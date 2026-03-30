-- Disable FK checks during seed to avoid failures on partially-migrated DBs.
PRAGMA foreign_keys = OFF;

-- Drift guard: some remote DBs may miss `users`.
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`short_name` text,
	`email` text UNIQUE,
	`department` text NOT NULL,
	`role` text NOT NULL DEFAULT 'TEACHER',
	`work_load_limit` integer NOT NULL DEFAULT 6,
	`created_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
	`updated_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
	`teaching_level` text NOT NULL DEFAULT 'MIDDLE'
);

DELETE FROM users;

INSERT INTO users (
	id,
	first_name,
	last_name,
	short_name,
	email,
	department,
	teaching_level,
	role,
	work_load_limit
) VALUES
-- 1. ЗАХИРГАА (ADMINISTRATION)
('ADMIN_1','Тунгалаг','Дамба','Д.Тунгалаг','tungalag.d@school1.edu.mn','ADMIN','HIGH','ADMIN',2),
('ADMIN_2','Батжаргал','Сүх','С.Батжаргал','batjargal.s@school1.edu.mn','ADMIN','MIDDLE','ADMIN',2),
('ADMIN_3','Ганчимэг','Дорж','Д.Ганчимэг','ganchimeg.d@school1.edu.mn','ADMIN','ELEMENTARY','ADMIN',2),

-- 2. БАГА АНГИЙН ЗАН (ELEMENTARY - 35 Багш)
('ELEM_00','Сарантуяа','Багш','С.Сарантуяа','elem.сарантуяа.0@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_01','Энхтуяа','Багш','Э.Энхтуяа','elem.энхтуяа.1@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_02','Гэрэлмаа','Багш','Г.Гэрэлмаа','elem.гэрэлмаа.2@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_03','Алтанцэцэг','Багш','А.Алтанцэцэг','elem.алтанцэцэг.3@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_04','Мөнхжаргал','Багш','М.Мөнхжаргал','elem.мөнхжаргал.4@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_05','Нарантуяа','Багш','Н.Нарантуяа','elem.нарантуяа.5@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_06','Цэцэгээ','Багш','Ц.Цэцэгээ','elem.цэцэгээ.6@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_07','Оюун','Багш','О.Оюун','elem.оюун.7@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_08','Болдмаа','Багш','Б.Болдмаа','elem.болдмаа.8@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_09','Туяа','Багш','Т.Туяа','elem.туяа.9@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_10','Жаргал','Багш','Ж.Жаргал','elem.жаргал.10@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_11','Эрдэнэ','Багш','Э.Эрдэнэ','elem.эрдэнэ.11@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_12','Чимэг','Багш','Ч.Чимэг','elem.чимэг.12@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_13','Сувд','Багш','С.Сувд','elem.сувд.13@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_14','Болор','Багш','Б.Болор','elem.болор.14@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_15','Цэцэгмаа','Багш','Ц.Цэцэгмаа','elem.цэцэгмаа.15@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_16','Ариунаа','Багш','А.Ариунаа','elem.ариунаа.16@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_17','Байгал','Багш','Б.Байгал','elem.байгал.17@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_18','Уянга','Багш','У.Уянга','elem.уянга.18@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_19','Пүрэвсүрэн','Багш','П.Пүрэвсүрэн','elem.пүрэвсүрэн.19@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_20','Отгонжаргал','Багш','О.Отгонжаргал','elem.отгонжаргал.20@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_21','Лхагвасүрэн','Багш','Л.Лхагвасүрэн','elem.лхагвасүрэн.21@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_22','Долгор','Багш','Д.Долгор','elem.долгор.22@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_23','Дулам','Багш','Д.Дулам','elem.дулам.23@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_24','Ханд','Багш','Х.Ханд','elem.ханд.24@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_25','Цолмон','Багш','Ц.Цолмон','elem.цолмон.25@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_26','Ням','Багш','Н.Ням','elem.ням.26@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_27','Даваа','Багш','Д.Даваа','elem.даваа.27@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_28','Баяр','Багш','Б.Баяр','elem.баяр.28@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_29','Солонго','Багш','С.Солонго','elem.солонго.29@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_30','Мичидмаа','Багш','М.Мичидмаа','elem.мичидмаа.30@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_31','Энхмаа','Багш','Э.Энхмаа','elem.энхмаа.31@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_32','Батцэцэг','Багш','Б.Батцэцэг','elem.батцэцэг.32@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_33','Ундармаа','Багш','У.Ундармаа','elem.ундармаа.33@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),
('ELEM_34','Гантуяа','Багш','Г.Гантуяа','elem.гантуяа.34@school1.edu.mn','ELEMENTARY','ELEMENTARY','TEACHER',6),

-- 3. МАТЕМАТИК & ГҮНЗГИЙ (MATH - 12 Багш)
('MATH_00','Ганболд','Багш','Г.Ганболд','math.0@school1.edu.mn','MATH','MIDDLE,HIGH','TEACHER',7),
('MATH_01','Батцэцэг','Багш','Б.Батцэцэг','math.1@school1.edu.mn','MATH','MIDDLE,HIGH','TEACHER',7),
('MATH_02','Баясгалан','Багш','Б.Баясгалан','math.2@school1.edu.mn','MATH','MIDDLE,HIGH','TEACHER',7),
('MATH_03','Отгонбаяр','Багш','О.Отгонбаяр','math.3@school1.edu.mn','MATH','MIDDLE,HIGH','TEACHER',7),
('MATH_04','Пүрэвсүрэн','Багш','П.Пүрэвсүрэн','math.4@school1.edu.mn','MATH','MIDDLE,HIGH','TEACHER',7),
('MATH_05','Бат-Очир','Багш','Б.Бат-Очир','math.5@school1.edu.mn','MATH','MIDDLE,HIGH','TEACHER',7),
('MATH_06','Мөнхбат','Багш','М.Мөнхбат','math.6@school1.edu.mn','MATH','MIDDLE,HIGH','TEACHER',7),
('MATH_07','Цолмон','Багш','Ц.Цолмон','math.7@school1.edu.mn','MATH','MIDDLE,HIGH','TEACHER',7),
('MATH_08','Гантуяа','Багш','Г.Гантуяа','math.8@school1.edu.mn','MATH','MIDDLE,HIGH','TEACHER',7),
('MATH_09','Батбаяр','Багш','Б.Батбаяр','math.9@school1.edu.mn','MATH','MIDDLE,HIGH','TEACHER',7),
('MATH_10','Энхболд','Багш','Э.Энхболд','math.10@school1.edu.mn','MATH','MIDDLE,HIGH','TEACHER',7),
('MATH_11','Саран','Багш','С.Саран','math.11@school1.edu.mn','MATH','MIDDLE,HIGH','TEACHER',7),

-- 4. ГАДААД ХЭЛ (FOREIGN_LANG - 10 Багш)
('LANG_00','Оюунцэцэг','Teacher','О.Оюунцэцэг','lang.0@school1.edu.mn','FOREIGN_LANG','ALL','TEACHER',6),
('LANG_01','Амаржаргал','Teacher','А.Амаржаргал','lang.1@school1.edu.mn','FOREIGN_LANG','ALL','TEACHER',6),
('LANG_02','Сайнзаяа','Teacher','С.Сайнзаяа','lang.2@school1.edu.mn','FOREIGN_LANG','ALL','TEACHER',6),
('LANG_03','Enkh-Amgalan','Teacher','E.Enkh-Amgalan','lang.3@school1.edu.mn','FOREIGN_LANG','ALL','TEACHER',6),
('LANG_04','Bolormaa','Teacher','B.Bolormaa','lang.4@school1.edu.mn','FOREIGN_LANG','ALL','TEACHER',6),
('LANG_05','Saran','Teacher','S.Saran','lang.5@school1.edu.mn','FOREIGN_LANG','ALL','TEACHER',6),
('LANG_06','Tuya','Teacher','T.Tuya','lang.6@school1.edu.mn','FOREIGN_LANG','ALL','TEACHER',6),
('LANG_07','Khaliun','Teacher','K.Khaliun','lang.7@school1.edu.mn','FOREIGN_LANG','ALL','TEACHER',6),
('LANG_08','Munkh','Teacher','M.Munkh','lang.8@school1.edu.mn','FOREIGN_LANG','ALL','TEACHER',6),
('LANG_09','Ariunaa','Teacher','A.Ariunaa','lang.9@school1.edu.mn','FOREIGN_LANG','ALL','TEACHER',6),

-- 5. МОНГОЛ ХЭЛ & УРАН ЗОХИОЛ (LANGUAGE - 10 Багш)
('MGL_00','Уртнасан','Багш','У.Уртнасан','mgl.0@school1.edu.mn','LANGUAGE','MIDDLE,HIGH','TEACHER',6),
('MGL_01','Энхжаргал','Багш','Э.Энхжаргал','mgl.1@school1.edu.mn','LANGUAGE','MIDDLE,HIGH','TEACHER',6),
('MGL_02','Баттуяа','Багш','Б.Баттуяа','mgl.2@school1.edu.mn','LANGUAGE','MIDDLE,HIGH','TEACHER',6),
('MGL_03','Энхмаа','Багш','Э.Энхмаа','mgl.3@school1.edu.mn','LANGUAGE','MIDDLE,HIGH','TEACHER',6),
('MGL_04','Цэцэгмаа','Багш','Ц.Цэцэгмаа','mgl.4@school1.edu.mn','LANGUAGE','MIDDLE,HIGH','TEACHER',6),
('MGL_05','Мөнхтуяа','Багш','М.Мөнхтуяа','mgl.5@school1.edu.mn','LANGUAGE','MIDDLE,HIGH','TEACHER',6),
('MGL_06','Ганцэцэг','Багш','Г.Ганцэцэг','mgl.6@school1.edu.mn','LANGUAGE','MIDDLE,HIGH','TEACHER',6),
('MGL_07','Болoрмаа','Багш','Б.Болoрмаа','mgl.7@school1.edu.mn','LANGUAGE','MIDDLE,HIGH','TEACHER',6),
('MGL_08','Ундармаа','Багш','У.Ундармаа','mgl.8@school1.edu.mn','LANGUAGE','MIDDLE,HIGH','TEACHER',6),
('MGL_09','Нарантуяа','Багш','Н.Нарантуяа','mgl.9@school1.edu.mn','LANGUAGE','MIDDLE,HIGH','TEACHER',6),

-- 6. БАЙГАЛИЙН УХААН (PHYSICS, CHEMISTRY, BIOLOGY, GEO, IT)
('SCI_01','Алтанхуяг','Багш','Г.Алтанхуяг','phys.1@school1.edu.mn','PHYSICS','MIDDLE,HIGH','TEACHER',6),
('SCI_02','Бат-Орших','Багш','Б.Бат-Орших','phys.2@school1.edu.mn','PHYSICS','MIDDLE,HIGH','TEACHER',6),
('SCI_03','Болормаа','Багш','С.Болормаа','chem.1@school1.edu.mn','CHEMISTRY','MIDDLE,HIGH','TEACHER',6),
('SCI_04','Энхмаа','Багш','Т.Энхмаа','chem.2@school1.edu.mn','CHEMISTRY','MIDDLE,HIGH','TEACHER',6),
('SCI_05','Батжаргал','Багш','С.Батжаргал','bio.1@school1.edu.mn','BIOLOGY','MIDDLE,HIGH','TEACHER',6),
('SCI_06','Ганхуяг','Багш','Л.Ганхуяг','bio.2@school1.edu.mn','BIOLOGY','MIDDLE,HIGH','TEACHER',6),
('SCI_07','Лхагва','Багш','Д.Лхагва','geo.1@school1.edu.mn','GEOGRAPHY','MIDDLE,HIGH','TEACHER',6),
('SCI_08','Мөнхцэцэг','Багш','Б.Мөнхцэцэг','geo.2@school1.edu.mn','GEOGRAPHY','MIDDLE,HIGH','TEACHER',6),
('SCI_09','Цэвээнсүрэн','Багш','Б.Цэвээнсүрэн','it.1@school1.edu.mn','IT','MIDDLE,HIGH','TEACHER',6),
('SCI_10','Мөнх-Эрдэнэ','Багш','С.Мөнх-Эрдэнэ','it.2@school1.edu.mn','IT','HIGH','TEACHER',6),

-- 7. НИЙГЭМ, ТҮҮХ, ЭДИЙН ЗАСАГ (HISTORY, HUMANITY)
('HIST_00','Түвшинжаргал','Багш','Т.Түвшинжаргал','hist.0@school1.edu.mn','HISTORY','MIDDLE,HIGH','TEACHER',6),
('HIST_01','Энхболд','Багш','Э.Энхболд','hist.1@school1.edu.mn','HISTORY','MIDDLE,HIGH','TEACHER',6),
('HIST_02','Наранцэцэг','Багш','Н.Наранцэцэг','hist.2@school1.edu.mn','HISTORY','MIDDLE,HIGH','TEACHER',6),
('HIST_03','Баатар','Багш','Б.Баатар','hist.3@school1.edu.mn','HISTORY','MIDDLE,HIGH','TEACHER',6),
('SOC_00','Гантуяа','Багш','Г.Гантуяа','soc.0@school1.edu.mn','HUMANITY','MIDDLE,HIGH','TEACHER',6),
('SOC_01','Солонго','Багш','С.Солонго','soc.1@school1.edu.mn','HUMANITY','MIDDLE,HIGH','TEACHER',6),
('SOC_02','Батбаяр','Багш','Б.Батбаяр','soc.2@school1.edu.mn','HUMANITY','MIDDLE,HIGH','TEACHER',6),
('SOC_03','Энхмаа','Багш','Э.Энхмаа','soc.3@school1.edu.mn','HUMANITY','MIDDLE,HIGH','TEACHER',6),

-- 8. УРЛАГ, СПОРТ, ТЕХНОЛОГИ (ART_SPORT, TECH)
('ART_01','Бат-Эрдэнэ','Данзан','Д.Бат-Эрдэнэ','pe.1@school1.edu.mn','ART_SPORT','ALL','TEACHER',8),
('ART_02','Тэмүүлэн','Бат','Б.Тэмүүлэн','pe.2@school1.edu.mn','ART_SPORT','ALL','TEACHER',8),
('ART_03','Давааням','Пүрэв','П.Давааням','chess.1@school1.edu.mn','ART_SPORT','ALL','TEACHER',6),
('ART_04','Цэцэгээ','Баяр','Б.Цэцэгээ','health.1@school1.edu.mn','HUMANITY','ALL','TEACHER',6),
('TECH_01','Болд','Сүх','С.Болд','tech.1@school1.edu.mn','TECH','MIDDLE,HIGH','TEACHER',6),
('TECH_02','Дорж','Пүрэв','П.Дорж','tech.2@school1.edu.mn','TECH','MIDDLE,HIGH','TEACHER',6),
('ART_05','Уянга','Багш','У.Уянга','art.0@school1.edu.mn','ART_SPORT','ALL','TEACHER',6),
('ART_06','Болор','Багш','Б.Болор','art.1@school1.edu.mn','ART_SPORT','ALL','TEACHER',6),
('ART_07','Чимэг','Багш','Ч.Чимэг','art.2@school1.edu.mn','ART_SPORT','ALL','TEACHER',6),
('ART_08','Сувд','Багш','С.Сувд','art.3@school1.edu.mn','ART_SPORT','ALL','TEACHER',6);

PRAGMA foreign_keys = ON;

