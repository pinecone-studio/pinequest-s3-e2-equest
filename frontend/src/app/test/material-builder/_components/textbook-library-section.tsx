"use client";

import { ArrowRight, BookOpen, Clock3, FileText } from "lucide-react";
import { getStageLabel } from "@/features/textbook-processing/status";
import type { ImportedTextbookCard } from "./import-section";

type Props = {
  activeId?: string | null;
  isLoading?: boolean;
  items: ImportedTextbookCard[];
  onSelect?: (importId: string) => void;
};

function getCardBadge(item: ImportedTextbookCard) {
  if (item.materialStatus === "ready") {
    return "Бэлэн";
  }

  if (item.materialStatus === "ocr_needed") {
    return "OCR хэрэгтэй";
  }

  if (item.materialStatus === "error") {
    return "Алдаа";
  }

  if (item.materialStage) {
    return getStageLabel(item.materialStage);
  }

  if (item.uploadedAsset) {
    return "Хадгалсан";
  }

  return "Хүлээгдэж байна";
}

function canOpenSections(item: ImportedTextbookCard) {
  return Boolean(item.materialId || item.uploadedAsset);
}

function getActionLabel(item: ImportedTextbookCard) {
  if (item.materialStatus === "ready" || item.materialStatus === "ocr_needed") {
    return "Бүлэг, дэд бүлэг харах";
  }

  if (item.materialStatus === "processing" || item.materialStatus === "uploaded") {
    return "Боловсруулалтыг үргэлжлүүлэх";
  }

  if (item.materialStatus === "error") {
    return "Дахин ачаалж шалгах";
  }

  return "Материалыг нээх";
}

export function TextbookLibrarySection({
  activeId = null,
  isLoading = false,
  items,
  onSelect,
}: Props) {
  const visibleItems = items.filter((item) => item.uploadedAsset || item.materialId);

  return (
    <section className="mt-5 rounded-[18px] border border-[#e3e9f4] bg-white px-5 py-8 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:px-6">
      <div className="mb-6 flex items-center gap-3 text-[15px] font-semibold text-slate-900">
        <BookOpen className="h-5 w-5 text-[#2563eb]" />
        Сурах бичгийн сан
      </div>

      {visibleItems.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-[#dbe4f3] bg-[#f8fbff] px-5 py-6 text-[14px] leading-6 text-slate-500">
          {isLoading
            ? "Хадгалсан сурах бичгүүдийг ачаалж байна..."
            : "Импорт хийсэн эсвэл өмнө нь боловсруулсан номууд энд харагдана."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleItems.map((item) => {
            const openable = canOpenSections(item);
            const isActive = activeId === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect?.(item.id)}
                className={`flex items-start justify-between gap-4 rounded-[18px] px-4 py-4 text-left transition ${
                  isActive
                    ? "border border-[#9fc4ff] bg-white shadow-[0_10px_24px_rgba(37,99,235,0.10)]"
                    : "border border-[#d9e2f2] bg-[#f8fbff] hover:border-[#cfe1ff] hover:bg-white hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 shrink-0 text-[#2563eb]" />
                    <p className="truncate text-[16px] font-semibold text-slate-900">
                      {item.title}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                    <span className="rounded-full border border-[#dbe4f3] bg-white px-3 py-1 text-[#215da8]">
                      {getCardBadge(item)}
                    </span>
                    {typeof item.pageCount === "number" && item.pageCount > 0 ? (
                      <span className="rounded-full border border-[#e6edf7] bg-white px-3 py-1">
                        {item.pageCount} хуудас
                      </span>
                    ) : null}
                    {typeof item.sectionCount === "number" && item.sectionCount > 0 ? (
                      <span className="rounded-full border border-[#e6edf7] bg-white px-3 py-1">
                        {item.sectionCount} сэдэв
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 truncate text-[13px] text-slate-500">
                    {item.fileName}
                  </p>

                  <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#dbe4f3] bg-white px-3 py-1 text-[12px] text-[#215da8]">
                    {openable ? (
                      <>
                        <FileText className="h-3.5 w-3.5" />
                        {getActionLabel(item)}
                      </>
                    ) : (
                      <>
                        <Clock3 className="h-3.5 w-3.5" />
                        Боловсруулалт дуусахыг хүлээнэ үү
                      </>
                    )}
                  </p>

                  {item.errorMessage ? (
                    <p className="mt-2 text-[12px] text-[#8a5a13]">
                      {item.errorMessage}
                    </p>
                  ) : null}
                </div>

                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
