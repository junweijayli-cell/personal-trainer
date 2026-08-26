CREATE TABLE `daily_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`log_date` text NOT NULL,
	`water_ml` integer DEFAULT 0 NOT NULL,
	`meals` text DEFAULT 'Balanced' NOT NULL,
	`sleep_hours` real DEFAULT 0 NOT NULL,
	`energy` integer DEFAULT 3 NOT NULL,
	`weight_kg` real,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_daily_logs_user_date` ON `daily_logs` (`user_id`,`log_date`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`goal` text DEFAULT 'Build strength' NOT NULL,
	`level` text DEFAULT 'Beginner' NOT NULL,
	`days_per_week` integer DEFAULT 3 NOT NULL,
	`session_minutes` integer DEFAULT 24 NOT NULL,
	`hydration_target_ml` integer DEFAULT 2500 NOT NULL,
	`sleep_target_hours` real DEFAULT 8 NOT NULL,
	`injuries` text DEFAULT '' NOT NULL,
	`reminder_time` text DEFAULT '18:00' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `training_schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`workout_name` text DEFAULT 'Foundation 01' NOT NULL,
	`start_time` text DEFAULT '18:00' NOT NULL,
	`duration_minutes` integer DEFAULT 24 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_training_schedule_user_day` ON `training_schedule` (`user_id`,`weekday`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workout_id` text NOT NULL,
	`workout_name` text NOT NULL,
	`completed_at` text NOT NULL,
	`duration_seconds` integer NOT NULL,
	`sets_completed` integer NOT NULL,
	`movements_completed` integer NOT NULL,
	`camera_sets` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_workout_sessions_user_completed` ON `workout_sessions` (`user_id`,`completed_at`);