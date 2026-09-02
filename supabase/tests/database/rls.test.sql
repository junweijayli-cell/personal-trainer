begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.memberships'::regclass), 'memberships has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.workout_sessions'::regclass), 'workout sessions has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.wellness_logs'::regclass), 'wellness logs has RLS');
select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anonymous visitors cannot read profiles');
select ok(not has_table_privilege('authenticated', 'public.memberships', 'update'), 'members cannot edit billing entitlements');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'one@example.com', crypt('Password123!', gen_salt('bf')), now(), '{}'::jsonb, '{"display_name":"One"}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'two@example.com', crypt('Password123!', gen_salt('bf')), now(), '{}'::jsonb, '{"display_name":"Two"}'::jsonb, now(), now());

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select is((select count(*)::integer from public.profiles), 1, 'a member sees only their own profile');
select is((select count(*)::integer from public.memberships), 1, 'a member sees only their own membership');
with changed as (
  update public.profiles
  set display_name = 'Cross-account edit'
  where user_id = '22222222-2222-4222-8222-222222222222'
  returning 1
)
select is((select count(*)::integer from changed), 0, 'a member cannot update another user profile');
select throws_ok(
  $$insert into public.workout_sessions (user_id, workout_id, workout_name, duration_seconds, sets_completed, movements_completed) values ('22222222-2222-4222-8222-222222222222', 'x', 'Other user', 10, 1, 1)$$,
  '42501',
  null,
  'a member cannot write another user workout'
);
select throws_ok(
  $$insert into public.wellness_logs (user_id, log_date) values ('11111111-1111-4111-8111-111111111111', current_date)$$,
  '42501',
  null,
  'wellness storage requires explicit consent'
);

reset role;
update public.training_preferences set consent_health_data = true where user_id = '11111111-1111-4111-8111-111111111111';
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select lives_ok(
  $$insert into public.wellness_logs (user_id, log_date) values ('11111111-1111-4111-8111-111111111111', current_date)$$,
  'consented member can save their wellness log'
);

reset role;
insert into public.wellness_logs (user_id, log_date) values ('22222222-2222-4222-8222-222222222222', current_date);
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select is((select count(*)::integer from public.wellness_logs), 1, 'a member cannot read another account wellness data');

select * from finish();
rollback;
