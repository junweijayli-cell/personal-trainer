import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [uniqueIndex('idx_users_email').on(table.email)]);

export const profiles = sqliteTable('profiles', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  goal: text('goal').notNull().default('Build strength'),
  level: text('level').notNull().default('Beginner'),
  daysPerWeek: integer('days_per_week').notNull().default(3),
  sessionMinutes: integer('session_minutes').notNull().default(24),
  hydrationTargetMl: integer('hydration_target_ml').notNull().default(2500),
  sleepTargetHours: real('sleep_target_hours').notNull().default(8),
  injuries: text('injuries').notNull().default(''),
  reminderTime: text('reminder_time').notNull().default('18:00'),
  updatedAt: text('updated_at').notNull(),
});

export const workoutSessions = sqliteTable('workout_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workoutId: text('workout_id').notNull(),
  workoutName: text('workout_name').notNull(),
  completedAt: text('completed_at').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  setsCompleted: integer('sets_completed').notNull(),
  movementsCompleted: integer('movements_completed').notNull(),
  cameraSets: integer('camera_sets').notNull().default(0),
  notes: text('notes').notNull().default(''),
}, (table) => [index('idx_workout_sessions_user_completed').on(table.userId, table.completedAt)]);

export const dailyLogs = sqliteTable('daily_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  logDate: text('log_date').notNull(),
  waterMl: integer('water_ml').notNull().default(0),
  meals: text('meals').notNull().default('Balanced'),
  sleepHours: real('sleep_hours').notNull().default(0),
  energy: integer('energy').notNull().default(3),
  weightKg: real('weight_kg'),
  notes: text('notes').notNull().default(''),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('idx_daily_logs_user_date').on(table.userId, table.logDate),
]);

export const trainingSchedule = sqliteTable('training_schedule', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weekday: integer('weekday').notNull(),
  workoutName: text('workout_name').notNull().default('Foundation 01'),
  startTime: text('start_time').notNull().default('18:00'),
  durationMinutes: integer('duration_minutes').notNull().default(24),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
}, (table) => [
  uniqueIndex('idx_training_schedule_user_day').on(table.userId, table.weekday),
]);
