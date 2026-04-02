"use client";

import { useCallback, useEffect, useState } from "react";
import { listTextbookMaterialLibrary, type MaterialBuilderSubject } from "./api";
import type { TextbookMaterial } from "./types";

const DEFAULT_LIBRARY_STATUSES = [
  "ready",
  "ocr_needed",
  "processing",
  "uploaded",
  "error",
] as const;

export function useTextbookMaterialLibrary({
  grade,
  subject,
}: {
  grade: number;
  subject: MaterialBuilderSubject;
}) {
  const [items, setItems] = useState<TextbookMaterial[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await listTextbookMaterialLibrary({
        grade,
        limit: 24,
        statuses: [...DEFAULT_LIBRARY_STATUSES],
        subject,
      });
      setItems(response.items || []);
    } catch (nextError) {
      setItems([]);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Сурах бичгийн санг ачаалж чадсангүй.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [grade, subject]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    error,
    isLoading,
    items,
    refresh: load,
  };
}
