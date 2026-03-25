import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { savePublishedTest } from "@/lib/exam-service/store";
import type { MockTest } from "@shared/contracts/mock-exam";

export async function POST(request: Request) {
    try {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);

        const test = (await request.json()) as MockTest;
        await savePublishedTest(db, test, env.EXAM_CACHE);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Unable to save test." },
            { status: 500 },
        );
    }
}
