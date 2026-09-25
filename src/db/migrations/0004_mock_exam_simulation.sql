ALTER TABLE `mock_tests` ADD COLUMN `description` text;--> statement-breakpoint
ALTER TABLE `mock_tests` ADD COLUMN `total_questions` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mock_tests` ADD COLUMN `exam_id` text REFERENCES `exams`(`id`) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `mock_tests` ADD COLUMN `marking_scheme` text;--> statement-breakpoint
ALTER TABLE `mock_tests` ADD COLUMN `sections` text;--> statement-breakpoint
ALTER TABLE `mock_tests` ADD COLUMN `question_selection_config` text;--> statement-breakpoint
ALTER TABLE `mock_tests` ADD COLUMN `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `mock_tests` ADD COLUMN `provenance` text DEFAULT 'fixture' NOT NULL;--> statement-breakpoint
CREATE TABLE `mock_test_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`mock_test_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`question_ids` text NOT NULL,
	`selected_answers` text DEFAULT '{}' NOT NULL,
	`marked_for_review` text DEFAULT '[]' NOT NULL,
	`current_index` integer DEFAULT 0 NOT NULL,
	`duration_seconds` integer NOT NULL,
	`started_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`mock_test_id`) REFERENCES `mock_tests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mock_test_sessions_workspace_status_idx` ON `mock_test_sessions` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `mock_test_sessions_mock_test_id_idx` ON `mock_test_sessions` (`mock_test_id`);--> statement-breakpoint
ALTER TABLE `mock_test_results` ADD COLUMN `session_id` text REFERENCES `mock_test_sessions`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `mock_test_results` ADD COLUMN `time_spent_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mock_test_results` ADD COLUMN `submission_status` text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE `mock_test_results` ADD COLUMN `section_results` text;--> statement-breakpoint
ALTER TABLE `mock_test_results` ADD COLUMN `question_results` text;--> statement-breakpoint
CREATE INDEX `mock_test_results_session_id_idx` ON `mock_test_results` (`session_id`);
