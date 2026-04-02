"use client";

import { ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { renderTextbookPdfPagePreview } from "./pdf-page-preview-cache";
import type { TextbookUploadedAsset } from "./types";

type PreviewItem = {
  pageNumber: number;
  url: string;
};

type Props = {
  asset: TextbookUploadedAsset | null;
  file?: File | null;
  pageNumbers: number[];
};

function uniquePageNumbers(values: number[]) {
  return Array.from(
    new Set(
      values
        .map((value) => Math.trunc(Number(value)))
        .filter((value) => Number.isFinite(value) && value >= 1),
    ),
  ).sort((left, right) => left - right);
}

export function TextbookSourcePagePreview({
  asset,
  file = null,
  pageNumbers,
}: Props) {
  const normalizedPages = useMemo(
    () => uniquePageNumbers(pageNumbers).slice(0, 2),
    [pageNumbers],
  );
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (normalizedPages.length === 0) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    Promise.all(
      normalizedPages.map(async (pageNumber) => ({
        pageNumber,
        url: await renderTextbookPdfPagePreview({
          asset,
          file,
          maxWidth: 420,
          pageNumber,
        }),
      })),
    )
      .then((nextItems) => {
        if (cancelled) {
          return;
        }
        setItems(nextItems);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [asset, file, normalizedPages]);

  if (normalizedPages.length === 0) {
    return null;
  }

  if (isLoading && items.length === 0) {
    return (
      <div className="rounded-[12px] border border-[#e2e8f0] bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          Эх хуудасны зургийг бэлдэж байна...
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[12px] border border-[#e2e8f0] bg-white px-4 py-3">
      <div className="mb-3 flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.08em] text-slate-500">
        <ImageIcon className="h-4 w-4" />
        Эх Хуудасны Зураг
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.pageNumber}
            className="overflow-hidden rounded-[12px] border border-[#dbe4f3] bg-[#f8fbff]"
          >
            <img
              src={item.url}
              alt={`Source page ${item.pageNumber}`}
              className="block h-auto max-h-[320px] w-full object-contain bg-white"
              loading="lazy"
            />
            <div className="border-t border-[#dbe4f3] px-3 py-2 text-[12px] text-slate-600">
              Хуудас {item.pageNumber}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
