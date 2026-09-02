create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(display_name) between 1 and 100),
  locale text not null default 'en' check (locale in ('en', 'zh')),
  market text not null default 'global' check (market in ('global', 'cn')),
  timezone text not null default 'UTC',
  onboarding_completed boolean not null default false,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal text not null default 'Build strength',
  level text not null default 'Beginner',
  days_per_week smallint not null default 5 check (days_per_week between 1 and 7),
  session_minutes smallint not null default 24 check (session_minutes between 10 and 180),
  hydration_target_ml integer not null default 2500 check (hydration_target_ml between 0 and 10000),
  sleep_target_hours numeric(3,1) not null default 8 check (sleep_target_hours between 0 and 16),
  limitations text not null default '' check (char_length(limitations) <= 1000),
  reminder_time time not null default '18:00',
  equipment text[] not null default '{}',
  preferred_focus text[] not null default '{}',
  consent_health_data boolean not null default false,
  consent_health_data_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending_verification' check (status in ('pending_verification', 'trial', 'active', 'past_due', 'expired', 'canceled')),
  plan text not null default 'trial' check (plan in ('trial', 'monthly', 'annual')),
  market text not null default 'global' check (market in ('global', 'cn')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  last_stripe_event_created bigint not null default 0,
  last_stripe_event_id text,
  updated_at timestamptz not null default now()
);

create table public.training_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  focus text not null,
  equipment text[] not null default '{}',
  active boolean not null default true,
  plan_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scheduled_workouts (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  workout_name text not null,
  start_time time not null default '18:00',
  duration_minutes smallint not null default 24 check (duration_minutes between 5 and 240),
  enabled boolean not null default true,
  timezone text not null default 'UTC',
  updated_at timestamptz not null default now(),
  unique (user_id, weekday)
);

create table public.workout_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id text not null,
  workout_name text not null,
  completed_at timestamptz not null default now(),
  duration_seconds integer not null check (duration_seconds between 1 and 86400),
  sets_completed smallint not null check (sets_completed between 0 and 500),
  movements_completed smallint not null check (movements_completed between 0 and 100),
  camera_sets smallint not null default 0 check (camera_sets between 0 and 500),
  form_score numeric(5,2),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create index workout_sessions_user_completed_idx on public.workout_sessions(user_id, completed_at desc);

create table public.exercise_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id text not null,
  set_number smallint not null check (set_number between 1 and 100),
  reps integer,
  duration_seconds integer,
  camera_used boolean not null default false,
  form_feedback text not null default '' check (char_length(form_feedback) <= 1000),
  created_at timestamptz not null default now()
);

create index exercise_logs_session_idx on public.exercise_logs(workout_session_id);

create table public.wellness_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  water_ml integer not null default 0 check (water_ml between 0 and 10000),
  meals text not null default 'Balanced' check (char_length(meals) <= 200),
  sleep_hours numeric(3,1) not null default 0 check (sleep_hours between 0 and 24),
  energy smallint not null default 3 check (energy between 1 and 5),
  weight_kg numeric(6,2),
  notes text not null default '' check (char_length(notes) <= 2000),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create table public.reminders (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('workout', 'hydration', 'trial', 'billing')),
  local_time time not null,
  timezone text not null,
  weekdays smallint[] not null default '{}',
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'push')),
  enabled boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_events (
  stripe_event_id text primary key,
  event_type text not null,
  livemode boolean not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed')),
  attempts integer not null default 1,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.billing_audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  stripe_event_id text,
  action text not null,
  previous_state jsonb,
  next_state jsonb,
  created_at timestamptz not null default now()
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.set_preferences_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.consent_health_data = true and (old.consent_health_data is distinct from true) then
    new.consent_health_data_at = now();
  end if;
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger training_preferences_updated_at before update on public.training_preferences for each row execute function private.set_preferences_updated_at();
create trigger memberships_updated_at before update on public.memberships for each row execute function private.set_updated_at();
create trigger training_plans_updated_at before update on public.training_plans for each row execute function private.set_updated_at();
create trigger scheduled_workouts_updated_at before update on public.scheduled_workouts for each row execute function private.set_updated_at();
create trigger wellness_logs_updated_at before update on public.wellness_logs for each row execute function private.set_updated_at();
create trigger reminders_updated_at before update on public.reminders for each row execute function private.set_updated_at();

create or replace function private.ensure_verified_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account auth.users%rowtype;
  selected_market text;
begin
  select * into account from auth.users where id = target_user_id;
  if account.id is null or account.email_confirmed_at is null then return; end if;

  selected_market := case when account.raw_user_meta_data ->> 'market' = 'cn' then 'cn' else 'global' end;

  insert into public.memberships (user_id, status, plan, market, trial_started_at, trial_ends_at)
  values (target_user_id, 'trial', 'trial', selected_market, now(), now() + interval '7 days')
  on conflict (user_id) do update set
    status = case when public.memberships.status = 'pending_verification' then 'trial' else public.memberships.status end,
    trial_started_at = coalesce(public.memberships.trial_started_at, now()),
    trial_ends_at = coalesce(public.memberships.trial_ends_at, now() + interval '7 days');

  insert into public.scheduled_workouts (user_id, weekday, workout_name, start_time, duration_minutes, enabled)
  values
    (target_user_id, 1, 'Legs Day 01', '18:00', 24, true),
    (target_user_id, 2, 'Chest Day 01', '18:00', 24, true),
    (target_user_id, 3, 'Back Day 01', '18:00', 24, true),
    (target_user_id, 4, 'Neck Day 01', '18:00', 24, true),
    (target_user_id, 6, 'Cardio Day 01', '18:00', 24, true)
  on conflict (user_id, weekday) do nothing;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_locale text;
  selected_market text;
begin
  selected_locale := case when new.raw_user_meta_data ->> 'locale' = 'zh' then 'zh' else 'en' end;
  selected_market := case when new.raw_user_meta_data ->> 'market' = 'cn' then 'cn' else 'global' end;

  insert into public.profiles (user_id, email, display_name, locale, market, timezone, terms_accepted_at)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'member'), '@', 1)),
    selected_locale,
    selected_market,
    coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), 'UTC'),
    nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz
  );

  insert into public.training_preferences (user_id) values (new.id);
  insert into public.memberships (user_id, status, plan, market) values (new.id, 'pending_verification', 'trial', selected_market);
  perform private.ensure_verified_account(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create or replace function private.handle_user_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform private.ensure_verified_account(new.id);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_verified after update of email_confirmed_at on auth.users for each row execute function private.handle_user_verified();

create or replace function public.initialize_verified_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform private.ensure_verified_account(auth.uid());
end;
$$;

create or replace function public.current_user_has_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and (
        (m.status = 'trial' and m.trial_ends_at > now())
        or (m.status = 'active' and coalesce(m.current_period_end, 'infinity'::timestamptz) > now())
      )
  );
$$;

create or replace function public.get_my_entitlement()
returns table (
  status text,
  plan text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  server_now timestamptz,
  has_access boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.status,
    m.plan,
    m.trial_started_at,
    m.trial_ends_at,
    m.current_period_end,
    m.cancel_at_period_end,
    now(),
    (
      (m.status = 'trial' and m.trial_ends_at > now())
      or (m.status = 'active' and coalesce(m.current_period_end, 'infinity'::timestamptz) > now())
    )
  from public.memberships m
  where m.user_id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.training_preferences enable row level security;
alter table public.memberships enable row level security;
alter table public.training_plans enable row level security;
alter table public.scheduled_workouts enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.wellness_logs enable row level security;
alter table public.reminders enable row level security;
alter table public.billing_events enable row level security;
alter table public.billing_audit_log enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, locale, timezone, onboarding_completed) on public.profiles to authenticated;
grant select, update on public.training_preferences to authenticated;
grant select on public.memberships to authenticated;
grant select, insert, update, delete on public.training_plans to authenticated;
grant select, insert, update, delete on public.scheduled_workouts to authenticated;
grant select, insert on public.workout_sessions to authenticated;
grant select, insert on public.exercise_logs to authenticated;
grant select, insert, update, delete on public.wellness_logs to authenticated;
grant select, insert, update, delete on public.reminders to authenticated;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy preferences_select_own on public.training_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy preferences_update_own on public.training_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy memberships_select_own on public.memberships for select to authenticated using ((select auth.uid()) = user_id);

create policy plans_select_own on public.training_plans for select to authenticated using ((select auth.uid()) = user_id);
create policy plans_insert_own_active on public.training_plans for insert to authenticated with check ((select auth.uid()) = user_id and public.current_user_has_access());
create policy plans_update_own_active on public.training_plans for update to authenticated using ((select auth.uid()) = user_id and public.current_user_has_access()) with check ((select auth.uid()) = user_id);
create policy plans_delete_own_active on public.training_plans for delete to authenticated using ((select auth.uid()) = user_id and public.current_user_has_access());

create policy schedules_select_own on public.scheduled_workouts for select to authenticated using ((select auth.uid()) = user_id);
create policy schedules_insert_own_active on public.scheduled_workouts for insert to authenticated with check ((select auth.uid()) = user_id and public.current_user_has_access());
create policy schedules_update_own_active on public.scheduled_workouts for update to authenticated using ((select auth.uid()) = user_id and public.current_user_has_access()) with check ((select auth.uid()) = user_id);
create policy schedules_delete_own_active on public.scheduled_workouts for delete to authenticated using ((select auth.uid()) = user_id and public.current_user_has_access());

create policy sessions_select_own on public.workout_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy sessions_insert_own_active on public.workout_sessions for insert to authenticated with check ((select auth.uid()) = user_id and public.current_user_has_access());
create policy exercise_logs_select_own on public.exercise_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy exercise_logs_insert_own_active on public.exercise_logs for insert to authenticated with check (
  (select auth.uid()) = user_id
  and public.current_user_has_access()
  and exists (
    select 1 from public.workout_sessions s
    where s.id = workout_session_id and s.user_id = auth.uid()
  )
);

create policy wellness_select_own on public.wellness_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy wellness_insert_own_active_consent on public.wellness_logs for insert to authenticated with check (
  (select auth.uid()) = user_id
  and public.current_user_has_access()
  and exists (select 1 from public.training_preferences p where p.user_id = auth.uid() and p.consent_health_data)
);
create policy wellness_update_own_active_consent on public.wellness_logs for update to authenticated using ((select auth.uid()) = user_id and public.current_user_has_access()) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.training_preferences p where p.user_id = auth.uid() and p.consent_health_data)
);
create policy wellness_delete_own on public.wellness_logs for delete to authenticated using ((select auth.uid()) = user_id);

create policy reminders_select_own on public.reminders for select to authenticated using ((select auth.uid()) = user_id);
create policy reminders_insert_own_active on public.reminders for insert to authenticated with check ((select auth.uid()) = user_id and public.current_user_has_access());
create policy reminders_update_own_active on public.reminders for update to authenticated using ((select auth.uid()) = user_id and public.current_user_has_access()) with check ((select auth.uid()) = user_id);
create policy reminders_delete_own on public.reminders for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on function public.current_user_has_access() from public;
grant execute on function public.current_user_has_access() to authenticated;
revoke all on function public.get_my_entitlement() from public;
grant execute on function public.get_my_entitlement() to authenticated;
revoke all on function public.initialize_verified_account() from public;
grant execute on function public.initialize_verified_account() to authenticated;

revoke all on schema private from public;
revoke all on all functions in schema private from public;
