import {
  getTextbookMaterialDb,
  readTextbookJsonBody,
  textbookError,
  textbookJson,
  textbookOptions,
} from "@/features/textbook-materials/http";
import { getTextbookMaterialStructure } from "@/features/textbook-materials/selection";
import { replaceTextbookMaterialStructure } from "@/features/textbook-materials/repository";
import type { ReplaceTextbookStructureInput } from "@/features/textbook-materials/types";

type RouteContext = {
  params: Promise<{
    materialId: string;
  }>;
};

export function OPTIONS() {
  return textbookOptions("GET, POST, OPTIONS");
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const db = getTextbookMaterialDb();
    const { materialId } = await context.params;
    const detail = await getTextbookMaterialStructure(db, materialId);

    if (!detail) {
      return textbookJson({ material: null, sections: [] }, 404);
    }

    return textbookJson(detail);
  } catch (error) {
    return textbookError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const db = getTextbookMaterialDb();
    const { materialId } = await context.params;
    const body = await readTextbookJsonBody<ReplaceTextbookStructureInput>(request);
    const detail = await replaceTextbookMaterialStructure(db, materialId, body);
    return textbookJson(detail);
  } catch (error) {
    return textbookError(error);
  }
}
