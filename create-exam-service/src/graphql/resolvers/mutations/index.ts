import { generateExamQuestionsMutation } from "./generateExamQuestions";
import { saveExamMutation } from "./saveExam";
import { saveNewMathExamMutation } from "./saveNewMathExam";

export const mutationResolvers = {
	...generateExamQuestionsMutation,
	...saveExamMutation,
	...saveNewMathExamMutation,
};
