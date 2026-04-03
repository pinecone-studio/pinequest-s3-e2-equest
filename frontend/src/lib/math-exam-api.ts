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
  const contentType = response.headers.get("content-type") ?? "";
  const rawBody = await response.text();

  if (!contentType.includes("application/json")) {
    if (rawBody.trim().startsWith("<!DOCTYPE") || rawBody.trim().startsWith("<")) {
      throw new Error(
        "API route HTML буцаалаа. Dev server дээр `/api/gemini-extract` эсвэл `/api/gemini-exam` route ажиллаж байгаа эсэхийг шалгана уу.",
      );
    }

    throw new Error(fallbackError);
  }

  const payload = JSON.parse(rawBody) as ExamApiResponse | undefined;

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
    onProgress?: (progress: { loaded: number; total?: number }) => void;
  },
) {
  const attachments = await Promise.all(
    files.map((file) => serializeAttachment(file)),
  );
  const payload = JSON.stringify({
    attachments,
    enhanceFocus: options?.enhanceFocus,
    mode: options?.mode ?? "fast",
  });

  if (!options?.onProgress) {
    const response = await fetch("/api/gemini-extract", {
      body: payload,
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    return parseExamResponse(response, "Файлаас асуултуудыг таньж чадсангүй.");
  }

  return new Promise<GeneratedExamPayload>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("POST", "/api/gemini-extract");
    request.setRequestHeader("Content-Type", "application/json");
    request.upload.onprogress = (event) => {
      options.onProgress?.({
        loaded: event.loaded,
        total: event.lengthComputable ? event.total : undefined,
      });
    };
    request.onerror = () => {
      reject(new Error("Файлаас асуултуудыг таньж чадсангүй."));
    };
    request.onload = () => {
      const contentType = request.getResponseHeader("content-type") ?? "";
      const rawBody = request.responseText ?? "";

      if (!contentType.includes("application/json")) {
        if (rawBody.trim().startsWith("<!DOCTYPE") || rawBody.trim().startsWith("<")) {
          reject(
            new Error(
              "API route HTML буцаалаа. Dev server дээр `/api/gemini-extract` эсвэл `/api/gemini-exam` route ажиллаж байгаа эсэхийг шалгана уу.",
            ),
          );
          return;
        }
        reject(new Error("Файлаас асуултуудыг таньж чадсангүй."));
        return;
      }

      try {
        const parsed = JSON.parse(rawBody) as ExamApiResponse | undefined;
        if (request.status < 200 || request.status >= 300 || !parsed?.exam) {
          reject(new Error(parsed?.error || "Файлаас асуултуудыг таньж чадсангүй."));
          return;
        }
        resolve(parsed.exam);
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error("Файлаас асуултуудыг таньж чадсангүй."),
        );
      }
    };

    request.send(payload);
  });
}
