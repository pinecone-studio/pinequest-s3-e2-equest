"use client";

import { BookOpen, Download, FileText, ArrowRight } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import type {
  TextbookMaterialStage,
  TextbookMaterialStatus,
  TextbookUploadedAsset,
} from "@/features/textbook-processing/types";
import { importOptions } from "./material-builder-config";

export type ImportedTextbookCard = {
  createdAt: string;
  errorMessage?: string | null;
  file?: File | null;
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

type ImportSectionProps = {
  activeImportId?: string | null;
  importedTextbooks?: ImportedTextbookCard[];
  onOpenImportedTextbook?: (importId: string) => void;
  onTextbookPicked?: (file: File) => void;
};

function getActionLabel(item: ImportedTextbookCard, isActive: boolean) {
  if (item.materialStatus === "ready" || item.materialStatus === "ocr_needed") {
    return isActive ? "Доор нээсэн" : "Доор нээх";
  }

  if (item.materialStatus === "processing" || item.materialStatus === "uploaded") {
    return isActive ? "Доор боловсруулж байна" : "Явц харах";
  }

  if (item.materialStatus === "error") {
    return isActive ? "Доор алдаа гарсан" : "Доор шалгах";
  }

  return isActive ? "Доор нээсэн" : "Доор нээх";
}

export function ImportSection({
  activeImportId = null,
  importedTextbooks = [],
  onOpenImportedTextbook,
  onTextbookPicked,
}: ImportSectionProps) {
  const textbookInputRef = useRef<HTMLInputElement | null>(null);

  function handleOptionClick(optionId: string) {
    if (optionId === "textbook") {
      textbookInputRef.current?.click();
      return;
    }

    toast.message("Энэ импортын төрөл удахгүй холбогдоно.");
  }

  return (
    <section className="mt-5 rounded-[18px] border border-[#e3e9f4] bg-white px-5 py-8 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:px-6">
      <div className="mb-8 flex items-center gap-3 text-[15px] font-semibold text-slate-900">
        <Download className="h-5 w-5 text-[#2563eb]" />
        Файл
      </div>

      <input
        ref={textbookInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (!file) {
            return;
          }
          onTextbookPicked?.(file);
          event.currentTarget.value = "";
        }}
      />

      <div>
        <p className="mb-5 text-[18px] font-medium text-slate-900">Файл оруулах</p>

        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          {importOptions.map((option) => {
            const Icon = option.icon;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleOptionClick(option.id)}
                className="flex h-[48px] w-full items-center gap-4 rounded-[12px] border border-[#d9e2f2] bg-[#eef3ff] px-4 text-left text-[16px] font-medium text-slate-800 transition hover:bg-[#e7efff]"
              >
                <Icon className="h-5 w-5 text-slate-900" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {importedTextbooks.length > 0 ? (
        <div className="mt-8">
          <p className="mb-4 text-[18px] font-medium text-slate-900">
            Оруулсан номууд
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {importedTextbooks.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenImportedTextbook?.(item.id)}
                className={`flex items-start justify-between gap-4 rounded-[16px] px-4 py-4 text-left transition hover:bg-white hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)] ${
                  activeImportId === item.id
                    ? "border border-[#9fc4ff] bg-white shadow-[0_10px_24px_rgba(37,99,235,0.10)]"
                    : "border border-[#d9e2f2] bg-[#f8fbff] hover:border-[#cfe1ff]"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 shrink-0 text-[#2563eb]" />
                    <p className="truncate text-[16px] font-semibold text-slate-900">
                      {item.title}
                    </p>
                  </div>
                  <p className="mt-2 truncate text-[13px] text-slate-500">
                    {item.fileName}
                  </p>
                  <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#dbe4f3] bg-white px-3 py-1 text-[12px] text-[#215da8]">
                    <FileText className="h-3.5 w-3.5" />
                    {getActionLabel(item, activeImportId === item.id)}
                  </p>
                  <p className="mt-2 text-[12px] text-slate-500">
                    Энэ хэсгийн доор upload, progress, боловсруулалт эхэлнэ.
                  </p>
                </div>

                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
