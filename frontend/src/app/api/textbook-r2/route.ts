import { forwardTextbookR2Request } from "@/server/textbook-r2-proxy";

export const revalidate = 0;

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  return forwardTextbookR2Request(request);
}

export async function POST(request: Request) {
  return forwardTextbookR2Request(request);
}
