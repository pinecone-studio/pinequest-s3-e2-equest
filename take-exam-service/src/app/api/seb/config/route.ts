import { NextResponse } from "next/server";
import { buildSebConfigBundle } from "@/lib/seb/config";
import { getSebSettingsPassword } from "@/lib/seb/verify";

export const runtime = "nodejs";

function buildFilename(hostname: string) {
	return `${hostname.replace(/[^a-z0-9.-]/gi, "-") || "safe-exam"}.seb`;
}

export async function GET(request: Request) {
	try {
		const requestUrl = new URL(request.url);
		const { configKey, encryptedConfig, startURL, quitURL } =
			buildSebConfigBundle(requestUrl.origin, getSebSettingsPassword());

		return new NextResponse(encryptedConfig, {
			status: 200,
			headers: {
				"Content-Type": "application/octet-stream",
				"Content-Disposition": `attachment; filename="${buildFilename(requestUrl.hostname)}"`,
				"Cache-Control": "no-store",
				"X-SEB-Config-Key": configKey,
				"X-SEB-Start-URL": startURL,
				"X-SEB-Quit-URL": quitURL,
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "SEB config үүсгэж чадсангүй.",
			},
			{ status: 500 },
		);
	}
}
