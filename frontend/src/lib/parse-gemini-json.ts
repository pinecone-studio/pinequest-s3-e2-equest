function extractLikelyJsonBlock(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return trimmed;
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");

  if (objectStart !== -1 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");

  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1);
  }

  return trimmed;
}

export function cleanJsonBlock(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("```")) {
    return extractLikelyJsonBlock(
      trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim(),
    );
  }

  return extractLikelyJsonBlock(trimmed);
}

function repairInvalidJsonStringEscapes(value: string) {
  let result = "";
  let inString = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";

    if (!inString) {
      result += char;

      if (char === '"') {
        inString = true;
      }

      continue;
    }

    if (char === "\\") {
      const next = value[index + 1];

      if (next === undefined) {
        result += "\\\\";
        continue;
      }

      if (next === "u") {
        const unicodeDigits = value.slice(index + 2, index + 6);

        if (/^[0-9a-fA-F]{4}$/.test(unicodeDigits)) {
          result += `\\u${unicodeDigits}`;
          index += 5;
          continue;
        }

        result += "\\\\";
        continue;
      }

      if (`"\\/bfnrt`.includes(next)) {
        result += `\\${next}`;
        index += 1;
        continue;
      }

      result += "\\\\";
      continue;
    }

    if (char === '"') {
      inString = false;
      result += char;
      continue;
    }

    if (char === "\n") {
      result += "\\n";
      continue;
    }

    if (char === "\r") {
      result += "\\r";
      continue;
    }

    if (char === "\t") {
      result += "\\t";
      continue;
    }

    const codePoint = char.charCodeAt(0);

    if (codePoint < 0x20) {
      result += `\\u${codePoint.toString(16).padStart(4, "0")}`;
      continue;
    }

    result += char;
  }

  return result;
}

export function parseGeminiJson<T>(value: string): T {
  const cleaned = cleanJsonBlock(value);

  try {
    return JSON.parse(cleaned) as T;
  } catch (firstError) {
    const repaired = repairInvalidJsonStringEscapes(cleaned);

    try {
      return JSON.parse(repaired) as T;
    } catch {
      throw firstError;
    }
  }
}
