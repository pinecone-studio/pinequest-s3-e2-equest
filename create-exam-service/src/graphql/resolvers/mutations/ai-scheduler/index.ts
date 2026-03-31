import { approveAiExamScheduleMutation } from "./approveAiExamSchedule";
import { rejectAiExamScheduleVariantMutation } from "./rejectAiExamScheduleVariant";
import { requestAiExamScheduleMutation } from "./requestAiExamSchedule";

/** AI хуваарь: дараалал + багшийн баталгаа */
export const aiSchedulerMutationResolvers = {
	...requestAiExamScheduleMutation,
	...approveAiExamScheduleMutation,
	...rejectAiExamScheduleVariantMutation,
};
