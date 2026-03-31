import type {
  ExtractExamEnhanceFocus,
  ExamApiResponse,
  GenerateExamRequest,
  GeneratedExamPayload,
  UploadAttachmentPayload,
} from "@/lib/math-exam-contract";

type GenerateExamOptions = Omit<GenerateExamRequest, "attachments"> & {
  files?: File[];
};

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        reject(new Error(`${file.name} файлыг уншиж чадсангүй.`));
        return;
      }

      resolve(result.split(",")[1] ?? "");
    };

    reader.onerror = () => {
      reject(new Error(`${file.name} файлыг уншиж чадсангүй.`));
    };

    reader.readAsDataURL(file);
  });
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`${file.name} зургийг уншиж чадсангүй.`));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error(`${file.name} зургийг уншиж чадсангүй.`));
    };

    reader.readAsDataURL(file);
  });
}

export async function serializeAttachment(
  file: File,
): Promise<UploadAttachmentPayload> {
  const mimeType = file.type || "application/octet-stream";

  if (mimeType.startsWith("text/")) {
    return {
      mimeType,
      name: file.name,
      text: await file.text(),
    };
  }

  return {
    data: await readFileAsBase64(file),
    mimeType,
    name: file.name,
  };
}

async function parseExamResponse(response: Response, fallbackError: string) {
  const payload = (await response.json()) as ExamApiResponse | undefined;

  if (!response.ok || !payload?.exam) {
    throw new Error(payload?.error || fallbackError);
  }

  return payload.exam;
}

export async function requestGeneratedExam({
  files = [],
  ...request
}: GenerateExamOptions): Promise<GeneratedExamPayload> {
  const attachments = await Promise.all(
    files.map((file) => serializeAttachment(file)),
  );

  const response = await fetch("/api/gemini-exam", {
    body: JSON.stringify({
      ...request,
      attachments,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return parseExamResponse(response, "AI шалгалт үүсгэж чадсангүй.");
}

export async function requestExtractedExam(
  files: File[],
  options?: {
    enhanceFocus?: ExtractExamEnhanceFocus;
    mode?: "enhance" | "fast";
  },
) {
  const attachments = await Promise.all(
    files.map((file) => serializeAttachment(file)),
  );
  const response = await fetch("/api/gemini-extract", {
    body: JSON.stringify({
      attachments,
      enhanceFocus: options?.enhanceFocus,
      mode: options?.mode ?? "fast",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return parseExamResponse(response, "Файлаас асуултуудыг таньж чадсангүй.");
}
