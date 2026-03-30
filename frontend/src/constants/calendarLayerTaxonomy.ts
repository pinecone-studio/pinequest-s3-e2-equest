/**
 * Давхарга + дагалдах үйл ажиллагааны стратеги (hard/soft, static/dynamic).
 * DB / GraphQL / AI draft урсгалд нэг эх үүсвэр болно.
 */

import type { SchoolEventLayerKind } from "@/types/schoolCalendar";

/** Хуанлийн блокыг шалгалт төлөвлөхөд: хөдөлгөхгүй vs уян хатан. */
export type ConstraintKind = "hard" | "soft";

/** Глобал тренд: үндсэн хичээлээс тусдаа бүлэглэлт. */
export type AncillaryActivityGroup =
  | "academic_fixed"
  | "extra_curricular"
  | "school_admin";

/** Өгөгдөл хэр өөрчлөгддөг вэ (бодлогын тайлбар). */
export type DataDynamism = "static" | "semi_dynamic" | "dynamic";

export type AncillaryActivityProfile = {
  /** Mock / UI-д гарчигтай тааруулах түлхүүр үг */
  labelKeys: readonly string[];
  group: AncillaryActivityGroup;
  /** Анхны constraint — багш өөрчилж болох эсэх (soft) */
  defaultConstraint: ConstraintKind;
  dynamism: DataDynamism;
  /**
   * Аль давхаргад уялдуулах вэ (одоогийн архитектур).
   * - primary: багшийн хуваарийн duty (amber) — Зөвлөх, Анги уд, Секц, Давтлага
   * - school_event: бүх багшид нэгэн зэрэг нэвтрэх захиргааны хурал
   * - ai_draft: сул цаг дээр санал (Секц/Давтлага улиралд)
   */
  preferredLayerBinding: "primary" | "school_event" | "ai_draft";
  notesMn: string;
};

/**
 * Дагалдах үйл ажиллагаа — төрөл бүрийн өгөгдлийн шинж.
 * (title-д `startsWith` / `includes` зэргээр тааруулж болно.)
 */
export const ANCILLARY_ACTIVITY_REGISTRY: readonly AncillaryActivityProfile[] =
  [
    {
      labelKeys: ["Зөвлөх", "Зөвлөх цаг"],
      group: "academic_fixed",
      defaultConstraint: "hard",
      dynamism: "semi_dynamic",
      preferredLayerBinding: "primary",
      notesMn:
        "Ихэвчлэн тогтмол; гэхдээ гадуур явах үед зөөвөрлөх (drag) эсвэл soft болгоно.",
    },
    {
      labelKeys: ["Анги уд"],
      group: "academic_fixed",
      defaultConstraint: "hard",
      dynamism: "semi_dynamic",
      preferredLayerBinding: "primary",
      notesMn:
        "Үндсэн хичээл шиг харагдах; багш өөрөө цаг солих тохиолдолд soft draft.",
    },
    {
      labelKeys: ["Секц", "Секц/"],
      group: "extra_curricular",
      defaultConstraint: "soft",
      dynamism: "semi_dynamic",
      preferredLayerBinding: "ai_draft",
      notesMn:
        "Улирал, олимпын үеэр идэвхжинэ; AI нь сул цаг дээр draft санал өгнө.",
    },
    {
      labelKeys: ["Давтлага"],
      group: "extra_curricular",
      defaultConstraint: "soft",
      dynamism: "semi_dynamic",
      preferredLayerBinding: "ai_draft",
      notesMn:
        "Шалгалтын өмнө уртасах тохиолдол байна; санал + батлах урсгал.",
    },
    {
      labelKeys: ["Хурал"],
      group: "school_admin",
      defaultConstraint: "hard",
      dynamism: "dynamic",
      preferredLayerBinding: "school_event",
      notesMn:
        "Долоо хоног бүр өөр — админ бүх багшийн хуваарь руу school_event layer-ээр оруулна.",
    },
    {
      labelKeys: ["Дугуйлан"],
      group: "extra_curricular",
      defaultConstraint: "soft",
      dynamism: "semi_dynamic",
      preferredLayerBinding: "primary",
      notesMn: "Секцтой ижил зарчим — улирлаас хамаарна.",
    },
    {
      labelKeys: ["Цэвэрлэгээ"],
      group: "school_admin",
      defaultConstraint: "hard",
      dynamism: "static",
      preferredLayerBinding: "school_event",
      notesMn: "Бүтэн сургуулийн хуваарьтай уялдсан үе.",
    },
  ] as const;

/** `CALENDAR_LAYERS` дээрх давхарга бүрт: шалгалт төлөвлөлтийн үндсэн ангилал. */
export const CALENDAR_LAYER_CONSTRAINT: Record<
  | "primary"
  | "ancillary_confirmed"
  | "confirmed_exam"
  | "ai_draft"
  | "school_event"
  | "personal"
  | "conflict",
  ConstraintKind
> = {
  primary: "hard",
  ancillary_confirmed: "hard",
  confirmed_exam: "hard",
  ai_draft: "soft",
  school_event: "hard",
  personal: "soft",
  conflict: "hard",
};

export function constraintLabelMn(kind: ConstraintKind): string {
  return kind === "hard"
    ? "Hard — тогтмол / захиргаа"
    : "Soft — санал, синк, draft";
}

/**
 * Сургуулийн эвентийн дэд давхарга — GraphQL `SchoolEventLayerKind` болон UI нэг эх үүсвэр.
 * Нэг өнгөөр бүгдийг харуулахгүй: амралт vs заавал хурал vs нөөц түгжээ vs deadline ялгагдана.
 */
export const SCHOOL_EVENT_LAYER_ORDER: readonly SchoolEventLayerKind[] = [
  "HOLIDAY",
  "ADMIN_FIXED",
  "RESOURCE_LOCK",
  "ACADEMIC_MILESTONE",
];

export const SCHOOL_EVENT_LAYER_UI: Record<
  SchoolEventLayerKind,
  {
    labelMn: string;
    examplesMn: string;
    /** Легенд — swatch */
    swatch: string;
    /** Тор дээрх карт (border + bg) */
    cardClass: string;
    constraint: ConstraintKind;
    impactMn: string;
  }
> = {
  HOLIDAY: {
    labelMn: "Амралт / баяр",
    examplesMn: "Улирлын амралт, Цагаан сар, Эрдмийн баяр",
    swatch: "bg-pink-100 ring-1 ring-pink-300/50 dark:bg-pink-950/60 dark:ring-pink-700/50",
    cardClass:
      "border-pink-300/90 bg-pink-100/95 text-pink-950 dark:border-pink-600/70 dark:bg-pink-950/45 dark:text-pink-50",
    constraint: "hard",
    impactMn: "Хичээл орохгүй",
  },
  ADMIN_FIXED: {
    labelMn: "Захиргаа / хурал",
    examplesMn: "Багш нарын зөвлөгөөн, ЗАН-ийн хурал",
    swatch: "bg-amber-200 ring-1 ring-amber-400/45 dark:bg-amber-950/55 dark:ring-amber-700/45",
    cardClass:
      "border-amber-400/90 bg-amber-200/95 text-amber-950 dark:border-amber-600/70 dark:bg-amber-950/50 dark:text-amber-50",
    constraint: "hard",
    impactMn: "Заавал оролцоно",
  },
  RESOURCE_LOCK: {
    labelMn: "Нөөцийн хязгаар",
    examplesMn: "Заалны засвар, лабораторийн ариутгал",
    swatch: "bg-slate-200 ring-1 ring-slate-400/45 dark:bg-slate-700/80 dark:ring-slate-500/50",
    cardClass:
      "border-slate-400/90 bg-slate-200/95 text-slate-900 dark:border-slate-500/65 dark:bg-slate-800/75 dark:text-slate-100",
    constraint: "hard",
    impactMn: "Өрөө ашиглахгүй",
  },
  ACADEMIC_MILESTONE: {
    labelMn: "Deadline / академик",
    examplesMn: "Дүн гаргах эцсийн хугацаа, ЕШ сорил",
    swatch: "bg-orange-100 ring-1 ring-orange-300/50 dark:bg-orange-950/55 dark:ring-orange-700/45",
    cardClass:
      "border-orange-400/90 bg-orange-100/95 text-orange-950 dark:border-orange-600/65 dark:bg-orange-950/45 dark:text-orange-50",
    constraint: "hard",
    impactMn: "Төлөвлөлтийн milestone",
  },
};

/** Дэд давхарга бүрт шалгалт төлөвлөлтийн хатуу зэрэг (ихэвчлэн hard). */
export const SCHOOL_EVENT_LAYER_CONSTRAINT: Record<
  SchoolEventLayerKind,
  ConstraintKind
> = {
  HOLIDAY: "hard",
  ADMIN_FIXED: "hard",
  RESOURCE_LOCK: "hard",
  ACADEMIC_MILESTONE: "hard",
};
