import { gql } from "@apollo/client";

export const GenerateExamQuestionsDocument = gql(`
	mutation GenerateExamQuestions($input: ExamGenerationInput!) {
		generateExamQuestions(input: $input) {
			examId
			questions {
				id
				text
				format
				difficulty
				options
				correctAnswer
				explanation
			}
		}
	}
`);

export const SaveExamDocument = gql(`
	mutation SaveExam($input: SaveExamInput!) {
		saveExam(input: $input) {
			examId
			status
		}
	}
`);

export const SaveNewMathExamDocument = gql(`
	mutation SaveNewMathExam($input: SaveNewMathExamInput!) {
		saveNewMathExam(input: $input) {
			examId
			title
			createdAt
			updatedAt
		}
	}
`);

export const ListNewMathExamsDocument = gql(`
	query ListNewMathExams($limit: Int = 50) {
		listNewMathExams(limit: $limit) {
			examId
			title
			updatedAt
		}
	}
`);

export const AnalyzeQuestionDocument = gql(`
	mutation AnalyzeQuestion($prompt: String!) {
		analyzeQuestion(prompt: $prompt) {
			difficulty
			points
			tags
			explanation
			options
			correctAnswer
			suggestedType
			source
			skillLevel
		}
	}
`);

export const CreateAiExamTemplateDocument = gql(`
	mutation CreateAiExamTemplate($input: CreateAiExamTemplateInput!) {
		createAiExamTemplate(input: $input) {
			templateId
			title
			totalPoints
			difficulty
			createdAt
		}
	}
`);

/** Жишээ / баримтын нэрээр ашиглах бол (AnalyzeQuestionDocument-тай ижил). */
export const ANALYZE_QUESTION = AnalyzeQuestionDocument;

/** Жишээ / баримтын нэрээр ашиглах бол (CreateAiExamTemplateDocument-тай ижил). */
export const CREATE_AI_EXAM_TEMPLATE = CreateAiExamTemplateDocument;

export const RequestExamScheduleDocument = gql(`
	mutation RequestExamSchedule(
		$testId: ID!
		$classId: String!
		$preferredDate: String!
	) {
		requestExamSchedule(
			testId: $testId
			classId: $classId
			preferredDate: $preferredDate
		) {
			success
			message
			examId
		}
	}
`);

export const GetNewMathExamDocument = gql(`
	query GetNewMathExam($examId: ID!) {
		getNewMathExam(examId: $examId) {
			examId
			title
			mcqCount
			mathCount
			totalPoints
			generator {
				difficulty
				topics
				sourceContext
			}
			sessionMeta {
				grade
				groupClass
				examType
				subject
				topics
				teacherId
				roomId
				examDate
				startTime
				endTime
				durationMinutes
				mixQuestions
				withVariants
				variantCount
				description
			}
			questions {
				id
				type
				prompt
				points
				imageAlt
				imageDataUrl
				options
				correctOption
				responseGuide
				answerLatex
			}
			createdAt
			updatedAt
		}
	}
`);
