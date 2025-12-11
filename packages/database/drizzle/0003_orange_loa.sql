CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`email_id` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`r2_key` text NOT NULL,
	`cid` text,
	`created_at` integer NOT NULL
);
