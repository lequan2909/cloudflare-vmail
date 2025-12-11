CREATE TABLE `blocked_senders` (
	`email` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`reason` text
);
