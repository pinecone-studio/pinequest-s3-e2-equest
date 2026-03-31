-- Periods нь master_schedules.period_id зэрэг FK-ийн эх хүснэгт тул
-- эхлээд хамааралтай мөрүүдийг цэвэрлэж байж periods-ийг reset хийнэ.
PRAGMA foreign_keys = OFF;

DELETE FROM master_schedules;
DELETE FROM ancillary_activities;
DELETE FROM exam_schedules;

DELETE FROM periods;

INSERT INTO periods (id, shift, period_number, start_time, end_time, break_minutes) VALUES
(1, 1, 1, '07:45', '08:25', 5),
(2, 1, 2, '08:30', '09:10', 10),
(3, 1, 3, '09:20', '10:00', 15),
(4, 1, 4, '10:15', '10:55', 5),
(5, 1, 5, '11:00', '11:40', 10),
(6, 1, 6, '11:50', '12:30', 5),
(7, 1, 7, '12:35', '13:15', 5),
(8, 2, 1, '13:20', '14:00', 5),
(9, 2, 2, '14:05', '14:45', 10),
(10, 2, 3, '14:55', '15:35', 15),
(11, 2, 4, '15:50', '16:30', 5),
(12, 2, 5, '16:35', '17:15', 10),
(13, 2, 6, '17:25', '18:05', 5),
(14, 2, 7, '18:10', '18:50', 5);

PRAGMA foreign_keys = ON;

