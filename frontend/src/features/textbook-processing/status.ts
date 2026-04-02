import type {
  TextbookMaterial,
  TextbookMaterialDetail,
  TextbookMaterialStage,
} from "./types";

export function getStageLabel(stage: TextbookMaterialStage) {
  switch (stage) {
    case "uploading":
      return "R2-д хадгалж байна";
    case "processing_pages":
      return "Хуудас боловсруулж байна";
    case "detecting_chapters":
      return "Бүлэг ялгаж байна";
    case "ready":
      return "Бэлэн";
    case "ocr_needed":
      return "OCR хэрэгтэй";
    case "error":
      return "Алдаа";
    default:
      return "Хадгалсан";
  }
}

export function buildProgressMessage(material: TextbookMaterial | null) {
  if (!material) {
    return "";
  }

  if (material.statusMessage?.trim()) {
    return material.statusMessage.trim();
  }

  if (
    material.progressTotal > 0 &&
    material.progressCurrent > 0 &&
    material.stage === "processing_pages"
  ) {
    return `${getStageLabel(material.stage)} ${material.progressCurrent}/${material.progressTotal}`;
  }

  return getStageLabel(material.stage);
}

export function isMaterialReady(detail: TextbookMaterialDetail | null) {
  return detail?.material.status === "ready";
}
