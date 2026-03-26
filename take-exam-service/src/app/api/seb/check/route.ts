import { NextResponse } from "next/server";
import { validateSebRequest } from "@/lib/seb/verify";

export async function GET(request: Request) {
	const validation = validateSebRequest(request);

	if (!validation.ok) {
		return NextResponse.json(
			{
				ok: false,
				message: validation.message,
			},
			{ status: 403 },
		);
	}

	return NextResponse.json({
		ok: true,
		message: "Safe Exam Browser verification амжилттай боллоо.",
		configKey: "configKey" in validation ? validation.configKey : undefined,
	});
}
