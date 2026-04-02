PRAGMA foreign_keys = OFF;

-- Өмнөх датаг цэвэрлэх
DELETE FROM school_event_teacher_targets;
DELETE FROM school_event_targets;
DELETE FROM school_events;

-- Үндсэн арга хэмжээнүүдийг оруулах
INSERT INTO school_events (
  id, title, description, event_type, priority, urgency_level,
  start_date, end_date, start_period_id, end_period_id,
  repeat_pattern, is_full_lock, target_type, is_school_wide, color_code, created_at
) VALUES
  -- 1. Долоо хоног бүрийн тогтмол арга хэмжээ
  (
    'rec-teacher-meeting-spring', 'Багш нарын хурал', 'Даваа гараг бүрийн 1-р цагт.',
    'TEACHER_DEVELOPMENT', 3, 'REQUIRED', 1767571200000, 1767574800000, 1, 1, 'WEEKLY', 1, 'TEACHERS', 1, '#3B82F6', 1767571200000
  ),
  (
    'rec-cleaning-spring', 'Их цэвэрлэгээ', 'Баасан гарагийн оройн их цэвэрлэгээ.',
    'MAINTENANCE', 1, 'FLEXIBLE', 1767339000000, 1767344400000, 7, 8, 'WEEKLY', 0, 'ALL', 1, '#6B7280', 1767339000000
  ),

  -- 2. Баяр ёслол болон Амралт (Holidays)
  (
    'ev-01-01', 'Шинэ жилийн амралт', NULL, 'HOLIDAY', 4, 'REQUIRED',
    1767225600000, 1767520800000, NULL, NULL, 'NONE', 1, 'ALL', 1, '#F97316', 1767225600000
  ),
  (
    'ev-02-01', 'Сар шинийн баярын амралт', NULL, 'HOLIDAY', 4, 'REQUIRED',
    1771200000000, 1771581600000, NULL, NULL, 'NONE', 1, 'ALL', 1, '#F97316', 1771200000000
  ),
  (
    'ev-06-02', 'Зуны амралт', 'Урт хугацааны амралт.', 'HOLIDAY', 4, 'REQUIRED',
    1780358400000, 1788170400000, NULL, NULL, 'NONE', 1, 'ALL', 1, '#F97316', 1780358400000
  ),

  -- 3. Сургуулийн онцлох үйл явдлууд
  (
    'ev-03-01', 'Олон улсын эмэгтэйчүүдийн өдөр', NULL, 'EVENT', 4, 'REQUIRED',
    1772928000000, 1773050400000, NULL, NULL, 'NONE', 1, 'ALL', 1, '#10B981', 1772928000000
  ),
  (
    'ev-04-01', 'Сургуулийн ойн баяр', '08:00-13:00 цагийн хооронд.',
    'EVENT', 4, 'REQUIRED', 1776211200000, 1776229200000, NULL, NULL, 'NONE', 1, 'ALL', 1, '#10B981', 1776211200000
  ),
  (
    'ev-04-02', 'Спортын наадам', NULL, 'EXTRACURRICULAR', 2, 'REQUIRED',
    1775782800000, 1775901600000, NULL, NULL, 'NONE', 1, 'ALL', 1, '#F59E0B', 1775782800000
  ),
  (
    'ev-05-02', 'Төгсөлтийн хонхны баяр', '2026 оны төгсөлт.',
    'EVENT', 4, 'REQUIRED', 1779667200000, 1779696000000, NULL, NULL, 'NONE', 1, 'ALL', 1, '#10B981', 1779667200000
  ),
  (
    'ev-09-01', 'Хичээлийн шинэ жилийн нээлт', NULL, 'EVENT', 4, 'REQUIRED',
    1788220800000, 1788235200000, NULL, NULL, 'NONE', 1, 'ALL', 1, '#3B82F6', 1788220800000
  ),

  -- 4. Шалгалт болон Олимпиад (Exams)
  (
    'ev-03-02', 'Улсын Математикийн Олимпиад', NULL, 'EXAM', 4, 'REQUIRED',
    1773966600000, 1773986400000, NULL, NULL, 'NONE', 1, 'ALL', 1, '#DC2626', 1773966600000
  ),
  (
    'ev-05-01', 'Улсын шалгалтын сорил', NULL, 'EXAM', 4, 'REQUIRED',
    1778545800000, 1778558400000, NULL, NULL, 'NONE', 1, 'ALL', 1, '#DC2626', 1778545800000
  );

-- Зорилтот бүлгүүдийг холбох (School Event Targets)
-- school_event_targets schema: composite PK (event_id, group_id)
INSERT OR IGNORE INTO school_event_targets (event_id, group_id)
SELECT e.id, g.id
FROM school_events e
JOIN `groups` g
WHERE e.is_school_wide = 1;

PRAGMA foreign_keys = ON;
