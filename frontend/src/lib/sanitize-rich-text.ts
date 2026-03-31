const TAG_TOKEN_PATTERN = /(<\/?[^>]+>)/g;

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function canonicalizeTag(token: string) {
  const normalized = token.trim().toLowerCase();

  if (/^<br\s*\/?>$/.test(normalized)) {
    return "<br>";
  }

  if (/^<(strong|b)>$/.test(normalized)) {
    return "<strong>";
  }

  if (/^<\/(strong|b)>$/.test(normalized)) {
    return "</strong>";
  }

  if (/^<(em|i)>$/.test(normalized)) {
    return "<em>";
  }

  if (/^<\/(em|i)>$/.test(normalized)) {
    return "</em>";
  }

  if (/^<(p|div)>$/.test(normalized)) {
    return "<p>";
  }

  if (/^<\/(p|div)>$/.test(normalized)) {
    return "</p>";
  }

  if (/^<ul>$/.test(normalized)) {
    return "<ul>";
  }

  if (/^<\/ul>$/.test(normalized)) {
    return "</ul>";
  }

  if (/^<ol>$/.test(normalized)) {
    return "<ol>";
  }

  if (/^<\/ol>$/.test(normalized)) {
    return "</ol>";
  }

  if (/^<li>$/.test(normalized)) {
    return "<li>";
  }

  if (/^<\/li>$/.test(normalized)) {
    return "</li>";
  }

  return "";
}

function convertPlainTextToHtml(value: string) {
  const normalized = decodeHtmlEntities(value).replace(/\r\n?/g, "\n");

  if (!normalized.trim()) {
    return "";
  }

  return escapeHtml(normalized).replace(/\n/g, "<br>");
}

export function sanitizeRichTextHtml(value: string) {
  const decoded = decodeHtmlEntities(value).replace(/\r\n?/g, "\n");

  if (!decoded.includes("<")) {
    return convertPlainTextToHtml(decoded);
  }

  const tokens = decoded.split(TAG_TOKEN_PATTERN);
  const sanitized = tokens
    .map((token) => {
      if (!token) {
        return "";
      }

      if (token.startsWith("<") && token.endsWith(">")) {
        return canonicalizeTag(token);
      }

      return escapeHtml(token);
    })
    .join("")
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/(?:<br>){3,}/g, "<br><br>");

  return sanitized || convertPlainTextToHtml(decoded);
}
