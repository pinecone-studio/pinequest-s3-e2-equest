import type {
  TextbookMaterial,
  TextbookMaterialDetail,
  TextbookMaterialStage,
} from "./types";

function clampProgress(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function mapRatioToProgress(ratio: number, start: number, end: number) {
  const safeRatio = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  return clampProgress(start + (end - start) * safeRatio, start, end);
}

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

export function getMaterialProgressValue(material: TextbookMaterial | null) {
  if (!material) {
    return 0;
  }

  if (material.status === "ready" || material.status === "ocr_needed") {
    return 100;
  }

  if (material.stage === "detecting_chapters") {
    return 90;
  }

  if (material.stage === "processing_pages" && material.progressTotal > 0) {
    return mapRatioToProgress(
      material.progressCurrent / material.progressTotal,
      24,
      84,
    );
  }

  if (material.stage === "processing_pages") {
    return 40;
  }

  if (material.stage === "uploaded" || material.status === "uploaded") {
    return 18;
  }

  if (material.status === "processing") {
    return 28;
  }

  if (material.stage === "error" || material.status === "error") {
    return 0;
  }

  return 10;
}

export function getUploadWorkflowProgressValue(uploadPercent: number) {
  return mapRatioToProgress((uploadPercent || 0) / 100, 3, 20);
}
