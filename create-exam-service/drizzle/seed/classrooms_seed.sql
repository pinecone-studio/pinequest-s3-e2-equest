-- Disable FK checks during seed to avoid failures on partially-migrated DBs.
PRAGMA foreign_keys = OFF;

-- Safety: some remote DBs may not have `classrooms` if legacy migrations
-- were not applied or tables were manually dropped.
CREATE TABLE IF NOT EXISTS `classrooms` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text,
  `capacity` integer NOT NULL DEFAULT 30,
  `floor` integer,
  `type` text NOT NULL DEFAULT 'NORMAL',
  `has_projector` integer NOT NULL DEFAULT 0,
  `has_smart_board` integer NOT NULL DEFAULT 0,
  `is_shared` integer NOT NULL DEFAULT 0,
  `status` text NOT NULL DEFAULT 'AVAILABLE',
  `created_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
  `updated_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
  -- legacy columns
  `room_number` text NOT NULL,
  `is_lab` integer NOT NULL DEFAULT 0
);

DELETE FROM classrooms;

-- NOTE: `room_number` + `is_lab` are legacy NOT NULL columns in older migrations.
-- We keep them populated for backward compatibility.

INSERT INTO classrooms (
  id,
  room_number,
  name,
  capacity,
  floor,
  type,
  has_projector,
  has_smart_board,
  is_shared,
  status,
  is_lab
) VALUES
-- 1-р давхар (нийтийн бүс & захиргаа)
('WAHT','WAHT','Вахт (Жижүүрийн хэсэг)',10,1,'NORMAL',0,0,1,'AVAILABLE',0),
('CLOAK_1','CLOAK_1','Өлгүүр 1',300,1,'NORMAL',0,0,1,'AVAILABLE',0),
('CLOAK_2','CLOAK_2','Өлгүүр 2',300,1,'NORMAL',0,0,1,'AVAILABLE',0),
('ACT','ACT','Урлаг заал (Актовый зал)',150,1,'LECTURE',1,0,1,'AVAILABLE',0),
('CANTEEN','CANTEEN','Цайны газар',120,1,'NORMAL',0,0,1,'AVAILABLE',0),
('BOARD_ROOM','BOARD_ROOM','Зөвлөлийн танхим (10 тоот)',30,1,'LECTURE',1,0,0,'AVAILABLE',0),

-- 2-р давхар (захиргаа, спорт, дунд анги 21-29)
('GYM','GYM','Төв спорт заал',80,2,'GYM',0,0,1,'AVAILABLE',0),
('STAFF_MAIN','STAFF_MAIN','Багш нарын өрөө (Төв)',45,2,'NORMAL',0,0,1,'AVAILABLE',0),
('LIB','LIB','Төв номын сан',50,2,'LECTURE',1,0,0,'AVAILABLE',0),
('21','21','Англи хэлний кабинет I',30,2,'NORMAL',1,0,0,'AVAILABLE',0),
('22','22','Орос хэлний кабинет',30,2,'NORMAL',0,0,0,'AVAILABLE',0),
('23','23','Хөгжмийн кабинет',35,2,'NORMAL',0,0,0,'AVAILABLE',0),
('24','24','Дүрслэх урлагийн кабинет',25,2,'NORMAL',0,0,0,'AVAILABLE',0),
('25','25','Хичээлийн анги 25',32,2,'NORMAL',0,0,0,'AVAILABLE',0),
('26','26','Хичээлийн анги 26',32,2,'NORMAL',1,0,0,'AVAILABLE',0),
('27','27','Хичээлийн анги 27',32,2,'NORMAL',0,0,0,'AVAILABLE',0),
('28','28','Хичээлийн анги 28',32,2,'NORMAL',1,0,0,'AVAILABLE',0),
('29','29','Хичээлийн анги 29',32,2,'NORMAL',0,0,0,'AVAILABLE',0),

-- 3-р давхар (математик, байгалийн ухаан 30-39)
('30','30','Математикийн кабинет (Гүнзгий)',32,3,'NORMAL',1,1,0,'AVAILABLE',0),
('31','31','Шатрын өрөө',20,3,'NORMAL',0,0,0,'AVAILABLE',0),
('32','32','Физик Лаборатори',30,3,'LAB',1,1,0,'AVAILABLE',1),
('33','33','Химийн Лаборатори',26,3,'LAB',0,1,0,'AVAILABLE',1),
('34','34','Технологийн кабинет (Эрэгтэй)',22,3,'LAB',0,0,0,'AVAILABLE',1),
('35','35','Технологийн кабинет (Эмэгтэй)',22,3,'LAB',0,0,0,'AVAILABLE',1),
('36','36','Биологийн кабинет',30,3,'LAB',1,0,0,'AVAILABLE',1),
('37','37','Хичээлийн анги 37',32,3,'NORMAL',1,0,0,'AVAILABLE',0),
('38','38','Хичээлийн анги 38',32,3,'NORMAL',1,0,0,'AVAILABLE',0),
('39','39','Хичээлийн анги 39',32,3,'NORMAL',1,0,0,'AVAILABLE',0),

-- 4-р давхар (МТ, Монгол хэл, ахлах анги 40-49)
('40','40','Мэдээлэл зүйн лаборатори I',25,4,'LAB',1,1,0,'AVAILABLE',1),
('41','41','Мэдээлэл зүйн лаборатори II',25,4,'LAB',1,0,0,'AVAILABLE',1),
('42','42','Түүхийн кабинет',32,4,'NORMAL',1,0,0,'AVAILABLE',0),
('43','43','Газар зүй / Хүн ба орчин',32,4,'NORMAL',0,0,0,'AVAILABLE',0),
('44','44','Шугам зургийн кабинет',28,4,'NORMAL',0,0,0,'AVAILABLE',0),
('45','45','Монгол хэлний кабинет (А)',35,4,'NORMAL',1,1,0,'AVAILABLE',0),
('46','46','Монгол хэлний кабинет (Б)',35,4,'NORMAL',1,0,0,'AVAILABLE',0),
('47','47','Монгол хэлний кабинет (В)',35,4,'NORMAL',1,0,0,'AVAILABLE',0),
('48','48','Нийгэм судлалын кабинет',32,4,'NORMAL',1,0,0,'AVAILABLE',0),
('49','49','Хичээлийн анги 49',34,4,'NORMAL',0,0,0,'AVAILABLE',0);

-- Re-enable FK checks after seed.
PRAGMA foreign_keys = ON;

