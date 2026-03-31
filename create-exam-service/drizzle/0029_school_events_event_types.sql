PRAGMA foreign_keys=OFF;

-- Rebuild `school_events` to add new metadata columns + defaults.
CREATE TABLE `__school_events_new` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `event_type` text DEFAULT 'EVENT' NOT NULL,
  `priority` integer DEFAULT 2 NOT NULL,
  `urgency_level` text DEFAULT 'REQUIRED' NOT NULL,
  `target_type` text DEFAULT 'ALL' NOT NULL,
  `start_date` integer NOT NULL,
  `end_date` integer NOT NULL,
  `start_period_id` integer,
  `end_period_id` integer,
  `repeat_pattern` text DEFAULT 'NONE' NOT NULL,
  `is_full_lock` integer DEFAULT true NOT NULL,
  `is_school_wide` integer DEFAULT true NOT NULL,
  `color_code` text DEFAULT '#3b82f6',
  `description` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`start_period_id`) REFERENCES `periods`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`end_period_id`) REFERENCES `periods`(`id`) ON UPDATE no action ON DELETE restrict
);

INSERT INTO `__school_events_new` (
  id,
  title,
  event_type,
  priority,
  urgency_level,
  target_type,
  start_date,
  end_date,
  start_period_id,
  end_period_id,
  repeat_pattern,
  is_full_lock,
  is_school_wide,
  color_code,
  description,
  created_at
)
SELECT
  id,
  title,
  event_type,
  2 as priority,
  'REQUIRED' as urgency_level,
  target_type,
  start_date,
  end_date,
  start_period_id,
  end_period_id,
  'NONE' as repeat_pattern,
  COALESCE(is_full_lock, 0) as is_full_lock,
  is_school_wide,
  '#3b82f6' as color_code,
  description,
  created_at
FROM `school_events`;

DROP TABLE `school_events`;
ALTER TABLE `__school_events_new` RENAME TO `school_events`;

-- Rebuild targets to enforce uniqueness via composite PK.
CREATE TABLE `__school_event_targets_new` (
  `event_id` text NOT NULL,
  `group_id` text NOT NULL,
  PRIMARY KEY(`event_id`, `group_id`),
  FOREIGN KEY (`event_id`) REFERENCES `school_events`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);

INSERT OR IGNORE INTO `__school_event_targets_new` (event_id, group_id)
SELECT event_id, group_id FROM `school_event_targets`;

DROP TABLE `school_event_targets`;
ALTER TABLE `__school_event_targets_new` RENAME TO `school_event_targets`;

CREATE TABLE `__school_event_teacher_targets_new` (
  `event_id` text NOT NULL,
  `teacher_id` text NOT NULL,
  PRIMARY KEY(`event_id`, `teacher_id`),
  FOREIGN KEY (`event_id`) REFERENCES `school_events`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

INSERT OR IGNORE INTO `__school_event_teacher_targets_new` (event_id, teacher_id)
SELECT event_id, teacher_id FROM `school_event_teacher_targets`;

DROP TABLE `school_event_teacher_targets`;
ALTER TABLE `__school_event_teacher_targets_new` RENAME TO `school_event_teacher_targets`;

PRAGMA foreign_keys=ON;

