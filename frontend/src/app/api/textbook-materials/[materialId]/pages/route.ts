import {
  forwardTextbookMaterialsRequest,
  textbookMaterialsProxyOptions,
} from "@/server/textbook-materials-proxy";

type RouteContext = {
  params: Promise<{
    materialId: string;
  }>;
};

export function OPTIONS() {
  return textbookMaterialsProxyOptions("POST, OPTIONS");
}

export async function POST(request: Request, context: RouteContext) {
  const { materialId } = await context.params;
  return forwardTextbookMaterialsRequest(
    request,
    `/${encodeURIComponent(materialId)}/pages`,
  );
}
