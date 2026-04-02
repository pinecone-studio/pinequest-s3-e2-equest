-- Б.Батбаяр (users.id = MATH_09) — математикийн багшийн завгүй цагийг `teacher_availability`-д оруулна.
-- Урьдчилсан нөхцөл: `users_seed.sql` (MATH_09), `periods_seed.sql` (1–14 цаг).
--
-- Хуанлийн mock-тай ойролцоо:
--   • Лхагва (day_of_week = 3): «Гадуур ажил» ~12:00–14:30 → period 6–9 (11:50–14:45)
--   • Баасан (day_of_week = 5): «Багшийн сургалт» өглөө 08:00–13:00 → period 2–7 (08:30–13:15, торын хязгаар)
--
-- Тайлбар: хүснэг нь цагийн «тор»-оор (period_id) ажиллана; яг цагийг reason-д бичсэн.
-- Статус: BUSY — AI/хуваарь тухайн слотод шалгалт тавихгүй гэсэн утга.

PRAGMA foreign_keys = ON;

DELETE FROM teacher_availability WHERE id LIKE 'ta-m09-%';

INSERT INTO teacher_availability (id, teacher_id, day_of_week, period_id, status, reason, created_at) VALUES
-- Лхагва: Гадуур ажил (12:00–14:30 орчим)
('ta-m09-d3-p6', 'MATH_09', 3, 6, 'BUSY', 'Гадуур ажил (12:00–14:30)', (strftime('%s', 'now') * 1000)),
('ta-m09-d3-p7', 'MATH_09', 3, 7, 'BUSY', 'Гадуур ажил (12:00–14:30)', (strftime('%s', 'now') * 1000)),
('ta-m09-d3-p8', 'MATH_09', 3, 8, 'BUSY', 'Гадуур ажил (12:00–14:30)', (strftime('%s', 'now') * 1000)),
('ta-m09-d3-p9', 'MATH_09', 3, 9, 'BUSY', 'Гадуур ажил (12:00–14:30)', (strftime('%s', 'now') * 1000)),
-- Баасан: Багшийн сургалт (08:00–13:00) — I ээлж period 2–7
('ta-m09-d5-p2', 'MATH_09', 5, 2, 'BUSY', 'Багшийн сургалт (08:00–13:00)', (strftime('%s', 'now') * 1000)),
('ta-m09-d5-p3', 'MATH_09', 5, 3, 'BUSY', 'Багшийн сургалт (08:00–13:00)', (strftime('%s', 'now') * 1000)),
('ta-m09-d5-p4', 'MATH_09', 5, 4, 'BUSY', 'Багшийн сургалт (08:00–13:00)', (strftime('%s', 'now') * 1000)),
('ta-m09-d5-p5', 'MATH_09', 5, 5, 'BUSY', 'Багшийн сургалт (08:00–13:00)', (strftime('%s', 'now') * 1000)),
('ta-m09-d5-p6', 'MATH_09', 5, 6, 'BUSY', 'Багшийн сургалт (08:00–13:00)', (strftime('%s', 'now') * 1000)),
('ta-m09-d5-p7', 'MATH_09', 5, 7, 'BUSY', 'Багшийн сургалт (08:00–13:00)', (strftime('%s', 'now') * 1000));
