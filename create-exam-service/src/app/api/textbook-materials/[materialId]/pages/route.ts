import {
  getTextbookMaterialDb,
  readTextbookJsonBody,
  textbookError,
  textbookJson,
  textbookOptions,
} from "@/features/textbook-materials/http";
import { upsertTextbookMaterialPages } from "@/features/textbook-materials/repository";
import type { UpsertTextbookPagesInput } from "@/features/textbook-materials/types";

type RouteContext = {
  params: Promise<{
    materialId: string;
  }>;
};

export function OPTIONS() {
  return textbookOptions();
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const db = getTextbookMaterialDb();
    const { materialId } = await context.params;
    const body = await readTextbookJsonBody<UpsertTextbookPagesInput>(request);
    const detail = await upsertTextbookMaterialPages(db, materialId, body);
    return textbookJson(detail);
  } catch (error) {
    return textbookError(error);
  }
}
