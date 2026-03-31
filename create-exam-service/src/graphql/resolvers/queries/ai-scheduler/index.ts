import { getAiExamScheduleQuery } from "./getAiExamSchedule";
import { getStudentMainLessonsListQuery } from "./getStudentMainLessonsList";
import { getSchoolEventsQuery } from "./getSchoolEvents";
import { getStudentsListQuery } from "./getStudentsList";
import { getTeachersListQuery } from "./getTeachersList";
import { getTeacherMainLessonsListQuery } from "./getTeacherMainLessonsList";

/** AI хуваарь унших query-ууд */
export const aiSchedulerQueryResolvers = {
  ...getAiExamScheduleQuery,
	...getSchoolEventsQuery,
  ...getStudentMainLessonsListQuery,
  ...getStudentsListQuery,
  ...getTeachersListQuery,
  ...getTeacherMainLessonsListQuery,
};
