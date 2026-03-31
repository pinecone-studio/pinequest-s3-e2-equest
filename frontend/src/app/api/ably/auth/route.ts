import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";

type RouteEnv = {
  ABLY_API_KEY?: string;
  ABLY_CLIENT_ID_PREFIX?: string;
};

type TokenRequestBody = {
  capability: string;
  clientId?: string;
  keyName: string;
  mac: string;
  nonce: string;
  timestamp: number;
  ttl: number;
};

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const DEFAULT_CAPABILITY = JSON.stringify({
  "*": ["subscribe"],
});

const getEnv = () =>
  ((getCloudflareContext() as unknown as { env?: RouteEnv }).env ?? {}) as RouteEnv;

const getEnvValue = (primary?: string, fallback?: string) => {
  const value = primary?.trim() || fallback?.trim();
  return value ? value : undefined;
};

const sanitizeClientId = (value?: string) => {
  const normalized = value?.trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  return normalized && normalized.length > 0 ? normalized : undefined;
};

const parseAblyApiKey = (apiKey: string) => {
  const separatorIndex = apiKey.indexOf(":");

  if (separatorIndex <= 0 || separatorIndex === apiKey.length - 1) {
    throw new Error("ABLY_API_KEY буруу форматтай байна.");
  }

  return {
    keyName: apiKey.slice(0, separatorIndex),
    secret: apiKey.slice(separatorIndex + 1),
  };
};

const createNonce = () => crypto.randomUUID().replace(/-/g, "");

const createMac = async (
  secret: string,
  keyName: string,
  ttl: number,
  capability: string,
  clientId: string,
  timestamp: number,
  nonce: string,
) => {
  const signingText = [
    keyName,
    String(ttl),
    capability,
    clientId,
    String(timestamp),
    nonce,
  ].join("\n") + "\n";

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingText),
  );

  return Buffer.from(signature).toString("base64");
};

export async function POST(request: NextRequest) {
  const env = getEnv();
  const apiKey = getEnvValue(env.ABLY_API_KEY, process.env.ABLY_API_KEY);

  if (!apiKey) {
    return NextResponse.json(
      { message: "ABLY_API_KEY тохируулагдаагүй байна." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      capability?: string;
      clientId?: string;
      ttl?: number;
    };
    const { keyName, secret } = parseAblyApiKey(apiKey);
    const clientIdPrefix =
      getEnvValue(env.ABLY_CLIENT_ID_PREFIX, process.env.ABLY_CLIENT_ID_PREFIX) ??
      "pinequest";
    const clientId =
      sanitizeClientId(body.clientId) ?? `${clientIdPrefix}:test-dashboard`;
    const capability = body.capability?.trim() || DEFAULT_CAPABILITY;
    const ttl =
      typeof body.ttl === "number" && Number.isFinite(body.ttl) && body.ttl > 0
        ? Math.floor(body.ttl)
        : DEFAULT_TTL_MS;
    const timestamp = Date.now();
    const nonce = createNonce();
    const mac = await createMac(
      secret,
      keyName,
      ttl,
      capability,
      clientId,
      timestamp,
      nonce,
    );

    const tokenRequest: TokenRequestBody = {
      capability,
      clientId,
      keyName,
      mac,
      nonce,
      timestamp,
      ttl,
    };

    return NextResponse.json(tokenRequest, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Ably auth token үүсгэж чадсангүй.",
      },
      { status: 500 },
    );
  }
}
