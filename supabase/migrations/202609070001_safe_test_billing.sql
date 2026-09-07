-- Forward-only billing changes. Test entitlements cannot become live entitlements.
alter table public.memberships add column billing_mode text check (billing_mode in ('test', 'live'));
create table public.billing_runtime (
  singleton boolean primary key default true check (singleton),
  mode text not null default 'test' check (mode in ('test', 'live')),
  checkout_enabled boolean not null default false
);
insert into public.billing_runtime default values;
-- Selected operator accounts can validate checkout while it remains closed publicly.
create table public.billing_test_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.billing_test_users enable row level security;
revoke all on public.billing_test_users from anon, authenticated;
grant all on public.billing_test_users to service_role;
create table public.billing_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null,
  expires_at timestamptz not null
);
create table public.billing_checkout_operations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  operation jsonb not null
);
alter table public.billing_runtime enable row level security;
alter table public.billing_locks enable row level security;
alter table public.billing_checkout_operations enable row level security;
revoke all on public.billing_runtime, public.billing_locks, public.billing_checkout_operations from anon, authenticated;
grant all on public.billing_runtime, public.billing_locks, public.billing_checkout_operations to service_role;

create function public.claim_billing_lock(p_user uuid, p_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare acquired uuid;
begin
  insert into public.billing_locks(user_id, token, expires_at)
    values(p_user, p_token, clock_timestamp() + interval '120 seconds')
    on conflict (user_id) do update set token = excluded.token, expires_at = excluded.expires_at
    where public.billing_locks.expires_at < clock_timestamp()
    returning token into acquired;
  return acquired is not null;
end;
$$;
create function public.release_billing_lock(p_user uuid, p_token uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.billing_locks where user_id = p_user and token = p_token;
$$;

create function public.renew_billing_lock(p_user uuid, p_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.billing_locks set expires_at = clock_timestamp() + interval '120 seconds'
    where user_id = p_user and token = p_token and expires_at > clock_timestamp();
  return found;
end;
$$;

-- Every write checks ownership under a row lock: an expired worker cannot commit
-- after another request takes over. Event receipt, state and audit commit together.
create function public.apply_billing_state(
  p_user uuid, p_token uuid, p_patch jsonb default '{}'::jsonb,
  p_operation jsonb default null, p_event jsonb default null
) returns void language plpgsql security definer set search_path = '' as $$
declare before_row public.memberships; after_row public.memberships;
begin
  perform 1 from public.billing_locks where user_id = p_user and token = p_token
    and expires_at > clock_timestamp() for update;
  if not found then raise exception 'Billing lock expired'; end if;
  if p_event is not null and exists(select 1 from public.billing_events
      where stripe_event_id = p_event->>'id' and status = 'processed') then return; end if;
  select * into strict before_row from public.memberships where user_id = p_user for update;
  select * into after_row from jsonb_populate_record(before_row, p_patch);
  update public.memberships set
    status = after_row.status, plan = after_row.plan,
    current_period_start = after_row.current_period_start, current_period_end = after_row.current_period_end,
    cancel_at_period_end = after_row.cancel_at_period_end,
    stripe_customer_id = after_row.stripe_customer_id, stripe_subscription_id = after_row.stripe_subscription_id,
    stripe_price_id = after_row.stripe_price_id, billing_mode = after_row.billing_mode
    where user_id = p_user;
  if p_operation is not null then
    insert into public.billing_checkout_operations(user_id, operation) values(p_user, p_operation)
      on conflict(user_id) do update set operation = excluded.operation;
  end if;
  if p_event is not null then
    if (p_event->>'livemode')::boolean then raise exception 'Live events disabled'; end if;
    insert into public.billing_events(stripe_event_id, event_type, livemode, status, processed_at)
      values(p_event->>'id', p_event->>'type', false, 'processed', now())
      on conflict(stripe_event_id) do update set status='processed', processed_at=now(),
        attempts=public.billing_events.attempts+1, error_message=null;
    insert into public.billing_audit_log(user_id, stripe_event_id, action, previous_state, next_state)
      values(p_user, p_event->>'id', p_event->>'type', to_jsonb(before_row), to_jsonb(after_row));
  end if;
end;
$$;
revoke all on function public.claim_billing_lock(uuid,uuid), public.release_billing_lock(uuid,uuid), public.renew_billing_lock(uuid,uuid),
  public.apply_billing_state(uuid,uuid,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.claim_billing_lock(uuid,uuid), public.release_billing_lock(uuid,uuid), public.renew_billing_lock(uuid,uuid),
  public.apply_billing_state(uuid,uuid,jsonb,jsonb,jsonb) to service_role;

create or replace function public.current_user_has_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m where m.user_id = auth.uid() and (
    (m.status='trial' and m.trial_ends_at > now()) or
    (m.status='active' and m.plan in ('monthly','annual') and m.current_period_end > now()
      and m.billing_mode = (select mode from public.billing_runtime where singleton))
  ));
$$;
drop function public.get_my_entitlement();
create function public.get_my_entitlement()
returns table(status text, plan text, trial_started_at timestamptz, trial_ends_at timestamptz,
  current_period_end timestamptz, cancel_at_period_end boolean, server_now timestamptz,
  has_access boolean, billing_mode text, billing_enabled boolean)
language sql stable security definer set search_path = '' as $$
  select m.status,m.plan,m.trial_started_at,m.trial_ends_at,m.current_period_end,
    m.cancel_at_period_end,now(),public.current_user_has_access(),m.billing_mode,
    (select checkout_enabled and mode='test' from public.billing_runtime where singleton)
    from public.memberships m where m.user_id=auth.uid();
$$;
revoke all on function public.get_my_entitlement() from public;
grant execute on function public.get_my_entitlement() to authenticated;
