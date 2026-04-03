const TITLE_BY_CODE: Record<string, string> = {
  "answer-revised": "Хариу өөрчилсөн",
  "answer-selected": "Хариулж эхэлсэн",
  "attempt-finalize": "Эцэслэн илгээсэн",
  "attempt-save": "Явц хадгалсан",
  "attempt-session-open": "Шалгалтын сесс эхэлсэн",
  "autosave-sync": "Автомат хадгалалт",
  connection_lost: "Холболт тасарсан",
  connection_restored: "Холболт сэргэсэн",
  "context-menu": "Баруун товшилт",
  "device_change_suspected": "Төхөөрөмж өөрчлөгдсөн",
  "devtools-suspected": "Хөгжүүлэгчийн хэрэгсэл",
  "fullscreen-exit": "Бүтэн дэлгэцээс гарсан",
  "fullscreen-not-active": "Бүтэн дэлгэц",
  heartbeat: "Холболтын шалгалт",
  "idle-45s": "Идэвхгүй байдал",
  "idle-90s": "Идэвхгүй байдал",
  "parallel-tab-suspected": "Өөр таб нээгдсэн",
  "question-flagged": "Асуулт тэмдэглэсэн",
  "question-revisit": "Асуулт руу буцсан",
  "question-unflagged": "Тэмдэглэгээ цуцалсан",
  "split-view-suspected": "Хуваасан дэлгэц",
  tab_hidden: "Табаас гарсан",
  tab_visible: "Таб руу буцсан",
  "viewport-resize-suspicious": "Цонхны хэмжээ огцом өөрчлөгдсөн",
  window_blur: "Фокус алдагдсан",
  window_focus: "Фокус сэргэсэн",
};

const TITLE_BY_LEGACY_TEXT: Record<string, string> = {
  "Answer activity": "Хариулж эхэлсэн",
  "Answer revised": "Хариу өөрчилсөн",
  "Another tab": "Өөр таб нээгдсэн",
  Autosave: "Автомат хадгалалт",
  Clipboard: "Хуулах/буулгах үйлдэл",
  "Connection lost": "Холболт тасарсан",
  "Connection restored": "Холболт сэргэсэн",
  "Context menu": "Баруун товшилт",
  DevTools: "Хөгжүүлэгчийн хэрэгсэл",
  Fullscreen: "Бүтэн дэлгэц",
  Heartbeat: "Холболтын шалгалт",
  Idle: "Идэвхгүй байдал",
  Inspect: "Хөгжүүлэгчийн хэрэгсэл",
  "Question flagged": "Асуулт тэмдэглэсэн",
  "Question revisit": "Асуулт руу буцсан",
  "Question unflagged": "Тэмдэглэгээ цуцалсан",
  "Save progress": "Явц хадгалсан",
  "Session open": "Шалгалтын сесс эхэлсэн",
  Shortcut: "Товчлол ашигласан",
  "Split view": "Хуваасан дэлгэц",
  "Tab hidden": "Табаас гарсан",
  "Tab visible": "Таб руу буцсан",
  Viewport: "Цонхны хэмжээ",
  "Window blur": "Фокус алдагдсан",
  "Window focus": "Фокус сэргэсэн",
  "Window resize": "Цонхны хэмжээ огцом өөрчлөгдсөн",
};

export function localizeMonitoringEventTitle(
  code?: string | null,
  title?: string | null,
) {
  const normalizedCode = code?.trim() ?? "";
  const normalizedTitle = title?.trim() ?? "";

  if (normalizedCode) {
    if (normalizedCode.startsWith("clipboard-")) {
      const action = normalizedCode.replace("clipboard-", "");
      if (action === "copy") return "Хуулах үйлдэл";
      if (action === "cut") return "Таслах үйлдэл";
      if (action === "paste") return "Буулгах үйлдэл";
      return "Хуулах/буулгах үйлдэл";
    }

    if (normalizedCode.startsWith("shortcut-")) {
      return normalizedTitle === "Inspect"
        ? "Хөгжүүлэгчийн хэрэгсэл"
        : "Товчлол ашигласан";
    }

    if (normalizedCode.startsWith("viewport-breakpoint-")) {
      return "Цонхны хэмжээ өөрчлөгдсөн";
    }

    const localizedByCode = TITLE_BY_CODE[normalizedCode];
    if (localizedByCode) {
      return localizedByCode;
    }
  }

  if (!normalizedTitle) {
    return "Үйлдэл";
  }

  return TITLE_BY_LEGACY_TEXT[normalizedTitle] ?? normalizedTitle;
}
