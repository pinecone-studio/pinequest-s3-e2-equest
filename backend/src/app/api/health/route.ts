import { NextResponse } from "next/server";
import type { BackendHealthResponse } from "@shared/contracts/backend";

export function GET() {
	const response: BackendHealthResponse = {
		service: "create-exam-service",
		status: "ok",
		timestamp: new Date().toISOString(),
		version: "0.1.0",
		api: {
			healthPath: "/api/health",
			createExamPath: "/api/exams",
		},
		notes: [
			"Database schema can stay separate per microservice.",
			"Only the API contract between services must stay stable.",
		],
	};

	return NextResponse.json(response);
}
