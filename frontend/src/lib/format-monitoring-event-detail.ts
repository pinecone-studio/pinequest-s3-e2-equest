type MonitoringEventMetadata = {
  changedFields?: unknown;
  fingerprintHash?: unknown;
  mode?: unknown;
  online?: unknown;
  sessionId?: unknown;
};

const changedFieldLabels: Record<string, string> = {
  language: "хэл",
  platform: "төхөөрөмж",
  screen: "дэлгэцийн хэмжээ",
  sessionId: "сесс",
  timezone: "цагийн бүс",
  userAgent: "хөтөч",
};

function parseMonitoringEventMetadata(detail?: string | null) {
  const trimmed = detail?.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as MonitoringEventMetadata)
      : null;
  } catch {
    return null;
  }
}

export function formatMonitoringModeLabel(mode?: string | null) {
  switch (mode) {
    case "screen-capture-enabled":
      return "Дэлгэцийн зураг авалт";
    case "fallback-dom-capture":
      return "Нөөц хуудасны зураг авалт";
    case "limited-monitoring":
      return "Хязгаарлагдмал хяналт";
    default:
      return null;
  }
}

function formatChangedFields(fields: unknown) {
  if (!Array.isArray(fields)) {
    return null;
  }

  const labels = fields
    .filter((field): field is string => typeof field === "string")
    .map((field) => changedFieldLabels[field] ?? field)
    .filter(Boolean);

  return labels.length > 0 ? labels.join(", ") : null;
}

function isMonitoringMetadata(
  metadata: MonitoringEventMetadata | null,
): metadata is MonitoringEventMetadata {
  return Boolean(
    metadata &&
      ("online" in metadata ||
        "sessionId" in metadata ||
        "fingerprintHash" in metadata ||
        "changedFields" in metadata),
  );
}

export function formatMonitoringEventDetail({
  code,
  detail,
  mode,
}: {
  code?: string | null;
  detail?: string | null;
  mode?: string | null;
}) {
  const trimmed = detail?.trim() ?? "";
  const metadata = parseMonitoringEventMetadata(trimmed);
  const resolvedMode =
    typeof metadata?.mode === "string" ? metadata.mode : (mode ?? undefined);
  const modeLabel = formatMonitoringModeLabel(resolvedMode);

  switch (code) {
    case "attempt-finalize":
      return "Шалгалтыг амжилттай илгээж дуусгасан.";
    case "connection_lost":
      return "Интернэт холболт тасарсан байна.";
    case "connection_restored":
      return "Интернэт холболт дахин сэргэж хэвийн болсон.";
    case "heartbeat":
      if (metadata?.online === false) {
        return modeLabel
          ? `Холболтын шалгалт хийгдлээ. Одоогоор сүлжээ тасарсан байна. Хяналтын горим: ${modeLabel}.`
          : "Холболтын шалгалт хийгдлээ. Одоогоор сүлжээ тасарсан байна.";
      }

      return modeLabel
        ? `Холболтын шалгалт амжилттай. Сүлжээ хэвийн байна. Хяналтын горим: ${modeLabel}.`
        : "Холболтын шалгалт амжилттай. Сүлжээ хэвийн байна.";
    case "tab_hidden":
    case "window_blur":
      return "Шалгалтын табаас гарсан эсвэл өөр цонх руу шилжсэн.";
    case "tab_visible":
    case "window_focus":
      return "Шалгалтын таб руу буцаж орсон.";
    case "split-view-suspected":
    case "device_change_suspected":
    case "parallel-tab-suspected": {
      const changedFields = formatChangedFields(metadata?.changedFields);
      return changedFields
        ? `Төхөөрөмжийн мэдээлэл өөрчлөгдсөн байж болзошгүй (${changedFields}).`
        : "Олон цонх эсвэл хуваасан дэлгэц ашигласан байж болзошгүй.";
    }
    case "fullscreen-not-active":
    case "fullscreen-exit":
    case "viewport-resize-suspicious":
      return "Шалгалтын цонх жижигэрсэн эсвэл бүтэн дэлгэцээс гарсан.";
    default:
      break;
  }

  if (code?.includes("devtools")) {
    return "Хөгжүүлэгчийн хэрэгсэл нээсэн байж болзошгүй.";
  }

  if (code?.startsWith("shortcut")) {
    return "Сэжигтэй хос товчийн үйлдэл илэрлээ.";
  }

  if (isMonitoringMetadata(metadata)) {
    return modeLabel
      ? `Системийн хяналтын мэдээлэл бүртгэгдлээ. Хяналтын горим: ${modeLabel}.`
      : "Системийн хяналтын мэдээлэл бүртгэгдлээ.";
  }

  return trimmed;
}
