import { NextResponse } from "next/server";
import { validateSebRequest, validateSebVersion } from "@/lib/seb/verify";

export async function GET(request: Request) {
	const validation = validateSebRequest(request, { requireSeb: true });

	if (!validation.ok) {
		return NextResponse.json(
			{
				ok: false,
				message: validation.message,
			},
			{ status: 403 },
		);
	}

	const versionValidation = validateSebVersion(request);

	if (!versionValidation.ok) {
		return NextResponse.json(
			{
				client: versionValidation.client,
				message: versionValidation.message,
				ok: false,
			},
			{ status: 403 },
		);
	}

	return NextResponse.json({
		client: versionValidation.client,
		ok: true,
		message: "Safe Exam Browser verification амжилттай боллоо.",
		configKey: "configKey" in validation ? validation.configKey : undefined,
	});
}
