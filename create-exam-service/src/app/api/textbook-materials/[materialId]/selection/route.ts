import {
  getTextbookMaterialDb,
  readTextbookJsonBody,
  textbookError,
  textbookJson,
  textbookOptions,
} from "@/features/textbook-materials/http";
import { getTextbookMaterialSelection } from "@/features/textbook-materials/selection";
import type { GetTextbookMaterialSelectionInput } from "@/features/textbook-materials/types";

type RouteContext = {
  params: Promise<{
    materialId: string;
  }>;
};

export function OPTIONS() {
  return textbookOptions("POST, OPTIONS");
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const db = getTextbookMaterialDb();
    const { materialId } = await context.params;
    const body = await readTextbookJsonBody<GetTextbookMaterialSelectionInput>(request);
    const detail = await getTextbookMaterialSelection(db, materialId, body);

    if (!detail) {
      return textbookJson({ material: null, pages: [], sections: [], chunks: [] }, 404);
    }

    return textbookJson(detail);
  } catch (error) {
    return textbookError(error);
  }
}
