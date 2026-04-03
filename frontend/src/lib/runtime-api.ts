"use client";

const normalizeBaseUrl = (value?: string) => value?.trim().replace(/\/$/, "") ?? "";

const isLoopbackHostname = (hostname?: string | null) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname === "[::1]";

const isLoopbackUrl = (value?: string) => {
  if (!value) {
    return false;
  }

  try {
    return isLoopbackHostname(new URL(value).hostname);
  } catch {
    return false;
  }
};

const isBrowserOnLoopback = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return isLoopbackHostname(window.location.hostname);
};

const resolveFrontendBaseUrl = () => {
  const configured = normalizeBaseUrl(process.env.NEXT_PUBLIC_FRONTEND_API_BASE_URL);

  if (!configured) {
    return "";
  }

  if (isLoopbackUrl(configured) && !isBrowserOnLoopback()) {
    return "";
  }

  return configured;
};

export const buildRuntimeApiUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const baseUrl = resolveFrontendBaseUrl();

  if (!baseUrl) {
    return path;
  }

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
};

export const buildAblyAuthUrl = () => {
  const configuredAuthUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_ABLY_AUTH_URL);

  if (configuredAuthUrl && (!isLoopbackUrl(configuredAuthUrl) || isBrowserOnLoopback())) {
    return configuredAuthUrl;
  }

  return buildRuntimeApiUrl("/api/ably/auth");
};

const buildHtmlResponseError = () => {
  const configuredBaseUrl = resolveFrontendBaseUrl();

  if (configuredBaseUrl) {
    return new Error(
      "Frontend API JSON биш HTML буцаалаа. NEXT_PUBLIC_FRONTEND_API_BASE_URL тохиргоогоо шалгана уу.",
    );
  }

  if (!isBrowserOnLoopback()) {
    return new Error(
      "Frontend API JSON биш HTML буцаалаа. Deployed origin эсвэл routing-аа шалгана уу.",
    );
  }

  return new Error(
    "Frontend API олдсонгүй. `bun run preview` ажиллуулах эсвэл NEXT_PUBLIC_FRONTEND_API_BASE_URL тохируулна уу.",
  );
};

export const fetchRuntimeJson = async <TData extends object>(
  path: string,
  init?: RequestInit,
) => {
  const response = await fetch(buildRuntimeApiUrl(path), init);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    const text = await response.text().catch(() => "");
    if (/<!doctype html|<html/i.test(text)) {
      throw buildHtmlResponseError();
    }

    throw new Error("Frontend API JSON хариу буцаасангүй.");
  }

  const payload = (await response.json()) as TData & { message?: string };

  if (!response.ok) {
    throw new Error(
      typeof payload.message === "string" && payload.message.trim().length > 0
        ? payload.message
        : "Frontend API хүсэлт амжилтгүй боллоо.",
    );
  }

  return payload;
};
