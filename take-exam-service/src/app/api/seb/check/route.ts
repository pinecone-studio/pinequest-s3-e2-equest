import { NextResponse } from "next/server";
import {
	getSebClientDetails,
	isSebEnforcementEnabled,
	validateSebRequest,
	validateSebVersion,
} from "@/lib/seb/verify";

export async function GET(request: Request) {
	if (!isSebEnforcementEnabled()) {
		return NextResponse.json(
			{
				client: getSebClientDetails(request),
				ok: true,
				message: "SEB шалгалт dev горимд алгасагдлаа.",
			},
			{
				headers: {
					"Cache-Control": "no-store",
				},
			},
		);
	}

	const validation = validateSebRequest(request);

	if (!validation.ok) {
		return NextResponse.json(
			{
				ok: false,
				message: validation.message,
			},
			{
				headers: {
					"Cache-Control": "no-store",
				},
			},
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
			{
				headers: {
					"Cache-Control": "no-store",
				},
			},
		);
	}

	return NextResponse.json(
		{
			client: versionValidation.client,
			ok: true,
			message: "Safe Exam Browser verification амжилттай боллоо.",
			configKey: "configKey" in validation ? validation.configKey : undefined,
		},
		{
			headers: {
				"Cache-Control": "no-store",
			},
		},
	);
}
