import {
  chatWithOllama,
  DEFAULT_OLLAMA_MODEL,
  fetchOllamaJson,
  isRemoteOllamaBaseUrl,
  normalizeOllamaBaseUrl,
} from "./lib/ollama";
import { handleGeminiExamPost } from "./server/gemini-exam";
import { handleGeminiExtractPost } from "./server/gemini-extract";

type AssetBinding = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

type Env = {
  ABLY_API_KEY?: string;
  ABLY_CLIENT_ID_PREFIX?: string;
  ASSETS: AssetBinding;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  NEXT_PUBLIC_TAKE_EXAM_GRAPHQL_URL?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
  TAKE_EXAM_GRAPHQL_URL?: string;
};

type AttemptPayload = {
  answerReview?: Array<{
    answerChangeCount?: number | null;
    competency: string;
    dwellMs?: number | null;
    points: number;
    prompt: string;
    questionType: string;
    responseGuide?: string | null;
    selectedAnswerText?: string | null;
    selectedOptionId?: string | null;
  }> | null;
  attemptId: string;
  criteria?: {
    difficulty?: string;
    questionCount?: number;
    subject?: string;
    topic?: string;
  } | null;
  monitoring?: {
    dangerCount?: number;
    infoCount?: number;
    recentEvents?: Array<{
      code?: string | null;
      detail?: string | null;
      mode?: string | null;
      occurredAt?: string | null;
      severity?: string | null;
      screenshotCapturedAt?: string | null;
      screenshotStorageKey?: string | null;
      screenshotUrl?: string | null;
      title?: string | null;
    }>;
    totalEvents?: number;
    warningCount?: number;
  } | null;
  result?: {
    correctCount: number;
    incorrectCount: number;
    maxScore: number;
    percentage: number;
    questionResults?: Array<{
      answerChangeCount?: number | null;
      competency: string;
      dwellMs?: number | null;
      explanation?: string | null;
      isCorrect: boolean;
      maxPoints: number;
      pointsAwarded: number;
      prompt: string;
    }>;
    score: number;
    unansweredCount: number;
  } | null;
  startedAt: string;
  status: string;
  studentName: string;
  submittedAt?: string | null;
  title: string;
};

type FocusAnalysisRequest = {
  attempts: Array<{
    answerReview?: Array<{
      competency?: string | null;
      prompt: string;
      questionId: string;
    }> | null;
    result?: {
      questionResults: Array<{
        competency?: string | null;
        isCorrect: boolean;
        maxPoints: number;
        pointsAwarded: number;
        prompt?: string | null;
        questionId: string;
        selectedOptionId?: string | null;
      }>;
    } | null;
    studentId: string;
    studentName: string;
  }>;
  exam: {
    id: string;
    subject: string;
    title: string;
    topic: string;
  };
  testMaterial?: {
    questions: Array<{
      competency?: string | null;
      points: number;
      prompt: string;
      questionId: string;
      type: string;
    }>;
  } | null;
};

type FocusAnalysisResponse = {
  areas: Array<{
    affectedStudents?: number;
    avgScore: number;
    insight?: string;
    topic: string;
  }>;
  generatedAt: string;
  model?: string;
  source: "fallback" | "gemini" | "ollama";
  summary?: string;
};

type TopicAggregate = {
  affectedStudentIds: Set<string>;
  earnedPoints: number;
  incorrectCount: number;
  maxPoints: number;
  prompts: string[];
  questionCount: number;
  unansweredCount: number;
};

type QuestionFeedbackRequest = {
  competency?: string | null;
  correctAnswer?: string | null;
  questionText: string;
  questionType?: string | null;
  studentAnswer?: string | null;
};

type QuestionFeedbackResponse = {
  feedback: string;
  model?: string;
  source: "fallback" | "gemini" | "ollama";
};

type OllamaTeacherFeedback = {
  headline: string;
  interventions: string[];
  risks: string[];
  strengths: string[];
  summary: string;
};

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const DASHBOARD_QUERY = `
fragment FrontendDashboardAttemptFields on AttemptSummary {
  attemptId
  testId
  title
  studentId
  studentName
  status
  answerKeySource
  score
  maxScore
  percentage
  startedAt
  submittedAt
  monitoring {
    totalEvents
    warningCount
    dangerCount
    lastEventAt
    recentEvents {
      id
      code
      severity
      title
      detail
      occurredAt
      mode
      screenshotCapturedAt
      screenshotStorageKey
      screenshotUrl
    }
  }
  result {
    score
    maxScore
    percentage
    correctCount
    incorrectCount
    unansweredCount
    questionResults {
      questionId
      prompt
      competency
      questionType
      selectedOptionId
      correctOptionId
      isCorrect
      pointsAwarded
      maxPoints
      explanation
      explanationSource
      dwellMs
      answerChangeCount
    }
  }
  answerReview {
    questionId
    prompt
    competency
    questionType
    selectedOptionId
    selectedAnswerText
    correctAnswerText
    points
    responseGuide
    dwellMs
    answerChangeCount
  }
  feedback {
    headline
    summary
    strengths
    improvements
    source
  }
}

fragment FrontendDashboardLiveFeedFields on AttemptLiveFeedItem {
  attemptId
  testId
  title
  studentId
  studentName
  status
  startedAt
  submittedAt
  monitoring {
    totalEvents
    warningCount
    dangerCount
    lastEventAt
  }
  latestEvent {
    id
    code
    severity
    title
    detail
    occurredAt
    mode
    screenshotCapturedAt
    screenshotStorageKey
    screenshotUrl
  }
}

fragment FrontendDashboardAvailableTestFields on Test {
  id
  title
  description
  answerKeySource
  updatedAt
  criteria {
    gradeLevel
    className
    subject
    topic
    difficulty
    questionCount
  }
}

query FrontendTakeExamDashboard($limit: Int!) {
  availableTests {
    ...FrontendDashboardAvailableTestFields
  }
  attempts {
    ...FrontendDashboardAttemptFields
  }
  liveMonitoringFeed(limit: $limit) {
    ...FrontendDashboardLiveFeedFields
  }
}
`.trim();

const DASHBOARD_WITH_MATERIAL_QUERY = `
fragment FrontendDashboardAttemptFields on AttemptSummary {
  attemptId
  testId
  title
  studentId
  studentName
  status
  answerKeySource
  score
  maxScore
  percentage
  startedAt
  submittedAt
  monitoring {
    totalEvents
    warningCount
    dangerCount
    lastEventAt
    recentEvents {
      id
      code
      severity
      title
      detail
      occurredAt
      mode
      screenshotCapturedAt
      screenshotStorageKey
      screenshotUrl
    }
  }
  result {
    score
    maxScore
    percentage
    correctCount
    incorrectCount
    unansweredCount
    questionResults {
      questionId
      prompt
      competency
      questionType
      selectedOptionId
      correctOptionId
      isCorrect
      pointsAwarded
      maxPoints
      explanation
      explanationSource
      dwellMs
      answerChangeCount
    }
  }
  answerReview {
    questionId
    prompt
    competency
    questionType
    selectedOptionId
    selectedAnswerText
    correctAnswerText
    points
    responseGuide
    dwellMs
    answerChangeCount
  }
  feedback {
    headline
    summary
    strengths
    improvements
    source
  }
}

fragment FrontendDashboardLiveFeedFields on AttemptLiveFeedItem {
  attemptId
  testId
  title
  studentId
  studentName
  status
  startedAt
  submittedAt
  monitoring {
    totalEvents
    warningCount
    dangerCount
    lastEventAt
  }
  latestEvent {
    id
    code
    severity
    title
    detail
    occurredAt
    mode
    screenshotCapturedAt
    screenshotStorageKey
    screenshotUrl
  }
}

fragment FrontendDashboardAvailableTestFields on Test {
  id
  title
  description
  answerKeySource
  updatedAt
  criteria {
    gradeLevel
    className
    subject
    topic
    difficulty
    questionCount
  }
}

query FrontendTakeExamDashboardWithMaterial($limit: Int!, $testId: ID!) {
  availableTests {
    ...FrontendDashboardAvailableTestFields
  }
  attempts {
    ...FrontendDashboardAttemptFields
  }
  liveMonitoringFeed(limit: $limit) {
    ...FrontendDashboardLiveFeedFields
  }
  testMaterial(testId: $testId) {
    testId
    title
    description
    timeLimitMinutes
    criteria {
      gradeLevel
      className
      subject
      topic
      difficulty
      questionCount
    }
    questions {
      questionId
      type
      prompt
      points
      competency
      imageUrl
      audioUrl
      videoUrl
      responseGuide
      options {
        id
        text
      }
    }
  }
}
`.trim();

const getEnvValue = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);

const getTakeExamGraphqlUrl = (env: Env) =>
  getEnvValue(env.TAKE_EXAM_GRAPHQL_URL) ??
  getEnvValue(env.NEXT_PUBLIC_TAKE_EXAM_GRAPHQL_URL) ??
  "http://localhost:3002/api/graphql";

const buildProgress = (attempt: Record<string, any>, questionCount: number) => {
  const answeredQuestionsFromResult =
    (attempt.result?.correctCount ?? 0) +
    (attempt.result?.incorrectCount ?? 0) +
    (attempt.result?.unansweredCount ?? 0);
  const answeredQuestionsFromReview =
    attempt.answerReview?.filter(
      (item: Record<string, any>) =>
        item.selectedOptionId || item.selectedAnswerText,
    ).length ?? 0;
  const answeredQuestions = Math.max(
    answeredQuestionsFromResult,
    answeredQuestionsFromReview,
  );
  const totalQuestions =
    questionCount > 0
      ? questionCount
      : answeredQuestions > 0
        ? answeredQuestions
        : 0;
  const safeAnswered = Math.min(answeredQuestions, totalQuestions);
  const remainingQuestions = Math.max(totalQuestions - safeAnswered, 0);
  const completionRate =
    totalQuestions > 0 ? Math.round((safeAnswered / totalQuestions) * 100) : 0;

  return {
    answeredQuestions: safeAnswered,
    completionRate,
    remainingQuestions,
    totalQuestions,
  };
};

const hasMissingFieldError = (
  payload: { errors?: Array<{ message?: string }> },
  fieldName: string,
) =>
  payload.errors?.some((error) =>
    error.message?.includes(`Cannot query field "${fieldName}"`),
  ) ?? false;

const fetchDashboardPayload = async (
  targetUrl: string,
  query: string,
  variables: Record<string, string | number>,
) => {
  const response = await fetch(targetUrl, {
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const rawText = await response.text();
  const trimmedText = rawText.trim();
  let payload: Record<string, any> | null = null;

  if (trimmedText) {
    try {
      payload = JSON.parse(trimmedText) as Record<string, any>;
    } catch {
      payload = null;
    }
  }

  return { payload, rawText, response };
};

async function handleDashboardGet(request: Request, env: Env) {
  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get("limit") ?? "12");
  const testId = searchParams.get("testId");
  const targetUrl = getTakeExamGraphqlUrl(env);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 40)
    : 12;

  try {
    let { payload, response } = await fetchDashboardPayload(
      targetUrl,
      testId ? DASHBOARD_WITH_MATERIAL_QUERY : DASHBOARD_QUERY,
      testId ? { limit, testId } : { limit },
    );

    if (
      testId &&
      response.ok &&
      payload &&
      hasMissingFieldError(payload, "testMaterial")
    ) {
      const fallback = await fetchDashboardPayload(targetUrl, DASHBOARD_QUERY, {
        limit,
      });

      response = fallback.response;
      payload = fallback.payload?.data
        ? {
            ...fallback.payload,
            data: {
              ...fallback.payload.data,
              testMaterial: null,
            },
          }
        : fallback.payload;
    }

    if (!payload) {
      return json(
        {
          message:
            "Take exam service JSON биш хариу буцаалаа. Deploy URL эсвэл upstream route-аа шалгана уу.",
          status: response.status,
          targetUrl,
        },
        { status: 502 },
      );
    }

    if (!response.ok || payload.errors?.length || !payload.data) {
      return json(
        {
          message:
            payload.errors?.[0]?.message ??
            "Take exam service-ээс dashboard өгөгдөл авч чадсангүй.",
          targetUrl,
        },
        { status: response.ok ? 502 : response.status },
      );
    }

    const data = payload.data;
    const testsById = new Map<string, Record<string, any>>(
      data.availableTests.map((test: Record<string, any>) => [test.id, test]),
    );

    const normalizedData = {
      ...data,
      attempts: data.attempts.map((attempt: Record<string, any>) => {
        const test = testsById.get(attempt.testId);
        const totalQuestions = test?.criteria.questionCount ?? 0;

        return {
          ...attempt,
          answerReview: attempt.answerReview ?? null,
          criteria: test?.criteria ?? null,
          monitoring: attempt.monitoring
            ? {
                ...attempt.monitoring,
                infoCount: 0,
                recentEvents: attempt.monitoring.recentEvents ?? [],
              }
            : null,
          progress: buildProgress(attempt, totalQuestions),
          result: attempt.result
            ? {
                ...attempt.result,
                questionResults: attempt.result.questionResults.map(
                  (result: Record<string, any>) => ({
                    ...result,
                    answerChangeCount: result.answerChangeCount ?? null,
                    competency: result.competency,
                    dwellMs: result.dwellMs ?? null,
                    prompt: result.prompt,
                    questionType: result.questionType,
                  }),
                ),
              }
            : null,
          teacherSync: null,
        };
      }),
      availableTests: data.availableTests.map((test: Record<string, any>) => ({
        ...test,
      })),
      liveMonitoringFeed: data.liveMonitoringFeed.map((item: Record<string, any>) => ({
        ...item,
        monitoring: item.monitoring
          ? {
              ...item.monitoring,
              infoCount: 0,
            }
          : null,
      })),
    };

    return json(normalizedData, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Dashboard route дуудах үед алдаа гарлаа.",
        targetUrl,
      },
      { status: 500 },
    );
  }
}

async function handleApprovePost(request: Request, env: Env) {
  try {
    const body = (await request.json()) as {
      attemptId?: string;
      review?: {
        questionReviews?: Array<{
          correctOptionId?: string | null;
          explanation?: string | null;
          isCorrect?: boolean | null;
          maxPoints?: number | null;
          pointsAwarded?: number | null;
          questionId: string;
        }>;
      };
    };
    const attemptId = body.attemptId?.trim();

    if (!attemptId) {
      return json({ message: "attemptId шаардлагатай." }, { status: 400 });
    }

    const response = await fetch(getTakeExamGraphqlUrl(env), {
      body: JSON.stringify({
        query: `
          mutation ApproveAttempt($attemptId: String!, $review: AttemptReviewInput) {
            approveAttempt(attemptId: $attemptId, review: $review)
          }
        `,
        variables: {
          attemptId,
          review: body.review ?? null,
        },
      }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response.json()) as {
      data?: { approveAttempt?: boolean };
      errors?: Array<{ message?: string }>;
    };

    if (!response.ok || payload.errors?.length || !payload.data?.approveAttempt) {
      return json(
        {
          message:
            payload.errors?.[0]?.message ?? "Attempt approve хийж чадсангүй.",
        },
        { status: response.ok ? 502 : response.status },
      );
    }

    return json({ ok: true });
  } catch (error) {
    return json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Attempt approve хийх үед алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}

const safeQuestionFeedbackParse = (value: string): QuestionFeedbackResponse | null => {
  try {
    const parsed = JSON.parse(value) as Partial<QuestionFeedbackResponse>;
    if (typeof parsed.feedback !== "string" || parsed.feedback.trim().length === 0) {
      return null;
    }

    return {
      feedback: parsed.feedback.trim(),
      model:
        typeof parsed.model === "string" && parsed.model.trim().length > 0
          ? parsed.model.trim()
          : undefined,
      source:
        parsed.source === "ollama"
          ? "ollama"
          : parsed.source === "gemini"
            ? "gemini"
            : "fallback",
    };
  } catch {
    return null;
  }
};

const parseNumericValue = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/,/g, ".").replace(/\s+/g, "");
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractSimpleSubtraction = (questionText: string) => {
  const compact = questionText
    .replace(/\s+/g, " ")
    .replace(/[=?:]+/g, " ")
    .replace(/[^\d+\- ]/g, " ");
  const match = compact.match(/(^| )(-?\d+)\s*-\s*(-?\d+)( |$)/);
  if (!match) {
    return null;
  }

  const left = Number(match[2]);
  const right = Number(match[3]);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null;
  }

  return { left, result: left - right, right };
};

const buildHeuristicFeedback = (body: QuestionFeedbackRequest) => {
  const questionText = body.questionText.trim();
  const studentAnswer = body.studentAnswer?.trim();
  const correctAnswer = body.correctAnswer?.trim();
  const competency = body.competency?.trim();
  const studentNumeric = parseNumericValue(studentAnswer);
  const correctNumeric = parseNumericValue(correctAnswer);
  const subtraction = extractSimpleSubtraction(questionText);

  if (
    subtraction &&
    studentNumeric !== null &&
    correctNumeric !== null &&
    studentNumeric !== correctNumeric &&
    subtraction.left < subtraction.right &&
    correctNumeric < 0 &&
    studentNumeric >= 0
  ) {
    return `Та ${subtraction.left}-${subtraction.right} үйлдлийг ${studentAnswer} гэж хариулсан байна. Бага тооноос их тоог хасахад хариу сөрөг тэмдэгтэй гардгийг анзаараагүй байна. ${correctAnswer} гэж гарах шалтгааныг тооны шулуун дээр дүрслээд, сөрөг тооны хасалтын 2-3 жишээг дахин бодоорой.`;
  }

  if (
    questionText.match(/(∫|\\int|integral|интеграл)/i) &&
    correctAnswer?.includes("+ C") &&
    studentAnswer &&
    !studentAnswer.includes("+ C")
  ) {
    return `Та интегралын үндсэн илэрхийллээ зөв олсон ч интегралын тогтмол болох +C-г орхигдуулсан байна. Интеграл бодох бүрдээ эцсийн хариундаа +C заавал нэмдэг дүрмээ давтаж, ижил төрлийн 2 жишээ дээр дахин баталгаажуулаарай.`;
  }

  if (studentAnswer && correctAnswer) {
    const topicHint = competency
      ? `${competency} сэдвийн дүрэм,`
      : body.questionType === "math"
        ? "энэ бодлогын суурь дүрэм,"
        : "энэ асуултын гол ойлголт,";

    return `Таны хариулт "${studentAnswer}" байсан ч зөв хариулт нь "${correctAnswer}" байна. ${topicHint} бодолтын алхмуудаа мөр мөрөөр нь шалгаж, яг аль алхам дээр зөрсөнөө тэмдэглээд дахин нэг ижил төстэй дасгал ажиллаарай.`;
  }

  return null;
};

const buildFallbackFeedback = (body: QuestionFeedbackRequest) => {
  const heuristicFeedback = buildHeuristicFeedback(body);
  if (heuristicFeedback) {
    return heuristicFeedback;
  }

  const studentAnswer = body.studentAnswer?.trim();
  const correctAnswer = body.correctAnswer?.trim();
  const competency = body.competency?.trim();

  const lead = studentAnswer
    ? correctAnswer
      ? `Таны хариулт "${studentAnswer}" байсан ч зөв хариулт нь "${correctAnswer}" байна.`
      : `Таны хариулт "${studentAnswer}" дээр үндсэн алхмаа дахин шалгах хэрэгтэй байна.`
    : correctAnswer
      ? `Энэ асуултад хариулаагүй байна. Зөв хариулт нь "${correctAnswer}" юм.`
      : "Энэ асуултад өгөх хариултаа дахин нэг нягталж бодоорой.";

  const concept =
    competency && competency.length > 0
      ? `${competency} сэдвийн`
      : body.questionType === "math"
        ? "энэ төрлийн математикийн"
        : "энэ агуулгын";

  return `${lead} Гол алдаа нь ${concept} суурь ойлголт болон бодолтын дараалал дээр байна. Ижил төрлийн 2-3 жишээ бодлого дахин ажиллаж, яагаад ийм хариу гарах ёстойг алхам бүрээр нь тайлбарлаж давтаарай.`;
};

const buildQuestionFeedbackPrompt = (body: QuestionFeedbackRequest) =>
  JSON.stringify({
    instruction:
      "feedback гэсэн ганц key-тэй JSON буцаа. feedback нь монгол хэлээр 2-4 өгүүлбэртэй байна. Асуултыг, сурагчийн өгсөн хариултыг, зөв хариуг харьцуулж яг ямар ойлголт эсвэл алхам дээр алдсаныг тодорхой тайлбарла. Ерөнхий үг бүү хэрэглэ. Боломжтой бол яагаад тэр зөв хариу гарах ёстойг 1 богино логикоор тайлбарла. Эцэст нь ямар сэдэв эсвэл дүрмийг давтах ёстойг хэл.",
    payload: {
      competency: body.competency ?? null,
      correctAnswer: body.correctAnswer ?? null,
      questionText: body.questionText,
      questionType: body.questionType ?? null,
      studentAnswer: body.studentAnswer ?? null,
    },
  });

const generateOllamaQuestionFeedback = async (
  body: QuestionFeedbackRequest,
  env: Env,
): Promise<QuestionFeedbackResponse | null> => {
  const baseUrl = getEnvValue(env.OLLAMA_BASE_URL);
  if (!baseUrl) {
    return null;
  }

  const ollama = await chatWithOllama({
    apiKey: getEnvValue(env.OLLAMA_API_KEY),
    baseUrl,
    context: "Question feedback",
    messages: [
      {
        content:
          "Та сурагчийн буруу хариултад зориулсан монгол хэлний богино тайлбар JSON үүсгэнэ.",
        role: "system",
      },
      {
        content: buildQuestionFeedbackPrompt(body),
        role: "user",
      },
    ],
    model: getEnvValue(env.OLLAMA_MODEL) ?? DEFAULT_OLLAMA_MODEL,
  });
  const parsed = safeQuestionFeedbackParse(ollama.content);
  return parsed
    ? {
        ...parsed,
        model: parsed.model ?? ollama.model,
        source: "ollama",
      }
    : null;
};

const generateGeminiQuestionFeedback = async (
  body: QuestionFeedbackRequest,
  env: Env,
): Promise<QuestionFeedbackResponse | null> => {
  const apiKey = getEnvValue(env.GEMINI_API_KEY);
  if (!apiKey) {
    return null;
  }

  const model = getEnvValue(env.GEMINI_MODEL) ?? DEFAULT_GEMINI_MODEL;
  const response = await fetch(
    `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${apiKey}`,
    {
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: buildQuestionFeedbackPrompt(body) }],
            role: "user",
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
        systemInstruction: {
          parts: [
            {
              text:
                "Та сурагчийн буруу хариултад зориулсан монгол хэлний богино тайлбар JSON үүсгэнэ.",
            },
          ],
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini feedback failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };
  const parsed = safeQuestionFeedbackParse(
    payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
  );

  return parsed
    ? {
        ...parsed,
        model: parsed.model ?? model,
        source: "gemini",
      }
    : null;
};

async function handleQuestionFeedbackPost(request: Request, env: Env) {
  try {
    const body = (await request.json()) as QuestionFeedbackRequest;
    if (!body.questionText?.trim()) {
      return json({ message: "questionText шаардлагатай." }, { status: 400 });
    }

    try {
      const ollama = await generateOllamaQuestionFeedback(body, env);
      if (ollama) {
        return json(ollama, {
          headers: {
            "Cache-Control": "no-store",
          },
        });
      }
    } catch {
      // Try next provider.
    }

    try {
      const gemini = await generateGeminiQuestionFeedback(body, env);
      if (gemini) {
        return json(gemini, {
          headers: {
            "Cache-Control": "no-store",
          },
        });
      }
    } catch {
      // Fall through to deterministic feedback.
    }

    return json(
      {
        feedback: buildFallbackFeedback(body),
        source: "fallback",
      } satisfies QuestionFeedbackResponse,
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return json(
      {
        message:
          error instanceof Error
            ? error.message
            : "AI тайлбар бэлдэх үед алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}

const safeFocusAnalysisParse = (value: string): FocusAnalysisResponse | null => {
  try {
    const parsed = JSON.parse(value) as Partial<FocusAnalysisResponse>;
    if (!Array.isArray(parsed.areas)) {
      return null;
    }

    const areas = parsed.areas
      .filter(
        (
          area,
        ): area is {
          affectedStudents?: number;
          avgScore: number;
          insight?: string;
          topic: string;
        } =>
          Boolean(area) &&
          typeof area.topic === "string" &&
          typeof area.avgScore === "number",
      )
      .map((area) => ({
        affectedStudents:
          typeof area.affectedStudents === "number"
            ? Math.max(0, Math.round(area.affectedStudents))
            : undefined,
        avgScore: Math.max(0, Math.min(100, Math.round(area.avgScore))),
        insight:
          typeof area.insight === "string" && area.insight.trim().length > 0
            ? area.insight.trim()
            : undefined,
        topic: area.topic.trim(),
      }))
      .filter((area) => area.topic.length > 0)
      .slice(0, 4);

    return {
      areas,
      generatedAt:
        typeof parsed.generatedAt === "string"
          ? parsed.generatedAt
          : new Date().toISOString(),
      model:
        typeof parsed.model === "string" && parsed.model.trim().length > 0
          ? parsed.model.trim()
          : undefined,
      source:
        parsed.source === "ollama"
          ? "ollama"
          : parsed.source === "gemini"
            ? "gemini"
            : "fallback",
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : undefined,
    };
  } catch {
    return null;
  }
};

const uniquePrompts = (prompts: string[]) =>
  [...new Set(prompts.map((item) => item.trim()).filter(Boolean))];

const buildFallbackInsight = (topic: string, aggregate: TopicAggregate) => {
  const promptSnippet = uniquePrompts(aggregate.prompts)[0];
  const studentCount = aggregate.affectedStudentIds.size;

  if (promptSnippet) {
    return `${studentCount} сурагч энэ сэдэв дээр оноо алдсан. Гол алдаа гарсан асуулт: ${promptSnippet}`;
  }

  return `${studentCount} сурагч ${topic} сэдэв дээр оноо алдсан байна.`;
};

const buildFallbackAnalysis = (
  exam: FocusAnalysisRequest["exam"],
  aggregates: Map<string, TopicAggregate>,
): FocusAnalysisResponse => {
  const areas = [...aggregates.entries()]
    .map(([topic, aggregate]) => ({
      affectedStudents: aggregate.affectedStudentIds.size,
      avgScore:
        aggregate.maxPoints > 0
          ? Math.round((aggregate.earnedPoints / aggregate.maxPoints) * 100)
          : 0,
      insight: buildFallbackInsight(topic, aggregate),
      topic,
    }))
    .sort((left, right) => left.avgScore - right.avgScore)
    .slice(0, 4);

  const summary =
    areas.length > 0
      ? `${exam.title} дээр хамгийн их алдаа гарч буй сэдвүүдийг онооны бууралтаар эрэмбэллээ.`
      : `${exam.title} дээр AI шинжилгээ хийхэд хангалттай дүнтэй асуултын data хараахан үүсээгүй байна.`;

  return {
    areas,
    generatedAt: new Date().toISOString(),
    source: "fallback",
    summary,
  };
};

const buildAggregates = (body: FocusAnalysisRequest) => {
  const materialQuestionsById = new Map(
    (body.testMaterial?.questions ?? []).map((question) => [
      question.questionId,
      question,
    ] as const),
  );
  const aggregates = new Map<string, TopicAggregate>();

  for (const attempt of body.attempts) {
    const answerReviewById = new Map(
      (attempt.answerReview ?? []).map((item) => [item.questionId, item] as const),
    );

    for (const question of attempt.result?.questionResults ?? []) {
      const materialQuestion = materialQuestionsById.get(question.questionId);
      const answerReview = answerReviewById.get(question.questionId);
      const topic =
        question.competency?.trim() ||
        answerReview?.competency?.trim() ||
        materialQuestion?.competency?.trim() ||
        body.exam.topic ||
        materialQuestion?.type ||
        "Тодорхойгүй";

      const current = aggregates.get(topic) ?? {
        affectedStudentIds: new Set<string>(),
        earnedPoints: 0,
        incorrectCount: 0,
        maxPoints: 0,
        prompts: [],
        questionCount: 0,
        unansweredCount: 0,
      };

      current.earnedPoints += question.pointsAwarded;
      current.maxPoints += question.maxPoints;
      current.questionCount += 1;

      if (!question.isCorrect || question.pointsAwarded < question.maxPoints) {
        current.affectedStudentIds.add(attempt.studentId);
        current.incorrectCount += question.selectedOptionId ? 1 : 0;
        current.unansweredCount += question.selectedOptionId ? 0 : 1;
        current.prompts.push(
          question.prompt?.trim() ||
            answerReview?.prompt?.trim() ||
            materialQuestion?.prompt?.trim() ||
            "",
        );
      }

      aggregates.set(topic, current);
    }
  }

  return aggregates;
};

const buildFocusAnalysisPrompt = (
  exam: FocusAnalysisRequest["exam"],
  fallback: FocusAnalysisResponse,
) =>
  JSON.stringify({
    exam,
    fallback,
    instruction:
      "Монгол хэлээр summary болон areas JSON буцаа. areas нь хамгийн сул 4 хүртэл competency/topic байна. insight нь яг ямар төрлийн алдаа давамгай байгааг 1 өгүүлбэрээр тайлбарла.",
  });

const generateOllamaFocusAnalysis = async (
  body: FocusAnalysisRequest,
  fallback: FocusAnalysisResponse,
  env: Env,
) => {
  const ollamaBaseUrl = normalizeOllamaBaseUrl(getEnvValue(env.OLLAMA_BASE_URL));
  const configuredModel = getEnvValue(env.OLLAMA_MODEL) ?? DEFAULT_OLLAMA_MODEL;

  const ollama = await chatWithOllama({
    apiKey: getEnvValue(env.OLLAMA_API_KEY),
    baseUrl: ollamaBaseUrl,
    context: "Focus analysis",
    messages: [
      {
        content:
          "Та шалгалтын аналитикийн туслах. Зөвхөн JSON буцаана. summary, areas гэсэн key ашигла. areas дотор topic, avgScore, affectedStudents, insight байна.",
        role: "system",
      },
      {
        content: buildFocusAnalysisPrompt(body.exam, fallback),
        role: "user",
      },
    ],
    model: configuredModel,
  });
  const parsed = safeFocusAnalysisParse(ollama.content);

  if (!parsed) {
    throw new Error("Ollama analysis JSON parse хийж чадсангүй.");
  }

  return {
    ...parsed,
    generatedAt: new Date().toISOString(),
    model: ollama.model,
    source: "ollama" as const,
  };
};

const generateGeminiFocusAnalysis = async (
  body: FocusAnalysisRequest,
  fallback: FocusAnalysisResponse,
  env: Env,
) => {
  const apiKey = getEnvValue(env.GEMINI_API_KEY);
  if (!apiKey) {
    return null;
  }

  const model = getEnvValue(env.GEMINI_MODEL) ?? DEFAULT_GEMINI_MODEL;

  const response = await fetch(
    `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${apiKey}`,
    {
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildFocusAnalysisPrompt(body.exam, fallback),
              },
            ],
            role: "user",
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
        systemInstruction: {
          parts: [
            {
              text:
                "Та шалгалтын аналитикийн туслах. Зөвхөн JSON буцаана. summary, areas гэсэн key ашигла. areas дотор topic, avgScore, affectedStudents, insight байна.",
            },
          ],
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
    error?: {
      message?: string;
    };
  };

  if (!response.ok) {
    throw new Error(
      payload.error?.message ??
        `Gemini analysis failed with status ${response.status}`,
    );
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  const parsed = text ? safeFocusAnalysisParse(text) : null;

  if (!parsed) {
    throw new Error("Gemini analysis JSON parse хийж чадсангүй.");
  }

  return {
    ...parsed,
    generatedAt: new Date().toISOString(),
    model,
    source: "gemini" as const,
  };
};

async function handleFocusAnalysisPost(request: Request, env: Env) {
  try {
    const body = (await request.json()) as FocusAnalysisRequest;

    if (!body.exam?.id) {
      return json({ message: "testId байхгүй байна." }, { status: 400 });
    }

    const aggregates = buildAggregates(body);
    const fallback = buildFallbackAnalysis(body.exam, aggregates);

    if (aggregates.size === 0) {
      return json(fallback);
    }

    try {
      const aiAnalysis = await generateOllamaFocusAnalysis(body, fallback, env);
      return json(aiAnalysis, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      try {
        const geminiAnalysis = await generateGeminiFocusAnalysis(
          body,
          fallback,
          env,
        );
        if (geminiAnalysis) {
          return json(geminiAnalysis, {
            headers: { "Cache-Control": "no-store" },
          });
        }
      } catch {
        // Fall back below.
      }

      return json(fallback, {
        headers: { "Cache-Control": "no-store" },
      });
    }
  } catch (error) {
    return json(
      {
        areas: [],
        generatedAt: new Date().toISOString(),
        message:
          error instanceof Error
            ? error.message
            : "AI focus analysis үүсгэж чадсангүй.",
        source: "fallback",
      },
      { status: 500 },
    );
  }
}

const summarizeTopItems = (items: string[], emptyText: string) => {
  if (items.length === 0) {
    return emptyText;
  }

  return items.slice(0, 2).join(", ");
};

const buildBehaviorSummary = (attempt: AttemptPayload) => {
  const recentEvents = attempt.monitoring?.recentEvents ?? [];
  const recentCodes = recentEvents.map((item) => item.code?.trim() ?? "");
  const revisitCount = recentCodes.filter((code) => code === "question-revisit").length;
  const revisionCount = recentCodes.filter((code) => code === "answer-revised").length;
  const idleCount = recentCodes.filter((code) => code.startsWith("idle-")).length;
  const focusLossCount = recentCodes.filter(
    (code) =>
      code === "visibility-hidden" ||
      code === "window-blur" ||
      code === "window-focus-return" ||
      code === "visibility-return",
  ).length;
  const flaggedCount = recentCodes.filter((code) => code === "question-flagged").length;

  const behaviorHighlights = [
    revisitCount > 0 ? `${revisitCount} revisit signal` : null,
    revisionCount > 0 ? `${revisionCount} revision signal` : null,
    idleCount > 0 ? `${idleCount} idle signal` : null,
    focusLossCount > 0 ? `${focusLossCount} focus shift signal` : null,
    flaggedCount > 0 ? `${flaggedCount} flagged question` : null,
  ].filter((item): item is string => Boolean(item));

  const latestTimeline = recentEvents
    .slice(0, 5)
    .map((item) => `${item.title ?? "Event"}: ${item.detail ?? ""}`)
    .filter(Boolean);

  return {
    behaviorHighlights,
    flaggedCount,
    focusLossCount,
    idleCount,
    latestTimeline,
    revisitCount,
    revisionCount,
  };
};

const buildFallbackTeacherFeedback = (
  attempt: AttemptPayload,
): OllamaTeacherFeedback => {
  const result = attempt.result;
  const answerReview = attempt.answerReview ?? [];
  const behaviorSummary = buildBehaviorSummary(attempt);
  const questionResults = result?.questionResults ?? [];
  const fallbackQuestions =
    questionResults.length > 0
      ? questionResults
      : answerReview.map((item) => ({
          answerChangeCount: item.answerChangeCount ?? 0,
          competency: item.competency,
          dwellMs: item.dwellMs ?? 0,
          isCorrect: false,
          maxPoints: item.points,
          pointsAwarded: 0,
          prompt: item.prompt,
        }));
  const missedQuestions = questionResults.filter((item) => !item.isCorrect);
  const slowQuestions = [...fallbackQuestions]
    .filter((item) => typeof item.dwellMs === "number" && (item.dwellMs ?? 0) > 0)
    .sort((left, right) => (right.dwellMs ?? 0) - (left.dwellMs ?? 0))
    .slice(0, 2);
  const changedQuestions = [...fallbackQuestions]
    .filter(
      (item) =>
        typeof item.answerChangeCount === "number" &&
        (item.answerChangeCount ?? 0) > 0,
    )
    .sort(
      (left, right) =>
        (right.answerChangeCount ?? 0) - (left.answerChangeCount ?? 0),
    )
    .slice(0, 2);

  const missedTopics = Array.from(
    new Set(
      missedQuestions
        .map((item) => item.competency?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const scoreText = result
    ? `${result.score}/${result.maxScore} (${result.percentage}%)`
    : "дүн хараахан батлагдаагүй";
  const monitoringText = attempt.monitoring
    ? `info ${attempt.monitoring.infoCount ?? 0}, warning ${attempt.monitoring.warningCount ?? 0}, danger ${attempt.monitoring.dangerCount ?? 0}`
    : "monitoring event бүртгэгдээгүй";

  return {
    headline: `${attempt.studentName} - ${scoreText}`,
    interventions: [
      missedTopics.length > 0
        ? `${summarizeTopItems(missedTopics, "Сэдвийн")} дээр богино давтлага, жишиг бодлого ажиллуулах.`
        : "Алдсан асуултуудын тайлбарыг нэг бүрчлэн ярилцаж бататгах.",
      slowQuestions.length > 0
        ? `Удаан саатсан ${slowQuestions.length} асуултын бодолтын алхмыг задлуулж ажиллуулах.`
        : "Цагийн менежментийн богино дасгал ажиллуулах.",
      changedQuestions.length > 0 || behaviorSummary.revisionCount > 0
        ? "Эргэлзээтэй асуултууд дээр сонголтоо баталгаажуулах шалгах checklist ашиглуулах."
        : "Зөв бодолт баталгаажуулах алхамтай ажлын хуудас өгөх.",
    ].slice(0, 3),
    risks: [
      missedTopics.length > 0
        ? `Анхаарах competency: ${summarizeTopItems(missedTopics, "")}.`
        : "Алдсан асуултын competency цөөн эсвэл жигд тархсан байна.",
      changedQuestions.length > 0
        ? `Олон өөрчилсөн асуултууд: ${changedQuestions
            .map((item) => item.prompt)
            .join(", ")}.`
        : "Хариултаа олон давтамжаар өөрчилсөн асуулт бага байна.",
      behaviorSummary.focusLossCount > 0
        ? `Фокус тасалдсан эсвэл tab сольсон ${behaviorSummary.focusLossCount} signal байна.`
        : "Фокус тогтвортой байсан signal давамгай.",
      result && result.unansweredCount > 0
        ? `${result.unansweredCount} асуулт хоосон үлдсэн байна.`
        : "Хоосон үлдсэн асуулт ажиглагдсангүй.",
    ].slice(0, 3),
    strengths: [
      result && result.correctCount > 0
        ? `${result.correctCount} асуултад зөв хариулсан.`
        : "Оролдлого бүртгэгдсэн бөгөөд цаашид result-тай уялдуулж шинэчилж болно.",
      attempt.criteria?.topic
        ? `Шалгалтын сэдэв: ${attempt.criteria.topic}.`
        : "Шалгалтын сэдвийн мэдээлэл dashboard дээр бүртгэгдсэн.",
      slowQuestions.length > 0
        ? `Хамгийн удаан саатсан асуултууд: ${slowQuestions
            .map((item) => item.prompt)
            .join(", ")}.`
        : "Timing data дээр ноцтой саатал илрээгүй.",
    ].slice(0, 3),
    summary: `${attempt.title} дээр ${scoreText} үзүүлэлттэй байна. ${
      result
        ? `Анхаарах competency: ${summarizeTopItems(missedTopics, "тод ялгарах сул сэдэв алга")}.`
        : `Teacher-side result ирээгүй байна. Гэхдээ ${answerReview.length} асуултын өгсөн хариу, dwell time, answer change дээр тулгуурласан урьдчилсан analysis гаргав.`
    } Monitoring: ${monitoringText}. Behavior: ${summarizeTopItems(
      behaviorSummary.behaviorHighlights,
      "тод behavioral signal бага байна",
    )}.`,
  };
};

const cleanJsonBlock = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  return trimmed;
};

const buildTeacherFeedbackPrompt = (attempt: AttemptPayload) => {
  const behaviorSummary = buildBehaviorSummary(attempt);

  return `
Та Монгол хэл дээр багшид зориулсан шалгалтын задлан feedback үүсгэнэ.
Зөвхөн JSON буцаа.

JSON бүтэц:
{
  "headline": "string",
  "summary": "string",
  "strengths": ["string"],
  "risks": ["string"],
  "interventions": ["string"]
}

Дүрэм:
- strengths, risks, interventions нь тус бүр 2-4 богино мөр байна.
- risks хэсэгт аль сэдэв/competency дээр анхаарахыг тодорхой бич.
- interventions хэсэгт багшид өгөх практик дараагийн алхмуудыг бич.
- Хэрэв questionResults байгаа бол хамгийн их алдсан, хамгийн удаан саатсан, хамгийн олон өөрчилсөн асуултын хэв шинжийг дүгнэ.
- Хэрэв monitoring recentEvents байгаа бол focus shift, idle, revisit, answer revision signal-уудыг ашиглаж cheating risk ба hesitation pattern-ийг бодитой тайлбарла.
- Хэт ерөнхий магтаал бүү өг. Бодит өгөгдөлд тулгуурла.

Behavior summary:
${JSON.stringify(behaviorSummary, null, 2)}

Attempt өгөгдөл:
${JSON.stringify(attempt, null, 2)}
`.trim();
};

async function handleTeacherFeedbackPost(request: Request, env: Env) {
  try {
    const body = (await request.json()) as { attempt?: AttemptPayload };
    const attempt = body.attempt;

    if (!attempt) {
      return json({ error: "attempt payload шаардлагатай." }, { status: 400 });
    }

    const configuredModel = getEnvValue(env.OLLAMA_MODEL) ?? DEFAULT_OLLAMA_MODEL;
    const baseUrl = normalizeOllamaBaseUrl(getEnvValue(env.OLLAMA_BASE_URL));
    const apiKey = getEnvValue(env.OLLAMA_API_KEY);
    try {
      const ollama = await chatWithOllama({
        apiKey,
        baseUrl,
        context: "Teacher feedback",
        messages: [
          {
            content:
              "Та багшид зориулсан шалгалтын аналитик feedback-ийг зөвхөн JSON хэлбэрээр буцаана.",
            role: "system",
          },
          {
            content: buildTeacherFeedbackPrompt(attempt),
            role: "user",
          },
        ],
        model: configuredModel,
      });
      const feedback = JSON.parse(cleanJsonBlock(ollama.content)) as OllamaTeacherFeedback;

      return json({
        feedback,
        ollama: {
          baseUrl,
          hasApiKey: Boolean(apiKey),
          model: ollama.model,
          reachable: true,
          remote: isRemoteOllamaBaseUrl(baseUrl),
        },
        provider: "ollama",
      });
    } catch (ollamaError) {
      const feedback = buildFallbackTeacherFeedback(attempt);
      const message =
        ollamaError instanceof Error
          ? ollamaError.message
          : "Ollama unavailable";

      return json(
        {
          feedback,
          ollama: {
            baseUrl,
            model: configuredModel,
            remote: isRemoteOllamaBaseUrl(baseUrl),
          },
          provider: "fallback",
          warning: `Ollama холбогдсонгүй, fallback analysis ашиглалаа: ${message}`,
        },
        { status: 200 },
      );
    }
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ollama teacher feedback route дээр алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}

async function handleTeacherFeedbackGet(env: Env) {
  const model = getEnvValue(env.OLLAMA_MODEL) ?? DEFAULT_OLLAMA_MODEL;
  const baseUrl = normalizeOllamaBaseUrl(getEnvValue(env.OLLAMA_BASE_URL));
  const apiKey = getEnvValue(env.OLLAMA_API_KEY);
  const checkedAt = new Date().toISOString();

  try {
    const payload = await fetchOllamaJson<{
      error?: string;
      models?: Array<{ name?: string | null }>;
    }>({
      apiKey,
      baseUrl,
      context: "Ollama status",
      path: "/api/tags",
      retries: 0,
      timeoutMs: 5000,
    });

    const models = (payload.models ?? [])
      .map((item) => item.name?.trim())
      .filter((value): value is string => Boolean(value));

    return json(
      {
        baseUrl,
        hasApiKey: Boolean(apiKey),
        lastCheckedAt: checkedAt,
        model,
        modelAvailable: models.some(
          (item) => item === model || item.startsWith(`${model}:`),
        ),
        models,
        reachable: true,
        remote: isRemoteOllamaBaseUrl(baseUrl),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return json(
      {
        baseUrl,
        error:
          error instanceof Error
            ? error.message
            : "Ollama status шалгаж чадсангүй.",
        hasApiKey: Boolean(apiKey),
        lastCheckedAt: checkedAt,
        model,
        modelAvailable: false,
        models: [],
        reachable: false,
        remote: isRemoteOllamaBaseUrl(baseUrl),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

const sanitizeClientId = (value?: string) => {
  const normalized = value?.trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  return normalized && normalized.length > 0 ? normalized : undefined;
};

const parseAblyApiKey = (apiKey: string) => {
  const separatorIndex = apiKey.indexOf(":");

  if (separatorIndex <= 0 || separatorIndex === apiKey.length - 1) {
    throw new Error("ABLY_API_KEY буруу форматтай байна.");
  }

  return {
    keyName: apiKey.slice(0, separatorIndex),
    secret: apiKey.slice(separatorIndex + 1),
  };
};

const createNonce = () => crypto.randomUUID().replace(/-/g, "");

const arrayBufferToBase64 = (value: ArrayBuffer) => {
  let binary = "";
  const bytes = new Uint8Array(value);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const createMac = async (
  secret: string,
  keyName: string,
  ttl: number,
  capability: string,
  clientId: string,
  timestamp: number,
  nonce: string,
) => {
  const signingText = [
    keyName,
    String(ttl),
    capability,
    clientId,
    String(timestamp),
    nonce,
  ].join("\n") + "\n";

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingText),
  );

  return arrayBufferToBase64(signature);
};

async function handleAblyAuth(request: Request, env: Env) {
  const apiKey = getEnvValue(env.ABLY_API_KEY);

  if (!apiKey) {
    return json(
      { message: "ABLY_API_KEY тохируулагдаагүй байна." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      capability?: string;
      clientId?: string;
      ttl?: number;
    };
    const { keyName, secret } = parseAblyApiKey(apiKey);
    const clientIdPrefix = getEnvValue(env.ABLY_CLIENT_ID_PREFIX) ?? "pinequest";
    const clientId =
      sanitizeClientId(body.clientId) ?? `${clientIdPrefix}:test-dashboard`;
    const capability = body.capability?.trim() || JSON.stringify({ "*": ["subscribe"] });
    const ttl =
      typeof body.ttl === "number" && Number.isFinite(body.ttl) && body.ttl > 0
        ? Math.floor(body.ttl)
        : 60 * 60 * 1000;
    const timestamp = Date.now();
    const nonce = createNonce();
    const mac = await createMac(
      secret,
      keyName,
      ttl,
      capability,
      clientId,
      timestamp,
      nonce,
    );

    return json(
      {
        capability,
        clientId,
        keyName,
        mac,
        nonce,
        timestamp,
        ttl,
      },
      { status: 200 },
    );
  } catch (error) {
    return json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Ably auth token үүсгэж чадсангүй.",
      },
      { status: 500 },
    );
  }
}

async function routeApiRequest(request: Request, env: Env) {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/api/gemini-exam" && request.method === "POST") {
    return handleGeminiExamPost(request, env);
  }

  if (pathname === "/api/gemini-extract" && request.method === "POST") {
    return handleGeminiExtractPost(request, env);
  }

  if (pathname === "/api/take-exam-dashboard" && request.method === "GET") {
    return handleDashboardGet(request, env);
  }

  if (pathname === "/api/take-exam-approve" && request.method === "POST") {
    return handleApprovePost(request, env);
  }

  if (pathname === "/api/take-exam-question-feedback" && request.method === "POST") {
    return handleQuestionFeedbackPost(request, env);
  }

  if (pathname === "/api/take-exam-focus-analysis" && request.method === "POST") {
    return handleFocusAnalysisPost(request, env);
  }

  if (pathname === "/api/ollama-teacher-feedback") {
    if (request.method === "GET") {
      return handleTeacherFeedbackGet(env);
    }

    if (request.method === "POST") {
      return handleTeacherFeedbackPost(request, env);
    }
  }

  if (pathname === "/api/ably/auth" && request.method === "POST") {
    return handleAblyAuth(request, env);
  }

  return json({ message: "Not found" }, { status: 404 });
}

export default {
  async fetch(request: Request, env: Env) {
    const pathname = new URL(request.url).pathname;

    if (pathname.startsWith("/api/")) {
      return routeApiRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
