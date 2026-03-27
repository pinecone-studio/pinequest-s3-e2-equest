import mammoth from "mammoth";
import mammothUnzipModule from "mammoth/lib/unzip";
import mammothXmlModule from "mammoth/lib/xml";

import type {
  ExtractExamRequest,
  GeneratedExamPayload,
} from "@/lib/math-exam-contract";
import { buildGeminiErrorResponse } from "@/lib/gemini-error";

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOCX_XML_NAMESPACE_MAP = {
  "http://schemas.openxmlformats.org/officeDocument/2006/math": "m",
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main": "w",
};

type XmlTextNode = {
  type: "text";
  value: string;
};

type XmlElementNode = {
  attributes: Record<string, string>;
  children: XmlNode[];
  first: (name: string) => XmlElementNode | null;
  firstOrEmpty: (name: string) => XmlElementNode;
  getElementsByTagName: (name: string) => XmlElementNode[];
  name: string;
  type: "element";
};

type XmlNode = XmlElementNode | XmlTextNode;

type DocxZipFile = {
  exists: (name: string) => boolean;
  read: (name: string, encoding?: string) => Promise<string>;
};

const mammothUnzip = mammothUnzipModule as {
  openZip: (options: { buffer: Buffer }) => Promise<DocxZipFile>;
};

const mammothXml = mammothXmlModule as {
  readString: (
    xmlString: string,
    namespaceMap: Record<string, string>,
  ) => Promise<XmlElementNode>;
};

function cleanJsonBlock(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  return trimmed;
}

type AttachmentPayload = {
  data?: string;
  mimeType?: string;
  name?: string;
  text?: string;
};

type TextAttachment = {
  mimeType: string;
  name: string;
  text: string;
};

type BinaryAttachment = {
  data: string;
  mimeType: string;
  name: string;
};

type DocxArtifacts = {
  mathHints: string[];
  text: string;
};

function isMarkdownLikeTextFile(name?: string) {
  return Boolean(name?.match(/\.(md|markdown|txt|csv|json)$/i));
}

function detectPotentialMathGaps(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (/[._]{3,}/.test(line)) {
        return true;
      }

      if (/[=+\-*/^]$/.test(line)) {
        return true;
      }

      if (/^[A-D]\.\s*$/.test(line)) {
        return true;
      }

      if (/[xyabc]\s*[=<>+\-*/^]/i.test(line) && !/\d/.test(line)) {
        return true;
      }

      return false;
    })
    .slice(0, 20);
}

function normalizeMathToken(value: string) {
  return value
    .replace(/∙/g, "\\cdot ")
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/−/g, "-")
    .replace(/≤/g, "\\leq ")
    .replace(/≥/g, "\\geq ")
    .replace(/≠/g, "\\neq ");
}

function getChildElements(node: XmlElementNode, name?: string) {
  return node.children.filter((child): child is XmlElementNode => {
    if (child.type !== "element") {
      return false;
    }

    return name ? child.name === name : true;
  });
}

function normalizeMathFunctionName(value: string) {
  const trimmed = value.trim().replace(/^\{([A-Za-z]+)\}/, "$1");

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("\\")) {
    return trimmed;
  }

  const operatorMatch = trimmed.match(/^([A-Za-z]+)(.*)$/);

  if (!operatorMatch) {
    return trimmed;
  }

  const [, operator, suffix] = operatorMatch;
  const normalizedOperator = operator.toLowerCase();

  if (
    [
      "cos",
      "cot",
      "csc",
      "lim",
      "ln",
      "log",
      "max",
      "min",
      "prod",
      "sec",
      "sin",
      "sum",
      "tan",
    ].includes(normalizedOperator)
  ) {
    return `\\${normalizedOperator}${suffix}`;
  }

  return `\\operatorname{${operator}}${suffix}`;
}

function normalizeNaryOperator(value?: string) {
  switch (value) {
    case "∫":
      return "\\int";
    case "∮":
      return "\\oint";
    case "∑":
      return "\\sum";
    case "∏":
      return "\\prod";
    case "⋃":
      return "\\bigcup";
    case "⋂":
      return "\\bigcap";
    default:
      return value ? normalizeMathFunctionName(value) : "\\int";
  }
}

function normalizeDelimiterCharacter(
  value: string | undefined,
  fallback: string,
) {
  if (value === undefined) {
    return fallback;
  }

  if (value === "") {
    return ".";
  }

  return value;
}

function wrapMathBase(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^\\(?:frac|sqrt|left|right|operatorname)/.test(trimmed)) {
    return trimmed;
  }

  if (/^[A-Za-z0-9]+$/.test(trimmed)) {
    return trimmed;
  }

  return `{${trimmed}}`;
}

function readMathArgument(node: XmlElementNode | null) {
  if (!node) {
    return "";
  }

  return readXmlNodeText(node).trim();
}

function joinXmlChildrenText(children: XmlNode[]) {
  return children.map(readXmlNodeText).join("");
}

function normalizeTopLevelMathContent(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("\\\\") && !/\\begin\{[a-zA-Z*]+\}/.test(trimmed)) {
    return `\\begin{aligned} ${trimmed} \\end{aligned}`;
  }

  return trimmed;
}

function normalizeEquationLineForAlignment(value: string) {
  if (value.includes("&")) {
    return value;
  }

  return value.replace(
    /(.*?)(=|\\leq|\\geq|<|>)(.*)/,
    (_, left, operator, right) => `${left.trim()} &${operator} ${right.trim()}`,
  );
}

function readXmlNodeText(node: XmlNode): string {
  if (node.type === "text") {
    return node.value;
  }

  switch (node.name) {
    case "w:t":
      return joinXmlChildrenText(node.children);
    case "w:tab":
      return "\t";
    case "w:br":
      return "\n";
    case "m:t":
      return normalizeMathToken(joinXmlChildrenText(node.children));
    case "m:oMath":
    case "m:oMathPara":
      return `$${normalizeTopLevelMathContent(joinXmlChildrenText(node.children))}$`;
    case "m:r":
    case "m:num":
    case "m:den":
    case "m:e":
    case "m:sup":
    case "m:sub":
    case "m:deg":
    case "m:fName":
    case "m:lim":
      return joinXmlChildrenText(node.children);
    case "m:eqArr":
      return getChildElements(node, "m:e")
        .map((element) => normalizeEquationLineForAlignment(readXmlNodeText(element)))
        .join(" \\\\ ");
    case "m:f":
      return `\\frac{${readMathArgument(node.first("m:num"))}}{${readMathArgument(node.first("m:den"))}}`;
    case "m:sSup":
      return `${wrapMathBase(readMathArgument(node.first("m:e")))}^{${readMathArgument(node.first("m:sup"))}}`;
    case "m:sSub":
      return `${wrapMathBase(readMathArgument(node.first("m:e")))}_{${readMathArgument(node.first("m:sub"))}}`;
    case "m:sSubSup":
      return `${wrapMathBase(readMathArgument(node.first("m:e")))}_{${readMathArgument(node.first("m:sub"))}}^{${readMathArgument(node.first("m:sup"))}}`;
    case "m:func": {
      const functionName = normalizeMathFunctionName(
        readMathArgument(node.first("m:fName")),
      );
      const expression = readMathArgument(node.first("m:e"));

      if (!functionName) {
        return expression;
      }

      if (!expression) {
        return functionName;
      }

      return `${functionName}${wrapMathBase(expression)}`;
    }
    case "m:limLow": {
      const expression = normalizeMathFunctionName(
        readMathArgument(node.first("m:e")) || "lim",
      );
      const limit = readMathArgument(node.first("m:lim"));

      if (!limit) {
        return expression;
      }

      return `${expression}_{${limit}}`;
    }
    case "m:limUpp": {
      const expression = normalizeMathFunctionName(
        readMathArgument(node.first("m:e")),
      );
      const limit = readMathArgument(node.first("m:lim"));

      if (!limit) {
        return expression;
      }

      return `${expression}^{${limit}}`;
    }
    case "m:nary": {
      const operator = normalizeNaryOperator(
        node.first("m:naryPr")?.first("m:chr")?.attributes["m:val"],
      );
      const subscript = readMathArgument(node.first("m:sub"));
      const superscript = readMathArgument(node.first("m:sup"));
      const expression = readMathArgument(node.first("m:e"));
      const lowerBound = subscript ? `_{${subscript}}` : "";
      const upperBound = superscript ? `^{${superscript}}` : "";

      return `${operator}${lowerBound}${upperBound}${expression ? ` ${expression}` : ""}`;
    }
    case "m:d": {
      const delimiterProperties = node.first("m:dPr");
      const beginCharacter = normalizeDelimiterCharacter(
        delimiterProperties?.first("m:begChr")?.attributes["m:val"],
        "(",
      );
      const endCharacter = normalizeDelimiterCharacter(
        delimiterProperties?.first("m:endChr")?.attributes["m:val"],
        ")",
      );
      const innerValue = readMathArgument(node.first("m:e"));

      if (beginCharacter === "{" && innerValue.includes("\\\\")) {
        return `\\begin{cases} ${innerValue} \\end{cases}`;
      }

      return `\\left${beginCharacter}${innerValue}\\right${endCharacter}`;
    }
    case "m:rad": {
      const degree = readMathArgument(node.first("m:deg"));
      const expression = readMathArgument(node.first("m:e"));

      if (degree) {
        return `\\sqrt[${degree}]{${expression}}`;
      }

      return `\\sqrt{${expression}}`;
    }
    default:
      return joinXmlChildrenText(node.children);
  }
}

function normalizeExtractedParagraphText(value: string) {
  return value
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\$\s+/g, "$")
    .replace(/\s+\$/g, "$")
    .trim();
}

async function extractDocxStructuredText(buffer: Buffer) {
  const zipFile = await mammothUnzip.openZip({ buffer });

  if (!zipFile.exists("word/document.xml")) {
    return "";
  }

  const documentXml = await zipFile.read("word/document.xml", "utf-8");
  const documentNode = await mammothXml.readString(
    documentXml,
    DOCX_XML_NAMESPACE_MAP,
  );
  const body = documentNode.first("w:body");

  if (!body) {
    return "";
  }

  const lines: string[] = [];
  let questionIndex = 0;

  for (const child of body.children) {
    if (child.type !== "element" || child.name !== "w:p") {
      continue;
    }

    const paragraphProperties = child.first("w:pPr");
    const isNumberedQuestion = Boolean(paragraphProperties?.first("w:numPr"));
    const paragraphText = normalizeExtractedParagraphText(
      child.children
        .filter(
          (paragraphChild) =>
            paragraphChild.type !== "element" ||
            paragraphChild.name !== "w:pPr",
        )
        .map(readXmlNodeText)
        .join(""),
    );

    if (!paragraphText) {
      continue;
    }

    if (isNumberedQuestion) {
      questionIndex += 1;
      lines.push(`Q${questionIndex}. ${paragraphText}`);
      continue;
    }

    lines.push(paragraphText);
  }

  return lines.join("\n\n");
}

async function extractDocxArtifacts(
  attachment: AttachmentPayload,
): Promise<DocxArtifacts> {
  const data = attachment.data ?? "";

  if (!data) {
    return {
      mathHints: [],
      text: "",
    };
  }

  const buffer = Buffer.from(data, "base64");
  const rawTextResult = await mammoth.extractRawText({ buffer });
  const structuredText = await extractDocxStructuredText(buffer);
  const text = structuredText || rawTextResult.value.trim();

  return {
    mathHints: detectPotentialMathGaps(text),
    text,
  };
}

function decodeBase64Text(data: string) {
  return Buffer.from(data, "base64").toString("utf-8").trim();
}

async function uploadGeminiFile({
  apiKey,
  data,
  mimeType,
  name,
}: {
  apiKey: string;
  data: string;
  mimeType: string;
  name: string;
}) {
  const fileBytes = Buffer.from(data, "base64");
  const startResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      body: JSON.stringify({
        file: {
          display_name: name,
        },
      }),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(fileBytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "X-Goog-Upload-Protocol": "resumable",
      },
      method: "POST",
    },
  );

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");

  if (!startResponse.ok || !uploadUrl) {
    throw new Error(`${name} файлыг Gemini рүү upload хийж чадсангүй.`);
  }

  const uploadResponse = await fetch(uploadUrl, {
    body: fileBytes,
    headers: {
      "Content-Length": String(fileBytes.byteLength),
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
    },
    method: "POST",
  });

  const uploadPayload = (await uploadResponse.json()) as {
    file?: {
      mimeType?: string;
      uri?: string;
    };
  };

  if (!uploadResponse.ok || !uploadPayload.file?.uri) {
    throw new Error(`${name} файлыг finalize хийж чадсангүй.`);
  }

  return {
    mimeType: uploadPayload.file.mimeType ?? mimeType,
    name,
    uri: uploadPayload.file.uri,
  };
}

async function normalizeAttachments(attachments: AttachmentPayload[]) {
  const textAttachments: TextAttachment[] = [];
  const binaryAttachments: BinaryAttachment[] = [];
  const docxContexts: Array<{
    mathHints: string[];
    name: string;
  }> = [];

  for (const attachment of attachments) {
    const mimeType = attachment.mimeType ?? "application/octet-stream";
    const name = attachment.name ?? "attachment";
    const text = attachment.text?.trim();
    const data = attachment.data?.trim();

    if (mimeType === DOCX_MIME_TYPE) {
      const artifacts = await extractDocxArtifacts(attachment);

      if (artifacts.text) {
        textAttachments.push({
          mimeType: "text/plain",
          name,
          text: artifacts.text,
        });
      }

      docxContexts.push({
        mathHints: artifacts.mathHints,
        name,
      });

      continue;
    }

    if (text) {
      textAttachments.push({
        mimeType: mimeType.startsWith("text/") ? mimeType : "text/plain",
        name,
        text,
      });
      continue;
    }

    if (
      data &&
      (mimeType.startsWith("text/") || isMarkdownLikeTextFile(name))
    ) {
      const decodedText = decodeBase64Text(data);

      if (decodedText) {
        textAttachments.push({
          mimeType: "text/plain",
          name,
          text: decodedText,
        });
      }

      continue;
    }

    if (mimeType.startsWith("image/")) {
      continue;
    }

    if (data) {
      binaryAttachments.push({
        data,
        mimeType,
        name,
      });
    }
  }

  return {
    binaryAttachments,
    docxContexts,
    textAttachments,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExtractExamRequest;
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    if (attachments.length === 0) {
      return Response.json(
        { error: "Унших файл хавсаргаагүй байна." },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY тохируулаагүй байна." },
        { status: 500 },
      );
    }

    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const { binaryAttachments, docxContexts, textAttachments } =
      await normalizeAttachments(attachments);
    const uploadedFiles = await Promise.all(
      binaryAttachments.map((attachment) =>
        uploadGeminiFile({
          apiKey,
          data: attachment.data ?? "",
          mimeType: attachment.mimeType ?? "application/octet-stream",
          name: attachment.name ?? "attachment",
        }),
      ),
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
Хавсаргасан материал доторх БҮХ шалгалтын асуулт, хариултыг аль болох яг хэвээр нь таньж JSON болгон буцаа.

Дүрэм:
- Зөвхөн JSON буцаа. Тайлбар, markdown, code fence бүү нэм.
- Асуулт бүрийг дарааллаар нь Q1, Q2 гэж таньж ав.
- Prompt талбарт боломжтой бол асуултын дугаарыг хадгал. Жишээ: "Q1. ..."
- Материалыг бүү хураангуйл, бүү дүгнэ, бүү товчил.
- Асуулт, сонголт, хариу, оноо, тайлбар байвал яг тексттэй нь хадгал.
- Текстийг бүү хураангуйл. Тоо, томьёо, илэрхийлэл, бутархай, зэргийг яг байгаа хэлбэрээр нь хадгал.
- Prompt, options, responseGuide доторх математик хэсгийг боломжтой бол $...$ хэлбэрээр wrap хий.
- Prompt-ийн төгсгөлд байгаа /1 оноо/, /2 оноо/ гэх мэт онооны текстийг prompt дотор бүү хадгал, points талбарт тусад нь өг.
- answerLatex талбарт зөв хариуг цэвэр LaTeX хэлбэрээр өг. $ тэмдэг бүү ашигла.
- Хариултын түлхүүр, зөв сонголт, бодлогын зөв хариу байвал заавал гаргаж ав.
- Сонголтууд доторх тоо, тэмдэг, нэгж, томьёог алдалгүй буцаа.
- Сонгох асуултыг "mcq", задгай/бодлогын асуултыг "math" гэж тэмдэглэ.
- Одоогоор зураг унших feature түр унтарсан. Зурагтай холбоотой таамаг бүү хий.
- sourceImageName болон imageAlt талбаруудыг хоосон үлдээж болно.
- Хэрэв raw text мөр эвдэрсэн, томьёо тасарсан, сонголт дутуу, эсвэл математикийн мөр incomplete байвал зөвхөн харагдаж буй text context-оос аль болох сэргээ.
- Материал доторх асуултын эх бичвэрийг аль болох хадгал.
- Систем тэгшитгэл, логарифм, интеграл, лимит зэрэг тусгай математик бүтэц байвал LaTeX-ийг алдалгүй хадгал.
- mcq асуулт бол A/B/C/D дарааллыг зөв таньж options болон correctOption-ийг гарга.
- math асуулт бол answerLatex-ийг аль болох LaTeX хэлбэрээр гарга.
- responseGuide боломжтой бол богино заавар өг.
- title-д баримтын эсвэл шалгалтын нэрийг өг.

JSON бүтэц:
{
  "title": "string",
  "questions": [
    {
      "type": "mcq",
      "prompt": "string",
      "points": 2,
      "imageAlt": "string",
      "sourceImageName": "string",
      "options": ["string", "string", "string", "string"],
      "correctOption": 1
    },
    {
      "type": "math",
      "prompt": "string",
      "points": 4,
      "imageAlt": "string",
      "sourceImageName": "string",
      "responseGuide": "string",
      "answerLatex": "string"
    }
  ]
}
                  `.trim(),
                },
                ...textAttachments.map((attachment) => ({
                  text: `Хавсаргасан текст (${attachment.name ?? "text"}):\n${attachment.text}`,
                })),
                ...docxContexts.map((context) => ({
                  text: `DOCX text hints (${context.name}):\nPotentially broken math lines:\n${context.mathHints.join("\n") || "none"}`,
                })),
                ...(uploadedFiles.length > 0
                  ? [
                      {
                        text: `Тусдаа binary файл нэрс: ${uploadedFiles
                          .map((file) => file.name)
                          .join(", ")}`,
                      },
                    ]
                  : []),
                ...uploadedFiles.map((file) => ({
                  file_data: {
                    file_uri: file.uri,
                    mime_type: file.mimeType,
                  },
                })),
              ],
              role: "user",
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
      error?: {
        message?: string;
      };
    };

    if (!response.ok) {
      return buildGeminiErrorResponse({
        fallbackMessage: "Материалыг Gemini-аар унших үед алдаа гарлаа.",
        providerMessage: payload.error?.message,
        status: response.status,
      });
    }

    const extractedText = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim();

    if (!extractedText) {
      return Response.json(
        { error: "Материалаас уншигдах агуулга олдсонгүй." },
        { status: 502 },
      );
    }

    const exam = JSON.parse(cleanJsonBlock(extractedText)) as GeneratedExamPayload;

    if (!Array.isArray(exam.questions) || exam.questions.length === 0) {
      return Response.json(
        { error: "Файлаас танигдсан асуулт олдсонгүй." },
        { status: 502 },
      );
    }

    return Response.json({ exam });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Материалыг унших үед алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}
