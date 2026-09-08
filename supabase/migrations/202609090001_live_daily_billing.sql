-- Add daily access and mode-aware transactions without activating live checkout.
alter table public.memberships drop constraint memberships_plan_check;
alter table public.memberships add constraint memberships_plan_check check (plan in ('trial','daily','monthly','annual'));

-- Preserve all former demo billing links and unresolved operations on cutover.
create table public.billing_mode_archive (
  user_id uuid primary key references auth.users(id) on delete cascade,
  membership jsonb not null,
  operation jsonb,
  archived_at timestamptz not null default now()
);
alter table public.billing_mode_archive enable row level security;
revoke all on public.billing_mode_archive from public, anon, authenticated;
grant all on public.billing_mode_archive to service_role;

create or replace function public.apply_billing_state(
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
  if after_row.billing_mode is not null and after_row.billing_mode <> (select mode from public.billing_runtime where singleton) then
    raise exception 'Live/test billing mode mismatch';
  end if;
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
    if (p_event->>'livemode') is null or (p_event->>'livemode')::boolean <> ((select mode from public.billing_runtime where singleton) = 'live') then
      raise exception 'Live/test event mode mismatch';
    end if;
    insert into public.billing_events(stripe_event_id, event_type, livemode, status, processed_at)
      values(p_event->>'id', p_event->>'type', (p_event->>'livemode')::boolean, 'processed', now())
      on conflict(stripe_event_id) do update set status='processed', processed_at=now(),
        attempts=public.billing_events.attempts+1, error_message=null;
    insert into public.billing_audit_log(user_id, stripe_event_id, action, previous_state, next_state)
      values(p_user, p_event->>'id', p_event->>'type', to_jsonb(before_row), to_jsonb(after_row));
  end if;
end;
$$;
create or replace function public.current_user_has_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m where m.user_id = auth.uid() and (
    (m.status='trial' and m.trial_ends_at > now()) or
    (m.status='active' and m.plan in ('daily','monthly','annual') and m.current_period_end > now()
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
    (select checkout_enabled from public.billing_runtime where singleton)
    from public.memberships m where m.user_id=auth.uid();
$$;
revoke all on function public.get_my_entitlement() from public;
grant execute on function public.get_my_entitlement() to authenticated;

-- Operator-only atomic cutover. Trials retain their original dates; demo periods
-- are archived rather than promoted into real paid memberships.
create function public.activate_live_billing() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.billing_runtime where singleton and not checkout_enabled for update;
  if not found then raise exception 'Disable checkout before changing mode'; end if;
  if exists(select 1 from public.billing_locks where expires_at > clock_timestamp()) then
    raise exception 'Wait for in-flight billing operations';
  end if;
  if (select mode from public.billing_runtime where singleton) = 'live' then return; end if;
  insert into public.billing_mode_archive(user_id,membership,operation)
    select m.user_id,to_jsonb(m),o.operation from public.memberships m
    left join public.billing_checkout_operations o on o.user_id=m.user_id
    where m.billing_mode='test' or o.user_id is not null;
  delete from public.billing_checkout_operations where user_id in (select user_id from public.billing_mode_archive);
  update public.memberships set
    status=case when trial_ends_at > now() then 'trial' else 'expired' end,
    plan='trial',current_period_start=null,current_period_end=null,cancel_at_period_end=false,
    stripe_customer_id=null,stripe_subscription_id=null,stripe_price_id=null,billing_mode=null
    where billing_mode='test';
  update public.billing_runtime set mode='live',checkout_enabled=false where singleton;
end;
$$;
revoke all on function public.activate_live_billing() from public, anon, authenticated;
grant execute on function public.activate_live_billing() to service_role;
