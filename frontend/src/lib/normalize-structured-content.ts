const HTML_LIKE_TAG_PATTERN =
  /<\/?(?:p|br|strong|b|em|i|ul|ol|li|div|span|sup|sub)(?:\s[^>]*)?>/i;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}

export function normalizeStructuredContent(value: string) {
  const normalizedLineEndings = value.replace(/\r\n?/g, "\n");

  if (!HTML_LIKE_TAG_PATTERN.test(normalizedLineEndings)) {
    return normalizedLineEndings;
  }

  return decodeHtmlEntities(normalizedLineEndings)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<\s*p(?:\s[^>]*)?>/gi, "")
    .replace(
      /<\s*sup(?:\s[^>]*)?>([\s\S]*?)<\s*\/sup\s*>/gi,
      (_full, content: string) => {
        const trimmed = String(content).trim();
        if (!trimmed) return "";
        if (/^[∘°]$/u.test(trimmed)) {
          return "^\\circ";
        }
        return `^{${trimmed}}`;
      },
    )
    .replace(
      /<\s*sub(?:\s[^>]*)?>([\s\S]*?)<\s*\/sub\s*>/gi,
      (_full, content: string) => {
        const trimmed = String(content).trim();
        if (!trimmed) return "";
        return `_{${trimmed}}`;
      },
    )
    .replace(/<\s*\/div\s*>/gi, "\n")
    .replace(/<\s*div(?:\s[^>]*)?>/gi, "")
    .replace(/<\s*(?:strong|b|em|i|span)(?:\s[^>]*)?>/gi, "")
    .replace(/<\s*\/(?:strong|b|em|i|span)\s*>/gi, "")
    .replace(/<\s*(?:ul|ol)(?:\s[^>]*)?>/gi, "\n")
    .replace(/<\s*\/(?:ul|ol)\s*>/gi, "\n")
    .replace(/<\s*li(?:\s[^>]*)?>/gi, "\n• ")
    .replace(/<\s*\/li\s*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
