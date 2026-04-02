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

export type TextbookUploadedAsset = {
  bucketName: string;
  contentType: string;
  fileName: string;
  key: string;
  size: number;
  uploadedAt: string;
};

export type TextbookMaterial = {
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

export type TextbookPageRecord = {
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

export type TextbookSectionRecord = {
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

export type TextbookChunkRecord = {
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
  material: TextbookMaterial;
  pages: TextbookPageRecord[];
  sections: TextbookSectionRecord[];
  chunks: TextbookChunkRecord[];
};

export type TextbookMaterialStructureDetail = {
  material: TextbookMaterial;
  sections: TextbookSectionRecord[];
};

export type TextbookSectionTreeNode = TextbookSectionRecord & {
  children: TextbookSectionTreeNode[];
};

export type TextbookProcessingPage = {
  pageNumber: number;
  rawText: string;
  normalizedText: string;
  charCount: number;
  tokenCount: number;
  extractionStatus: "ready" | "ocr_needed";
};

export type TextbookProcessingSection = {
  id: string;
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
};

export type TextbookProcessingChunk = {
  id: string;
  sectionId: string;
  chunkType: "content" | "exercise" | "summary";
  orderIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  charCount: number;
  pageNumbers: number[];
  text: string;
};

export type TextbookStructurePayload = {
  title: string;
  pageCount: number;
  progressCurrent?: number;
  progressTotal?: number;
  status: TextbookMaterialStatus;
  stage: TextbookMaterialStage;
  statusMessage: string;
  warnings: string[];
  ocrNeededPageCount: number;
  unsupportedReason: string | null;
  sections: TextbookProcessingSection[];
  chunks: TextbookProcessingChunk[];
};

export type TextbookWorkerRequest = {
  type: "process";
  payload: {
    fileName: string;
    file: File;
  };
};

export type TextbookWorkerResponse =
  | {
      type: "document-info";
      payload: {
        fileName: string;
        pageCount: number;
        title: string;
      };
    }
  | {
      type: "progress";
      payload: {
        current: number;
        total: number;
        message: string;
        ocrNeededPageCount: number;
      };
    }
  | {
      type: "pages-batch";
      payload: {
        current: number;
        total: number;
        pages: TextbookProcessingPage[];
        ocrNeededPageCount: number;
      };
    }
  | {
      type: "stage";
      payload: {
        stage: TextbookMaterialStage;
        message: string;
      };
    }
  | {
      type: "complete";
      payload: TextbookStructurePayload;
    }
  | {
      type: "error";
      payload: {
        message: string;
      };
    };

export type TextbookGenerateSelection = {
  effectiveNodeIds: string[];
  selectedSectionTitles: string[];
  selectedPageNumbers: number[];
};
