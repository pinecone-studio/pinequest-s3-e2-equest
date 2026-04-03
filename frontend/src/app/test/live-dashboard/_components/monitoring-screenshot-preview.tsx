"use client";

import { useState } from "react";
import { Camera, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MonitoringScreenshotPreviewProps = {
  capturedAtLabel?: string;
  screenshotUrl: string;
  title?: string;
  triggerClassName?: string;
  triggerLabel?: string;
};

export function MonitoringScreenshotPreview({
  capturedAtLabel,
  screenshotUrl,
  title = "Бүртгэгдсэн дэлгэцийн зураг",
  triggerClassName,
  triggerLabel = "Screenshot",
}: MonitoringScreenshotPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary",
          triggerClassName,
        )}
      >
        <Camera className="h-3 w-3" />
        {triggerLabel}
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl border-[#dbe4f3] bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <DialogHeader className="border-b border-[#eef2f7] px-6 pb-4 pt-6">
            <DialogTitle className="text-left text-[20px] font-semibold text-slate-900">
              {title}
            </DialogTitle>
            <DialogDescription className="flex items-center justify-between gap-3 text-left text-[13px] text-slate-500">
              <span>
                {capturedAtLabel
                  ? `Авсан огноо: ${capturedAtLabel}`
                  : "Дэлгэцийн зураг томруулсан харагдац"}
              </span>
              <a
                href={screenshotUrl}
                rel="noreferrer"
                target="_blank"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#dbe4f3] bg-white px-3 py-1 text-[11px] font-medium text-[#0b5cab] transition-colors hover:bg-[#eff6ff]"
              >
                <ExternalLink className="h-3 w-3" />
                Шинэ tab
              </a>
            </DialogDescription>
          </DialogHeader>

          <div className="px-4 py-4 sm:px-6 sm:py-6">
            <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-[20px] border border-[#dbe4f3] bg-[#0f172a] p-3">
              <img
                src={screenshotUrl}
                alt={title}
                className="max-h-[75vh] w-auto max-w-full rounded-[14px] object-contain"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
