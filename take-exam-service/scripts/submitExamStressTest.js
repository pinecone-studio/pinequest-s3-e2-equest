import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 50 }, // 1 минутын дотор 0-ээс 50 хэрэглэгч хүртэл аажмаар нэмнэ
    { duration: "3m", target: 50 }, // 3 минутын турш 50 хэрэглэгчтэй тогтвортой барина
    { duration: "2m", target: 200 }, // 2 минутын дотор 50-иас 200 хэрэглэгч болгож өсгөнө
    { duration: "3m", target: 200 }, // 3 минутын турш 200 хэрэглэгчтэй тогтвортой байлгана
    { duration: "1m", target: 0 }, // Төгсгөлд нь 1 минутын дотор аажмаар буулгаж 0 болгоно
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"], // Алдааны хувь 1%-иас бага байх ёстой гэсэн шалгуур
    http_req_duration: ["p(95)<2000"], // Нийт хүсэлтийн 95% нь 2 секундээс хурдан байх ёстой
  },
};

export default function () {
  const url =
    "https://take-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql";

  // STEP 1: Start the exam to get a valid Attempt ID
  const startPayload = JSON.stringify({
    query: `
      mutation Start {
        startExam(testId: "test_1", studentId: "student_1", studentName: "Test Student") {
          attemptId
        }
      }
    `,
  });

  const startRes = http.post(url, startPayload, {
    headers: { "Content-Type": "application/json" },
  });
  const startBody = startRes.json();

  if (startBody.errors || !startBody.data) {
    console.error(
      `❌ Failed to start exam: ${JSON.stringify(startBody.errors || "Unknown error")}`,
    );
    return;
  }

  const validAttemptId = startBody.data.startExam.attemptId;

  // STEP 2: Submit answers for that real Attempt ID
  const submitPayload = JSON.stringify({
    query: `
      mutation Submit($aid: String!, $ans: [AnswerInput!]!, $fin: Boolean!) {
        submitAnswers(attemptId: $aid, answers: $ans, finalize: $fin) {
          attemptId
          status
        }
      }
    `,
    variables: {
      aid: validAttemptId,
      ans: [{ questionId: "q_1", selectedOptionId: "a" }],
      fin: true,
    },
  });

  const res = http.post(url, submitPayload, {
    headers: { "Content-Type": "application/json" },
  });
  const body = res.json();

  if (body.errors) {
    console.log(
      `❌ Attempt ${validAttemptId} failed: ${JSON.stringify(body.errors)}`,
    );
  } else {
    // Expected to be "processing" because we set finalize to true
    console.log(
      `✅ Attempt ${validAttemptId} success: ${body.data.submitAnswers.status}`,
    );
  }

  check(res, {
    "is status 200": (r) => r.status === 200,
    "no graphql errors": (r) => !r.json().errors,
  });

  sleep(1);
}
