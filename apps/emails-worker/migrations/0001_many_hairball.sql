CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`mailbox_address` text,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`last_used_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`rate_limit` integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mailboxes` (
	`address` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
ALTER TABLE emails ADD `is_read` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE emails ADD `read_at` integer;--> statement-breakpoint
ALTER TABLE emails ADD `priority` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_unique` ON `api_keys` (`key`);
