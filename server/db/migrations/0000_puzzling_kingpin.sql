CREATE TABLE `alerts_sent` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer,
	`listing_id` integer,
	`kind` text NOT NULL,
	`price_cents` integer,
	`sent_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`store` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`image_url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_error` text,
	`last_checked_at` integer,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listings_product_url_unique` ON `listings` (`product_id`,`url`);--> statement-breakpoint
CREATE TABLE `price_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`captured_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`cash_price_cents` integer,
	`installment_price_cents` integer,
	`installment_count` integer,
	`available` integer NOT NULL,
	`free_shipping` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `price_snapshots_listing_captured_idx` ON `price_snapshots` (`listing_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`image_url` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`target_price_cents` integer,
	`target_mode` text DEFAULT 'cash' NOT NULL,
	`drop_alert_percent` integer
);
