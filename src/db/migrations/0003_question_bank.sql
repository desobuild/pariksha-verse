CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`text` text NOT NULL,
	`type` text DEFAULT 'single_choice' NOT NULL,
	`difficulty` text DEFAULT 'medium' NOT NULL,
	`explanation` text,
	`source` text,
	`source_url` text,
	`attribution` text,
	`license` text,
	`external_id` text,
	`year` integer,
	`provenance` text DEFAULT 'fixture' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `questions_topic_status_idx` ON `questions` (`topic_id`,`status`);--> statement-breakpoint
CREATE INDEX `questions_subject_status_idx` ON `questions` (`subject_id`,`status`);--> statement-breakpoint
CREATE INDEX `questions_exam_status_idx` ON `questions` (`exam_id`,`status`);--> statement-breakpoint
CREATE TABLE `question_options` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`option_key` text NOT NULL,
	`text` text NOT NULL,
	`is_correct` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `question_options_question_order_idx` ON `question_options` (`question_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `question_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`total_questions` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `question_sessions_workspace_status_idx` ON `question_sessions` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `question_sessions_workspace_completed_idx` ON `question_sessions` (`workspace_id`,`completed_at`);--> statement-breakpoint
CREATE TABLE `question_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_option_id` text,
	`is_correct` integer,
	`display_order` integer DEFAULT 0 NOT NULL,
	`answered_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `question_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`selected_option_id`) REFERENCES `question_options`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `question_attempts_session_order_idx` ON `question_attempts` (`session_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `question_attempts_question_idx` ON `question_attempts` (`question_id`);
