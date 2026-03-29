import { aiExamMutationResolvers } from "./ai-exam";
import { aiSchedulerMutationResolvers } from "./ai-scheduler";
import { saveExamMutation } from "./saveExam";
import { saveNewMathExamMutation } from "./saveNewMathExam";

export const mutationResolvers = {
	...aiExamMutationResolvers,
	...aiSchedulerMutationResolvers,
	...saveExamMutation,
	...saveNewMathExamMutation,
};
