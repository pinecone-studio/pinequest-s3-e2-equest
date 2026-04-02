import {
  forwardTextbookMaterialsRequest,
  textbookMaterialsProxyOptions,
} from "@/server/textbook-materials-proxy";

export function OPTIONS() {
  return textbookMaterialsProxyOptions();
}

export async function GET(request: Request) {
  return forwardTextbookMaterialsRequest(request);
}

export async function POST(request: Request) {
  return forwardTextbookMaterialsRequest(request);
}
