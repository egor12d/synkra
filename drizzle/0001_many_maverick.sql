ALTER TABLE `nutrition` ADD `servings` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `outbox` ADD `claimed_at` text;--> statement-breakpoint
ALTER TABLE `workout_logs` ADD `exercises` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `workouts` ADD `scheduled_date` text;