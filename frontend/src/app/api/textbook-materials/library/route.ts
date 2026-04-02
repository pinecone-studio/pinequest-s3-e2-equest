import {
  forwardTextbookMaterialsRequest,
  textbookMaterialsProxyOptions,
} from "@/server/textbook-materials-proxy";

export function OPTIONS() {
  return textbookMaterialsProxyOptions("GET, OPTIONS");
}

export async function GET(request: Request) {
  return forwardTextbookMaterialsRequest(request, "/library");
}
