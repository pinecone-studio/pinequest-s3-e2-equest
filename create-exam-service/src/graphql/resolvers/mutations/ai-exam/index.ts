import { analyzeQuestionMutation } from "./analyzeQuestion";
import { confirmExamVariantMutation } from "./confirmExamVariant";
import { createAiExamTemplateMutation } from "./createAiExamTemplate";
import { generateQuestionAnswerMutation } from "./generateQuestionAnswer";
import { generateExamQuestionsMutation } from "./generateExamQuestions";
import { regenerateQuestionAnswerMutation } from "./regenerateQuestionAnswer";
import { requestExamVariantsMutation } from "./requestExamVariants";
import { saveExamVariantMutation } from "./saveExamVariant";

/** AI шалгалт үүсгэх / загвар / асуулт шинжлэх */
export const aiExamMutationResolvers = {
	...analyzeQuestionMutation,
	...confirmExamVariantMutation,
	...createAiExamTemplateMutation,
	...generateQuestionAnswerMutation,
	...generateExamQuestionsMutation,
	...regenerateQuestionAnswerMutation,
	...requestExamVariantsMutation,
	...saveExamVariantMutation,
};
