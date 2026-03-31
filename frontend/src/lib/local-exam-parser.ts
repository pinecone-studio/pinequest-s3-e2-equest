import type {
  GeneratedExamPayload,
  GeneratedExamQuestionPayload,
  GeneratedExamSourceImagePayload,
} from "@/lib/math-exam-contract";

type LocalExamTextSource = {
  answerKeyHints?: string[];
  name: string;
  text: string;
};

type QuestionDraft = {
  number: number;
  optionLines: string[];
  promptLines: string[];
  sectionType: "math" | "mcq" | null;
};

const IMAGE_MARKER_PATTERN =
  /\[IMAGE:\s*([^\]\|\n]+?)(?:\s*\|\s*alt:\s*([^\]\n]+))?\]/giu;

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

function stripOptionPrefix(value: string) {
  return value
    .replace(/^[A-FАБВГДЕ]\s*[\).\/:\-]?[\s]*/iu, "")
    .trim();
}

function parseCorrectOptionValue(value: string | undefined, options: string[]) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const letterMatch = trimmed.match(/^[\(\[]?([A-FАБВГДЕ])[\)\].:\-]?\s*$/iu);

  if (letterMatch?.[1]) {
    const normalizedMarker = normalizeChoiceMarker(letterMatch[1]);
    const index = normalizedMarker.charCodeAt(0) - "A".charCodeAt(0);

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

function splitBlocks(value: string) {
  return value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function fileNameToTitle(name: string) {
  return name.replace(/\.[^.]+$/u, "").replace(/[_-]+/g, " ").trim();
}

function looksLikeShortAnswerValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed || trimmed.length > 40) {
    return false;
  }

  if (/^[\(\[]?[A-FАБВГДЕ][\)\].:\/-]?\s*$/iu.test(trimmed)) {
    return true;
  }

  const tokenCount = trimmed.split(/\s+/u).filter(Boolean).length;

  if (tokenCount > 4) {
    return false;
  }

  return /^[0-9A-Za-zА-Яа-я+\-*/=^_.,()%[\]{}\\|<>]+(?:\s+[0-9A-Za-zА-Яа-я+\-*/=^_.,()%[\]{}\\|<>]+){0,3}$/u.test(
    trimmed,
  );
}

function parseQuestionStart(block: string) {
  const lines = block
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? "";
  const remainder = lines.slice(1);
  const match = firstLine.match(
    /^(?:\(?\s*(?:Q|№)\s*)?\(?\s*(\d+)\s*\)?\s*([\.\):-]?)\s*(.+)$/iu,
  );

  if (!match) {
    return null;
  }

  const separator = match[2] ?? "";
  const text = [match[3] ?? "", ...remainder].filter(Boolean).join("\n").trim();

  if (!separator && looksLikeShortAnswerValue(text)) {
    return null;
  }

  return {
    number: Number.parseInt(match[1] ?? "0", 10),
    text,
  };
}

function parseQuestionNumberToken(value: string) {
  const normalized = value
    .trim()
    .replace(/^(?:\(?\s*(?:Q|№)\s*)/iu, "")
    .replace(/^\(\s*/u, "")
    .replace(/\s*\)\s*$/u, "")
    .replace(/[\.\):-]+$/u, "")
    .trim();

  if (!/^\d+$/u.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionBlock(block: string) {
  if (looksLikeAnyInlineOptionBurst(block)) {
    return null;
  }

  const match = block.match(
    /^\(?\s*([A-FАБВГДЕ])\s*\)?(?:\s*[\).\/:\-]\s*|\s+)(.+)$/iu,
  );

  if (!match) {
    return null;
  }

  return {
    marker: normalizeChoiceMarker(match[1] ?? ""),
    text: (match[2] ?? "").trim(),
  };
}

function normalizeInlineOptionSeparators(value: string) {
  return value
    .replace(
      /\s+\|\s+(?=(?:[A-FАБВГДЕ]\s*[\).\/:\-]|Q?\d+\s*[\.\):]))/giu,
      "\n",
    )
    .replace(
      /\s+\/\s+(?=(?:[A-FАБВГДЕ]\s*[\).\/:\-]|Q?\d+\s*[\.\):]))/giu,
      "\n",
    );
}

function cleanDelimitedSegment(value: string) {
  return value.replace(/^[|/]+/u, "").replace(/[|/]+$/u, "").trim();
}

function extractInlineOptions(value: string) {
  const normalized = normalizeInlineOptionSeparators(value);
  const matches = Array.from(
    normalized.matchAll(
      /(^|[\s\n|/])\s*\(?([A-FАБВГДЕ])\s*\)?\s*[\).\/:\-]\s*/gimu,
    ),
  );

  if (matches.length < 2) {
    return null;
  }

  const firstMatch = matches[0];
  const firstMarkerStart =
    (firstMatch.index ?? 0) + (firstMatch[1]?.length ?? 0);
  const prompt = normalized
    .slice(0, firstMarkerStart)
    .replace(/[|/]\s*$/u, "")
    .trim();
  const options = matches
    .map((match, index) => {
      const nextMatch = matches[index + 1];
      const optionStart = (match.index ?? 0) + match[0].length;
      const nextMarkerStart = nextMatch
        ? (nextMatch.index ?? 0) + (nextMatch[1]?.length ?? 0)
        : normalized.length;

      return normalized
        .slice(optionStart, nextMarkerStart)
        .replace(/[|/]\s*$/u, "")
        .trim();
    })
    .map((option) => cleanDelimitedSegment(option))
    .filter(Boolean);

  if (options.length < 2) {
    return null;
  }

  return {
    options,
    prompt,
  };
}

function markersAreSequential(markers: string[]) {
  return markers.every((marker, index) => {
    if (index === 0) {
      return marker === "A";
    }

    return marker.charCodeAt(0) === markers[index - 1].charCodeAt(0) + 1;
  });
}

function extractLooseInlineOptions(value: string) {
  const normalized = normalizeInlineOptionSeparators(value);
  const matches = Array.from(
    normalized.matchAll(/(^|[\s\n|/])\s*\(?([A-FАБВГДЕ])\s*\)?\s+/gmu),
  );

  if (matches.length < 3) {
    return null;
  }

  const markers = matches
    .map((match) => normalizeChoiceMarker(match[2] ?? ""))
    .filter(Boolean);

  if (!markersAreSequential(markers)) {
    return null;
  }

  const firstMatch = matches[0];
  const firstMarkerStart =
    (firstMatch.index ?? 0) + (firstMatch[1]?.length ?? 0);
  const prompt = normalized
    .slice(0, firstMarkerStart)
    .replace(/[|/]\s*$/u, "")
    .trim();

  if (!prompt && matches.length < 4) {
    return null;
  }

  const options = matches
    .map((match, index) => {
      const nextMatch = matches[index + 1];
      const optionStart = (match.index ?? 0) + match[0].length;
      const nextMarkerStart = nextMatch
        ? (nextMatch.index ?? 0) + (nextMatch[1]?.length ?? 0)
        : normalized.length;

      return normalized
        .slice(optionStart, nextMarkerStart)
        .replace(/[|/]\s*$/u, "")
        .trim();
    })
    .map((option) => cleanDelimitedSegment(option))
    .filter((option) => option.length > 0 && option.length <= 200);

  if (options.length < 3) {
    return null;
  }

  return {
    options,
    prompt,
  };
}

function extractCellStyleOptions(value: string) {
  const tokens = value
    .split(/\s+[|/]\s+/u)
    .map((token) => cleanDelimitedSegment(token))
    .filter(Boolean);

  if (tokens.length < 4) {
    return null;
  }

  const firstMarkerIndex = tokens.findIndex((token) =>
    /^[A-FАБВГДЕ]$/iu.test(token),
  );

  if (firstMarkerIndex < 0) {
    return null;
  }

  const prompt = tokens.slice(0, firstMarkerIndex).join(" ").trim();
  const optionTokens = tokens.slice(firstMarkerIndex);

  if (optionTokens.length < 4) {
    return null;
  }

  const markers: string[] = [];
  const options: string[] = [];

  for (let index = 0; index + 1 < optionTokens.length; index += 2) {
    const markerToken = optionTokens[index] ?? "";
    const optionToken = cleanDelimitedSegment(optionTokens[index + 1] ?? "");

    if (!/^[A-FАБВГДЕ]$/iu.test(markerToken) || !optionToken) {
      return null;
    }

    markers.push(normalizeChoiceMarker(markerToken));
    options.push(optionToken);
  }

  if (markers.length < 2 || !markersAreSequential(markers)) {
    return null;
  }

  return {
    options,
    prompt,
  };
}

function extractAnyInlineOptions(value: string) {
  return (
    extractInlineOptions(value) ??
    extractLooseInlineOptions(value) ??
    extractCellStyleOptions(value)
  );
}

function looksLikeInlineOptionBurst(value: string) {
  const normalized = normalizeInlineOptionSeparators(value);
  const matches = normalized.match(
    /(^|[\s\n|/])\s*\(?[A-FАБВГДЕ]\s*\)?\s*[\).\/:\-]\s*/gimu,
  );

  return (matches?.length ?? 0) >= 2;
}

function looksLikeAnyInlineOptionBurst(value: string) {
  return (
    looksLikeInlineOptionBurst(value) ||
    Boolean(extractLooseInlineOptions(value)) ||
    Boolean(extractCellStyleOptions(value))
  );
}

function normalizeDraftOptions(optionLines: string[]) {
  const options: string[] = [];

  for (const optionLine of optionLines) {
    const inlineOptions = extractAnyInlineOptions(optionLine);

    if (inlineOptions) {
      options.push(...inlineOptions.options);
      continue;
    }

    const optionBlock = parseOptionBlock(optionLine);

    if (optionBlock) {
      options.push(optionBlock.text);
      continue;
    }

    const multilineOptionTexts = optionLine
      .split(/\r?\n+/)
      .map((line) => parseOptionBlock(line)?.text ?? "")
      .filter(Boolean);

    if (multilineOptionTexts.length > 0) {
      options.push(...multilineOptionTexts);
      continue;
    }

    const cleaned = cleanDelimitedSegment(optionLine);

    if (cleaned) {
      options.push(cleaned);
    }
  }

  return options;
}

function looksLikeDiagramLabelCloud(value: string) {
  const cleaned = stripImageMarkers(value).cleaned?.trim() ?? "";

  if (!cleaned) {
    return false;
  }

  if (/[?؟]/u.test(cleaned)) {
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

function looksLikeNaturalLanguageQuestionPrompt(value: string) {
  const cleaned = stripImageMarkers(value).cleaned?.trim() ?? "";

  if (!cleaned) {
    return false;
  }

  if (/[?؟]/u.test(cleaned)) {
    return true;
  }

  const longWordMatches =
    cleaned.match(/[A-Za-zА-Яа-яӨөҮүЁё]{3,}/gu) ?? [];

  return longWordMatches.length >= 3;
}

function isMediaContinuationBlock(block: string, currentQuestion: QuestionDraft | null) {
  if (!currentQuestion) {
    return false;
  }

  const marker = stripImageMarkers(block);
  const cleaned = marker.cleaned?.trim() ?? "";
  const hasImage = Boolean(marker.imageName);
  const hasDiagramLabels = looksLikeDiagramLabelCloud(block);

  if (!hasImage && !hasDiagramLabels) {
    return false;
  }

  if (
    parseQuestionStart(block) ||
    parsePipeDelimitedQuestionBlock(block) ||
    extractAnyInlineOptions(block) ||
    parseOptionBlock(block)
  ) {
    return false;
  }

  return !cleaned || hasImage || hasDiagramLabels;
}

function parseLikelyMultilineOptionBlock(
  block: string,
  question: QuestionDraft | null,
  currentSectionType: "math" | "mcq" | null,
) {
  const lines = block
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2 || lines.length > 6) {
    return null;
  }

  const explicitOptions = lines
    .map((line) => parseOptionBlock(line)?.text ?? "")
    .filter(Boolean);

  if (explicitOptions.length >= 2) {
    return explicitOptions;
  }

  const isMcqContext =
    question?.sectionType === "mcq" || currentSectionType === "mcq";

  if (!isMcqContext || lines.length < 4) {
    return null;
  }

  if (
    lines.some(
      (line) =>
        Boolean(parseQuestionStart(line)) ||
        isAnswerSectionHeading(line) ||
        looksLikeStandaloneAnswerKeyLine(line),
    )
  ) {
    return null;
  }

  if (
    lines.every(
      (line) =>
        line.length > 0 &&
        line.length <= 120 &&
        !/[=]{2,}|[{}[\]\\]/u.test(line),
    )
  ) {
    return lines;
  }

  return null;
}

function parseQuestionBody(
  value: string,
  sectionType: "math" | "mcq" | null,
) {
  const inlineOptions = extractAnyInlineOptions(value);

  if (inlineOptions) {
    return inlineOptions;
  }

  const lines = value
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return {
      options: [] as string[],
      prompt: value.trim(),
    };
  }

  const promptLines: string[] = [];
  const optionLines: string[] = [];
  let hasStartedOptions = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const optionStart = parseOptionBlock(line);

    if (optionStart) {
      optionLines.push(optionStart.text);
      hasStartedOptions = true;
      continue;
    }

    if (!hasStartedOptions) {
      const tailBlock = lines.slice(index).join("\n");
      const tailOptions = parseLikelyMultilineOptionBlock(
        tailBlock,
        {
          number: 0,
          optionLines: [],
          promptLines,
          sectionType,
        },
        sectionType,
      );

      if (tailOptions && promptLines.length > 0) {
        optionLines.push(...tailOptions);
        hasStartedOptions = true;
        break;
      }

      promptLines.push(line);
      continue;
    }

    if (optionLines.length > 0) {
      const lastOptionIndex = optionLines.length - 1;
      optionLines[lastOptionIndex] =
        `${optionLines[lastOptionIndex]}\n${line}`.trim();
      continue;
    }

    promptLines.push(line);
  }

  return {
    options: optionLines,
    prompt: promptLines.join("\n").trim(),
  };
}

function isNumberedContinuationCandidate(args: {
  currentQuestion: QuestionDraft | null;
  nextQuestionBody: ReturnType<typeof parseQuestionBody>;
  nextQuestionNumber: number;
}) {
  const { currentQuestion, nextQuestionBody, nextQuestionNumber } = args;

  if (!currentQuestion || currentQuestion.number + 1 !== nextQuestionNumber) {
    return false;
  }

  const promptMarker = stripImageMarkers(nextQuestionBody.prompt);
  const promptText = promptMarker.cleaned?.trim() ?? "";
  const hasImageOnlyPrompt = Boolean(promptMarker.imageName) && !promptText;
  const hasOptionPayload = nextQuestionBody.options.length >= 2;
  const hasOptionLikePrompt = looksLikeAnyInlineOptionBurst(nextQuestionBody.prompt);
  const hasDiagramLabelPrompt = looksLikeDiagramLabelCloud(nextQuestionBody.prompt);
  const hasNaturalLanguagePrompt = looksLikeNaturalLanguageQuestionPrompt(
    nextQuestionBody.prompt,
  );

  if (hasNaturalLanguagePrompt && !hasOptionPayload) {
    return false;
  }

  if (currentQuestion.optionLines.length === 0) {
    return (
      hasImageOnlyPrompt ||
      hasOptionPayload ||
      hasOptionLikePrompt ||
      hasDiagramLabelPrompt
    );
  }

  if (
    currentQuestion.optionLines.length > 0 &&
    currentQuestion.optionLines.length < 6 &&
    (!promptText || hasOptionLikePrompt || hasDiagramLabelPrompt) &&
    (
      hasOptionPayload ||
      hasOptionLikePrompt ||
      hasImageOnlyPrompt ||
      hasDiagramLabelPrompt
    )
  ) {
    return true;
  }

  return false;
}

function isLikelyLetterAnswer(value: string) {
  return /^[\(\[]?[A-FАБВГДЕ][\)\].:\/-]?\s*$/iu.test(value.trim());
}

function inferSourceSectionType(args: {
  answerMap: Map<number, string>;
  blocks: string[];
}) {
  let optionSignalCount = 0;

  for (const block of args.blocks) {
    if (
      detectSectionType(block) === "math" ||
      /(?:\b|\s)(?:задгай|essay|written)(?:\b|\s)/iu.test(block)
    ) {
      return null;
    }

    if (
      parsePipeDelimitedOptionBlock(block) ||
      extractAnyInlineOptions(block) ||
      parseOptionBlock(block)
    ) {
      optionSignalCount += 1;
    }
  }

  const answerValues = [...args.answerMap.values()].filter(Boolean);
  const letterAnswerCount = answerValues.filter((answer) =>
    isLikelyLetterAnswer(answer),
  ).length;

  if (
    answerValues.length >= 3 &&
    letterAnswerCount / answerValues.length >= 0.6
  ) {
    return "mcq" as const;
  }

  if (optionSignalCount >= 3) {
    return "mcq" as const;
  }

  return null;
}

function extractOptionsFromPipeTokens(tokens: string[]) {
  const options: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]?.trim() ?? "";

    if (!token) {
      continue;
    }

    const inlineOptions = extractAnyInlineOptions(token);

    if (inlineOptions) {
      options.push(...inlineOptions.options);
      continue;
    }

    const slashTokens = token
      .split(/\s+\/\s+/u)
      .map((item) => item.trim())
      .filter(Boolean);

    if (slashTokens.length >= 2) {
      const nestedOptions = extractOptionsFromPipeTokens(slashTokens);

      if (nestedOptions.length > 0) {
        options.push(...nestedOptions);
        continue;
      }
    }

    const optionBlock = parseOptionBlock(token);

    if (optionBlock) {
      options.push(optionBlock.text);
      continue;
    }

    if (/^[A-FАБВГДЕ]$/iu.test(token)) {
      const nextToken = tokens[index + 1]?.trim() ?? "";

      if (nextToken) {
        options.push(nextToken);
        index += 1;
      }
    }
  }

  return options;
}

function parsePipeDelimitedOptionBlock(block: string) {
  const tokens = block.split("|").map((token) => token.trim()).filter(Boolean);

  if (tokens.length < 2) {
    return null;
  }

  const options = extractOptionsFromPipeTokens(tokens);

  if (options.length === 0) {
    return null;
  }

  const nonOptionTokens = tokens.filter((token, index) => {
    if (parseOptionBlock(token)) {
      return false;
    }

    if (/^[A-FАБВГДЕ]$/iu.test(token)) {
      return false;
    }

    const previousToken = tokens[index - 1] ?? "";

    return !/^[A-FАБВГДЕ]$/iu.test(previousToken);
  });

  if (nonOptionTokens.length > 1) {
    return null;
  }

  return options;
}

function parsePipeDelimitedQuestionBlock(block: string) {
  const tokens = block.split("|").map((token) => token.trim()).filter(Boolean);

  if (tokens.length < 3) {
    return null;
  }

  const number = parseQuestionNumberToken(tokens[0] ?? "");
  const promptToken = tokens[1] ?? "";

  if (
    number === null ||
    !promptToken ||
    /^[A-FАБВГДЕ]$/iu.test(promptToken) ||
    promptToken.length < 3
  ) {
    return null;
  }

  const inlineOptions = extractAnyInlineOptions(promptToken);
  const prompt = (inlineOptions?.prompt ?? promptToken).trim();
  const options = [
    ...(inlineOptions?.options ?? []),
    ...extractOptionsFromPipeTokens(tokens.slice(2)),
  ];

  if (!prompt) {
    return null;
  }

  return {
    number,
    options,
    prompt,
  };
}

function isAnswerSectionHeading(line: string) {
  return /^(?:answer(?:\s*key)?|answers?|solutions?|хариу(?:нууд)?|зөв\s*хариу(?:лт(?:ууд)?)?)(?:\s*[:.-])?$/iu.test(
    line.trim(),
  );
}

function detectSectionType(block: string) {
  const trimmed = block.trim();

  if (!trimmed || trimmed.length > 80) {
    return null;
  }

  if (
    /^(?:(?:[ivxlcdm]+|\d+)(?:\s*(?:-р)?)?(?:\s*(?:хэсэг|section))?[\s.:-]*)?(?:тест|test|mcq|сонгох|сонголттой)(?:\s+(?:хэсэг|section|асуулт(?:ууд)?|даалгавар))?$/iu.test(
      trimmed,
    )
  ) {
    return "mcq" as const;
  }

  if (
    /^(?:(?:[ivxlcdm]+|\d+)(?:\s*(?:-р)?)?(?:\s*(?:хэсэг|section))?[\s.:-]*)?(?:задгай|бодлого|даалгавар|written|essay)(?:\s+(?:хэсэг|section|асуулт(?:ууд)?|даалгавар))?$/iu.test(
      trimmed,
    )
  ) {
    return "math" as const;
  }

  return null;
}

function looksLikeStandaloneAnswerKeyLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed) {
    return false;
  }

  const compactEntry = trimmed.match(/^Q?\d+\s*(?:[|:=-]|=>|->)\s*(.+)$/iu);

  if (compactEntry) {
    const answer = compactEntry[1]?.trim() ?? "";

    return Boolean(answer) && answer.length <= 140 && !/[?؟]/u.test(answer);
  }

  const whitespaceEntry = trimmed.match(/^Q?\s*(\d+)\s+(.+)$/iu);

  if (!whitespaceEntry) {
    return false;
  }

  return looksLikeShortAnswerValue(whitespaceEntry[2] ?? "");
}

function extractAnswerEntriesFromLine(line: string) {
  const entries: Array<{ answer: string; number: number }> = [];
  const pipeTokens = line.split("|").map((token) => token.trim()).filter(Boolean);

  if (pipeTokens.length >= 2 && pipeTokens.length % 2 === 0) {
    for (let index = 0; index < pipeTokens.length; index += 2) {
      const numberToken = pipeTokens[index] ?? "";
      const answerToken = pipeTokens[index + 1] ?? "";
      const questionStart = parseQuestionStart(`${numberToken}. ${answerToken}`);

      if (questionStart) {
        entries.push({
          answer: questionStart.text,
          number: questionStart.number,
        });
        continue;
      }

      const parsedNumber = Number.parseInt(numberToken.replace(/^Q/iu, ""), 10);

      if (Number.isFinite(parsedNumber) && answerToken) {
        entries.push({
          answer: answerToken,
          number: parsedNumber,
        });
      }
    }
  }

  if (entries.length > 0) {
    return entries;
  }

  const singleMatch = line.match(
    /^Q?\s*(\d+)\s*(?:[\.\)]|:|=|-|=>|->)\s*(.+)$/iu,
  );

  if (singleMatch) {
    const parsedNumber = Number.parseInt(singleMatch[1] ?? "0", 10);
    const answer = (singleMatch[2] ?? "").trim();

    if (Number.isFinite(parsedNumber) && answer) {
      entries.push({
        answer,
        number: parsedNumber,
      });
    }

    return entries;
  }

  const whitespaceMatch = line.match(/^Q?\s*(\d+)\s+(.+)$/iu);

  if (!whitespaceMatch) {
    return entries;
  }

  const parsedNumber = Number.parseInt(whitespaceMatch[1] ?? "0", 10);
  const answer = (whitespaceMatch[2] ?? "").trim();

  if (Number.isFinite(parsedNumber) && looksLikeShortAnswerValue(answer)) {
    entries.push({
      answer,
      number: parsedNumber,
    });
  }

  return entries;
}

function extractAnswerEntriesFromText(value: string) {
  const lines = value
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return extractAnswerEntriesFromLine(value.trim());
  }

  return lines.flatMap((line) => extractAnswerEntriesFromLine(line));
}

function parseAnswerKeyMap(answerKeyHints: string[]) {
  const answerMap = new Map<number, string>();

  for (const line of answerKeyHints) {
    if (isAnswerSectionHeading(line)) {
      continue;
    }

    for (const entry of extractAnswerEntriesFromText(line)) {
      answerMap.set(entry.number, entry.answer);
    }
  }

  return answerMap;
}

function finalizeQuestionDraft(
  draft: QuestionDraft,
  answerMap: Map<number, string>,
): GeneratedExamQuestionPayload | null {
  const combinedPrompt = draft.promptLines.join("\n\n");
  const promptInlineOptions = extractAnyInlineOptions(combinedPrompt);
  const promptMarker = stripImageMarkers(promptInlineOptions?.prompt ?? combinedPrompt);
  const optionMarkers = [
    ...(promptInlineOptions?.options ?? []),
    ...normalizeDraftOptions(draft.optionLines),
  ].map((option) => stripImageMarkers(option));
  const normalizedOptions = optionMarkers
    .map((option) => option.cleaned ?? "")
    .filter(Boolean);
  const answerMarker = stripImageMarkers(answerMap.get(draft.number));
  const sourceImageName =
    promptMarker.imageName ??
    optionMarkers.find((option) => option.imageName)?.imageName ??
    answerMarker.imageName;
  const imageAlt =
    promptMarker.imageAlt ??
    optionMarkers.find((option) => option.imageAlt)?.imageAlt ??
    answerMarker.imageAlt;
  const prompt = promptMarker.cleaned?.trim() ?? "";

  if (!prompt) {
    return null;
  }

  const isLikelyMcq =
    normalizedOptions.length >= 2 || draft.sectionType === "mcq";

  if (isLikelyMcq) {
    return {
      correctOption: parseCorrectOptionValue(answerMarker.cleaned, normalizedOptions),
      imageAlt,
      options: normalizedOptions,
      prompt,
      sourceImageName,
      type: "mcq",
    };
  }

  return {
    answerLatex: answerMarker.cleaned ?? "",
    imageAlt,
    prompt,
    responseGuide: "Бодолтын бүх алхмаа тодорхой бичнэ үү.",
    sourceImageName,
    type: "math",
  };
}

function parseQuestionsFromSource(source: LocalExamTextSource) {
  const blocks = splitBlocks(source.text);
  const answerMap = parseAnswerKeyMap(source.answerKeyHints ?? []);
  const questions: GeneratedExamQuestionPayload[] = [];
  const titleBlocks: string[] = [];
  let currentQuestion: QuestionDraft | null = null;
  let currentSectionType: "math" | "mcq" | null = inferSourceSectionType({
    answerMap,
    blocks,
  });
  let inAnswerSection = false;
  let nextQuestionNumber = 1;
  let lastSection: "option" | "prompt" = "prompt";

  function flushCurrentQuestion() {
    if (!currentQuestion) {
      return;
    }

    const finalized = finalizeQuestionDraft(currentQuestion, answerMap);

    if (finalized) {
      questions.push(finalized);
    }

    currentQuestion = null;
    lastSection = "prompt";
  }

  for (const block of blocks) {
    const sectionType = detectSectionType(block);

    if (sectionType) {
      currentSectionType = sectionType;
      flushCurrentQuestion();
      continue;
    }

    if (isAnswerSectionHeading(block)) {
      inAnswerSection = true;
      flushCurrentQuestion();
      continue;
    }

    if (inAnswerSection || looksLikeStandaloneAnswerKeyLine(block)) {
      for (const entry of extractAnswerEntriesFromText(block)) {
        answerMap.set(entry.number, entry.answer);
      }

      continue;
    }

    const pipeDelimitedQuestion = parsePipeDelimitedQuestionBlock(block);

    if (pipeDelimitedQuestion) {
      flushCurrentQuestion();
      currentQuestion = {
        number:
          pipeDelimitedQuestion.number > 0
            ? pipeDelimitedQuestion.number
            : nextQuestionNumber,
        optionLines: pipeDelimitedQuestion.options,
        promptLines: [pipeDelimitedQuestion.prompt],
        sectionType: currentSectionType,
      };
      nextQuestionNumber = currentQuestion.number + 1;
      lastSection =
        pipeDelimitedQuestion.options.length > 0 ? "option" : "prompt";
      continue;
    }

    const pipeDelimitedOptions = parsePipeDelimitedOptionBlock(block);

    if (pipeDelimitedOptions && currentQuestion) {
      currentQuestion.optionLines.push(...pipeDelimitedOptions);
      lastSection = "option";
      continue;
    }

    const questionStart = parseQuestionStart(block);

    if (questionStart) {
      const parsedQuestionBody = parseQuestionBody(
        questionStart.text,
        currentSectionType,
      );
      const currentQuestionCandidate = currentQuestion;

      if (
        isNumberedContinuationCandidate({
          currentQuestion: currentQuestionCandidate,
          nextQuestionBody: parsedQuestionBody,
          nextQuestionNumber: questionStart.number,
        })
        && currentQuestionCandidate
      ) {
        if (parsedQuestionBody.prompt) {
          currentQuestionCandidate.promptLines.push(parsedQuestionBody.prompt);
        }

        if (parsedQuestionBody.options.length > 0) {
          currentQuestionCandidate.optionLines.push(...parsedQuestionBody.options);
          lastSection = "option";
        } else {
          lastSection = "prompt";
        }

        nextQuestionNumber = Math.max(nextQuestionNumber, questionStart.number + 1);
        continue;
      }

      flushCurrentQuestion();
      currentQuestion = {
        number:
          questionStart.number > 0 ? questionStart.number : nextQuestionNumber,
        optionLines: parsedQuestionBody.options,
        promptLines:
          parsedQuestionBody.prompt || questionStart.text
            ? [parsedQuestionBody.prompt || questionStart.text]
            : [],
        sectionType: currentSectionType,
      };
      nextQuestionNumber = currentQuestion.number + 1;
      lastSection = parsedQuestionBody.options.length > 0 ? "option" : "prompt";
      continue;
    }

    const inlineOptions = extractAnyInlineOptions(block);

    if (inlineOptions && currentQuestion) {
      if (inlineOptions.prompt) {
        currentQuestion.promptLines.push(inlineOptions.prompt);
      }

      currentQuestion.optionLines.push(...inlineOptions.options);
      lastSection = "option";
      continue;
    }

    const optionStart = parseOptionBlock(block);

    if (optionStart && currentQuestion) {
      currentQuestion.optionLines.push(optionStart.text);
      lastSection = "option";
      continue;
    }

    const multilineOptions = parseLikelyMultilineOptionBlock(
      block,
      currentQuestion,
      currentSectionType,
    );

    if (multilineOptions && currentQuestion) {
      currentQuestion.optionLines.push(...multilineOptions);
      lastSection = "option";
      continue;
    }

    if (currentQuestion && isMediaContinuationBlock(block, currentQuestion)) {
      currentQuestion.promptLines.push(block);
      lastSection = "prompt";
      continue;
    }

    if (!currentQuestion) {
      titleBlocks.push(block);
      continue;
    }

    if (lastSection === "option" && currentQuestion.optionLines.length > 0) {
      const lastOptionIndex = currentQuestion.optionLines.length - 1;
      currentQuestion.optionLines[lastOptionIndex] =
        `${currentQuestion.optionLines[lastOptionIndex]}\n${block}`.trim();
      continue;
    }

    currentQuestion.promptLines.push(block);
    lastSection = "prompt";
  }

  flushCurrentQuestion();

  return {
    questions,
    title:
      titleBlocks.find(
        (block) =>
          !isAnswerSectionHeading(block) &&
          !looksLikeStandaloneAnswerKeyLine(block),
      ) ?? fileNameToTitle(source.name),
  };
}

export function parseLocalExamPayload(args: {
  sourceImages?: GeneratedExamSourceImagePayload[];
  sources: LocalExamTextSource[];
}): GeneratedExamPayload {
  const questions: GeneratedExamQuestionPayload[] = [];
  let title = "";

  for (const source of args.sources) {
    const parsed = parseQuestionsFromSource(source);

    if (!title && parsed.title) {
      title = parsed.title;
    }

    questions.push(...parsed.questions);
  }

  return {
    questions,
    sourceImages: args.sourceImages,
    title,
  };
}
