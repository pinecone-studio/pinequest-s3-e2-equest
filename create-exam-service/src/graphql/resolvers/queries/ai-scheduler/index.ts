import { getAiExamScheduleQuery } from "./getAiExamSchedule";
import { getTeachersListQuery } from "./getTeachersList";
import { getTeacherMainLessonsListQuery } from "./getTeacherMainLessonsList";

/** AI хуваарь унших query-ууд */
export const aiSchedulerQueryResolvers = {
	...getAiExamScheduleQuery,
	...getTeachersListQuery,
	...getTeacherMainLessonsListQuery,
};
