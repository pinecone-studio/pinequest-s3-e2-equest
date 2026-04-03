import { forwardTextbookR2Request } from "@/server/textbook-r2-proxy";

export async function POST(request: Request) {
  return forwardTextbookR2Request(request);
}
