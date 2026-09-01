import type { AccountSnapshot } from './account-types';
import { getFocusOption, weeklyRotation } from './workout-data';

export type BillingPlan = 'trial' | 'monthly' | 'annual';

export type DemoMember = {
  email: string;
  displayName: string;
  passwordDigest: string;
  verifiedAt: string;
  trialStartedAt: string;
  billingPlan: BillingPlan;
};

const ACCOUNT_PREFIX = 'relay-demo-account:';
const SNAPSHOT_PREFIX = 'relay-demo-snapshot:';
const SESSION_KEY = 'relay-demo-session';
export const TRIAL_DAYS = 7;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function accountKey(email: string) {
  return `${ACCOUNT_PREFIX}${normalizeEmail(email)}`;
}

function snapshotKey(email: string) {
  return `${SNAPSHOT_PREFIX}${normalizeEmail(email)}`;
}

async function digestPassword(password: string) {
  const bytes = new TextEncoder().encode(`relay-demo-v1:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateVerificationCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(100000 + values[0] % 900000);
}

export function getStoredMember(email: string): DemoMember | null {
  try {
    const raw = window.localStorage.getItem(accountKey(email));
    return raw ? JSON.parse(raw) as DemoMember : null;
  } catch {
    return null;
  }
}

export function getActiveMember(): DemoMember | null {
  try {
    const email = window.localStorage.getItem(SESSION_KEY);
    return email ? getStoredMember(email) : null;
  } catch {
    return null;
  }
}

export async function createDemoMember(email: string, password: string, displayName: string): Promise<DemoMember> {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date().toISOString();
  const member: DemoMember = {
    email: normalizedEmail,
    displayName: displayName.trim() || normalizedEmail.split('@')[0],
    passwordDigest: await digestPassword(password),
    verifiedAt: now,
    trialStartedAt: now,
    billingPlan: 'trial',
  };
  window.localStorage.setItem(accountKey(normalizedEmail), JSON.stringify(member));
  window.localStorage.setItem(SESSION_KEY, normalizedEmail);
  return member;
}

export async function signInDemoMember(email: string, password: string): Promise<DemoMember | null> {
  const member = getStoredMember(email);
  if (!member || member.passwordDigest !== await digestPassword(password)) return null;
  window.localStorage.setItem(SESSION_KEY, member.email);
  return member;
}

export function signOutDemoMember() {
  window.localStorage.removeItem(SESSION_KEY);
}

export function updateDemoBilling(member: DemoMember, billingPlan: BillingPlan): DemoMember {
  const updated = { ...member, billingPlan };
  window.localStorage.setItem(accountKey(member.email), JSON.stringify(updated));
  return updated;
}

export function trialEndsAt(member: DemoMember) {
  return new Date(new Date(member.trialStartedAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

export function trialDaysRemaining(member: DemoMember, now = new Date()) {
  if (member.billingPlan !== 'trial') return null;
  const remaining = trialEndsAt(member).getTime() - now.getTime();
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

export function hasProductAccess(member: DemoMember, now = new Date()) {
  return member.billingPlan !== 'trial' || trialEndsAt(member).getTime() > now.getTime();
}

export function createDefaultSnapshot(member: DemoMember): AccountSnapshot {
  const schedule = [1, 2, 3, 4, 6].map((weekday) => ({
    id: `demo-${weekday}`,
    weekday,
    workoutName: `${getFocusOption(weeklyRotation[weekday]).shortLabel} Day 01`,
    startTime: '18:00',
    durationMinutes: 24,
    enabled: true,
  }));
  return {
    user: { userId: `demo-${member.email}`, displayName: member.displayName, email: member.email },
    profile: {
      goal: 'Build strength', level: 'Beginner', daysPerWeek: 5, sessionMinutes: 24,
      hydrationTargetMl: 2500, sleepTargetHours: 8, injuries: '', reminderTime: '18:00',
    },
    sessions: [],
    todayLog: {
      logDate: new Date().toISOString().slice(0, 10), waterMl: 0, meals: 'Balanced',
      sleepHours: 0, energy: 3, weightKg: null, notes: '',
    },
    schedule,
  };
}

export function loadDemoSnapshot(member: DemoMember): AccountSnapshot {
  try {
    const raw = window.localStorage.getItem(snapshotKey(member.email));
    return raw ? JSON.parse(raw) as AccountSnapshot : createDefaultSnapshot(member);
  } catch {
    return createDefaultSnapshot(member);
  }
}

export function saveDemoSnapshot(email: string, snapshot: AccountSnapshot) {
  window.localStorage.setItem(snapshotKey(email), JSON.stringify(snapshot));
}
