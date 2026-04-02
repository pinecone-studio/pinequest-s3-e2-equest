export type TextbookMaterialStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "error"
  | "ocr_needed";

export type TextbookMaterialStage =
  | "uploading"
  | "uploaded"
  | "processing_pages"
  | "detecting_chapters"
  | "ready"
  | "error"
  | "ocr_needed";

export type StoredTextbookMaterial = {
  id: string;
  bucketName: string;
  r2Key: string;
  fileName: string;
  contentType: string | null;
  title: string | null;
  grade: number | null;
  subject: string | null;
  size: number;
  pageCount: number;
  chapterCount: number;
  sectionCount: number;
  subchapterCount: number;
  progressCurrent: number;
  progressTotal: number;
  status: TextbookMaterialStatus;
  stage: TextbookMaterialStage;
  statusMessage: string | null;
  errorMessage: string | null;
  warnings: string[];
  ocrNeededPageCount: number;
  unsupportedReason: string | null;
  readyAt: string | null;
  lastProcessedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredTextbookPage = {
  id: string;
  materialId: string;
  pageNumber: number;
  rawText: string;
  normalizedText: string;
  charCount: number;
  tokenCount: number;
  extractionStatus: "ready" | "ocr_needed";
  createdAt: string;
  updatedAt: string;
};

export type StoredTextbookSection = {
  id: string;
  materialId: string;
  parentId: string | null;
  nodeType: "chapter" | "section" | "subchapter";
  title: string;
  normalizedTitle: string;
  orderIndex: number;
  depth: number;
  startPage: number | null;
  endPage: number | null;
  childCount: number;
  pageNumbers: number[];
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredTextbookChunk = {
  id: string;
  materialId: string;
  sectionId: string;
  chapterId: string | null;
  subchapterId: string | null;
  chunkType: "content" | "exercise" | "summary";
  orderIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  charCount: number;
  pageNumbers: number[];
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type TextbookMaterialDetail = {
  material: StoredTextbookMaterial;
  pages: StoredTextbookPage[];
  sections: StoredTextbookSection[];
  chunks: StoredTextbookChunk[];
};

export type TextbookMaterialStructureDetail = {
  material: StoredTextbookMaterial;
  sections: StoredTextbookSection[];
};

export type CreateTextbookMaterialInput = {
  bucketName: string;
  key: string;
  fileName: string;
  contentType?: string | null;
  grade?: number | null;
  subject?: string | null;
  size?: number | null;
};

export type UpdateTextbookMaterialInput = {
  resetStoredContent?: boolean;
  title?: string | null;
  pageCount?: number | null;
  progressCurrent?: number | null;
  progressTotal?: number | null;
  status?: TextbookMaterialStatus;
  stage?: TextbookMaterialStage;
  statusMessage?: string | null;
  errorMessage?: string | null;
  warnings?: string[] | null;
  ocrNeededPageCount?: number | null;
  unsupportedReason?: string | null;
  readyAt?: string | null;
  lastProcessedAt?: string | null;
};

export type UpsertTextbookPagesInput = {
  pageCount?: number | null;
  progressCurrent?: number | null;
  progressTotal?: number | null;
  status?: TextbookMaterialStatus;
  stage?: TextbookMaterialStage;
  statusMessage?: string | null;
  ocrNeededPageCount?: number | null;
  pages: Array<{
    pageNumber: number;
    rawText: string;
    normalizedText: string;
    charCount: number;
    tokenCount: number;
    extractionStatus: "ready" | "ocr_needed";
  }>;
};

export type ReplaceTextbookStructureInput = {
  title?: string | null;
  pageCount?: number | null;
  progressCurrent?: number | null;
  progressTotal?: number | null;
  status?: TextbookMaterialStatus;
  stage?: TextbookMaterialStage;
  statusMessage?: string | null;
  warnings?: string[] | null;
  ocrNeededPageCount?: number | null;
  unsupportedReason?: string | null;
  sections: Array<{
    id: string;
    parentId?: string | null;
    nodeType: "chapter" | "section" | "subchapter";
    title: string;
    normalizedTitle: string;
    orderIndex: number;
    depth: number;
    startPage?: number | null;
    endPage?: number | null;
    childCount?: number | null;
    pageNumbers: number[];
    metadata?: Record<string, unknown> | null;
  }>;
  chunks: Array<{
    id: string;
    sectionId: string;
    chunkType: "content" | "exercise" | "summary";
    orderIndex: number;
    pageStart?: number | null;
    pageEnd?: number | null;
    charCount: number;
    pageNumbers: number[];
    text: string;
  }>;
};

export type ListTextbookMaterialsInput = {
  grade?: number | null;
  subject?: string | null;
  statuses?: Array<TextbookMaterialStatus | string> | null;
  limit?: number | null;
};

export type GetTextbookMaterialSelectionInput = {
  nodeIds: string[];
};
