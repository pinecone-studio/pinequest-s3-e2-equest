import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import {
	gradeTeacherSubmission,
	postTeacherCheckedAttempt,
} from "@/lib/teacherSubmission";

type RouteEnv = {
	DB?: D1Database;
	TAKE_EXAM_RESULT_WEBHOOK_SECRET?: string;
	TAKE_EXAM_RESULT_WEBHOOK_URL?: string;
};

const getRouteEnv = () =>
	(getCloudflareContext() as unknown as { env: RouteEnv }).env;

const getCallbackUrl = (env: RouteEnv) =>
	env.TAKE_EXAM_RESULT_WEBHOOK_URL ?? process.env.TAKE_EXAM_RESULT_WEBHOOK_URL;

const getCallbackSecret = (env: RouteEnv) =>
	env.TAKE_EXAM_RESULT_WEBHOOK_SECRET ??
	process.env.TAKE_EXAM_RESULT_WEBHOOK_SECRET;

export async function POST(request: Request) {
	try {
		const env = getRouteEnv();
		if (!env.DB) {
			return NextResponse.json(
				{ message: "D1 DB binding олдсонгүй." },
				{ status: 500 },
			);
		}

		const callbackUrl = getCallbackUrl(env)?.trim();
		if (!callbackUrl) {
			return NextResponse.json(
				{
					message:
						"TAKE_EXAM_RESULT_WEBHOOK_URL тохируулаагүй тул checked result буцааж чадсангүй.",
				},
				{ status: 500 },
			);
		}

		const db = getDb(env.DB);
		const graded = await gradeTeacherSubmission(db, await request.json());
		const callbackResponse = await postTeacherCheckedAttempt(graded, {
			callbackUrl,
			callbackSecret: getCallbackSecret(env),
		});

		return NextResponse.json(
			{
				message: "Teacher submission шалгагдаж, take-exam-service рүү буцаагдлаа.",
				callbackResponse,
				graded,
			},
			{
				headers: {
					"Cache-Control": "no-store",
				},
			},
		);
	} catch (error) {
		return NextResponse.json(
			{
				message:
					error instanceof Error
						? error.message
						: "Teacher submission шалгах үед алдаа гарлаа.",
			},
			{ status: 400 },
		);
	}
}
