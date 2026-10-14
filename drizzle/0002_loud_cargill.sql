CREATE INDEX `booking_class_status_idx` ON `bookings` (`class_id`,`status`);--> statement-breakpoint
CREATE INDEX `lead_status_idx` ON `leads` (`status`);--> statement-breakpoint
CREATE INDEX `lead_user_idx` ON `leads` (`user_id`);--> statement-breakpoint
CREATE INDEX `notification_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `nutrition_user_date_idx` ON `nutrition` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `order_user_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `outbox_status_created_idx` ON `outbox` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `progress_user_date_idx` ON `progress` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_expiry_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `reply_ticket_idx` ON `ticket_replies` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `ticket_user_idx` ON `tickets` (`user_id`);--> statement-breakpoint
CREATE INDEX `token_user_idx` ON `tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `log_user_created_idx` ON `workout_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `workout_user_idx` ON `workouts` (`user_id`);