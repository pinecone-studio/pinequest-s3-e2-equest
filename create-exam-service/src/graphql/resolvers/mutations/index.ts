import { generateExamQuestionsMutation } from "./generateExamQuestions";
import { saveExamMutation } from "./saveExam";

export const mutationResolvers = {
	...generateExamQuestionsMutation,
	...saveExamMutation,
};
