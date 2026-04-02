"use client";

import type {
  TextbookMaterialDetail,
  TextbookMaterialStage,
  TextbookMaterialStatus,
  TextbookUploadedAsset,
} from "./types";

type CachedPersistedMaterial = {
  asset: TextbookUploadedAsset | null;
  detail: TextbookMaterialDetail;
  importId?: string | null;
  savedAt: string;
};

export type PersistedImportedTextbookCard = {
  createdAt: string;
  errorMessage?: string | null;
  fileName: string;
  id: string;
  materialId?: string | null;
  materialStage?: TextbookMaterialStage | null;
  materialStatus?: TextbookMaterialStatus | "idle";
  pageCount?: number;
  sectionCount?: number;
  subchapterCount?: number;
  title: string;
  uploadedAsset?: TextbookUploadedAsset | null;
};

type PersistedTextbookState = {
  importedCards: PersistedImportedTextbookCard[];
  materials: CachedPersistedMaterial[];
  version: 1;
};

const STORAGE_KEY = "pinequest:textbook-processing:v1";
const MAX_IMPORTED_CARDS = 8;
const MAX_PERSISTED_MATERIALS = 4;

function getEmptyState(): PersistedTextbookState {
  return {
    importedCards: [],
    materials: [],
    version: 1,
  };
}

function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function buildR2CacheKey(asset: TextbookUploadedAsset | null | undefined) {
  if (!asset?.bucketName || !asset?.key) {
    return "";
  }

  return `${asset.bucketName}:${asset.key}`;
}

function normalizePageText(value: string) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeChunkText(value: string) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactDetailForStorage(detail: TextbookMaterialDetail): TextbookMaterialDetail {
  return {
    ...detail,
    chunks: detail.chunks.map((chunk) => ({
      ...chunk,
      text: normalizeChunkText(chunk.text),
    })),
    pages: detail.pages.map((page) => ({
      ...page,
      rawText: "",
      normalizedText: normalizePageText(page.normalizedText || page.rawText),
    })),
  };
}

function sanitizeImportedCard(
  card: PersistedImportedTextbookCard,
): PersistedImportedTextbookCard {
  return {
    createdAt: card.createdAt,
    errorMessage: card.errorMessage ?? null,
    fileName: card.fileName,
    id: card.id,
    materialId: card.materialId ?? null,
    materialStage: card.materialStage ?? null,
    materialStatus: card.materialStatus ?? "idle",
    pageCount: typeof card.pageCount === "number" ? card.pageCount : 0,
    sectionCount: typeof card.sectionCount === "number" ? card.sectionCount : 0,
    subchapterCount:
      typeof card.subchapterCount === "number" ? card.subchapterCount : 0,
    title: card.title,
    uploadedAsset: card.uploadedAsset ?? null,
  };
}

function normalizeState(value: unknown): PersistedTextbookState {
  if (!value || typeof value !== "object") {
    return getEmptyState();
  }

  const raw = value as {
    importedCards?: PersistedImportedTextbookCard[];
    materials?: CachedPersistedMaterial[];
    version?: number;
  };

  return {
    importedCards: Array.isArray(raw.importedCards)
      ? raw.importedCards.map(sanitizeImportedCard)
      : [],
    materials: Array.isArray(raw.materials)
      ? raw.materials.filter(
          (item) =>
            Boolean(item?.detail?.material?.id) &&
            Array.isArray(item?.detail?.sections) &&
            Array.isArray(item?.detail?.chunks) &&
            Array.isArray(item?.detail?.pages),
        )
      : [],
    version: 1,
  };
}

function readPersistedState(): PersistedTextbookState {
  if (!isBrowserStorageAvailable()) {
    return getEmptyState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getEmptyState();
    }

    return normalizeState(JSON.parse(raw));
  } catch {
    return getEmptyState();
  }
}

function sortImportedCards(cards: PersistedImportedTextbookCard[]) {
  return [...cards].sort(
    (left, right) =>
      Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""),
  );
}

function sortPersistedMaterials(materials: CachedPersistedMaterial[]) {
  return [...materials].sort(
    (left, right) =>
      Date.parse(right.savedAt || right.detail.material.updatedAt || "") -
      Date.parse(left.savedAt || left.detail.material.updatedAt || ""),
  );
}

function writePersistedState(nextState: PersistedTextbookState) {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  let stateToWrite = {
    ...nextState,
    importedCards: sortImportedCards(nextState.importedCards).slice(0, MAX_IMPORTED_CARDS),
    materials: sortPersistedMaterials(nextState.materials).slice(
      0,
      MAX_PERSISTED_MATERIALS,
    ),
  };

  while (true) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToWrite));
      return;
    } catch (error) {
      if (stateToWrite.materials.length > 1) {
        stateToWrite = {
          ...stateToWrite,
          materials: stateToWrite.materials.slice(0, stateToWrite.materials.length - 1),
        };
        continue;
      }

      if (stateToWrite.importedCards.length > 1) {
        stateToWrite = {
          ...stateToWrite,
          importedCards: stateToWrite.importedCards.slice(
            0,
            stateToWrite.importedCards.length - 1,
          ),
        };
        continue;
      }

      console.warn("Unable to persist textbook cache", error);
      return;
    }
  }
}

export function cachePersistedTextbookMaterial(input: {
  asset: TextbookUploadedAsset | null;
  detail: TextbookMaterialDetail | null;
  importId?: string | null;
}) {
  if (!input.detail) {
    return;
  }

  const hasReusableStructure =
    input.detail.sections.length > 0 &&
    (input.detail.chunks.length > 0 || input.detail.pages.length > 0);

  if (!hasReusableStructure) {
    return;
  }

  const nextMaterial: CachedPersistedMaterial = {
    asset: input.asset,
    detail: compactDetailForStorage(input.detail),
    importId: input.importId ?? null,
    savedAt: new Date().toISOString(),
  };

  const materialId = String(nextMaterial.detail.material.id || "").trim();
  const importId = String(nextMaterial.importId || "").trim();
  const r2Key = buildR2CacheKey(nextMaterial.asset);
  const state = readPersistedState();
  const materials = state.materials.filter((item) => {
    const sameMaterialId = String(item.detail.material.id || "").trim() === materialId;
    const sameImportId = importId && String(item.importId || "").trim() === importId;
    const sameR2Key = r2Key && buildR2CacheKey(item.asset) === r2Key;
    return !sameMaterialId && !sameImportId && !sameR2Key;
  });

  materials.unshift(nextMaterial);
  writePersistedState({
    ...state,
    materials,
  });
}

export function getCachedPersistedTextbookMaterial(input: {
  asset?: TextbookUploadedAsset | null;
  importId?: string | null;
  materialId?: string | null;
}) {
  const materialId = String(input.materialId || "").trim();
  const importId = String(input.importId || "").trim();
  const r2Key = buildR2CacheKey(input.asset || null);
  const state = readPersistedState();

  return (
    state.materials.find((item) => {
      if (materialId && String(item.detail.material.id || "").trim() === materialId) {
        return true;
      }

      if (importId && String(item.importId || "").trim() === importId) {
        return true;
      }

      if (r2Key && buildR2CacheKey(item.asset) === r2Key) {
        return true;
      }

      return false;
    }) || null
  );
}

export function loadPersistedImportedTextbookCards() {
  return readPersistedState().importedCards;
}

export function persistImportedTextbookCards(cards: PersistedImportedTextbookCard[]) {
  const state = readPersistedState();
  const persistedMaterialIds = new Set(
    state.materials.map((item) => String(item.detail.material.id || "").trim()),
  );
  const persistedR2Keys = new Set(
    state.materials
      .map((item) => buildR2CacheKey(item.asset))
      .filter(Boolean),
  );
  const filtered = cards
    .filter(
      (card) =>
        card.materialStatus === "ready" ||
        card.materialStatus === "ocr_needed" ||
        persistedMaterialIds.has(String(card.materialId || "").trim()) ||
        persistedR2Keys.has(buildR2CacheKey(card.uploadedAsset)),
    )
    .map(sanitizeImportedCard);

  const deduped = filtered.reduce<PersistedImportedTextbookCard[]>((acc, card) => {
    const existingIndex = acc.findIndex((item) => item.id === card.id);
    if (existingIndex >= 0) {
      acc[existingIndex] = card;
      return acc;
    }

    acc.push(card);
    return acc;
  }, []);

  writePersistedState({
    ...state,
    importedCards: deduped,
  });
}
