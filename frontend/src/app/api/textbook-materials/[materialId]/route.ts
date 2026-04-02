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
  return textbookMaterialsProxyOptions();
}

export async function GET(request: Request, context: RouteContext) {
  const { materialId } = await context.params;
  return forwardTextbookMaterialsRequest(
    request,
    `/${encodeURIComponent(materialId)}`,
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const { materialId } = await context.params;
  return forwardTextbookMaterialsRequest(
    request,
    `/${encodeURIComponent(materialId)}`,
  );
}
