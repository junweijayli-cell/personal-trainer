'use client';

import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type {
  AccountSnapshot,
  DailyLog,
  MemberAccount,
  Membership,
  Profile,
  ScheduleItem,
  WorkoutSession,
} from './account-types';
import { appUrl, backendConfigured, getSupabase, market } from './supabase-client';
import { getFocusOption, weeklyRotation } from './workout-data';

type EntitlementRow = {
  status: Membership['status'];
  plan: Membership['plan'];
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  server_now: string;
  has_access: boolean;
};

const defaultProfile: Profile = {
  goal: 'Build strength',
  level: 'Beginner',
  daysPerWeek: 5,
  sessionMinutes: 24,
  hydrationTargetMl: 2500,
  sleepTargetHours: 8,
  injuries: '',
  reminderTime: '18:00',
  consentHealthData: false,
  equipment: [],
  preferredFocus: [],
};

function dateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function defaultSchedule(): ScheduleItem[] {
  return [1, 2, 3, 4, 6].map((weekday) => ({
    id: '',
    weekday,
    workoutName: `${getFocusOption(weeklyRotation[weekday]).shortLabel} Day 01`,
    startTime: '18:00',
    durationMinutes: 24,
    enabled: true,
  }));
}

function defaultLog(): DailyLog {
  return { logDate: dateKey(), waterMl: 0, meals: 'Balanced', sleepHours: 0, energy: 3, weightKg: null, notes: '' };
}

function metadataName(user: User) {
  return String(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Relay member');
}

export function isSecureBackendConfigured() {
  return backendConfigured;
}

export async function signUpAccount(input: {
  email: string;
  password: string;
  displayName: string;
  locale: 'en' | 'zh';
  captchaToken?: string;
}) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      captchaToken: input.captchaToken,
      emailRedirectTo: appUrl(),
      data: {
        display_name: input.displayName.trim().slice(0, 100),
        locale: input.locale,
        market,
        terms_accepted_at: new Date().toISOString(),
      },
    },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Relay could not create the account.');
  return data.user;
}

export async function verifySignup(email: string, token: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: 'email',
  });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error('The verification succeeded but no session was created.');
  const { error: initializeError } = await supabase.rpc('initialize_verified_account');
  if (initializeError) throw new Error(initializeError.message);
  return loadMember(data.session);
}

export async function resendSignupCode(email: string, captchaToken?: string) {
  const { error } = await getSupabase().auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { captchaToken, emailRedirectTo: appUrl() },
  });
  if (error) throw new Error(error.message);
}

export async function signInAccount(email: string, password: string, captchaToken?: string) {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
    options: { captchaToken },
  });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error('Relay could not start your session.');
  return loadMember(data.session);
}

export async function requestPasswordReset(email: string, captchaToken?: string) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    captchaToken,
    redirectTo: `${appUrl()}?reset=1`,
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(password: string) {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function signOutAccount() {
  if (!backendConfigured) return;
  const { error } = await getSupabase().auth.signOut();
  if (error) throw new Error(error.message);
}

export function observeAuth(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  if (!backendConfigured) return () => undefined;
  const { data } = getSupabase().auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export async function getActiveSession() {
  if (!backendConfigured) return null;
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw new Error(error.message);
  return data.session;
}

export async function loadMember(session?: Session): Promise<MemberAccount> {
  const supabase = getSupabase();
  const activeSession = session ?? (await getActiveSession());
  if (!activeSession) throw new Error('Your session has expired. Please sign in again.');
  const user = activeSession.user;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name, locale, market')
    .eq('user_id', user.id)
    .single();
  if (profileError) throw new Error(profileError.message);
  const { data: entitlement, error: entitlementError } = await supabase.rpc('get_my_entitlement');
  if (entitlementError) throw new Error(entitlementError.message);
  const row = (Array.isArray(entitlement) ? entitlement[0] : entitlement) as EntitlementRow | undefined;
  if (!row) throw new Error('Your membership is still being prepared. Please try again.');
  return {
    userId: user.id,
    email: user.email ?? '',
    displayName: String(profile.display_name || metadataName(user)),
    locale: profile.locale === 'zh' ? 'zh' : 'en',
    market: profile.market === 'cn' ? 'cn' : 'global',
    membership: {
      status: row.status,
      plan: row.plan,
      trialStartedAt: row.trial_started_at,
      trialEndsAt: row.trial_ends_at,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
      hasAccess: Boolean(row.has_access),
      serverNow: row.server_now,
    },
  };
}

export async function loadAccountSnapshot(member: MemberAccount): Promise<AccountSnapshot> {
  const supabase = getSupabase();
  const today = dateKey();
  const [preferenceResult, sessionsResult, logResult, scheduleResult] = await Promise.all([
    supabase.from('training_preferences').select('*').eq('user_id', member.userId).single(),
    supabase.from('workout_sessions').select('*').eq('user_id', member.userId).order('completed_at', { ascending: false }).limit(60),
    supabase.from('wellness_logs').select('*').eq('user_id', member.userId).eq('log_date', today).maybeSingle(),
    supabase.from('scheduled_workouts').select('*').eq('user_id', member.userId).order('weekday'),
  ]);
  if (preferenceResult.error) throw new Error(preferenceResult.error.message);
  if (sessionsResult.error) throw new Error(sessionsResult.error.message);
  if (logResult.error) throw new Error(logResult.error.message);
  if (scheduleResult.error) throw new Error(scheduleResult.error.message);
  const preference = preferenceResult.data;
  const profile: Profile = {
    goal: String(preference.goal ?? defaultProfile.goal),
    level: String(preference.level ?? defaultProfile.level),
    daysPerWeek: Number(preference.days_per_week ?? defaultProfile.daysPerWeek),
    sessionMinutes: Number(preference.session_minutes ?? defaultProfile.sessionMinutes),
    hydrationTargetMl: Number(preference.hydration_target_ml ?? defaultProfile.hydrationTargetMl),
    sleepTargetHours: Number(preference.sleep_target_hours ?? defaultProfile.sleepTargetHours),
    injuries: String(preference.limitations ?? ''),
    reminderTime: String(preference.reminder_time ?? defaultProfile.reminderTime),
    consentHealthData: Boolean(preference.consent_health_data),
    equipment: Array.isArray(preference.equipment) ? preference.equipment.map(String) : [],
    preferredFocus: Array.isArray(preference.preferred_focus) ? preference.preferred_focus.map(String) : [],
  };
  const sessions: WorkoutSession[] = (sessionsResult.data ?? []).map((row) => ({
    id: String(row.id),
    workoutName: String(row.workout_name),
    completedAt: String(row.completed_at),
    durationSeconds: Number(row.duration_seconds),
    setsCompleted: Number(row.sets_completed),
    movementsCompleted: Number(row.movements_completed),
    cameraSets: Number(row.camera_sets),
  }));
  const log = logResult.data;
  const todayLog: DailyLog = log ? {
    logDate: String(log.log_date),
    waterMl: Number(log.water_ml),
    meals: String(log.meals),
    sleepHours: Number(log.sleep_hours),
    energy: Number(log.energy),
    weightKg: log.weight_kg === null ? null : Number(log.weight_kg),
    notes: String(log.notes ?? ''),
  } : defaultLog();
  const schedule: ScheduleItem[] = (scheduleResult.data ?? []).map((row) => ({
    id: String(row.id),
    weekday: Number(row.weekday),
    workoutName: String(row.workout_name),
    startTime: String(row.start_time),
    durationMinutes: Number(row.duration_minutes),
    enabled: Boolean(row.enabled),
  }));
  return {
    user: { userId: member.userId, displayName: member.displayName, email: member.email },
    profile,
    sessions,
    todayLog,
    schedule: schedule.length ? schedule : defaultSchedule(),
  };
}

export async function saveWorkout(member: MemberAccount, input: {
  workoutId: string;
  workoutName: string;
  durationSeconds: number;
  setsCompleted: number;
  movementsCompleted: number;
  cameraSets: number;
  notes?: string;
}) {
  const { error } = await getSupabase().from('workout_sessions').insert({
    user_id: member.userId,
    workout_id: input.workoutId,
    workout_name: input.workoutName,
    completed_at: new Date().toISOString(),
    duration_seconds: input.durationSeconds,
    sets_completed: input.setsCompleted,
    movements_completed: input.movementsCompleted,
    camera_sets: input.cameraSets,
    notes: input.notes ?? '',
  });
  if (error) throw new Error(error.message);
}

export async function saveWellnessLog(member: MemberAccount, input: DailyLog) {
  const { error } = await getSupabase().from('wellness_logs').upsert({
    user_id: member.userId,
    log_date: input.logDate,
    water_ml: input.waterMl,
    meals: input.meals,
    sleep_hours: input.sleepHours,
    energy: input.energy,
    weight_kg: input.weightKg,
    notes: input.notes,
  }, { onConflict: 'user_id,log_date' });
  if (error) throw new Error(error.message);
}

export async function saveTrainingProfile(member: MemberAccount, input: Profile) {
  const { error } = await getSupabase().from('training_preferences').update({
    goal: input.goal,
    level: input.level,
    days_per_week: input.daysPerWeek,
    session_minutes: input.sessionMinutes,
    hydration_target_ml: input.hydrationTargetMl,
    sleep_target_hours: input.sleepTargetHours,
    limitations: input.injuries,
    reminder_time: input.reminderTime,
    consent_health_data: input.consentHealthData,
    equipment: input.equipment ?? [],
    preferred_focus: input.preferredFocus ?? [],
  }).eq('user_id', member.userId);
  if (error) throw new Error(error.message);
}

export async function saveTrainingSchedule(member: MemberAccount, items: ScheduleItem[]) {
  const rows = items.map((item) => ({
    user_id: member.userId,
    weekday: item.weekday,
    workout_name: item.workoutName,
    start_time: item.startTime,
    duration_minutes: item.durationMinutes,
    enabled: item.enabled,
  }));
  const { error } = await getSupabase().from('scheduled_workouts').upsert(rows, { onConflict: 'user_id,weekday' });
  if (error) throw new Error(error.message);
}

async function invokeBillingFunction(name: string, body?: Record<string, unknown>) {
  const { data, error } = await getSupabase().functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  const url = String((data as { url?: string } | null)?.url ?? '');
  if (!url) throw new Error('The billing service did not return a secure checkout link.');
  return url;
}

export async function createCheckout(plan: 'monthly' | 'annual') {
  return invokeBillingFunction('create-checkout-session', { plan });
}

export async function createCustomerPortal() {
  return invokeBillingFunction('create-customer-portal-session');
}

export async function deleteAccount() {
  const { error } = await getSupabase().functions.invoke('delete-account', { body: {} });
  if (error) throw new Error(error.message);
}

export function readLegacySnapshot(email: string): AccountSnapshot | null {
  try {
    const raw = window.localStorage.getItem(`relay-demo-snapshot:${email.trim().toLowerCase()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccountSnapshot;
    return parsed && Array.isArray(parsed.sessions) && Array.isArray(parsed.schedule) ? parsed : null;
  } catch {
    return null;
  }
}

export async function importLegacySnapshot(member: MemberAccount, snapshot: AccountSnapshot) {
  const importedProfile = {
    ...snapshot.profile,
    consentHealthData: Boolean(snapshot.profile.consentHealthData),
    equipment: snapshot.profile.equipment ?? [],
    preferredFocus: snapshot.profile.preferredFocus ?? [],
  };
  await saveTrainingProfile(member, importedProfile);
  await saveTrainingSchedule(member, snapshot.schedule);
  if (snapshot.todayLog && importedProfile.consentHealthData) await saveWellnessLog(member, snapshot.todayLog);
  if (snapshot.sessions.length) {
    const { error } = await getSupabase().from('workout_sessions').insert(snapshot.sessions.slice(0, 60).map((session) => ({
      user_id: member.userId,
      workout_id: 'legacy-import',
      workout_name: session.workoutName,
      completed_at: session.completedAt,
      duration_seconds: session.durationSeconds,
      sets_completed: session.setsCompleted,
      movements_completed: session.movementsCompleted,
      camera_sets: session.cameraSets,
      notes: 'Imported from the previous device-only Relay demo.',
    })));
    if (error) throw new Error(error.message);
  }
  window.localStorage.removeItem(`relay-demo-snapshot:${member.email.trim().toLowerCase()}`);
}

export function downloadAccountExport(member: MemberAccount, snapshot: AccountSnapshot) {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), member, snapshot }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `relay-account-${dateKey()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
