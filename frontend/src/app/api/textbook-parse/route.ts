import { handleTextbookParsePost } from "@/server/textbook-parse";

export async function POST(request: Request) {
  return handleTextbookParsePost(request);
}
