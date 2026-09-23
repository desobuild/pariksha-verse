CREATE TABLE `exam_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`exam_date` integer,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`scoring_config` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_attempts_exam_id_slug_unique` ON `exam_attempts` (`exam_id`,`slug`);--> statement-breakpoint
CREATE INDEX `exam_attempts_exam_id_idx` ON `exam_attempts` (`exam_id`);--> statement-breakpoint
CREATE TABLE `exams` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exams_slug_unique` ON `exams` (`slug`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_exam_id_slug_unique` ON `subjects` (`exam_id`,`slug`);--> statement-breakpoint
CREATE INDEX `subjects_exam_id_idx` ON `subjects` (`exam_id`);--> statement-breakpoint
CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_subject_id_slug_unique` ON `chapters` (`subject_id`,`slug`);--> statement-breakpoint
CREATE INDEX `chapters_subject_id_idx` ON `chapters` (`subject_id`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_chapter_id_slug_unique` ON `topics` (`chapter_id`,`slug`);--> statement-breakpoint
CREATE INDEX `topics_chapter_id_idx` ON `topics` (`chapter_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `user_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`exam_attempt_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`started_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exam_attempt_id`) REFERENCES `exam_attempts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `user_workspaces_user_id_idx` ON `user_workspaces` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_workspaces_exam_attempt_id_idx` ON `user_workspaces` (`exam_attempt_id`);--> statement-breakpoint
CREATE TABLE `user_topic_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`started_at` integer,
	`learned_at` integer,
	`practiced_at` integer,
	`revised_at` integer,
	`mastered_at` integer,
	`practice_attempts` integer DEFAULT 0 NOT NULL,
	`correct_answers` integer DEFAULT 0 NOT NULL,
	`incorrect_answers` integer DEFAULT 0 NOT NULL,
	`accuracy` integer DEFAULT 0 NOT NULL,
	`last_studied_at` integer,
	`last_revised_at` integer,
	`next_revision_at` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_topic_progress_workspace_topic_unique` ON `user_topic_progress` (`workspace_id`,`topic_id`);--> statement-breakpoint
CREATE INDEX `user_topic_progress_workspace_id_idx` ON `user_topic_progress` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `user_topic_progress_topic_id_idx` ON `user_topic_progress` (`topic_id`);--> statement-breakpoint
CREATE TABLE `planner_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`subject_id` text,
	`chapter_id` text,
	`topic_id` text,
	`scheduled_date` text NOT NULL,
	`start_time` text,
	`duration_minutes` integer NOT NULL,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `planner_tasks_workspace_scheduled_idx` ON `planner_tasks` (`workspace_id`,`scheduled_date`);--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`planner_task_id` text,
	`topic_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_minutes` integer DEFAULT 0 NOT NULL,
	`session_type` text DEFAULT 'focused' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`planner_task_id`) REFERENCES `planner_tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `study_sessions_workspace_id_idx` ON `study_sessions` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `revision_items` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`revision_number` integer DEFAULT 1 NOT NULL,
	`last_revised_at` integer,
	`next_revision_at` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `revision_items_workspace_next_rev_idx` ON `revision_items` (`workspace_id`,`next_revision_at`);--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`topic_id` text,
	`question_count` integer DEFAULT 0 NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`incorrect` integer DEFAULT 0 NOT NULL,
	`unattempted` integer DEFAULT 0 NOT NULL,
	`duration_minutes` integer DEFAULT 0 NOT NULL,
	`completed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `practice_sessions_workspace_completed_idx` ON `practice_sessions` (`workspace_id`,`completed_at`);--> statement-breakpoint
CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`subject_id` text,
	`chapter_id` text,
	`topic_id` text,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`source_name` text,
	`url` text,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `resources_exam_id_idx` ON `resources` (`exam_id`);--> statement-breakpoint
CREATE INDEX `resources_topic_id_idx` ON `resources` (`topic_id`);--> statement-breakpoint
CREATE TABLE `saved_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`saved_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_resources_workspace_resource_unique` ON `saved_resources` (`workspace_id`,`resource_id`);--> statement-breakpoint
CREATE INDEX `saved_resources_workspace_id_idx` ON `saved_resources` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `mock_test_results` (
	`id` text PRIMARY KEY NOT NULL,
	`mock_test_id` text NOT NULL,
	`score` integer NOT NULL,
	`total_marks` integer NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`incorrect` integer DEFAULT 0 NOT NULL,
	`unattempted` integer DEFAULT 0 NOT NULL,
	`accuracy` integer DEFAULT 0 NOT NULL,
	`completed_at` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`mock_test_id`) REFERENCES `mock_tests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mock_test_results_mock_test_id_idx` ON `mock_test_results` (`mock_test_id`);--> statement-breakpoint
CREATE TABLE `mock_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`scheduled_at` integer,
	`duration_minutes` integer NOT NULL,
	`source` text,
	`external_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mock_tests_workspace_scheduled_idx` ON `mock_tests` (`workspace_id`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`study_reminders` integer DEFAULT true NOT NULL,
	`revision_reminders` integer DEFAULT true NOT NULL,
	`mock_test_reminders` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`daily_study_goal_minutes` integer DEFAULT 120 NOT NULL,
	`timezone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
