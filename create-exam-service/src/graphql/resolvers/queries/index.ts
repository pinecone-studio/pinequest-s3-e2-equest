import { aiSchedulerQueryResolvers } from "./ai-scheduler";
import { newMathExamQueries } from "./newMathExams";

export const queryResolvers = {
	...newMathExamQueries,
	...aiSchedulerQueryResolvers,
};
