export type Profile = {
  goal: string;
  level: string;
  daysPerWeek: number;
  sessionMinutes: number;
  hydrationTargetMl: number;
  sleepTargetHours: number;
  injuries: string;
  reminderTime: string;
  consentHealthData: boolean;
  equipment: string[];
  preferredFocus: string[];
};

export type WorkoutSession = {
  id: string;
  workoutName: string;
  completedAt: string;
  durationSeconds: number;
  setsCompleted: number;
  movementsCompleted: number;
  cameraSets: number;
};

export type DailyLog = {
  logDate: string;
  waterMl: number;
  meals: string;
  sleepHours: number;
  energy: number;
  weightKg: number | null;
  notes: string;
};

export type ScheduleItem = {
  id: string;
  weekday: number;
  workoutName: string;
  startTime: string;
  durationMinutes: number;
  enabled: boolean;
};

export type AccountSnapshot = {
  user: { userId: string; displayName: string; email: string };
  profile: Profile;
  sessions: WorkoutSession[];
  todayLog: DailyLog;
  schedule: ScheduleItem[];
};

export type Market = 'global' | 'cn';
export type BillingPlan = 'trial' | 'monthly' | 'annual';
export type MembershipStatus = 'pending_verification' | 'trial' | 'active' | 'past_due' | 'expired' | 'canceled';

export type Membership = {
  status: MembershipStatus;
  plan: BillingPlan;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasAccess: boolean;
  serverNow: string;
};

export type MemberAccount = {
  userId: string;
  email: string;
  displayName: string;
  locale: 'en' | 'zh';
  market: Market;
  membership: Membership;
};
