import { env } from 'cloudflare:workers';
import type { ChatGPTUser } from '../app/chatgpt-auth';
import type { AccountSnapshot, DailyLog, Profile, ScheduleItem, WorkoutSession } from '../app/account-types';

let schemaReady: Promise<void> | null = null;

function getD1() {
  if (!env.DB) throw new Error('The Relay database is unavailable.');
  return env.DB;
}

async function ensureSchema() {
  if (schemaReady) return schemaReady;
  const db = getD1();
  schemaReady = db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY NOT NULL,
      goal TEXT NOT NULL DEFAULT 'Build strength',
      level TEXT NOT NULL DEFAULT 'Beginner',
      days_per_week INTEGER NOT NULL DEFAULT 3,
      session_minutes INTEGER NOT NULL DEFAULT 24,
      hydration_target_ml INTEGER NOT NULL DEFAULT 2500,
      sleep_target_hours REAL NOT NULL DEFAULT 8,
      injuries TEXT NOT NULL DEFAULT '',
      reminder_time TEXT NOT NULL DEFAULT '18:00',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      workout_id TEXT NOT NULL,
      workout_name TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      sets_completed INTEGER NOT NULL,
      movements_completed INTEGER NOT NULL,
      camera_sets INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_completed ON workout_sessions (user_id, completed_at)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS daily_logs (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      log_date TEXT NOT NULL,
      water_ml INTEGER NOT NULL DEFAULT 0,
      meals TEXT NOT NULL DEFAULT 'Balanced',
      sleep_hours REAL NOT NULL DEFAULT 0,
      energy INTEGER NOT NULL DEFAULT 3,
      weight_kg REAL,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs (user_id, log_date)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS training_schedule (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      weekday INTEGER NOT NULL,
      workout_name TEXT NOT NULL DEFAULT 'Foundation 01',
      start_time TEXT NOT NULL DEFAULT '18:00',
      duration_minutes INTEGER NOT NULL DEFAULT 24,
      enabled INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_training_schedule_user_day ON training_schedule (user_id, weekday)'),
    db.prepare('PRAGMA optimize'),
  ]).then(() => undefined).catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

function defaultLog(logDate: string): DailyLog {
  return { logDate, waterMl: 0, meals: 'Balanced', sleepHours: 0, energy: 3, weightKg: null, notes: '' };
}

export async function ensureUser(user: ChatGPTUser) {
  await ensureSchema();
  const db = getD1();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO users (id, email, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, updated_at = excluded.updated_at`)
      .bind(user.userId, user.email, user.displayName, now, now),
    db.prepare(`INSERT OR IGNORE INTO profiles
      (user_id, goal, level, days_per_week, session_minutes, hydration_target_ml, sleep_target_hours, injuries, reminder_time, updated_at)
      VALUES (?, 'Build strength', 'Beginner', 5, 24, 2500, 8, '', '18:00', ?)`)
      .bind(user.userId, now),
  ]);

  const scheduleCount = await db.prepare('SELECT COUNT(*) AS count FROM training_schedule WHERE user_id = ?')
    .bind(user.userId).first<{ count: number }>();
  if (!scheduleCount?.count) {
    const defaultSchedule = [
      { weekday: 1, workoutName: 'Legs Day 01' },
      { weekday: 2, workoutName: 'Chest Day 01' },
      { weekday: 3, workoutName: 'Back Day 01' },
      { weekday: 4, workoutName: 'Neck Day 01' },
      { weekday: 6, workoutName: 'Cardio Day 01' },
    ];
    await db.batch(defaultSchedule.map(({ weekday, workoutName }) => db.prepare(`INSERT OR IGNORE INTO training_schedule
      (id, user_id, weekday, workout_name, start_time, duration_minutes, enabled)
      VALUES (?, ?, ?, ?, '18:00', 24, 1)`)
      .bind(crypto.randomUUID(), user.userId, weekday, workoutName)));
  }
}

export async function getAccountSnapshot(user: ChatGPTUser, logDate: string): Promise<AccountSnapshot> {
  await ensureUser(user);
  const db = getD1();
  const [profileRow, sessionRows, logRow, scheduleRows] = await Promise.all([
    db.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(user.userId).first<Record<string, unknown>>(),
    db.prepare('SELECT * FROM workout_sessions WHERE user_id = ? ORDER BY completed_at DESC LIMIT 60').bind(user.userId).all<Record<string, unknown>>(),
    db.prepare('SELECT * FROM daily_logs WHERE user_id = ? AND log_date = ?').bind(user.userId, logDate).first<Record<string, unknown>>(),
    db.prepare('SELECT * FROM training_schedule WHERE user_id = ? ORDER BY weekday').bind(user.userId).all<Record<string, unknown>>(),
  ]);

  const profile: Profile = {
    goal: String(profileRow?.goal ?? 'Build strength'),
    level: String(profileRow?.level ?? 'Beginner'),
    daysPerWeek: Number(profileRow?.days_per_week ?? 3),
    sessionMinutes: Number(profileRow?.session_minutes ?? 24),
    hydrationTargetMl: Number(profileRow?.hydration_target_ml ?? 2500),
    sleepTargetHours: Number(profileRow?.sleep_target_hours ?? 8),
    injuries: String(profileRow?.injuries ?? ''),
    reminderTime: String(profileRow?.reminder_time ?? '18:00'),
  };

  const sessions: WorkoutSession[] = sessionRows.results.map((row) => ({
    id: String(row.id),
    workoutName: String(row.workout_name),
    completedAt: String(row.completed_at),
    durationSeconds: Number(row.duration_seconds),
    setsCompleted: Number(row.sets_completed),
    movementsCompleted: Number(row.movements_completed),
    cameraSets: Number(row.camera_sets),
  }));

  const todayLog: DailyLog = logRow ? {
    logDate: String(logRow.log_date),
    waterMl: Number(logRow.water_ml),
    meals: String(logRow.meals),
    sleepHours: Number(logRow.sleep_hours),
    energy: Number(logRow.energy),
    weightKg: logRow.weight_kg === null ? null : Number(logRow.weight_kg),
    notes: String(logRow.notes),
  } : defaultLog(logDate);

  const schedule: ScheduleItem[] = scheduleRows.results.map((row) => ({
    id: String(row.id),
    weekday: Number(row.weekday),
    workoutName: String(row.workout_name),
    startTime: String(row.start_time),
    durationMinutes: Number(row.duration_minutes),
    enabled: Boolean(row.enabled),
  }));

  return { user: { userId: user.userId, displayName: user.displayName, email: user.email }, profile, sessions, todayLog, schedule };
}

export async function saveWorkout(userId: string, input: { workoutId: string; workoutName: string; durationSeconds: number; setsCompleted: number; movementsCompleted: number; cameraSets: number; notes?: string }) {
  await ensureSchema();
  const db = getD1();
  await db.prepare(`INSERT INTO workout_sessions
    (id, user_id, workout_id, workout_name, completed_at, duration_seconds, sets_completed, movements_completed, camera_sets, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), userId, input.workoutId, input.workoutName, new Date().toISOString(), input.durationSeconds, input.setsCompleted, input.movementsCompleted, input.cameraSets, input.notes ?? '').run();
}

export async function saveDailyLog(userId: string, input: DailyLog) {
  await ensureSchema();
  const db = getD1();
  await db.prepare(`INSERT INTO daily_logs
    (id, user_id, log_date, water_ml, meals, sleep_hours, energy, weight_kg, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, log_date) DO UPDATE SET
      water_ml = excluded.water_ml, meals = excluded.meals, sleep_hours = excluded.sleep_hours,
      energy = excluded.energy, weight_kg = excluded.weight_kg, notes = excluded.notes, updated_at = excluded.updated_at`)
    .bind(crypto.randomUUID(), userId, input.logDate, input.waterMl, input.meals, input.sleepHours, input.energy, input.weightKg, input.notes, new Date().toISOString()).run();
}

export async function saveProfile(userId: string, input: Profile) {
  await ensureSchema();
  await getD1().prepare(`UPDATE profiles SET
    goal = ?, level = ?, days_per_week = ?, session_minutes = ?, hydration_target_ml = ?,
    sleep_target_hours = ?, injuries = ?, reminder_time = ?, updated_at = ? WHERE user_id = ?`)
    .bind(input.goal, input.level, input.daysPerWeek, input.sessionMinutes, input.hydrationTargetMl,
      input.sleepTargetHours, input.injuries, input.reminderTime, new Date().toISOString(), userId).run();
}

export async function saveSchedule(userId: string, items: ScheduleItem[]) {
  await ensureSchema();
  const db = getD1();
  await db.batch([
    db.prepare('DELETE FROM training_schedule WHERE user_id = ?').bind(userId),
    ...items.map((item) => db.prepare(`INSERT INTO training_schedule
      (id, user_id, weekday, workout_name, start_time, duration_minutes, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), userId, item.weekday, item.workoutName, item.startTime, item.durationMinutes, item.enabled ? 1 : 0)),
  ]);
}
