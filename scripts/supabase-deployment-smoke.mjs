/**
 * Opt-in, low-volume deployment check. Admin-created .invalid accounts receive no email.
 * Supply `supabase projects api-keys --project-ref ... --output json` on stdin;
 * NEVER place keys in arguments, commit them, or print the input. This is not a load test.
 * Only accounts created by this invocation are mutated/deleted, including in finally.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const PROJECT_REF = 'yvcdlrnjhhafywawuknj';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
class SafeSmokeError extends Error {}

export function parseArguments(args) {
  if (args.length !== 3 || args[0] !== '--project-ref' || args[1] !== PROJECT_REF || args[2] !== '--allow-test-accounts') {
    throw new Error('Require --project-ref yvcdlrnjhhafywawuknj --allow-test-accounts. No other target is permitted.');
  }
  return `https://${PROJECT_REF}.supabase.co`;
}

export function parseKeys(input) {
  let parsed;
  try { parsed = JSON.parse(input.replace(/^\uFEFF/, '')); }
  catch { throw new Error('Input must be the CLI API-key JSON; its content was not printed.'); }
  const rows = Array.isArray(parsed) ? parsed : parsed?.keys;
  if (!Array.isArray(rows)) throw new Error('Expected the CLI API-key array.');
  const find = (name) => rows.find((row) => row.name === name || row.id === name)?.api_key;
  const anon = find('anon');
  const service = find('service_role');
  if (typeof anon !== 'string' || typeof service !== 'string' || anon.length < 20 || service.length < 20 || anon === service) {
    throw new Error('Both distinct anon and service_role API keys are required.');
  }
  // Legacy JWT keys contain their project reference. Reject mismatched credentials before requests.
  for (const key of [anon, service]) {
    if (key.split('.').length === 3) {
      let claims;
      try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); }
      catch { throw new Error('Malformed legacy API key.'); }
      if (claims.ref !== PROJECT_REF) throw new Error('API keys do not belong to the explicitly allowed project.');
    }
  }
  return { anon, service };
}

function demand(condition, message) {
  if (!condition) throw new SafeSmokeError(message);
}

function requireData(result, label) {
  // Never forward remote error messages: they could contain request data or credentials.
  if (result.error) {
    const code = String(result.error.code || result.error.status || 'unspecified');
    throw new SafeSmokeError(`${label} failed (code ${/^[a-zA-Z0-9_]{1,64}$/.test(code) ? code : 'redacted'}).`);
  }
  return result.data;
}

async function main() {
  const url = parseArguments(process.argv.slice(2));
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 200_000) throw new Error('API-key input exceeds the permitted size.');
  }
  const { anon, service } = parseKeys(input);
  input = '';
  const runTag = `relay-smoke-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const created = new Map();
  const report = {
    project: PROJECT_REF,
    runTag,
    type: 'low-volume API smoke test, not load test or browser E2E',
    emailDeliveryTested: false,
    otpDeliveryTested: false,
    paymentsTested: false,
    checks: [],
  };
  let requestCount = 0;
  let cleaningUp = false;
  const started = Date.now();
  const controlledFetch = async (resource, options = {}) => {
    const destination = new URL(typeof resource === 'string' ? resource : resource.url || resource.href);
    if (destination.origin !== url || destination.username || destination.password) throw new SafeSmokeError('Unexpected API destination blocked.');
    requestCount += 1;
    if ((!cleaningUp && requestCount > 48) || requestCount > 56) throw new SafeSmokeError('Safety request budget reached.');
    if (!cleaningUp && Date.now() - started > 120_000) throw new SafeSmokeError('Smoke-test time budget reached.');
    const deadline = AbortSignal.timeout(12_000);
    const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
    return fetch(resource, { ...options, signal });
  };
  const client = (key) => createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: controlledFetch },
  });
  const admin = client(service);
  const alice = client(anon);
  const secondDevice = client(anon);
  const bob = client(anon);
  const anonymous = client(anon);
  const pass = (name) => { report.checks.push({ name, result: 'PASS' }); };
  let currentCheck = 'Create disposable test accounts';
  let failed = false;

  const makeAccount = async (suffix, confirmed) => {
    const email = `${runTag}-${suffix}@example.invalid`;
    const password = `aA9!${randomBytes(32).toString('base64url')}`;
    const result = await admin.auth.admin.createUser({
      email, password, email_confirm: confirmed,
      user_metadata: { display_name: 'Disposable deployment test', locale: 'en', market: 'global', timezone: 'Asia/Shanghai' },
      app_metadata: { relay_smoke_run: runTag },
    });
    const data = requireData(result, 'Create disposable account');
    demand(data.user?.id && data.user.email === email, 'Create-account response did not match the disposable identity.');
    created.set(data.user.id, email);
    return { id: data.user.id, email, password };
  };

  try {
    const a = await makeAccount('a', false);
    const b = await makeAccount('b', true);
    pass(currentCheck);

    currentCheck = 'Unverified account has no trial and cannot sign in';
    const pending = requireData(await admin.from('memberships').select('status,trial_started_at,trial_ends_at').eq('user_id', a.id).single(), currentCheck);
    demand(pending.status === 'pending_verification' && pending.trial_started_at === null && pending.trial_ends_at === null, 'Unverified account already has trial access.');
    const unverifiedLogin = await alice.auth.signInWithPassword({ email: a.email, password: a.password });
    demand(unverifiedLogin.error?.code === 'email_not_confirmed' && !unverifiedLogin.data.session, 'Unverified email was not rejected as expected.');
    pass(currentCheck);

    currentCheck = 'Verification starts exactly seven server-calculated days';
    requireData(await admin.auth.admin.updateUserById(a.id, { email_confirm: true }), 'Admin confirmation (no inbox delivery)');
    const login = requireData(await alice.auth.signInWithPassword({ email: a.email, password: a.password }), 'Verified sign-in');
    demand(login.session?.access_token && login.user?.id === a.id, 'Sign-in did not establish the expected session.');
    const first = requireData(await alice.rpc('get_my_entitlement'), currentCheck)?.[0];
    demand(first?.status === 'trial' && first.has_access, 'Verified account does not have trial access.');
    demand(Date.parse(first.trial_ends_at) - Date.parse(first.trial_started_at) === SEVEN_DAYS, 'Trial does not last exactly seven days.');
    demand(Date.parse(first.server_now) >= Date.parse(first.trial_started_at), 'Trial start is not before server time.');
    pass(currentCheck);

    currentCheck = 'Fresh device and account initialization do not restart the trial';
    requireData(await alice.rpc('initialize_verified_account'), currentCheck);
    requireData(await secondDevice.auth.signInWithPassword({ email: a.email, password: a.password }), 'Second-device sign-in');
    const second = requireData(await secondDevice.rpc('get_my_entitlement'), currentCheck)?.[0];
    demand(second?.trial_started_at === first.trial_started_at && second.trial_ends_at === first.trial_ends_at, 'Session recovery changed trial dates.');
    pass(currentCheck);

    currentCheck = 'Profile, equipment, weekly schedule, plan and workout data save';
    const profile = requireData(await alice.from('profiles').update({ display_name: 'Smoke Coach', locale: 'zh', timezone: 'Asia/Shanghai', onboarding_completed: true }).eq('user_id', a.id).select().single(), 'Save profile');
    demand(profile.display_name === 'Smoke Coach' && profile.locale === 'zh', 'Profile update was not persisted.');
    requireData(await alice.from('training_preferences').update({ equipment: ['dumbbells'], preferred_focus: ['back', 'chest'], days_per_week: 3 }).eq('user_id', a.id), 'Save preferences');
    requireData(await alice.from('scheduled_workouts').update({ workout_name: 'Smoke back day', timezone: 'Asia/Shanghai' }).eq('user_id', a.id).eq('weekday', 3), 'Save schedule');
    requireData(await alice.from('training_plans').insert({ user_id: a.id, name: 'Smoke weekly plan', focus: 'back', equipment: ['dumbbells'] }), 'Save plan');
    const workoutPayload = { user_id: a.id, workout_id: 'smoke-test', workout_name: 'Smoke workout', duration_seconds: 300, sets_completed: 1, movements_completed: 1 };
    const workout = requireData(await alice.from('workout_sessions').insert(workoutPayload).select('id').single(), 'Save workout');
    requireData(await alice.from('exercise_logs').insert({ user_id: a.id, workout_session_id: workout.id, exercise_id: 'squat', set_number: 1, reps: 10, form_feedback: 'Synthetic test data' }), 'Save exercise log');
    requireData(await alice.from('reminders').insert({ user_id: a.id, kind: 'workout', local_time: '18:00', timezone: 'Asia/Shanghai', weekdays: [1, 3, 5], channel: 'in_app' }), 'Save reminder');
    pass(currentCheck);

    currentCheck = 'Health-data consent is required before wellness data can be saved';
    const wellnessPayload = { user_id: a.id, log_date: first.server_now.slice(0, 10), water_ml: 750, sleep_hours: 7.5, energy: 4, notes: 'Synthetic test data' };
    const withoutConsent = await alice.from('wellness_logs').insert(wellnessPayload);
    demand(withoutConsent.error?.code === '42501', 'Wellness write without consent was not rejected by database security.');
    const consent = requireData(await alice.from('training_preferences').update({ consent_health_data: true }).eq('user_id', a.id).select('consent_health_data_at').single(), 'Record health consent');
    demand(consent.consent_health_data_at, 'Server did not timestamp consent.');
    requireData(await alice.from('wellness_logs').insert(wellnessPayload), 'Save wellness data with consent');
    pass(currentCheck);

    currentCheck = 'Independent second device reads saved product data';
    for (const [table, expected] of [
      ['training_preferences', (rows) => rows.length === 1 && rows[0].equipment.includes('dumbbells')],
      ['scheduled_workouts', (rows) => rows.some((row) => row.weekday === 3 && row.workout_name === 'Smoke back day')],
      ['training_plans', (rows) => rows.some((row) => row.name === 'Smoke weekly plan')],
      ['workout_sessions', (rows) => rows.some((row) => row.id === workout.id)],
      ['exercise_logs', (rows) => rows.some((row) => row.workout_session_id === workout.id && row.reps === 10)],
      ['wellness_logs', (rows) => rows.some((row) => row.water_ml === 750)],
    ]) {
      const rows = requireData(await secondDevice.from(table).select('*').eq('user_id', a.id), `Second-device ${table} read`);
      demand(expected(rows), `Second-device ${table} data mismatch.`);
    }
    pass(currentCheck);

    currentCheck = 'Another account cannot read private profile, health, workout or membership rows';
    requireData(await bob.auth.signInWithPassword({ email: b.email, password: b.password }), 'Other-account sign-in');
    for (const table of ['profiles', 'wellness_logs', 'workout_sessions', 'memberships']) {
      const rows = requireData(await bob.from(table).select('*').eq('user_id', a.id), `Cross-account ${table} read`);
      demand(rows.length === 0, `Cross-account ${table} data leaked.`);
    }
    pass(currentCheck);

    currentCheck = 'Another account cannot modify a profile or forge workouts';
    const crossUpdate = requireData(await bob.from('profiles').update({ display_name: 'Forbidden' }).eq('user_id', a.id).select('user_id'), 'Cross-account profile update');
    demand(crossUpdate.length === 0, 'Cross-account profile update succeeded.');
    const crossWorkout = await bob.from('workout_sessions').insert(workoutPayload);
    demand(crossWorkout.error?.code === '42501', 'Cross-account workout insert was not rejected.');
    const crossExercise = await bob.from('exercise_logs').insert({ user_id: b.id, workout_session_id: workout.id, exercise_id: 'squat', set_number: 1, reps: 1 });
    demand(crossExercise.error?.code === '42501', 'A user attached an exercise to another user\'s workout.');
    pass(currentCheck);

    currentCheck = 'Browser credentials cannot grant paid membership';
    const billingChange = await alice.from('memberships').update({ status: 'active', plan: 'annual' }).eq('user_id', a.id);
    demand(billingChange.error?.code === '42501', 'Membership mutation was not rejected.');
    const anonymousRead = await anonymous.from('profiles').select('user_id').eq('user_id', a.id);
    demand(anonymousRead.error?.code === '42501', 'Unauthenticated profile read was not rejected.');
    pass(currentCheck);

    currentCheck = 'Server-side expiry blocks new workouts and retains history';
    demand(created.has(a.id), 'Expiry fixture does not belong to this test invocation.');
    requireData(await admin.from('memberships').update({ trial_ends_at: new Date(Date.parse(first.server_now) - 60_000).toISOString() }).eq('user_id', a.id), 'Expire this disposable trial');
    const expired = requireData(await alice.rpc('get_my_entitlement'), 'Read expired entitlement')?.[0];
    demand(expired && !expired.has_access, 'Expired trial still has access.');
    const blockedWorkout = await alice.from('workout_sessions').insert(workoutPayload);
    demand(blockedWorkout.error?.code === '42501', 'Expired account created a workout.');
    const history = requireData(await alice.from('workout_sessions').select('id').eq('id', workout.id), 'Read expired-account history');
    demand(history.length === 1, 'Expiry removed access to existing history.');
    pass(currentCheck);

    currentCheck = 'Deployed account-deletion function removes only the authenticated test account';
    const deletion = requireData(await alice.functions.invoke('delete-account', { body: {} }), 'Invoke deployed delete-account');
    demand(deletion?.deleted === true, 'Delete-account did not confirm deletion.');
    const removed = await admin.auth.admin.getUserById(a.id);
    demand(removed.error?.status === 404 || removed.error?.code === 'user_not_found', 'Deleted account remains in authentication.');
    const removedProfile = requireData(await admin.from('profiles').select('user_id').eq('user_id', a.id), 'Check account-data cascade');
    demand(removedProfile.length === 0, 'Deleted profile was retained.');
    created.delete(a.id);
    pass(currentCheck);
  } catch (error) {
    failed = true;
    // Only locally authored errors reach the report; redact all unknown failures.
    const message = error instanceof SafeSmokeError
      ? error.message : 'Request failed; raw error details suppressed to protect credentials.';
    report.checks.push({ name: currentCheck, result: 'FAIL', detail: message });
  } finally {
    cleaningUp = true;
    for (const [id, email] of created) {
      if (!email.startsWith(`${runTag}-`) || !email.endsWith('@example.invalid')) continue;
      try {
        const removal = await admin.auth.admin.deleteUser(id);
        if (removal.error && removal.error.status !== 404 && removal.error.code !== 'user_not_found') throw new Error('Cleanup failed');
        created.delete(id);
      } catch {
        failed = true;
      }
    }
    report.requests = requestCount;
    report.cleanup = created.size === 0 ? 'All disposable accounts removed' : 'MANUAL CLEANUP REQUIRED';
    if (created.size) report.cleanupAccountIds = [...created.keys()];
    report.result = failed ? 'FAIL' : 'PASS';
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = failed ? 1 : 0;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(() => {
    console.error('Smoke test did not start. Check the explicit target/opt-in flags and pipe valid CLI API-key JSON on stdin. No credentials were printed.');
    process.exitCode = 1;
  });
}
