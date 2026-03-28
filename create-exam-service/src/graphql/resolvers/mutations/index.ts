import { analyzeQuestionMutation } from "./analyzeQuestion";
import { createAiExamTemplateMutation } from "./createAiExamTemplate";
import { generateExamQuestionsMutation } from "./generateExamQuestions";
import { requestExamScheduleMutation } from "./requestExamSchedule";
import { saveExamMutation } from "./saveExam";
import { saveNewMathExamMutation } from "./saveNewMathExam";

export const mutationResolvers = {
	...generateExamQuestionsMutation,
	...saveExamMutation,
	...saveNewMathExamMutation,
	...analyzeQuestionMutation,
	...createAiExamTemplateMutation,
	...requestExamScheduleMutation,
};
