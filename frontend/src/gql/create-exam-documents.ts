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
			createdAt
			updatedAt
		}
	}
`);
