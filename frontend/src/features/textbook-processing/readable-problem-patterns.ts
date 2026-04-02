export type ReadableProblemSolution = {
  answer: number;
  explanation: string;
  prompt: string;
  type: "triangle-interior-angle-x";
};

export function normalizeReadableProblemText(value: string) {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s*°/g, "°")
    .replace(
      /([A-Za-zА-Яа-яЁёӨөҮүҢңӘә0-9])\s*-\s*(ийн|ын|ийнх|ыг|ийг|д|т|аар|ээр|оор|өөр|аас|ээс|оос|өөс|тай|тэй|руу|рүү)(?=\s|$|[.,;:!?])/gu,
      "$1-$2",
    )
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+/g, " ")
    .trim();
}

export function looksReadableMathWordProblem(value: string) {
  const text = normalizeReadableProblemText(value);
  if (!text || text.length < 12 || text.length > 220) {
    return false;
  }

  const hasQuestionSignal =
    /(утгыг\s*ол|хэд\s*вэ|олно\s*уу|ол\.?$|шийд|тооцоол)/iu.test(text);
  const hasMathTopic =
    /(гурвалжин|өнцөг|тэгшитгэл|периметр|талбай|магадлал|функц|координат|вектор|радиус|диаметр)/iu.test(
      text,
    ) || /[xXхХyYуУzZ]/.test(text);
  const digitCount = (text.match(/\d/g) || []).length;

  return hasQuestionSignal && hasMathTopic && digitCount >= 2;
}

export function replaceFirstReadableTokenWithBlank(sourceText: string, token: string) {
  const source = normalizeReadableProblemText(sourceText);
  const value = String(token || "").trim();
  if (!source || !value) {
    return "";
  }

  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = /^[\p{L}]+$/u.test(value)
    ? new RegExp(`\\b${escaped}\\b`, "u")
    : new RegExp(escaped, "u");

  return source.replace(expression, "_____").trim();
}

function formatReadableNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "";
  }

  const rounded = Math.abs(value - Math.round(value)) < 1e-9 ? Math.round(value) : value;
  return String(rounded);
}

function toLinearSafeExpression(rawExpression: string) {
  let expression = normalizeReadableProblemText(rawExpression)
    .replace(/,/g, ".")
    .replace(/°/g, "")
    .replace(/[хХ]/g, "x")
    .replace(/\s+/g, "");

  if (!expression) {
    return null;
  }

  expression = expression
    .replace(/(\d)(x|\()/g, "$1*$2")
    .replace(/(x|\))(\d)/g, "$1*$2")
    .replace(/(\))(x)/g, ")*$2")
    .replace(/(x)(\()/g, "$1*$2");

  const alphaCheck = expression.replace(/x/g, "");
  if (/[A-WYZa-wyzА-Яа-яЁёӨөҮүҢңӘә]/u.test(alphaCheck)) {
    return null;
  }
  if (!/^[0-9x+\-*/().]+$/.test(expression)) {
    return null;
  }

  return expression;
}

function evaluateLinearExpression(rawExpression: string, x: number) {
  const safeExpression = toLinearSafeExpression(rawExpression);
  if (!safeExpression) {
    return null;
  }

  try {
    const value = Function("x", `"use strict"; return (${safeExpression});`)(x) as number;
    return Number.isFinite(value) ? Number(value) : null;
  } catch {
    return null;
  }
}

function extractTriangleAngleExpressions(problemText: string) {
  const source = normalizeReadableProblemText(problemText);
  if (!/(гурвалжин|гурвалжны)/iu.test(source) || !/өнцөг/iu.test(source)) {
    return [];
  }

  const beforeTarget = source.split(/(?:бол|байвал|байна|гээд|тэгвэл)/iu)[0] || source;
  const startIndex = beforeTarget.search(/[\dxхXХ(]/);
  if (startIndex < 0) {
    return [];
  }

  const candidate = beforeTarget
    .slice(startIndex)
    .replace(/дотоод\s+өнцгүүд?/giu, "")
    .replace(/өнцгүүд?/giu, "")
    .trim();

  return candidate
    .split(/\s*,\s*|\s*;\s*|\s+ба\s+/iu)
    .map((item) =>
      normalizeReadableProblemText(item)
        .replace(/[.?!]+$/g, "")
        .replace(/°$/g, "")
        .trim(),
    )
    .filter((item) => item && /[\dxхXХ]/.test(item))
    .slice(0, 3);
}

export function trySolveReadableMathProblem(problemText: string): ReadableProblemSolution | null {
  const prompt = normalizeReadableProblemText(problemText).replace(
    /^\s*(?:\d{1,3}|[A-Za-zА-Яа-яЁёӨөҮүҢңӘә])\s*[\).:\-–]\s*/u,
    "",
  );
  if (!looksReadableMathWordProblem(prompt)) {
    return null;
  }

  const beforeTarget = prompt.split(/(?:бол|байвал|байна|гээд|тэгвэл)/iu)[0] || prompt;
  const startIndex = beforeTarget.search(/[\dxхXХ(]/);
  const triangleAngles =
    startIndex >= 0
      ? beforeTarget
          .slice(startIndex)
          .replace(/дотоод\s+өнцгүүд?/giu, "")
          .replace(/өнцгүүд?/giu, "")
          .trim()
          .split(/\s*,\s*|\s*;\s*|\s+ба\s+/iu)
          .map((item) =>
            normalizeReadableProblemText(item)
              .replace(/[.?!]+$/g, "")
              .replace(/°$/g, "")
              .trim(),
          )
          .filter((item) => item && /[\dxхXХ]/.test(item))
          .slice(0, 3)
      : [];

  if (triangleAngles.length === 3) {
    const evaluateSegment = (expression: string, xValue: number) => {
      let safeExpression = normalizeReadableProblemText(expression)
        .replace(/,/g, ".")
        .replace(/°/g, "")
        .replace(/[хХ]/g, "x")
        .replace(/\s+/g, "");

      safeExpression = safeExpression
        .replace(/(\d)(x|\()/g, "$1*$2")
        .replace(/(x|\))(\d)/g, "$1*$2")
        .replace(/(\))(x)/g, ")*$2")
        .replace(/(x)(\()/g, "$1*$2");

      if (!safeExpression || /[^0-9x+\-*/().]/.test(safeExpression)) {
        return null;
      }

      try {
        const value = Function("x", `"use strict"; return (${safeExpression});`)(xValue) as number;
        return Number.isFinite(value) ? Number(value) : null;
      } catch {
        return null;
      }
    };

    const sumAtZero = triangleAngles.reduce((sum, expression) => {
      const value = evaluateSegment(expression, 0);
      return Number.isFinite(value) ? sum + Number(value) : Number.NaN;
    }, 0);
    const sumAtOne = triangleAngles.reduce((sum, expression) => {
      const value = evaluateSegment(expression, 1);
      return Number.isFinite(value) ? sum + Number(value) : Number.NaN;
    }, 0);

    const coefficient = Number(sumAtOne) - Number(sumAtZero);
    if (
      Number.isFinite(sumAtZero) &&
      Number.isFinite(sumAtOne) &&
      Number.isFinite(coefficient) &&
      Math.abs(coefficient) > 1e-9
    ) {
      const answer = (180 - Number(sumAtZero)) / coefficient;
      const verification = triangleAngles.reduce((sum, expression) => {
        const value = evaluateSegment(expression, answer);
        return Number.isFinite(value) ? sum + Number(value) : Number.NaN;
      }, 0);

      if (Number.isFinite(answer) && Number.isFinite(verification) && Math.abs(verification - 180) < 1e-6) {
        return {
          answer,
          explanation: `${triangleAngles
            .map((expression) => expression.replace(/\s+/g, " ").trim())
            .join(" + ")} = 180°, тэгэхээр x = ${formatReadableNumber(answer)}.`,
          prompt,
          type: "triangle-interior-angle-x",
        };
      }
    }
  }

  return null;
}
