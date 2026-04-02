import { aiSchedulerQueryResolvers } from "./ai-scheduler";
import { examVariantJobQueries } from "./examVariantJobs";
import { newMathExamQueries } from "./newMathExams";

export const queryResolvers = {
	...newMathExamQueries,
	...examVariantJobQueries,
	...aiSchedulerQueryResolvers,
};
