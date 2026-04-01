"use client";

const normalizeBaseUrl = (value?: string) => value?.trim().replace(/\/$/, "") ?? "";

export const buildRuntimeApiUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const baseUrl = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_FRONTEND_API_BASE_URL,
  );

  if (!baseUrl) {
    return path;
  }

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
};

const buildHtmlResponseError = () => {
  const configuredBaseUrl = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_FRONTEND_API_BASE_URL,
  );

  if (configuredBaseUrl) {
    return new Error(
      "Frontend API JSON биш HTML буцаалаа. NEXT_PUBLIC_FRONTEND_API_BASE_URL тохиргоогоо шалгана уу.",
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
