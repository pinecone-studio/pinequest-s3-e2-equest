ALTER TABLE `school_calendar_events` ADD `layer_kind` text DEFAULT 'academic_milestone' NOT NULL;

UPDATE `school_calendar_events` SET `layer_kind` = CASE `category`
	WHEN 'ACADEMIC' THEN 'academic_milestone'
	WHEN 'ADMIN' THEN 'admin_fixed'
	WHEN 'RESOURCE_CONSTRAINT' THEN 'resource_lock'
	WHEN 'CAMPUS_LIFE' THEN 'holiday'
	ELSE 'academic_milestone'
END;
