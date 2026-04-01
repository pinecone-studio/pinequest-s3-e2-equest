import { analyzeQuestionMutation } from "./analyzeQuestion";
import { createAiExamTemplateMutation } from "./createAiExamTemplate";
import { generateQuestionAnswerMutation } from "./generateQuestionAnswer";
import { generateExamQuestionsMutation } from "./generateExamQuestions";

/** AI шалгалт үүсгэх / загвар / асуулт шинжлэх */
export const aiExamMutationResolvers = {
	...analyzeQuestionMutation,
	...createAiExamTemplateMutation,
	...generateQuestionAnswerMutation,
	...generateExamQuestionsMutation,
};
