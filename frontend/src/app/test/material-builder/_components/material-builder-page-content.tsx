"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TestShell } from "../../_components/test-shell";
import { GeneralInfoSection } from "./general-info-section";
import { MaterialBuilderWorkspaceSection } from "./material-builder-workspace-section";
import {
  sharedLibraryMaterials,
  type MaterialSourceId,
} from "./material-builder-config";

export default function MaterialBuilderPageContent() {
  const [source, setSource] = useState<MaterialSourceId>("question-bank");
  const [selectedSharedMaterialId, setSelectedSharedMaterialId] =
    useState<string>(sharedLibraryMaterials[0]?.id ?? "");
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [variantCount, setVariantCount] = useState("2");

  return (
    <TestShell
      title="Шалгалтын материал үүсгэх"
      description="Шалгалтын ерөнхий мэдээлэл, материалын эх сурвалж, хугацааг эндээс тохируулна."
      contentClassName="bg-[#eef3ff] px-6 py-0 sm:px-8 lg:px-10"
    >
      <div className="min-h-[calc(100vh-3rem)] w-full pb-10 pt-1">
        <GeneralInfoSection />
        <MaterialBuilderWorkspaceSection
          source={source}
          onSourceChange={setSource}
          selectedSharedMaterialId={selectedSharedMaterialId}
          onSelectMaterialId={setSelectedSharedMaterialId}
        />

        <div className="flex items-center justify-end gap-3 pt-10">
          <Button
            variant="outline"
            onClick={() => setVariantDialogOpen(true)}
            className="h-[42px] min-w-[148px] rounded-[10px] border-[#cfe0fb] bg-white px-6 text-[15px] font-semibold text-[#0b5cab] shadow-[0_6px_14px_rgba(148,163,184,0.12)] hover:border-[#b7cff8] hover:bg-[#f7faff]"
          >
            Хувилбар нэмэх
          </Button>
          <Button className="h-[42px] min-w-[128px] rounded-[10px] bg-[#0b5cab] px-7 text-[15px] font-semibold shadow-[0_8px_18px_rgba(11,92,171,0.25)] hover:bg-[#0a4f96]">
            {source === "shared-library"
              ? "Сонгосон материалыг ашиглах"
              : "Хадгалах"}
          </Button>
        </div>

        <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
          <DialogContent className="max-w-[min(100vw-2rem,28rem)] gap-0 overflow-hidden rounded-[24px] border border-[#dfe7f3] bg-white p-0 shadow-[0_30px_80px_-28px_rgba(15,23,42,0.28)]">
            <DialogHeader className="border-b border-[#e9eef6] px-5 py-4">
              <DialogTitle className="text-[18px] font-semibold text-slate-900">
                Хувилбарын тоо
              </DialogTitle>
              <DialogDescription className="text-[14px] text-slate-500">
                Нэмэх хувилбарын тоог оруулна уу.
              </DialogDescription>
            </DialogHeader>

            <div className="px-5 py-6">
              <Input
                type="number"
                min="1"
                step="1"
                value={variantCount}
                onChange={(event) => setVariantCount(event.target.value)}
                placeholder="Жишээ нь: 2"
                className="h-[48px] rounded-[14px] border-[#d7e3f5] bg-[#f8fbff] px-4 text-[15px] shadow-none"
              />
            </div>

            <DialogFooter className="mx-0 mb-0 rounded-b-[24px] border-t border-[#e9eef6] bg-white px-5 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVariantDialogOpen(false)}
                className="rounded-[12px] border-[#d7e3f5] bg-white px-5 hover:bg-slate-50"
              >
                Болих
              </Button>
              <Button
                type="button"
                onClick={() => setVariantDialogOpen(false)}
                className="rounded-[12px] bg-[#0b5cab] px-5 hover:bg-[#0a4f96]"
              >
                AI хувилбар үүсгэх
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TestShell>
  );
}
