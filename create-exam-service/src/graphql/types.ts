/** GraphQL `ExamGenerationInput`-тай тааруулсан TS төрөл */
export type ExamGenerationInput = {
	gradeClass: string;
	subject: string;
	examType: string;
	topicScope: string;
	examDate: string;
	examTime: string;
	durationMinutes: number;
	totalQuestionCount: number;
	difficultyDistribution: {
		easy: number;
		medium: number;
		hard: number;
	};
	difficultyPoints?: {
		easyPoints?: number | null;
		mediumPoints?: number | null;
		hardPoints?: number | null;
	} | null;
	difficultyFormats: {
		easy: string;
		medium: string;
		hard: string;
	};
};

export type GeneratedQuestionPayload = {
	text: string;
	format: string;
	difficulty: string;
	options?: string[] | null;
	correctAnswer?: string | null;
	explanation?: string | null;
};
