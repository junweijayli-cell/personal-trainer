-- One-time access grants for customers paid outside Stripe.
create table public.promo_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Rollout control is kept in the database so code redemption can remain disabled
-- while the schema and functions are deployed and verified.
create table public.promo_runtime (
  singleton boolean primary key default true check (singleton),
  redemption_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.promo_runtime(singleton) values (true);

create table public.promo_code_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  plan text not null check (plan in ('monthly', 'annual')),
  market text not null default 'global' check (market = 'global'),
  label text not null default '' check (char_length(label) <= 120),
  quantity integer not null check (quantity between 1 and 500),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.promo_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  batch_id uuid not null references public.promo_code_batches(id) on delete restrict,
  code_digest text not null unique check (code_digest ~ '^[0-9a-f]{64}$'),
  code_suffix text not null check (code_suffix ~ '^[A-Z0-9]{4}$'),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index promo_codes_batch_idx on public.promo_codes(batch_id);

create table public.membership_grants (
  id uuid primary key default extensions.gen_random_uuid(),
  promo_code_id uuid not null unique references public.promo_codes(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'annual')),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  created_at timestamptz not null default now()
);
create index membership_grants_user_end_idx on public.membership_grants(user_id, ends_at desc);

alter table public.promo_operators enable row level security;
alter table public.promo_runtime enable row level security;
alter table public.promo_code_batches enable row level security;
alter table public.promo_codes enable row level security;
alter table public.membership_grants enable row level security;
revoke all on public.promo_operators, public.promo_code_batches, public.promo_codes from public, anon, authenticated;
revoke all on public.promo_runtime from public, anon, authenticated;
revoke all on public.membership_grants from public, anon, authenticated;
grant select on public.membership_grants to authenticated;
create policy membership_grants_select_own on public.membership_grants for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.current_user_has_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m where m.user_id = auth.uid() and (
    (m.status='trial' and m.trial_ends_at > now()) or
    (m.status='active' and m.plan in ('daily','monthly','annual') and m.current_period_end > now()
      and m.billing_mode = (select mode from public.billing_runtime where singleton))
  )) or exists(
    select 1 from public.membership_grants g where g.user_id = auth.uid() and g.ends_at > now()
  );
$$;

drop function public.get_my_entitlement();
create function public.get_my_entitlement()
returns table(status text, plan text, trial_started_at timestamptz, trial_ends_at timestamptz,
  current_period_end timestamptz, cancel_at_period_end boolean, server_now timestamptz,
  has_access boolean, billing_mode text, billing_enabled boolean, access_source text)
language sql stable security definer set search_path = '' as $$
  with base as (
    select m.*, (select mode from public.billing_runtime where singleton) as runtime_mode,
      exists(select 1 from public.membership_grants g where g.user_id = m.user_id and g.ends_at > now()) as has_grant
    from public.memberships m where m.user_id = auth.uid()
  ), grants as (
    select g.plan, g.ends_at from public.membership_grants g
    where g.user_id = auth.uid() and g.ends_at > now()
    order by g.ends_at desc limit 1
  ), candidates as (
    select 'grant'::text as source, g.plan, g.ends_at, false as cancel_at_period_end from grants g
    union all
    select 'stripe', b.plan, b.current_period_end, b.cancel_at_period_end
      from base b where b.status = 'active' and b.current_period_end > now() and b.billing_mode = b.runtime_mode
    union all
    select 'trial', 'trial', b.trial_ends_at, false from base b where b.status = 'trial' and b.trial_ends_at > now()
  ), effective as (
    select c.* from candidates c order by c.ends_at desc, (c.source = 'stripe') desc limit 1
  )
  select case when e.source = 'trial' then 'trial' when e.source in ('grant','stripe') then 'active' else b.status end,
    coalesce(e.plan, b.plan), b.trial_started_at, b.trial_ends_at,
    case when e.source in ('grant','stripe') then e.ends_at else null end,
    coalesce(e.cancel_at_period_end, b.cancel_at_period_end), now(),
    (e.source is not null), b.billing_mode,
    (select checkout_enabled from public.billing_runtime where singleton),
    e.source
  from base b left join effective e on true;
$$;
revoke all on function public.get_my_entitlement() from public;
grant execute on function public.get_my_entitlement() to authenticated;

create or replace function public.redeem_promo_code(p_digest text)
returns table(grant_id uuid, plan text, starts_at timestamptz, ends_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  account auth.users%rowtype;
  member public.memberships%rowtype;
  code public.promo_codes%rowtype;
  batch public.promo_code_batches%rowtype;
  existing public.membership_grants%rowtype;
  start_time timestamptz;
  grant_row public.membership_grants%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not coalesce((select redemption_enabled from public.promo_runtime where singleton), false) then
    raise exception 'Access codes are not available yet.';
  end if;
  select * into account from auth.users where id = uid;
  if account.email_confirmed_at is null then raise exception 'Verify your email before redeeming an access code.'; end if;
  select * into member from public.memberships where user_id = uid for update;
  select c.* into code
    from public.promo_codes c where c.code_digest = lower(trim(p_digest)) for update;
  if code.id is not null then select * into batch from public.promo_code_batches where id = code.batch_id; end if;
  if code.id is null then raise exception 'This access code is invalid or unavailable.'; end if;
  if batch.market <> 'global' or batch.revoked_at is not null or batch.expires_at <= now() then
    raise exception 'This access code is invalid or unavailable.';
  end if;
  if code.redeemed_at is not null then
    select * into existing from public.membership_grants where promo_code_id = code.id;
    if existing.user_id = uid then return query select existing.id, existing.plan, existing.starts_at, existing.ends_at; return; end if;
    raise exception 'This access code is invalid or unavailable.';
  end if;
  if (select market from public.profiles where user_id = uid) <> 'global' then
    raise exception 'This access code is not available for this account.';
  end if;
  start_time := greatest(now(), coalesce(member.current_period_end, now()), coalesce((select max(g.ends_at) from public.membership_grants g where g.user_id = uid), now()));
  insert into public.membership_grants(promo_code_id, user_id, plan, starts_at, ends_at)
    values(code.id, uid, batch.plan, start_time,
      start_time + case when batch.plan = 'monthly' then interval '30 days' else interval '365 days' end)
    returning * into grant_row;
  update public.promo_codes set redeemed_at = now(), redeemed_by = uid where id = code.id;
  insert into public.billing_audit_log(user_id, action, previous_state, next_state)
    values(uid, 'promo_code.redeemed', jsonb_build_object('code_suffix', code.code_suffix),
      jsonb_build_object('grant_id', grant_row.id, 'plan', grant_row.plan, 'ends_at', grant_row.ends_at));
  return query select grant_row.id, grant_row.plan, grant_row.starts_at, grant_row.ends_at;
end;
$$;
revoke all on function public.redeem_promo_code(text) from public, anon, authenticated;
grant execute on function public.redeem_promo_code(text) to authenticated;
