import mammoth from "mammoth";
import mammothUnzipModule from "mammoth/lib/unzip";
import mammothXmlModule from "mammoth/lib/xml";

import type {
  ExtractExamEnhanceFocus,
  ExtractExamRequest,
  GeneratedExamPayload,
  GeneratedExamSourceImagePayload,
} from "../lib/math-exam-contract";
import { parseLocalExamPayload } from "../lib/local-exam-parser";
import { parseGeminiJson } from "../lib/parse-gemini-json";
import { buildGeminiErrorResponse } from "../lib/gemini-error";

export type GeminiExtractWorkerEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
};

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOCX_XML_NAMESPACE_MAP = {
  "http://schemas.microsoft.com/office/word/2010/wordprocessingShape": "wps",
  "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup": "wpg",
  "http://schemas.openxmlformats.org/drawingml/2006/main": "a",
  "http://schemas.openxmlformats.org/drawingml/2006/picture": "pic",
  "http://schemas.openxmlformats.org/officeDocument/2006/math": "m",
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships": "r",
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main": "w",
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing": "wp",
  "urn:schemas-microsoft-com:office:office": "o",
  "urn:schemas-microsoft-com:vml": "v",
};
const DOCX_RELATIONSHIPS_NAMESPACE_MAP = {
  "http://schemas.openxmlformats.org/package/2006/relationships": "pr",
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
  read: (
    name: string,
    encoding?: string,
  ) => Promise<string | Uint8Array>;
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

type ExtractedDocxSourceImage = GeneratedExamSourceImagePayload & {
  dataUrl: string;
  mimeType: string;
  name: string;
  relationshipId: string;
};

type DocxArtifacts = {
  answerKeyHints: string[];
  geminiImageAttachments: BinaryAttachment[];
  mathHints: string[];
  sourceImages: GeneratedExamSourceImagePayload[];
  text: string;
};

type DocxContext = {
  answerKeyHints: string[];
  imageNames: string[];
  mathHints: string[];
  name: string;
};

type DocxExtractionState = {
  imagesByRelationshipId: Record<string, GeneratedExamSourceImagePayload>;
  questionIndex: number;
};

function stripDocxImageMarkers(value: string) {
  return value
    .replace(
      /\[IMAGE:\s*([^\]\|\n]+?)(?:\s*\|\s*alt:\s*([^\]\n]+))?\]/giu,
      " ",
    )
    .replace(/[|/]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function looksLikeDocxInlineOptionBurst(value: string) {
  const matches = value.match(
    /(^|[\s|/])\s*\(?[A-FАБВГДЕ]\s*\)?\s*[\).\/:\-]\s*/gimu,
  );

  return (matches?.length ?? 0) >= 2;
}

function looksLikeDocxDiagramLabelCloud(value: string) {
  const cleaned = stripDocxImageMarkers(value);

  if (!cleaned || /[?؟]/u.test(cleaned)) {
    return false;
  }

  const tokens = cleaned.split(/\s+/u).filter(Boolean);

  if (tokens.length < 2 || tokens.length > 20) {
    return false;
  }

  const symbolLikeTokens = tokens.filter((token) =>
    /^[0-9A-Za-zА-Яа-я°º∠()+\-=/\\.,:_]+$/u.test(token),
  ).length;
  const longWordLikeTokens = tokens.filter((token) =>
    /[A-Za-zА-Яа-я]{3,}/u.test(token),
  ).length;

  return (
    symbolLikeTokens / tokens.length >= 0.8 &&
    longWordLikeTokens / tokens.length <= 0.2
  );
}

function isDocxQuestionContinuationParagraph(value: string) {
  const cleaned = stripDocxImageMarkers(value);

  if (!cleaned) {
    return true;
  }

  return (
    looksLikeDocxInlineOptionBurst(value) ||
    looksLikeDocxDiagramLabelCloud(value)
  );
}

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

function normalizeZipPath(path: string) {
  const segments = path.split("/");
  const normalizedSegments: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      normalizedSegments.pop();
      continue;
    }

    normalizedSegments.push(segment);
  }

  return normalizedSegments.join("/");
}

function resolveZipPath(basePath: string, target: string) {
  if (!target) {
    return "";
  }

  if (/^[A-Za-z]+:\/\//.test(target)) {
    return target;
  }

  if (target.startsWith("/")) {
    return normalizeZipPath(target);
  }

  const baseSegments = basePath.split("/").slice(0, -1);
  return normalizeZipPath([...baseSegments, ...target.split("/")].join("/"));
}

function sanitizeDocxImageNamePart(value: string) {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-");
}

function getMimeTypeFromFileName(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "svg":
      return "image/svg+xml";
    case "tif":
    case "tiff":
      return "image/tiff";
    case "webp":
      return "image/webp";
    case "emf":
      return "image/emf";
    case "wmf":
      return "image/wmf";
    default:
      return "application/octet-stream";
  }
}

function getXmlAttribute(node: XmlElementNode, names: string[]) {
  for (const name of names) {
    const value = node.attributes[name];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  const suffixes = names
    .filter((name) => name.includes(":"))
    .map((name) => name.split(":").pop() ?? name);

  if (suffixes.length === 0) {
    return undefined;
  }

  for (const [key, value] of Object.entries(node.attributes)) {
    if (
      typeof value === "string" &&
      value.trim() &&
      suffixes.some((suffix) => key === suffix || key.endsWith(`:${suffix}`))
    ) {
      return value;
    }
  }

  return undefined;
}

async function extractDocxSourceImages(
  zipFile: DocxZipFile,
  attachmentName: string,
) {
  const relationshipsPath = "word/_rels/document.xml.rels";

  if (!zipFile.exists(relationshipsPath)) {
    return [] as ExtractedDocxSourceImage[];
  }

  const relationshipsXmlValue = await zipFile.read(relationshipsPath, "utf-8");

  if (typeof relationshipsXmlValue !== "string") {
    return [];
  }

  const relationshipsNode = await mammothXml.readString(
    relationshipsXmlValue,
    DOCX_RELATIONSHIPS_NAMESPACE_MAP,
  );
  const takenNames = new Set<string>();
  const attachmentBaseName = sanitizeDocxImageNamePart(
    attachmentName.replace(/\.[^.]+$/u, ""),
  );
  const relationshipElements =
    relationshipsNode.name === "pr:Relationship"
      ? [relationshipsNode]
      : getChildElements(relationshipsNode, "pr:Relationship");

  const sourceImages: Array<ExtractedDocxSourceImage | null> = await Promise.all(
    relationshipElements.map(async (relationship, index) => {
      const relationshipId = getXmlAttribute(relationship, ["Id"]);
      const target = getXmlAttribute(relationship, ["Target"]);
      const relationshipType = getXmlAttribute(relationship, ["Type"]);

      if (
        !relationshipId ||
        !target ||
        !relationshipType?.toLowerCase().includes("/image")
      ) {
        return null;
      }

      const resolvedPath = resolveZipPath("word/document.xml", target);

      if (!resolvedPath || !zipFile.exists(resolvedPath)) {
        return null;
      }

      const imageBase64Value = await zipFile.read(resolvedPath, "base64");

      if (typeof imageBase64Value !== "string" || !imageBase64Value.trim()) {
        return null;
      }

      const basename = resolvedPath.split("/").pop() ?? `image-${index + 1}`;
      const safeBasename = sanitizeDocxImageNamePart(basename);
      let nextName = `${attachmentBaseName || "doc"}-${safeBasename || `image-${index + 1}`}`;
      let duplicateIndex = 1;

      while (takenNames.has(nextName)) {
        duplicateIndex += 1;
        nextName = `${attachmentBaseName || "doc"}-${duplicateIndex}-${safeBasename || `image-${index + 1}`}`;
      }

      takenNames.add(nextName);

      const mimeType = getMimeTypeFromFileName(basename);

      return {
        dataUrl: `data:${mimeType};base64,${imageBase64Value}`,
        mimeType,
        name: nextName,
        relationshipId,
      };
    }),
  );

  return sourceImages.filter(
    (image): image is ExtractedDocxSourceImage => image !== null,
  );
}

function omitRelationshipIdFromDocxImages(
  sourceImages: ExtractedDocxSourceImage[],
) {
  return sourceImages.map((sourceImage) => ({
    dataUrl: sourceImage.dataUrl,
    mimeType: sourceImage.mimeType,
    name: sourceImage.name,
  }));
}

function collectImageRelationshipIds(node: XmlNode): string[] {
  if (node.type === "text") {
    return [];
  }

  const relationshipIds = new Set<string>();

  if (node.name === "a:blip") {
    const embedId = getXmlAttribute(node, ["r:embed", "embed"]);

    if (embedId) {
      relationshipIds.add(embedId);
    }
  }

  if (node.name === "v:imagedata") {
    const imageId = getXmlAttribute(node, ["r:id", "id"]);

    if (imageId) {
      relationshipIds.add(imageId);
    }
  }

  for (const child of node.children) {
    for (const relationshipId of collectImageRelationshipIds(child)) {
      relationshipIds.add(relationshipId);
    }
  }

  return [...relationshipIds];
}

function buildImageMarkersForNode(
  node: XmlNode,
  state: DocxExtractionState,
) {
  const imageNames = collectImageRelationshipIds(node)
    .map((relationshipId) => state.imagesByRelationshipId[relationshipId]?.name)
    .filter((name): name is string => typeof name === "string" && name.length > 0);

  if (imageNames.length === 0) {
    return "";
  }

  return ` ${imageNames.map((name) => `[IMAGE:${name}]`).join(" ")}`;
}

function buildDocxParagraphLine(
  paragraph: XmlElementNode,
  state: DocxExtractionState,
) {
  const paragraphProperties = paragraph.first("w:pPr");
  const isNumberedQuestion = Boolean(paragraphProperties?.first("w:numPr"));
  const paragraphText = normalizeExtractedParagraphText(
    paragraph.children
      .filter(
        (paragraphChild) =>
          paragraphChild.type !== "element" || paragraphChild.name !== "w:pPr",
      )
      .map((paragraphChild) =>
        `${readXmlNodeText(paragraphChild)}${buildImageMarkersForNode(
          paragraphChild,
          state,
        )}`,
      )
      .join(""),
  );

  if (!paragraphText) {
    return "";
  }

  if (
    isNumberedQuestion &&
    state.questionIndex > 0 &&
    isDocxQuestionContinuationParagraph(paragraphText)
  ) {
    return paragraphText;
  }

  if (isNumberedQuestion) {
    state.questionIndex += 1;
    return `Q${state.questionIndex}. ${paragraphText}`;
  }

  return paragraphText;
}

function extractDocxCellText(
  cell: XmlElementNode,
  state: DocxExtractionState,
) {
  return getChildElements(cell)
    .flatMap((child) => extractDocxBlockLines(child, state))
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" / ");
}

function extractDocxTableLines(
  table: XmlElementNode,
  state: DocxExtractionState,
) {
  const lines: string[] = [];

  for (const row of getChildElements(table, "w:tr")) {
    const cells = getChildElements(row, "w:tc")
      .map((cell) => extractDocxCellText(cell, state))
      .filter(Boolean);

    if (cells.length > 0) {
      lines.push(cells.join(" | "));
    }
  }

  return lines;
}

function extractDocxBlockLines(
  node: XmlElementNode,
  state: DocxExtractionState,
): string[] {
  switch (node.name) {
    case "w:body":
    case "w:tc":
    case "w:tr":
      return getChildElements(node).flatMap((child) =>
        extractDocxBlockLines(child, state),
      );
    case "w:p": {
      const line = buildDocxParagraphLine(node, state);
      return line ? [line] : [];
    }
    case "w:tbl":
      return extractDocxTableLines(node, state);
    default:
      return [];
  }
}

function splitNonEmptyLines(value: string) {
  return value
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function mergeDocxTextSources(...sources: string[]) {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const source of sources) {
    for (const line of splitNonEmptyLines(source)) {
      const key = line.replace(/\s+/g, " ").trim().toLowerCase();

      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      lines.push(line);
    }
  }

  return lines.join("\n\n");
}

function isAnswerSectionHeading(line: string) {
  return /^(?:answer(?:\s*key)?|answers?|solutions?|хариу(?:нууд)?|зөв\s*хариу(?:лт(?:ууд)?)?)(?:\s*[:.-])?$/iu.test(
    line.trim(),
  );
}

function looksLikeStandaloneAnswerKeyLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed) {
    return false;
  }

  const compactEntry = trimmed.match(
    /^Q?\d+\s*(?:[|:=-]|=>|->)\s*(.+)$/iu,
  );

  if (!compactEntry) {
    return false;
  }

  const answer = compactEntry[1]?.trim() ?? "";

  if (!answer || answer.length > 120) {
    return false;
  }

  return !/[?؟]/u.test(answer);
}

function detectAnswerKeyHints(text: string) {
  const lines = splitNonEmptyLines(text);

  for (let index = 0; index < lines.length; index += 1) {
    if (!isAnswerSectionHeading(lines[index] ?? "")) {
      continue;
    }

    const sectionLines: string[] = [lines[index] ?? ""];

    for (
      let nextIndex = index + 1;
      nextIndex < lines.length && sectionLines.length < 25;
      nextIndex += 1
    ) {
      const nextLine = lines[nextIndex] ?? "";

      if (isAnswerSectionHeading(nextLine)) {
        break;
      }

      sectionLines.push(nextLine);
    }

    return sectionLines;
  }

  return lines.filter(looksLikeStandaloneAnswerKeyLine).slice(0, 20);
}

const IMAGE_MARKER_PATTERN =
  /\[IMAGE:\s*([^\]\|\n]+?)(?:\s*\|\s*alt:\s*([^\]\n]+))?\]/giu;

function stripImageMarkers(value: string | undefined) {
  if (!value) {
    return {
      cleaned: value,
      imageAlt: undefined,
      imageName: undefined,
    };
  }

  let firstImageAlt: string | undefined;
  let firstImageName: string | undefined;
  const cleaned = value
    .replace(IMAGE_MARKER_PATTERN, (_, rawName: string, rawAlt?: string) => {
      const imageName = rawName.trim();
      const imageAlt = rawAlt?.trim();

      if (!firstImageName && imageName) {
        firstImageName = imageName;
      }

      if (!firstImageAlt && imageAlt) {
        firstImageAlt = imageAlt;
      }

      return " ";
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();

  return {
    cleaned,
    imageAlt: firstImageAlt,
    imageName: firstImageName,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickStringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function pickNumberField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function pickStringArrayField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (!Array.isArray(value)) {
      continue;
    }

    const normalized = value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (!isRecord(item)) {
          return "";
        }

        return (
          pickStringField(item, ["text", "label", "option", "value"]) ?? ""
        );
      })
      .filter(Boolean);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return undefined;
}

function stripOptionPrefix(value: string) {
  return value
    .replace(/^[A-FАБВГДЕ]\s*[\).\]:-]?\s*/iu, "")
    .trim();
}

function normalizeChoiceMarker(value: string) {
  const upper = value.trim().toUpperCase();

  switch (upper) {
    case "А":
      return "A";
    case "Б":
      return "B";
    case "В":
      return "C";
    case "Г":
      return "D";
    case "Д":
      return "E";
    case "Е":
      return "F";
    default:
      return upper;
  }
}

function parseCorrectOptionValue(value: unknown, options: string[]) {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value >= 0 && value < options.length) {
      return value;
    }

    if (value >= 1 && value <= options.length) {
      return value - 1;
    }

    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const letterMatch = trimmed.match(/^[\(\[]?([A-FАБВГДЕ])[\)\].:\-]?\s*$/iu);

  if (letterMatch?.[1]) {
    const normalizedMarker = normalizeChoiceMarker(letterMatch[1]);
    const index =
      normalizedMarker.charCodeAt(0) - "A".charCodeAt(0);

    if (index >= 0 && index < options.length) {
      return index;
    }
  }

  if (/^\d+$/u.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);

    if (parsed >= 0 && parsed < options.length) {
      return parsed;
    }

    if (parsed >= 1 && parsed <= options.length) {
      return parsed - 1;
    }
  }

  const directIndex = options.findIndex(
    (option) => option.trim().toLowerCase() === trimmed.toLowerCase(),
  );

  if (directIndex >= 0) {
    return directIndex;
  }

  const normalizedAnswer = stripOptionPrefix(trimmed).toLowerCase();
  const normalizedIndex = options.findIndex(
    (option) => stripOptionPrefix(option).toLowerCase() === normalizedAnswer,
  );

  return normalizedIndex >= 0 ? normalizedIndex : null;
}

function enhanceFocusLabel(focus: ExtractExamEnhanceFocus | undefined) {
  switch (focus) {
    case "images":
      return "зурагтай асуулт болон зураг-асуултын холбоос";
    case "math":
      return "эвдэрсэн эсвэл incomplete математик мөрүүд";
    case "incomplete":
      return "parser дутуу таньсан ambiguous content";
    default:
      return "зураг, broken math, incomplete content, мөн дутуу зөв хариунууд";
  }
}

function buildLocalTextSources(args: {
  docxContexts: DocxContext[];
  textAttachments: TextAttachment[];
}) {
  return args.textAttachments.map((attachment) => ({
    answerKeyHints:
      args.docxContexts.find((context) => context.name === attachment.name)
        ?.answerKeyHints ?? [],
    name: attachment.name,
    text: attachment.text,
  }));
}

function coerceExamPayload(value: unknown): GeneratedExamPayload {
  if (!isRecord(value)) {
    return {};
  }

  const rawQuestions = Array.isArray(value.questions)
    ? value.questions
    : Array.isArray(value.items)
      ? value.items
      : [];

  const questions = rawQuestions
    .map((question) => {
      if (!isRecord(question)) {
        return null;
      }

      const options = pickStringArrayField(question, [
        "options",
        "choices",
        "answers",
      ]);
      const rawType = pickStringField(question, ["type", "questionType"]);
      const normalizedType =
        rawType === "mcq" || rawType === "math"
          ? rawType
          : options && options.length >= 2
            ? "mcq"
            : "math";
      const points = pickNumberField(question, ["points", "score"]);
      const promptMarker = stripImageMarkers(
        pickStringField(question, ["prompt", "question", "text"]),
      );
      const responseGuideMarker = stripImageMarkers(
        pickStringField(question, ["responseGuide", "guide", "explanation"]),
      );
      const sourceImageNameField = pickStringField(question, [
        "sourceImageName",
        "imageName",
      ]);
      const imageAltField = pickStringField(question, ["imageAlt", "alt"]);
      const imageAlt =
        imageAltField ??
        promptMarker.imageAlt ??
        responseGuideMarker.imageAlt;
      const sourceImageName =
        sourceImageNameField ??
        promptMarker.imageName ??
        responseGuideMarker.imageName;
      const prompt = promptMarker.cleaned;

      if (normalizedType === "mcq") {
        const normalizedOptionMarkers = (options ?? []).map((option) =>
          stripImageMarkers(option),
        );
        const normalizedOptions = normalizedOptionMarkers.map(
          (option) => option.cleaned ?? "",
        );
        const resolvedSourceImageName =
          sourceImageName ??
          normalizedOptionMarkers.find((option) => option.imageName)?.imageName;
        const resolvedImageAlt =
          imageAlt ??
          normalizedOptionMarkers.find((option) => option.imageAlt)?.imageAlt;
        const correctOption = parseCorrectOptionValue(
          question.correctOption ??
            question.correctAnswer ??
            question.answer ??
            question.answerKey,
          normalizedOptions,
        );

        return {
          correctOption,
          imageAlt: resolvedImageAlt,
          options: normalizedOptions,
          points,
          prompt,
          sourceImageName: resolvedSourceImageName,
          type: "mcq" as const,
        };
      }

      return {
        answerLatex: pickStringField(question, [
          "answerLatex",
          "correctAnswer",
          "answer",
          "finalAnswer",
        ]),
        imageAlt,
        points,
        prompt,
        responseGuide: responseGuideMarker.cleaned,
        sourceImageName,
        type: "math" as const,
      };
    })
    .filter(
      (
        question,
      ): question is NonNullable<typeof question> => question !== null,
    );

  return {
    questions,
    sourceImages: Array.isArray(value.sourceImages)
      ? value.sourceImages.filter(isRecord).map((image) => ({
          alt: pickStringField(image, ["alt", "imageAlt"]),
          dataUrl: pickStringField(image, ["dataUrl"]),
          mimeType: pickStringField(image, ["mimeType"]),
          name: pickStringField(image, ["name"]) ?? "image",
        }))
      : undefined,
    title: pickStringField(value, ["title", "examTitle", "name"]),
  };
}

async function extractDocxStructuredText(buffer: Buffer, attachmentName: string) {
  const zipFile = await mammothUnzip.openZip({ buffer });

  if (!zipFile.exists("word/document.xml")) {
    return {
      sourceImages: [] as GeneratedExamSourceImagePayload[],
      text: "",
    };
  }

  const documentXml = await zipFile.read("word/document.xml", "utf-8");

  if (typeof documentXml !== "string") {
    return {
      sourceImages: [] as GeneratedExamSourceImagePayload[],
      text: "",
    };
  }

  const sourceImages = await extractDocxSourceImages(zipFile, attachmentName);
  const documentNode = await mammothXml.readString(
    documentXml,
    DOCX_XML_NAMESPACE_MAP,
  );
  const body = documentNode.first("w:body");

  if (!body) {
    return {
      sourceImages: omitRelationshipIdFromDocxImages(sourceImages),
      text: "",
    };
  }

  const lines = extractDocxBlockLines(body, {
    imagesByRelationshipId: Object.fromEntries(
      sourceImages.map(({ relationshipId, ...image }) => [relationshipId, image]),
    ),
    questionIndex: 0,
  });

  return {
    sourceImages: omitRelationshipIdFromDocxImages(sourceImages),
    text: lines.join("\n\n"),
  };
}

async function extractDocxArtifacts(
  attachment: AttachmentPayload,
): Promise<DocxArtifacts> {
  const data = attachment.data ?? "";

  if (!data) {
    return {
      answerKeyHints: [],
      geminiImageAttachments: [],
      mathHints: [],
      sourceImages: [],
      text: "",
    };
  }

  const buffer = Buffer.from(data, "base64");
  const rawTextResult = await mammoth.extractRawText({ buffer });
  const structuredDocx = await extractDocxStructuredText(
    buffer,
    attachment.name ?? "docx",
  );
  const primaryText =
    structuredDocx.text.trim() || rawTextResult.value.trim();
  const supplementalText = rawTextResult.value.trim();
  const hintsText = mergeDocxTextSources(
    primaryText,
    supplementalText,
  );

  return {
    answerKeyHints: detectAnswerKeyHints(hintsText),
    geminiImageAttachments: structuredDocx.sourceImages
      .filter(
        (image): image is GeneratedExamSourceImagePayload & {
          dataUrl: string;
          mimeType: string;
        } =>
          typeof image.dataUrl === "string" &&
          image.dataUrl.startsWith("data:") &&
          typeof image.mimeType === "string" &&
          image.mimeType.startsWith("image/"),
      )
      .map((image) => ({
        data: image.dataUrl.split(",")[1] ?? "",
        mimeType: image.mimeType,
        name: image.name,
      })),
    mathHints: detectPotentialMathGaps(hintsText),
    sourceImages: structuredDocx.sourceImages,
    text: primaryText,
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
  const docxContexts: DocxContext[] = [];
  const sourceImages: GeneratedExamSourceImagePayload[] = [];

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
        answerKeyHints: artifacts.answerKeyHints,
        imageNames: artifacts.sourceImages.map((image) => image.name),
        mathHints: artifacts.mathHints,
        name,
      });
      binaryAttachments.push(...artifacts.geminiImageAttachments);
      sourceImages.push(...artifacts.sourceImages);

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
    sourceImages,
    textAttachments,
  };
}

export async function handleGeminiExtractPost(
  request: Request,
  env: GeminiExtractWorkerEnv,
) {
  try {
    const body = (await request.json()) as ExtractExamRequest;
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const mode = body.mode ?? "fast";
    const enhanceFocus = body.enhanceFocus ?? "all";

    if (attachments.length === 0) {
      return Response.json(
        { error: "Унших файл хавсаргаагүй байна." },
        { status: 400 },
      );
    }

    const { binaryAttachments, docxContexts, sourceImages, textAttachments } =
      await normalizeAttachments(attachments);
    const localExam = parseLocalExamPayload({
      sourceImages,
      sources: buildLocalTextSources({
        docxContexts,
        textAttachments,
      }),
    });

    if (mode === "fast") {
      if (!Array.isArray(localExam.questions) || localExam.questions.length === 0) {
        return Response.json(
          {
            error:
              textAttachments.length > 0
                ? "DOCX/text parser асуулт таньж чадсангүй. AI сайжруулалт ашиглаад үзнэ үү."
                : "Fast import одоогоор DOCX/text төрлийн файл дээр ажиллана.",
          },
          { status: 422 },
        );
      }

      return Response.json({ exam: localExam });
    }

    const apiKey = env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY тохируулаагүй байна." },
        { status: 500 },
      );
    }

    const model = env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
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
- Доорх local parser JSON нь суурь хувилбар. Аль хэдийн зөв байгаа хэсгийг бүү дахин зохиож өөрчил.
- Хариуг local parser JSON-той ижил асуултын дараалалтай байлга.
- Асуулт бүрийг дарааллаар нь Q1, Q2 гэж таньж ав.
- Prompt талбарт боломжтой бол асуултын дугаарыг хадгал. Жишээ: "Q1. ..."
- Материалыг бүү хураангуйл, бүү дүгнэ, бүү товчил.
- Асуулт, сонголт, хариу, оноо, тайлбар байвал яг тексттэй нь хадгал.
- Текстийг бүү хураангуйл. Тоо, томьёо, илэрхийлэл, бутархай, зэргийг яг байгаа хэлбэрээр нь хадгал.
- Prompt, options, responseGuide доторх математик хэсгийг боломжтой бол $...$ хэлбэрээр wrap хий.
- DOCX эсвэл PDF-ээс таньсан LaTeX/math-ийг plain unicode текст рүү бүү хөрвүүл. Backslash, braces, frac, sqrt, aligned, matrix зэрэг бүтцийг хадгал.
- Prompt, options, responseGuide доторх нэг математик илэрхийллийг хэсэгчлэн тасалж wrap хийхгүй. Аль болох бүхэл formula-г нэг $...$ эсвэл $$...$$ segment байдлаар буцаа.
- Хэрэв source дээр аль хэдийн LaTeX тэмдэглэгээ байгаа бол түүнийг бүү эвд, бүү хялбарчил, бүү тайлбарласан prose болгож соль.
- Prompt-ийн төгсгөлд байгаа /1 оноо/, /2 оноо/ гэх мэт онооны текстийг prompt дотор бүү хадгал, points талбарт тусад нь өг.
- answerLatex талбарт зөв хариуг цэвэр LaTeX хэлбэрээр өг. $ тэмдэг бүү ашигла.
- Хариултын түлхүүр, зөв сонголт, бодлогын зөв хариу байвал заавал гаргаж ав.
- Сонголтууд доторх тоо, тэмдэг, нэгж, томьёог алдалгүй буцаа.
- Сонгох асуултыг "mcq", задгай/бодлогын асуултыг "math" гэж тэмдэглэ.
- Хэрэв prompt орчимд [IMAGE:some-name.png] marker харагдвал тухайн асуултыг тэр зурагтай холбож sourceImageName дээр яг тэр нэрийг тавь.
- Хэрэв тусдаа image attachment-ууд ирсэн бол тэднийг асуулттай нь зөв холбож sourceImageName талбарт exact file name-ийг тавь.
- [IMAGE:...] marker өөрөө final prompt дотор үлдэх ёсгүй.
- imageAlt талбарт зурагт богино тайлбар өгч болно.
- Хэрэв raw text мөр эвдэрсэн, томьёо тасарсан, сонголт дутуу, эсвэл математикийн мөр incomplete байвал зөвхөн харагдаж буй text context-оос аль болох сэргээ.
- Материал доторх асуултын эх бичвэрийг аль болох хадгал.
- Систем тэгшитгэл, логарифм, интеграл, лимит зэрэг тусгай математик бүтэц байвал LaTeX-ийг алдалгүй хадгал.
- Хэрэв баримтад тусдаа "Хариу", "Зөв хариу", "Answer key" хэсэг, хүснэгт, эсвэл 1 | A шиг мөрүүд байвал entry бүрийг асуултын дугаартай нь тааруулж зөв хариуг бөглө.
- DOCX answer key hints гэж ирсэн мөрүүд нь хүснэгтээс задласан туслах мөр байж болно. Тэдгээрийг ашигла.
- mcq асуулт бол A/B/C/D дарааллыг зөв таньж options болон correctOption-ийг гарга.
- correctOption нь 0-ээс эхэлсэн индекс байна: A=0, B=1, C=2, D=3.
- math асуулт бол answerLatex-ийг аль болох LaTeX хэлбэрээр гарга.
- Хэрэв баримтад зөв хариу байгаа бол correctOption эсвэл answerLatex-ийг хоосон бүү орхи.
- responseGuide боломжтой бол богино заавар өг.
- title-д баримтын эсвэл шалгалтын нэрийг өг.

AI сайжруулах одоогийн гол зорилго:
- ${enhanceFocusLabel(enhanceFocus)}
- Мөн local parser дутуу авсан correct answer-уудыг нөхөж өг.

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
      "correctOption": 0
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
                {
                  text: `Local parser JSON:\n${JSON.stringify(localExam, null, 2)}`,
                },
                ...textAttachments.map((attachment) => ({
                  text: `Хавсаргасан текст (${attachment.name ?? "text"}):\n${attachment.text}`,
                })),
                ...docxContexts.map((context) => ({
                  text: `DOCX answer key hints (${context.name}):\n${context.answerKeyHints.join("\n") || "none"}`,
                })),
                ...docxContexts.map((context) => ({
                  text: `DOCX extracted image names (${context.name}):\n${context.imageNames.join("\n") || "none"}`,
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

    const exam = coerceExamPayload(
      parseGeminiJson<GeneratedExamPayload>(extractedText),
    ) as GeneratedExamPayload;

    if (!Array.isArray(exam.questions) || exam.questions.length === 0) {
      if (Array.isArray(localExam.questions) && localExam.questions.length > 0) {
        return Response.json({ exam: localExam });
      }

      return Response.json(
        { error: "Файлаас танигдсан асуулт олдсонгүй." },
        { status: 502 },
      );
    }

    if (!exam.title?.trim() && localExam.title?.trim()) {
      exam.title = localExam.title;
    }

    if (sourceImages.length > 0) {
      exam.sourceImages = sourceImages;
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
