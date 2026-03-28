-- AI Scheduler "Digital Twin" — танхим + 10А Даваа гаргийн хуваарь + жишээ exam_schedule.
-- Урьдчилсан нөхцөл: `ai_exam_mock_seed.sql` (эсвэл хамгийн багадаа `ai_exam_templates` id = a1000000-0000-4000-8000-000000000001).
PRAGMA foreign_keys = ON;

DELETE FROM exam_schedules WHERE id = 'es-seed-001';
DELETE FROM master_timetable WHERE id IN ('1', '2', '3');
DELETE FROM classrooms WHERE id IN ('R-302', 'R-105', 'R-501');

INSERT INTO classrooms (id, room_number, capacity, is_lab) VALUES
('R-302', '302', 35, 0),
('R-105', '105', 40, 0),
('R-501', 'Заал', 100, 0);

-- 10А ангийн Даваа гарагийн хичээлүүд
INSERT INTO master_timetable (id, class_id, subject_name, day_of_week, period, teacher_id, room_id) VALUES
('1', '10A', 'Математик', 1, 1, 'T-001', 'R-302'),
('2', '10A', 'Физик', 1, 2, 'T-002', 'R-302'),
('3', '10A', 'Монгол хэл', 1, 4, 'T-003', 'R-105');

-- Жишээ: pending — AI батлах хүртэл end_time, room_id хоосон
INSERT INTO exam_schedules (
  id, test_id, class_id, start_time, end_time, room_id, status, ai_reasoning, created_at, updated_at
) VALUES (
  'es-seed-001',
  'a1000000-0000-4000-8000-000000000001',
  '10A',
  1704067200000,
  NULL,
  NULL,
  'pending',
  NULL,
  '2026-03-29T12:00:00.000Z',
  '2026-03-29T12:00:00.000Z'
);
