PRAGMA foreign_keys = OFF;

DELETE FROM school_event_teacher_targets
WHERE event_id IN ('event-001', 'event-002', 'event-003', 'event-004', 'event-005', 'event-006');

DELETE FROM school_event_targets
WHERE event_id IN ('event-001', 'event-002', 'event-003', 'event-004', 'event-005', 'event-006');

DELETE FROM school_events
WHERE id IN ('event-001', 'event-002', 'event-003', 'event-004', 'event-005', 'event-006');

INSERT INTO school_events (
  id,
  title,
  description,
  event_type,
  priority,
  urgency_level,
  start_date,
  end_date,
  start_period_id,
  end_period_id,
  repeat_pattern,
  is_full_lock,
  target_type,
  is_school_wide,
  created_at
) VALUES
  (
    'event-001',
    'Сар шинийн баярын амралт',
    'Бүх нийтийн амралт тул сургууль бүрэн хаагдана.',
    'HOLIDAY',
    4,
    'REQUIRED',
    1771113600000,
    1771668000000,
    NULL,
    NULL,
    'NONE',
    1,
    'ALL',
    1,
    1771113600000
  ),
  (
    'event-002',
    'Улсын математикийн олимпиад',
    'Төгсөх ангиудын дунд зохиогдох улсын олимпиад.',
    'EXAM',
    4,
    'REQUIRED',
    1773966600000,
    1773979200000,
    1,
    4,
    'NONE',
    1,
    'STUDENTS',
    0,
    1773966600000
  ),
  (
    'event-003',
    'Долоо хоног бүрийн багш нарын шуурхай',
    'Сургуулийн захиргаанаас өгөх долоо хоногийн чиглэл.',
    'TEACHER_DEVELOPMENT',
    3,
    'REQUIRED',
    1772409600000,
    1772413200000,
    1,
    1,
    'WEEKLY',
    1,
    'TEACHERS',
    1,
    1772409600000
  ),
  (
    'event-004',
    'Спортын заалны их цэвэрлэгээ',
    'Спортын заал ашиглах боломжгүй.',
    'MAINTENANCE',
    2,
    'REQUIRED',
    1775023200000,
    1775034000000,
    6,
    NULL,
    'NONE',
    1,
    'ALL',
    1,
    1775023200000
  ),
  (
    'event-005',
    '9-р ангийнхны музей үзэх аялал',
    'Түүхийн хичээлийн хүрээнд музей үзэх аялал.',
    'TRIP',
    2,
    'REQUIRED',
    1775782800000,
    1775804400000,
    NULL,
    NULL,
    'NONE',
    1,
    'STUDENTS',
    0,
    1775782800000
  ),
  (
    'event-006',
    'Сурагчдын зөвлөлийн уулзалт',
    'Сурагчдын өөрийн удирдлагын зөвлөлийн сар бүрийн уулзалт.',
    'EVENT',
    1,
    'FLEXIBLE',
    1776240000000,
    1776243600000,
    NULL,
    NULL,
    'MONTHLY',
    0,
    'STUDENTS',
    0,
    1776240000000
  );

INSERT INTO school_event_targets (event_id, group_id) VALUES
  ('event-002', '12A'),
  ('event-002', '12B'),
  ('event-005', '9C');

INSERT INTO school_event_teacher_targets (event_id, teacher_id) VALUES
  ('event-003', 'MATH_03'),
  ('event-003', 'SCI_01');

PRAGMA foreign_keys = ON;
