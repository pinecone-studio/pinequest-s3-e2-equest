import { handleTextbookUploadProxyRequest } from "@/server/textbook-r2-proxy";

export async function POST(request: Request) {
  return handleTextbookUploadProxyRequest(request);
}
