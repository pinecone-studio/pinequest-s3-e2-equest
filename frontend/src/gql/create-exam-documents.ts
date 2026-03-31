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
