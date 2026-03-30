/**
 * «Intelligent Buffer» — AI ачаалал + давхаргын дараагийн түвшний бодлого.
 * Шалгалтаас цааш: давтлага/секц товлоход багш + сурагч хоёул сул байх шаардлагатай.
 *
 * **Нэг Scheduling Engine, хоёр Intent** (шалгалт vs давтлага/секц) — яагаад нэг AI байх ёстой:
 * @see ./schedulingEngineIntent.ts
 */

import type { AncillaryActivityGroup } from "./calendarLayerTaxonomy";

/** Зөөхөд баталгаажуулах шатны хатуулаг. */
export type MovePriority = "high" | "medium" | "low";

/** Үндсэн хуваарь: зөвхөн админ засах (багшид drag хориглох). */
export const POLICY_PRIMARY_TIMETABLE_READONLY = true;

/**
 * Үйл төрлөөр: зөөхөд double-check шаардлагатай эсэх.
 * Хурал, баталгаажсан шалгалт — high; давтлага, секц — medium/low.
 */
export const MOVE_PRIORITY_BY_CONTEXT: Record<
  | "confirmed_exam"
  | "school_meeting"
  | "school_event"
  | "tutorial"
  | "section"
  | "counselor"
  | "class_hour",
  MovePriority
> = {
  confirmed_exam: "high",
  school_meeting: "high",
  school_event: "high",
  tutorial: "low",
  section: "medium",
  counselor: "medium",
  class_hour: "medium",
};

/** Ancillary бүлэг → ерөнхий зөөхийн уян хатан байдал. */
export const MOVE_PRIORITY_BY_ANCILLARY_GROUP: Record<
  AncillaryActivityGroup,
  MovePriority
> = {
  school_admin: "high",
  academic_fixed: "medium",
  extra_curricular: "low",
};

/**
 * Ачааллын зөвлөмж (AI prompt / rule engine).
 * Жишээ: өдөрт олон цагийн хичээлийн дараа оройн давтлага санал болгохгүй.
 */
export const WORKLOAD_RULES = {
  /** Нэг өдөрт «үндсэн хичээл»-ийн тооцоолсон дээд цаг — түүнээс дээш бол оройн давтлага draft хасна. */
  maxPrimaryHoursPerDayBeforeBlockEveningTutorial: 6,
  /** Орой гэж тооцох эхлэл (цагийн тэмдэг). */
  eveningAfterHour: 17,
} as const;

/** Conflict layer: зөвлөх цагийг үндсэн хичээл дээр давхаруулбал pulse (UI токен). */
export const CONFLICT_LAYER_ON_ILLEGAL_MOVE = {
  pulseClass: "animate-pulse",
  swatch: "bg-rose-500",
} as const;

/**
 * Хоосон сул цаг дээр урьдчилсан визуал hint (ирээдүйн UI).
 * `globals.css` → `.calendar-smart-slot-hint`
 */
export const SMART_EMPTY_SLOT = {
  cssClass: "calendar-smart-slot-hint",
  /** Ямар нөхцөлд hint харуулах (жишээ) */
  whenHintEligible:
    "Багш + сурагч хоёул сул, улаан бүс биш, өдрийн ачаалал дээд хэмжээнээс доош",
} as const;

/** AI хүсэлтийн төрөл (шалгалтаас өргөн). */
export type AiSchedulingIntent =
  | "exam_slot"
  | "tutorial_hours"
  | "section_block"
  | "workload_optimize";

export const AI_SCHEDULING_INTENT: Record<
  AiSchedulingIntent,
  { labelMn: string; needsStudentAvailability: boolean }
> = {
  exam_slot: {
    labelMn: "Шалгалтын цаг",
    needsStudentAvailability: true,
  },
  tutorial_hours: {
    labelMn: "Давтлага (цагийн тоо)",
    needsStudentAvailability: true,
  },
  section_block: {
    labelMn: "Секцийн блок",
    needsStudentAvailability: true,
  },
  workload_optimize: {
    labelMn: "Өдрийн ачааллын зөвлөмж",
    needsStudentAvailability: false,
  },
};

/** PineQuest AI таб — замын зураг (UI-д богино жагсаалт). */
export const INTELLIGENT_BUFFER_ROADMAP_MN: readonly string[] = [
  "Давтлага/секц: багш + ангийн сул цагийг хамтад нь шалгаад ai_draft дээр санал.",
  "Зөөхөд: хурал/шалгалт — өндөр эрхтэй (баталгаажуулалт), давтлага — уян хатан.",
  "Сул цаг: урьдчилсан dashed hint (ирээдүй) — төлөвлөхөд визуал заавар.",
  "Үндсэн хичээл: read-only (админ), давтлага/зөвлөхийг багш drag-and-drop.",
  "Ачаалал: «6 цагийн дараа оройн давтлага битгий» гэх мэт AI зөвлөмж.",
] as const;
