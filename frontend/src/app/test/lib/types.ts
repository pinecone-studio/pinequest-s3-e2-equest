export type StudentStatus =
  | "in-progress"
  | "processing"
  | "submitted"
  | "approved";
export type RiskLevel = "low" | "medium" | "high";
export type MonitoringState =
  | "online"
  | "offline"
  | "reconnected"
  | "tab-hidden"
  | "device-switch"
  | "idle";
export type EventSeverity = "info" | "warning" | "danger";
export type AiContentSource = "ollama" | "gemini" | "cf-ai" | "fallback";

export interface Exam {
  id: string;
  title: string;
  subject: string;
  topic: string;
  questionCount: number;
  liveStudentCount: number;
  totalStudentCount: number;
  averageScore?: number;
  startTime: Date;
  endTime?: Date;
  class: string;
}

export interface Student {
  id: string;
  name: string;
  studentId: string;
  status: StudentStatus;
  progress: number;
  riskLevel: RiskLevel;
  warningCount: number;
  dangerCount: number;
  score?: number;
  lastActivity: Date;
  monitoringState: MonitoringState;
  avatar?: string;
}

export interface MonitoringEvent {
  code?: string;
  count?: number;
  id: string;
  studentId: string;
  studentName: string;
  type:
    | "focus-lost"
    | "idle"
    | "offline"
    | "reconnected"
    | "device-switch"
    | "submitted"
    | "answer-revision";
  severity: EventSeverity;
  title: string;
  detail: string;
  timestamp: Date;
}

export interface AnalyticsScoreBucket {
  range: string;
  count: number;
}

export interface AnalyticsRiskSlice {
  name: string;
  value: number;
  color: string;
}

export interface AnalyticsFocusArea {
  topic: string;
  avgScore: number;
  affectedStudents?: number;
  insight?: string;
}

export interface AnalyticsQuestionTime {
  question: string;
  avgTime: string;
  relativeTime: number;
}

export interface AnalyticsAnswerChange {
  question: string;
  changes: number;
  students: number;
}

export interface AnalyticsTimelinePoint {
  time: string;
  warnings: number;
  dangers: number;
}

export interface ExamAnalytics {
  answerChanges: AnalyticsAnswerChange[];
  dangerTimeline: AnalyticsTimelinePoint[];
  focusAreas: AnalyticsFocusArea[];
  riskDistribution: AnalyticsRiskSlice[];
  scoreDistribution: AnalyticsScoreBucket[];
  slowestQuestions: AnalyticsQuestionTime[];
}

export interface ExamFocusAnalysis {
  areas: AnalyticsFocusArea[];
  generatedAt: string;
  model?: string;
  source: AiContentSource;
  summary?: string;
}

export interface OllamaConnectionStatus {
  baseUrl?: string;
  error?: string;
  lastCheckedAt?: string;
  model: string;
  modelAvailable: boolean;
  reachable: boolean;
  remote?: boolean;
}

export interface AblyConnectionStatus {
  error?: string;
  lastCheckedAt?: string;
  state: "checking" | "connecting" | "connected" | "disconnected" | "failed";
}

export interface QuestionReview {
  aiAnalysis?: string;
  aiSource?: AiContentSource;
  competency?: string;
  id: string;
  questionNumber: number;
  questionText: string;
  questionType?: string;
  requiresManualReview?: boolean;
  studentAnswer: string;
  correctAnswer: string;
  reviewState: "correct" | "incorrect" | "pending";
  points: number;
  maxPoints: number;
  explanation?: string;
}

export interface AttemptFeedbackSummary {
  headline: string;
  summary: string;
  strengths: string[];
  improvements: string[];
}

export interface SubmittedAttempt {
  id: string;
  studentId: string;
  studentName: string;
  submissionTime: Date;
  status: "pending" | "in-review" | "reviewed";
  reviewableItems: number;
  answerKeySource: string;
  score?: number;
  questions: QuestionReview[];
  feedback?: AttemptFeedbackSummary;
  monitoringSummary: {
    warningCount: number;
    dangerCount: number;
    focusLostCount: number;
    deviceSwitchCount: number;
    events: Array<{
      code?: string;
      detail: string;
      id: string;
      occurredAt: Date;
      severity: EventSeverity;
      title: string;
      type: "warning" | "danger" | "focus";
    }>;
  };
}
