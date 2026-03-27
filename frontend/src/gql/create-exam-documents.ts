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
