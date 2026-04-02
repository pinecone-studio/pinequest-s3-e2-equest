import type { TextbookMaterial, TextbookUploadedAsset } from "./types";

export function buildUploadedAssetFromMaterial(
  material: TextbookMaterial,
): TextbookUploadedAsset {
  return {
    bucketName: material.bucketName,
    contentType: material.contentType || "application/pdf",
    fileName: material.fileName,
    key: material.r2Key,
    size: material.size,
    uploadedAt: material.updatedAt || material.createdAt,
  };
}
