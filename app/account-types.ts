export type Profile = {
  goal: string;
  level: string;
  daysPerWeek: number;
  sessionMinutes: number;
  hydrationTargetMl: number;
  sleepTargetHours: number;
  injuries: string;
  reminderTime: string;
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
