import type {
  TextbookMaterialDetail,
  TextbookMaterialStructureDetail,
} from "./types";

const TEXTBOOK_MATERIALS_PROXY_PATH = "/api/textbook-materials";

async function parseJsonError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function parseProxyJson<T extends { error?: string }>(response: Response) {
  const payload = (await response.json()) as T;
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    throw new Error(payload.error);
  }
  return payload;
}

export async function getTextbookMaterialStructureById(materialId: string) {
  const response = await fetch(
    `${TEXTBOOK_MATERIALS_PROXY_PATH}/${encodeURIComponent(materialId)}/structure`,
    {
      method: "GET",
    },
  );

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await parseJsonError(response));
  }

  return parseProxyJson<TextbookMaterialStructureDetail & { error?: string }>(response);
}

export async function getTextbookMaterialSelectionByNodeIds(
  materialId: string,
  nodeIds: string[],
) {
  const response = await fetch(
    `${TEXTBOOK_MATERIALS_PROXY_PATH}/${encodeURIComponent(materialId)}/selection`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nodeIds,
      }),
    },
  );

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await parseJsonError(response));
  }

  return parseProxyJson<TextbookMaterialDetail & { error?: string }>(response);
}
