import type { TextbookMaterialDetail, TextbookUploadedAsset } from "./types";

type CachedSessionMaterial = {
  asset: TextbookUploadedAsset | null;
  detail: TextbookMaterialDetail;
  importId?: string | null;
};

const materialIdCache = new Map<string, CachedSessionMaterial>();
const importIdCache = new Map<string, CachedSessionMaterial>();
const r2KeyCache = new Map<string, CachedSessionMaterial>();

function buildR2CacheKey(asset: TextbookUploadedAsset | null) {
  if (!asset?.bucketName || !asset?.key) {
    return "";
  }

  return `${asset.bucketName}:${asset.key}`;
}

export function cacheSessionTextbookMaterial(input: {
  asset: TextbookUploadedAsset | null;
  detail: TextbookMaterialDetail | null;
  importId?: string | null;
}) {
  if (!input.detail) {
    return;
  }

  const cached: CachedSessionMaterial = {
    asset: input.asset,
    detail: input.detail,
    importId: input.importId || null,
  };

  const materialId = String(input.detail.material.id || "").trim();
  if (materialId) {
    materialIdCache.set(materialId, cached);
  }

  const importId = String(input.importId || "").trim();
  if (importId) {
    importIdCache.set(importId, cached);
  }

  const r2Key = buildR2CacheKey(input.asset);
  if (r2Key) {
    r2KeyCache.set(r2Key, cached);
  }
}

export function getCachedSessionTextbookMaterial(input: {
  asset?: TextbookUploadedAsset | null;
  importId?: string | null;
  materialId?: string | null;
}) {
  const materialId = String(input.materialId || "").trim();
  if (materialId && materialIdCache.has(materialId)) {
    return materialIdCache.get(materialId) || null;
  }

  const importId = String(input.importId || "").trim();
  if (importId && importIdCache.has(importId)) {
    return importIdCache.get(importId) || null;
  }

  const r2Key = buildR2CacheKey(input.asset || null);
  if (r2Key && r2KeyCache.has(r2Key)) {
    return r2KeyCache.get(r2Key) || null;
  }

  return null;
}
