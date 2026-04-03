"use client";

import { Suspense } from "react";
import MaterialBuilderPageContent from "./_components/material-builder-page-content";

function MaterialBuilderFallback() {
  return (
    <div className="min-h-screen bg-[#F1F4FA]" aria-busy="true" aria-label="Ачааллаж байна" />
  );
}

export default function MaterialBuilderPage() {
  return (
    <Suspense fallback={<MaterialBuilderFallback />}>
      <MaterialBuilderPageContent />
    </Suspense>
  );
}
