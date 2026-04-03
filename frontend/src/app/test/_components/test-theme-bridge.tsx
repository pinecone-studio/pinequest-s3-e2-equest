"use client";

import { useLayoutEffect } from "react";
import { useTheme } from "next-themes";

const THEME_STORAGE_KEY = "theme";

export function TestThemeBridge() {
  const { setTheme } = useTheme();

  useLayoutEffect(() => {
    const previousTheme =
      window.localStorage.getItem(THEME_STORAGE_KEY) ?? "system";

    setTheme("light");

    return () => {
      setTheme(previousTheme);
    };
  }, [setTheme]);

  return null;
}
