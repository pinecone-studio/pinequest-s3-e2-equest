"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TestShell } from "../../_components/test-shell";
import { GeneralInfoSection } from "./general-info-section";
import { ImportSection } from "./import-section";
import { MaterialBuilderWorkspaceSection } from "./material-builder-workspace-section";
import { QuestionBankSection } from "./question-bank-section";
import { SharedLibrarySection } from "./shared-library-section";
import { TextbookSection } from "./textbook-section";
import {
  sourceOptions,
  sharedLibraryMaterials,
  type MaterialSourceId,
} from "./material-builder-config";

export default function MaterialBuilderPageContent() {
  const [source, setSource] = useState<MaterialSourceId>("question-bank");
  const [selectedSharedMaterialId, setSelectedSharedMaterialId] =
    useState<string>(sharedLibraryMaterials[0]?.id ?? "");

  return (
    <TestShell
      title="Шалгалтын материал үүсгэх"
      description="Шалгалтын ерөнхий мэдээлэл, материалын эх сурвалж, хугацааг эндээс тохируулна."
      contentClassName="bg-[#eef3ff] px-6 py-0 sm:px-8 lg:px-10"
    >
      <div className="min-h-[calc(100vh-3rem)] w-full pb-10 pt-1">
        <GeneralInfoSection />
        <Tabs
          value={source}
          onValueChange={(value) => setSource(value as MaterialSourceId)}
          className="mt-5 gap-0"
        >
          <TabsList className="h-auto gap-0 rounded-none bg-transparent p-0 text-slate-500">
            {sourceOptions.map((option, index) => {
              const Icon = option.icon;
              const isFirst = index === 0;
              const isLast = index === sourceOptions.length - 1;

              return (
                <TabsTrigger
                  key={option.id}
                  value={option.id}
                  className={`relative h-[50px] rounded-b-none border border-[#d9e1ee] border-b-0 bg-[#edf2fa] px-5 text-[14px] font-semibold text-slate-500 shadow-none transition-all hover:bg-[#f4f7fc] hover:text-slate-700 data-[state=active]:z-10 data-[state=active]:bg-white data-[state=active]:text-[#0b5cab] data-[state=active]:shadow-none ${isFirst ? "rounded-tl-[18px]" : "-ml-px"} ${isLast ? "rounded-tr-[18px]" : ""}`}
                >
                  <Icon className="h-4 w-4 text-current" />
                  {option.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent
            value="question-bank"
            className="-mt-px rounded-b-[18px] rounded-tr-[18px] border border-[#d9e1ee] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
          >
            <QuestionBankSection />
          </TabsContent>

          <TabsContent
            value="textbook"
            className="-mt-px rounded-b-[18px] rounded-tr-[18px] border border-[#d9e1ee] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
          >
            <TextbookSection />
          </TabsContent>

          <TabsContent
            value="import"
            className="-mt-px rounded-b-[18px] rounded-tr-[18px] border border-[#d9e1ee] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
          >
            <ImportSection />
          </TabsContent>

          <TabsContent
            value="shared-library"
            className="-mt-px rounded-b-[18px] rounded-tr-[18px] border border-[#d9e1ee] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
          >
            <SharedLibrarySection
              selectedMaterialId={selectedSharedMaterialId}
              onSelectMaterialId={setSelectedSharedMaterialId}
            />
          </TabsContent>
        </Tabs>

        <MaterialBuilderWorkspaceSection
          source={source}
          onSourceChange={setSource}
          selectedSharedMaterialId={selectedSharedMaterialId}
          onSelectMaterialId={setSelectedSharedMaterialId}
        />

        <div className="flex items-center justify-end pt-10">
          <Button className="h-[42px] min-w-[128px] rounded-[10px] bg-[#0b5cab] px-7 text-[15px] font-semibold shadow-[0_8px_18px_rgba(11,92,171,0.25)] hover:bg-[#0a4f96]">
            {source === "shared-library"
              ? "Сонгосон материалыг ашиглах"
              : "Хадгалах"}
          </Button>
        </div>
      </div>
    </TestShell>
  );
}
