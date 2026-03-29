import { approveAiExamScheduleMutation } from "./approveAiExamSchedule";
import { requestAiExamScheduleMutation } from "./requestAiExamSchedule";

/** AI хуваарь: дараалал + багшийн баталгаа */
export const aiSchedulerMutationResolvers = {
	...requestAiExamScheduleMutation,
	...approveAiExamScheduleMutation,
};
