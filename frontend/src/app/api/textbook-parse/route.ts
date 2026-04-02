import { parseTextbookFileOnServer } from "@/server/textbook-parse";

function normalizeParseErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "PDF боловсруулах үед алдаа гарлаа.";
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid pdf structure") || normalized.includes("invalid pdf")) {
    return "PDF файл гэмтсэн эсвэл бүрэн PDF бүтэцгүй байна. Өөр PDF сонгоод дахин оролдоно уу.";
  }

  return message;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof (file as File).arrayBuffer !== "function") {
      return Response.json(
        { error: "PDF файл олдсонгүй." },
        { status: 400 },
      );
    }

    const result = await parseTextbookFileOnServer(file as File);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: normalizeParseErrorMessage(error) },
      { status: 400 },
    );
  }
}
