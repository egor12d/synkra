CREATE TABLE `payment_attempts` (
	`order_id` text PRIMARY KEY NOT NULL,
	`method_id` text,
	`status` text NOT NULL,
	`redirect_url` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`method_id`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`merchant_key` text NOT NULL,
	`token_ciphertext` text NOT NULL,
	`token_iv` text NOT NULL,
	`token_hash` text NOT NULL,
	`last4` text,
	`brand` text NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`source_order_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_methods_source_order_id_unique` ON `payment_methods` (`source_order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_method_token_unique` ON `payment_methods` (`user_id`,`merchant_key`,`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_method_one_default` ON `payment_methods` (`user_id`) WHERE is_default=1;--> statement-breakpoint
ALTER TABLE `orders` ADD `save_card` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `card_token_saved` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `checkout_issued` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `card_consent_at` text;