type AblyAuthInfo = {
  authUrl: string;
  restBaseUrl: string;
};

function getCreateExamOriginFromRequest(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function getAblyAuthInfo(request: Request): AblyAuthInfo {
  const origin = getCreateExamOriginFromRequest(request);
  return {
    authUrl: `${origin}/api/ably/auth`,
    restBaseUrl: "https://rest.ably.io",
  };
}

function getAblyKeyParts() {
  const key = process.env.ABLY_API_KEY;
  if (!key) return null;

  const [keyName, keySecret] = key.split(":");
  if (!keyName || !keySecret) return null;
  return { key, keyName, keySecret };
}

function getBasicAuthHeader(apiKey: string) {
  // Node/Workers compat: btoa is not always present, Buffer may not always exist.
  const encoded =
    typeof Buffer !== "undefined"
      ? Buffer.from(apiKey, "utf8").toString("base64")
      : btoa(apiKey);
  return `Basic ${encoded}`;
}

export async function requestAblyToken(request: Request) {
  const parts = getAblyKeyParts();
  if (!parts) {
    return { error: "ABLY_API_KEY тохируулаагүй байна." } as const;
  }

  const res = await fetch(`${"https://rest.ably.io"}/keys/${parts.keyName}/requestToken`, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(parts.key),
      "Content-Type": "application/json",
    },
    // clientId/capability-г хүсвэл энд тодорхойлж болно.
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `Ably token авахад алдаа гарлаа (${res.status}): ${text}` } as const;
  }

  const json = (await res.json()) as unknown;
  return { tokenRequest: json } as const;
}

export async function publishExamSaved(payload: {
  examId: string;
  title: string;
  updatedAt: string;
}) {
  try {
    const parts = getAblyKeyParts();
    if (!parts) {
      return;
    }

    const channel = "new-math-exams";
    const res = await fetch(
      `https://rest.ably.io/channels/${encodeURIComponent(channel)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: getBasicAuthHeader(parts.key),
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            name: "exam.saved",
            data: payload,
          },
        ]),
      },
    );

    // Publish failure shouldn't break save flow.
    if (!res.ok) {
      return;
    }
  } catch {
    // Network/runtime failure shouldn't break save flow either.
    return;
  }
}

