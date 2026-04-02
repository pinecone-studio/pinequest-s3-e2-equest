import { handleTextbookGeneratePost } from "@/server/textbook-generate";

const DEFAULT_LOCAL_OLLAMA_BASE_URL =
  "https://fax-guides-draw-minority.trycloudflare.com";
const DEFAULT_LOCAL_OLLAMA_MODEL = "llama3.1:latest";
const DEFAULT_LOCAL_GEMINI_MODEL = "gemini-2.5-flash";

export async function POST(request: Request) {
  return handleTextbookGeneratePost(request, {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL || DEFAULT_LOCAL_GEMINI_MODEL,
    OLLAMA_API_KEY: process.env.OLLAMA_API_KEY,
    OLLAMA_BASE_URL:
      process.env.OLLAMA_BASE_URL || DEFAULT_LOCAL_OLLAMA_BASE_URL,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || DEFAULT_LOCAL_OLLAMA_MODEL,
  });
}
