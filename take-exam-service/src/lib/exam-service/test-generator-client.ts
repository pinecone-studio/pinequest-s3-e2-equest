import type { ExamTest, GetTestByIdResponse } from "@/lib/exam-service/types";

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

export async function fetchPublishedTest(testId: string): Promise<ExamTest> {
	const baseUrl = process.env.TEST_GENERATOR_BASE_URL?.trim();

	if (!baseUrl) {
		throw new Error("TEST_GENERATOR_BASE_URL is missing.");
	}

	const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/tests/${testId}`, {
		cache: "no-store",
	});

	if (!response.ok) {
		throw new Error(`Test Generator returned ${response.status} ${response.statusText}.`);
	}

	const payload = (await response.json()) as GetTestByIdResponse;

	if (payload.test.status !== "published") {
		throw new Error("Only published tests can be started by students.");
	}

	return payload.test;
}
