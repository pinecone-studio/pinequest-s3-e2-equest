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

export const RequestExamVariantsDocument = gql(`
	mutation RequestExamVariants($input: RequestExamVariantsInput!) {
		requestExamVariants(input: $input) {
			success
			message
			jobId
		}
	}
`);

export const ConfirmExamVariantDocument = gql(`
	mutation ConfirmExamVariant($input: ConfirmExamVariantInput!) {
		confirmExamVariant(input: $input) {
			success
			message
			variant {
				id
				status
				confirmedAt
				savedAt
				savedExamId
			}
		}
	}
`);

export const ConfirmExamVariantsDocument = gql(`
	mutation ConfirmExamVariants($inputs: [ConfirmExamVariantInput!]!) {
		confirmExamVariants(inputs: $inputs) {
			success
			message
			variants {
				id
				status
				confirmedAt
				savedAt
				savedExamId
			}
		}
	}
`);

export const SaveExamVariantDocument = gql(`
	mutation SaveExamVariant($input: SaveExamVariantInput!) {
		saveExamVariant(input: $input) {
			success
			message
			examId
			variant {
				id
				status
				confirmedAt
				savedAt
				savedExamId
			}
		}
	}
`);

export const SaveExamVariantsDocument = gql(`
	mutation SaveExamVariants($inputs: [SaveExamVariantInput!]!) {
		saveExamVariants(inputs: $inputs) {
			success
			message
			examIds
			variants {
				id
				status
				confirmedAt
				savedAt
				savedExamId
			}
		}
	}
`);

export const GetExamVariantJobDocument = gql(`
	query GetExamVariantJob($jobId: ID!) {
		getExamVariantJob(jobId: $jobId) {
			jobId
			examId
			status
			variantCount
			sourceQuestionsJson
			resultJson
			errorMessage
			requestedBy
			requestedAt
			startedAt
			completedAt
			updatedAt
			variants {
				id
				jobId
				examId
				variantNumber
				title
				status
				confirmedAt
				savedAt
				savedExamId
				createdAt
				updatedAt
				questions {
					id
					position
					type
					prompt
					options
					correctAnswer
					explanation
				}
			}
		}
	}
`);

export const ListNewMathExamsDocument = gql(`
	query ListNewMathExams($limit: Int = 50, $offset: Int = 0, $filters: ListNewMathExamsFilterInput) {
		listNewMathExams(limit: $limit, offset: $offset, filters: $filters) {
			examId
			title
			grade
			examType
			subject
			teacherId
			withVariants
			variantCount
			questionCount
			durationMinutes
			firstQuestionPreview
			secondQuestionPreview
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

export const GenerateQuestionAnswerDocument = gql(`
	mutation GenerateQuestionAnswer($input: GenerateQuestionAnswerInput!) {
		generateQuestionAnswer(input: $input) {
			questionText
			format
			difficulty
			points
			options
			correctAnswer
			explanation
		}
	}
`);

export const RegenerateQuestionAnswerDocument = gql(`
	mutation RegenerateQuestionAnswer($input: RegenerateQuestionAnswerInput!) {
		regenerateQuestionAnswer(input: $input) {
			questionText
			format
			difficulty
			points
			options
			correctAnswer
			explanation
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

export const GetAiExamScheduleDocument = gql(`
	query GetAiExamSchedule($examId: ID!) {
		getAiExamSchedule(examId: $examId) {
			id
			testId
			classId
			startTime
			endTime
			roomId
			status
			aiReasoning
			aiVariants {
				id
				label
				startTime
				roomId
				reason
			}
			createdAt
			updatedAt
		}
	}
`);

export const ListTeacherConfirmedExamSchedulesDocument = gql(`
	query ListTeacherConfirmedExamSchedules(
		$teacherId: ID!
		$startDate: String!
		$endDate: String!
	) {
		listTeacherConfirmedExamSchedules(
			teacherId: $teacherId
			startDate: $startDate
			endDate: $endDate
		) {
			id
			testId
			classId
			startTime
			endTime
			roomId
			status
			aiReasoning
			aiVariants {
				id
				label
				startTime
				roomId
				reason
			}
			createdAt
			updatedAt
		}
	}
`);

export const GetTeachersListDocument = gql(`
	query GetTeachersList($grades: [Int!]) {
		getTeachersList(grades: $grades) {
			id
			firstName
			lastName
			shortName
			email
			department
			teachingLevel
			role
			workLoadLimit
		}
	}
`);

export const GetStudentsListDocument = gql(`
	query GetStudentsList($grade: Int!, $group: String!) {
		getStudentsList(grade: $grade, group: $group) {
			id
			firstName
			lastName
			studentCode
			groupId
			gradeLevel
			homeRoomNumber
			status
		}
	}
`);

export const GetStudentMainLessonsListDocument = gql(`
	query GetStudentMainLessonsList(
		$studentId: ID!
		$semesterId: String = "2026-SPRING"
		$includeDraft: Boolean = false
	) {
		getStudentMainLessonsList(
			studentId: $studentId
			semesterId: $semesterId
			includeDraft: $includeDraft
		) {
			id
			dayOfWeek
			semesterId
			isDraft
			groupId
			gradeLevel
			subjectId
			subjectName
			teacherId
			teacherShortName
			classroomId
			classroomRoomNumber
			periodId
			periodShift
			periodNumber
			startTime
			endTime
		}
	}
`);

export const GetSchoolEventsDocument = gql(`
	query GetSchoolEvents($startDate: String!, $endDate: String!) {
		getSchoolEvents(startDate: $startDate, endDate: $endDate) {
			id
			title
			description
			eventType
			priority
			urgencyLevel
			targetType
			isSchoolWide
			isFullLock
			repeatPattern
			startDate
			endDate
			startPeriodId
			endPeriodId
			colorCode
			groupIds
			teacherIds
		}
	}
`);

export const GetTeacherMainLessonsListDocument = gql(`
	query GetTeacherMainLessonsList(
		$teacherId: ID!
		$semesterId: String = "2026-SPRING"
		$includeDraft: Boolean = false
	) {
		getTeacherMainLessonsList(
			teacherId: $teacherId
			semesterId: $semesterId
			includeDraft: $includeDraft
		) {
			id
			dayOfWeek
			semesterId
			isDraft
			groupId
			gradeLevel
			subjectId
			subjectName
			classroomId
			classroomRoomNumber
			periodId
			periodShift
			periodNumber
			startTime
			endTime
		}
	}
`);

export const GetTeacherAvailabilityDocument = gql(`
	query GetTeacherAvailability($teacherId: ID!) {
		getTeacherAvailability(teacherId: $teacherId) {
			id
			dayOfWeek
			periodId
			status
			reason
			startTime
			endTime
		}
	}
`);

export const ApproveAiExamScheduleDocument = gql(`
	mutation ApproveAiExamSchedule($examId: ID!, $variantId: String!) {
		approveAiExamSchedule(examId: $examId, variantId: $variantId) {
			id
			startTime
			endTime
			roomId
			status
			aiReasoning
			aiVariants {
				id
				label
				startTime
				roomId
				reason
			}
		}
	}
`);

export const RejectAiExamScheduleVariantDocument = gql(`
	mutation RejectAiExamScheduleVariant(
		$examId: ID!
		$variantId: String!
		$reason: String
	) {
		rejectAiExamScheduleVariant(
			examId: $examId
			variantId: $variantId
			reason: $reason
		) {
			id
			startTime
			endTime
			roomId
			status
			aiReasoning
			aiVariants {
				id
				label
				startTime
				roomId
				reason
			}
		}
	}
`);

export const RequestAiExamScheduleDocument = gql(`
	mutation RequestAiExamSchedule(
		$testId: ID!
		$classId: String!
		$preferredDate: String!
	) {
		requestAiExamSchedule(
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
