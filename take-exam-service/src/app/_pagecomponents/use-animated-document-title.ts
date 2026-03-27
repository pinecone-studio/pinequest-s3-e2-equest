"use client";

import { useEffect } from "react";

export function useAnimatedDocumentTitle(baseTitle: string) {
  useEffect(() => {
    const frames = [
      "📝   🧑‍💻   ✅",
      " ⏳   📝   📚",
      "  ✅   🎯   🧠",
      " 📖   📝   ✅",
      "  ✅   📚   🎯",
      " ⏳   ✅   📚",
    ];

    let frameIndex = 0;
    document.title = `${frames[frameIndex]} | ${baseTitle}`;

    const titleTimer = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      document.title = `${frames[frameIndex]} | ${baseTitle}`;
    }, 700);

    return () => {
      window.clearInterval(titleTimer);
      document.title = baseTitle;
    };
  }, [baseTitle]);
}
