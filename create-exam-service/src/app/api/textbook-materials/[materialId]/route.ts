import type { NextRequest } from "next/server";
import {
  getTextbookMaterialDb,
  readTextbookJsonBody,
  textbookError,
  textbookJson,
  textbookOptions,
} from "@/features/textbook-materials/http";
import {
  getTextbookMaterialDetail,
  updateTextbookMaterial,
} from "@/features/textbook-materials/repository";
import type { UpdateTextbookMaterialInput } from "@/features/textbook-materials/types";

type RouteContext = {
  params: Promise<{
    materialId: string;
  }>;
};

export function OPTIONS() {
  return textbookOptions();
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const db = getTextbookMaterialDb();
    const { materialId } = await context.params;
    const includeContent =
      request.nextUrl.searchParams.get("includeContent") === "1";
    const detail = await getTextbookMaterialDetail(
      db,
      { materialId },
      { includeContent },
    );

    if (!detail) {
      return textbookJson({ material: null, pages: [], sections: [], chunks: [] }, 404);
    }

    return textbookJson(detail);
  } catch (error) {
    return textbookError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const db = getTextbookMaterialDb();
    const { materialId } = await context.params;
    const body = await readTextbookJsonBody<UpdateTextbookMaterialInput>(request);
    const detail = await updateTextbookMaterial(db, materialId, body);
    return textbookJson(detail);
  } catch (error) {
    return textbookError(error);
  }
}
