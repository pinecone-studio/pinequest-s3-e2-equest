CREATE TABLE `school_calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`subcategory` text,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`all_day` integer DEFAULT 0 NOT NULL,
	`visibility` text DEFAULT 'SCHOOL_WIDE' NOT NULL,
	`metadata_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

INSERT INTO `school_calendar_events` (
	`id`, `title`, `description`, `category`, `subcategory`, `start_time`, `end_time`, `all_day`, `visibility`, `metadata_json`, `created_at`, `updated_at`
) VALUES
('b1000000-0000-4000-8000-000000000001', 'Дүн гаргах deadline', '1-р улирлын дүн баталгаажуулах эцсийн хугацаа', 'ACADEMIC', 'GRADE_DEADLINE', 1774310400, 1774396799, 1, 'SCHOOL_WIDE', NULL, '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'),
('b1000000-0000-4000-8000-000000000002', 'ЗАН-ийн хурал (Математик)', 'Салбарын хурал, багш нарын оролцоо', 'ADMIN', 'MATHEMATICS', 1774418400, 1774423800, 0, 'SCHOOL_WIDE', NULL, '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'),
('b1000000-0000-4000-8000-000000000003', 'Спорт заал засвартай', 'Спорт заал түр хаагдсан — шалгалт төлөвлөхгүй', 'RESOURCE_CONSTRAINT', 'GYM', 1774483200, 1774519200, 0, 'SCHOOL_WIDE', '{"resourceId":"gym-main"}', '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'),
('b1000000-0000-4000-8000-000000000004', 'Спортын наадам', 'Урлаг, спортын хэсгийн өдөрлөг', 'CAMPUS_LIFE', 'SPORTS', 1774576800, 1774584000, 0, 'SCHOOL_WIDE', NULL, '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'),
('b1000000-0000-4000-8000-000000000005', 'ЕШ-ын сорил шалгалт (жишээ)', 'Туршилтын шалгалтын цагийн цонх', 'ACADEMIC', 'NATIONAL_EXAM_TRIAL', 1774659600, 1774670400, 0, 'SCHOOL_WIDE', NULL, '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z');
