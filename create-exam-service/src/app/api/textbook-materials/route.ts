import type { NextRequest } from "next/server";
import {
  getTextbookMaterialDb,
  readTextbookJsonBody,
  textbookError,
  textbookJson,
  textbookOptions,
} from "@/features/textbook-materials/http";
import {
  createOrReuseTextbookMaterial,
  getTextbookMaterialDetail,
} from "@/features/textbook-materials/repository";
import type { CreateTextbookMaterialInput } from "@/features/textbook-materials/types";

export function OPTIONS() {
  return textbookOptions();
}

export async function GET(request: NextRequest) {
  try {
    const db = getTextbookMaterialDb();
    const includeContent =
      request.nextUrl.searchParams.get("includeContent") === "1";
    const materialId = request.nextUrl.searchParams.get("materialId")?.trim();
    const bucketName = request.nextUrl.searchParams.get("bucketName")?.trim();
    const r2Key = request.nextUrl.searchParams.get("key")?.trim();

    const detail = materialId
      ? await getTextbookMaterialDetail(
          db,
          { materialId },
          { includeContent },
        )
      : bucketName && r2Key
        ? await getTextbookMaterialDetail(
            db,
            { bucketName, r2Key },
            { includeContent },
          )
        : null;

    if (!detail) {
      return textbookJson({ material: null, pages: [], sections: [], chunks: [] }, 404);
    }

    return textbookJson(detail);
  } catch (error) {
    return textbookError(error);
  }
}

export async function POST(request: Request) {
  try {
    const db = getTextbookMaterialDb();
    const body = await readTextbookJsonBody<CreateTextbookMaterialInput>(request);
    const detail = await createOrReuseTextbookMaterial(db, body);
    return textbookJson(detail, 201);
  } catch (error) {
    return textbookError(error);
  }
}
