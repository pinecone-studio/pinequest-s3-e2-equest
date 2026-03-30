-- Disable FK checks during seed to avoid failures on partially-migrated DBs.
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`requires_lab` integer NOT NULL DEFAULT 0,
	`category` text NOT NULL,
	`level` text NOT NULL DEFAULT 'MIDDLE',
	`status` text NOT NULL DEFAULT 'ACTIVE'
);

DELETE FROM subjects;

INSERT INTO subjects (id, name, requires_lab, category, level, status) VALUES
-- ELEMENTARY (1-5)
('MATH_ELEM','Математик (Бага анги)',0,'STEM','ELEMENTARY','ACTIVE'),
('MON_ELEM','Монгол хэл (Бага анги)',0,'LANGUAGE','ELEMENTARY','ACTIVE'),
('SCI_ENV','Хүн ба орчин',0,'STEM','ELEMENTARY','ACTIVE'),
('SCI_SOC','Хүн ба нийгэм',0,'HUMANITY','ELEMENTARY','ACTIVE'),
('ART_ELEM','Дүрслэх урлаг, Технологи',0,'ART_SPORT','ELEMENTARY','ACTIVE'),
('MUS_ELEM','Хөгжим (Бага анги)',0,'ART_SPORT','ELEMENTARY','ACTIVE'),
('PE_ELEM','Биеийн тамир (Бага анги)',0,'ART_SPORT','ELEMENTARY','ACTIVE'),

-- MIDDLE (6-9)
('MATH_MID','Математик (Дунд анги)',0,'STEM','MIDDLE','ACTIVE'),
('MON_LNG_MID','Монгол хэл (Дунд анги)',0,'LANGUAGE','MIDDLE','ACTIVE'),
('MON_SCR_MID','Монгол бичиг (Дунд анги)',0,'LANGUAGE','MIDDLE','ACTIVE'),
('MON_LIT_MID','Уран зохиол (Дунд анги)',0,'LANGUAGE','MIDDLE','ACTIVE'),
('PHYS_MID','Физик (Суурь)',1,'STEM','MIDDLE','ACTIVE'),
('CHEM_MID','Хими (Суурь)',1,'STEM','MIDDLE','ACTIVE'),
('BIO_MID','Биологи (Суурь)',1,'STEM','MIDDLE','ACTIVE'),
('HIST_MID','Түүх (Дунд анги)',0,'HUMANITY','MIDDLE','ACTIVE'),
('GEO_MID','Газар зүй (Дунд анги)',0,'HUMANITY','MIDDLE','ACTIVE'),
('ENG_MID','Англи хэл (Дунд анги)',0,'LANGUAGE','MIDDLE','ACTIVE'),
('FRN_MID','Франц хэл (Дунд анги)',0,'LANGUAGE','MIDDLE','ACTIVE'),
('IT_MID','Мэдээлэл зүй (Дунд анги)',1,'STEM','MIDDLE','ACTIVE'),

-- HIGH (10-12)
('ALG_HIGH','Алгебр (Ахлах анги)',0,'STEM','HIGH','ACTIVE'),
('GEO_HIGH','Геометр (Ахлах анги)',0,'STEM','HIGH','ACTIVE'),
('MATH_SEL','Сонгон Математик (Олимпиад)',0,'STEM','HIGH','ACTIVE'),
('PHYS_HIGH','Физик (Гүнзгий)',1,'STEM','HIGH','ACTIVE'),
('CHEM_HIGH','Хими (Гүнзгий)',1,'STEM','HIGH','ACTIVE'),
('BIO_HIGH','Биологи (Гүнзгий)',1,'STEM','HIGH','ACTIVE'),
('IT_PROG','Програмчлал (Мэдээлэл зүй II)',1,'STEM','HIGH','ACTIVE'),
('ENG_SEL','Сонгон Англи хэл (IELTS/TOEFL)',0,'LANGUAGE','HIGH','ACTIVE'),
('FRN_HIGH','Франц хэл (Гүнзгий)',0,'LANGUAGE','HIGH','ACTIVE'),
('ECON_BUS','Эдийн засаг / Бизнес судлал',0,'HUMANITY','HIGH','ACTIVE'),
('SOC_HIGH','Нийгэм судлал (Ахлах анги)',0,'HUMANITY','HIGH','ACTIVE'),

-- ALL LEVELS
('CHESS','Шатар',0,'ART_SPORT','ALL','ACTIVE'),
('HEALTH_EDU','Эрүүл мэнд',0,'HUMANITY','ALL','ACTIVE'),
('PE_GEN','Биеийн тамир',0,'ART_SPORT','ALL','ACTIVE');

PRAGMA foreign_keys = ON;

