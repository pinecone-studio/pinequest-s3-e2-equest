import { getAiExamScheduleQuery } from "./getAiExamSchedule";
import { getStudentMainLessonsListQuery } from "./getStudentMainLessonsList";
import { getSchoolEventsQuery } from "./getSchoolEvents";
import { getStudentsListQuery } from "./getStudentsList";
import { getTeachersListQuery } from "./getTeachersList";
import { listTeacherConfirmedExamSchedulesQuery } from "./listTeacherConfirmedExamSchedules";
import { getTeacherMainLessonsListQuery } from "./getTeacherMainLessonsList";
import { getTeacherAvailabilityQuery } from "./getTeacherAvailability";

/** AI хуваарь унших query-ууд */
export const aiSchedulerQueryResolvers = {
  ...getAiExamScheduleQuery,
  ...listTeacherConfirmedExamSchedulesQuery,
	...getSchoolEventsQuery,
  ...getStudentMainLessonsListQuery,
  ...getStudentsListQuery,
  ...getTeachersListQuery,
  ...getTeacherMainLessonsListQuery,
  ...getTeacherAvailabilityQuery,
};
