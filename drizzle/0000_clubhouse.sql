CREATE TABLE `catches` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `species` text NOT NULL,
  `length_cm` real,
  `caught_on` text NOT NULL,
  `location` text DEFAULT '' NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `catches_owner_date_idx` ON `catches` (`owner_id`, `caught_on`);
--> statement-breakpoint
CREATE TABLE `meeting_notes` (
  `id` text PRIMARY KEY NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  `actions_json` text DEFAULT '[]' NOT NULL,
  `version` integer DEFAULT 0 NOT NULL,
  `updated_at` text NOT NULL,
  `updated_by` text NOT NULL,
  `last_mutation_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
  `id` text PRIMARY KEY NOT NULL,
  `actor_id` text NOT NULL,
  `actor_role` text NOT NULL,
  `action` text NOT NULL,
  `entity_id` text NOT NULL,
  `occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_time_idx` ON `audit_log` (`occurred_at`);
