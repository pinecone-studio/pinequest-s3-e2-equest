PRAGMA foreign_keys = OFF;

-- Drift guard: ensure table exists (same shape as migration 0026).
CREATE TABLE IF NOT EXISTS `teacher_subjects` (
	`teacher_id` text NOT NULL,
	`subject_id` text NOT NULL,
	PRIMARY KEY (`teacher_id`, `subject_id`),
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);

DELETE FROM teacher_subjects;

-- ELEMENTARY department: elementary core set
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id
FROM users u
JOIN subjects s
WHERE u.department = 'ELEMENTARY'
  AND s.id IN ('MATH_ELEM','MON_ELEM','SCI_ENV','SCI_SOC','ART_ELEM','MUS_ELEM','PE_ELEM');

-- MATH department: middle + high math set
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id
FROM users u
JOIN subjects s
WHERE u.department = 'MATH'
  AND s.id IN ('MATH_MID','ALG_HIGH','GEO_HIGH','MATH_SEL');

-- PHYSICS department
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id
FROM users u
JOIN subjects s
WHERE u.department = 'PHYSICS'
  AND s.id IN ('PHYS_MID','PHYS_HIGH');

-- CHEMISTRY department
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id
FROM users u
JOIN subjects s
WHERE u.department = 'CHEMISTRY'
  AND s.id IN ('CHEM_MID','CHEM_HIGH');

-- BIOLOGY department
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id
FROM users u
JOIN subjects s
WHERE u.department = 'BIOLOGY'
  AND s.id IN ('BIO_MID','BIO_HIGH');

-- IT department
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id
FROM users u
JOIN subjects s
WHERE u.department = 'IT'
  AND s.id IN ('IT_MID','IT_PROG');

-- LANGUAGE department (Mongolian): middle core + high elective
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id
FROM users u
JOIN subjects s
WHERE u.department = 'LANGUAGE'
  AND s.id IN ('MON_LNG_MID','MON_SCR_MID','MON_LIT_MID','ENG_SEL');

-- FOREIGN_LANG department: English/ French (middle) + electives (high)
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id
FROM users u
JOIN subjects s
WHERE u.department = 'FOREIGN_LANG'
  AND s.id IN ('ENG_MID','FRN_MID','ENG_SEL','FRN_HIGH');

-- HISTORY department
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id
FROM users u
JOIN subjects s
WHERE u.department = 'HISTORY'
  AND s.id IN ('HIST_MID');

-- HUMANITY department: geography, economics, society, health
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id
FROM users u
JOIN subjects s
WHERE u.department = 'HUMANITY'
  AND s.id IN ('GEO_MID','ECON_BUS','SOC_HIGH','HEALTH_EDU','SCI_SOC');

-- ART_SPORT department: PE + Chess (and elementary PE)
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id
FROM users u
JOIN subjects s
WHERE u.department = 'ART_SPORT'
  AND s.id IN ('PE_ELEM','PE_GEN','CHESS','ART_ELEM','MUS_ELEM');

-- TECH department
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id
FROM users u
JOIN subjects s
WHERE u.department = 'TECH'
  AND s.id IN ('ART_ELEM');

PRAGMA foreign_keys = ON;

