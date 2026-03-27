import { healthQuery } from "./health";
import { newMathExamQueries } from "./newMathExams";

export const queryResolvers = {
	...healthQuery,
	...newMathExamQueries,
};
