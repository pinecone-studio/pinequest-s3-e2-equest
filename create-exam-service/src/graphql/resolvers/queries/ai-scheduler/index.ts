import { getAiExamScheduleQuery } from "./getAiExamSchedule";
import { getStudentMainLessonsListQuery } from "./getStudentMainLessonsList";
import { getStudentsListQuery } from "./getStudentsList";
import { getTeachersListQuery } from "./getTeachersList";
import { getTeacherMainLessonsListQuery } from "./getTeacherMainLessonsList";

/** AI хуваарь унших query-ууд */
export const aiSchedulerQueryResolvers = {
  ...getAiExamScheduleQuery,
  ...getStudentMainLessonsListQuery,
  ...getStudentsListQuery,
  ...getTeachersListQuery,
  ...getTeacherMainLessonsListQuery,
};
