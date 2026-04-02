import type { NextRequest } from "next/server";
import {
  getTextbookMaterialDb,
  textbookError,
  textbookJson,
  textbookOptions,
} from "@/features/textbook-materials/http";
import { listTextbookMaterials } from "@/features/textbook-materials/repository";

export function OPTIONS() {
  return textbookOptions("GET, OPTIONS");
}

export async function GET(request: NextRequest) {
  try {
    const db = getTextbookMaterialDb();
    const gradeParam = request.nextUrl.searchParams.get("grade")?.trim();
    const limitParam = request.nextUrl.searchParams.get("limit")?.trim();
    const subject = request.nextUrl.searchParams.get("subject")?.trim();
    const statuses = request.nextUrl.searchParams
      .getAll("status")
      .map((value) => value.trim())
      .filter(Boolean);
    const detail = await listTextbookMaterials(db, {
      grade:
        gradeParam && Number.isFinite(Number(gradeParam))
          ? Number(gradeParam)
          : null,
      limit:
        limitParam && Number.isFinite(Number(limitParam))
          ? Number(limitParam)
          : null,
      statuses: statuses.length ? statuses : null,
      subject: subject || null,
    });

    return textbookJson({ items: detail });
  } catch (error) {
    return textbookError(error);
  }
}
