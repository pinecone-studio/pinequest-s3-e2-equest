/**
 * # Scheduling AI — нэг «тархи» (Single Engine), олон Intent
 *
 * Системд **нэг** scheduling / reasoning pipeline (нэг queue + нэг consumer pattern)
 * байх нь зөв: тусдаа AI бол шалгалт товлох ба давтлага/секц товлох **хоорондоо мөргөлдөнө**
 * (нэг нь нөгөөгийн сул цагийг мэдэхгүй, давхар захиалга гарна).
 *
 * Нэг engine дээр **Intent**-ээр оролтын хүрээ + гаралтын давхарга ялгагдана.
 *
 * ---
 *
 * ## Intent: Exam Scheduling (`exam_scheduling`)
 * - **Асуулт**: «Шалгалт товлох уу?»
 * - **DB / өгөгдөл**: сурагчдын хуваарь + багшийн хуваарь + өрөөний сул цаг (+ шаардлагатай constraint).
 * - **Гаралт (UI давхарга)**: `confirmed_exam` (баталгаажсан) эсвэл `ai_draft` (violet / санал).
 *
 * ---
 *
 * ## Intent: Extra Activity (`extra_activity`)
 * - **Асуулт**: «Давтлага / секц товлох уу?»
 * - **DB / өгөгдөл**: зөвхөн **багшийн сул цаг** + **сургуулийн нийтийн эвент** (school_event давхарга —
 *   давхардахгүй гэж тооцох ёстой).
 * - **Гаралт**: «academic_fixed» төрлийн тогтмол блок (үндсэн хуваарийн duty/захиргааны хатуу цонх)
 *   эсвэл `ai_draft` (зураасан санал — UI-д одоо violet draft).
 *
 * ---
 *
 * Ирээдүйд GraphQL / Worker нь `intent` талбарыг ижил engine руу дамжуулна.
 */

/** Нэг engine дээр ялгагдах зорилго. */
export type SchedulingIntentKind = "exam_scheduling" | "extra_activity";

/** Intent бүрийн бодлогын тойм (баримтжуулалт). */
export const SCHEDULING_INTENT: Record<
  SchedulingIntentKind,
  {
    labelMn: string;
    questionMn: string;
    readsFromDbMn: string;
    outputLayersMn: string;
    /** `AiPersonalExamScheduler` / taxonomy-тай уялдуулах нэршил */
    calendarLayerHints: readonly string[];
  }
> = {
  exam_scheduling: {
    labelMn: "Шалгалт товлох",
    questionMn: "Шалгалт товлох уу?",
    readsFromDbMn:
      "Сурагчдын хуваарь + багшийн хуваарь + өрөөний сул цаг",
    outputLayersMn:
      "confirmed_exam (ногоон) эсвэл ai_draft (violet санал)",
    calendarLayerHints: ["confirmed_exam", "ai_draft"],
  },
  extra_activity: {
    labelMn: "Давтлага / секц / дагалдах",
    questionMn: "Давтлага / секц товлох уу?",
    readsFromDbMn:
      "Зөвхөн багшийн сул цаг + сургуулийн эвент (school_event / read-only давхарга)",
    outputLayersMn:
      "academic_fixed (албан тогтмол цонх) эсвэл ai_draft (санал)",
    calendarLayerHints: ["primary", "school_event", "ai_draft"],
  },
};

/** Яагаад нэг engine — богино тайлбар (UI / PR-д хуулахад). */
export const SCHEDULING_SINGLE_ENGINE_RATIONALE_MN =
  "Нэг AI: шалгалтын цагийг давтлага товлоход, давтлагын цагийг шалгалт товлоход нэг эргэлтэд хооронд нь давхцуулахгүй тооцоолно. Тусдаа engine бол хоорондоо мэдээлэл солилцохгүй.";
