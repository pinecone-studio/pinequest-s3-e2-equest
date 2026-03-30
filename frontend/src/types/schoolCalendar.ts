/**
 * Local (non-GraphQL) school calendar types.
 * We keep these after deprecating the `schoolCalendarEvents` GraphQL query.
 */

export type SchoolCalendarEventCategory =
  | "ACADEMIC"
  | "ADMIN"
  | "CAMPUS_LIFE"
  | "RESOURCE_CONSTRAINT";

export type SchoolCalendarEventVisibility = "SCHOOL_WIDE" | "TEACHERS" | "PUBLIC";

/** UI дэд давхарга — өнгө, ачааллын эрэмбэ. */
export type SchoolEventLayerKind =
  | "HOLIDAY"
  | "ADMIN_FIXED"
  | "RESOURCE_LOCK"
  | "ACADEMIC_MILESTONE";

export type SchoolCalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  category: SchoolCalendarEventCategory;
  layerKind: SchoolEventLayerKind;
  subcategory?: string | null;
  startAt: string; // ISO
  endAt: string; // ISO
  allDay: boolean;
  visibility: SchoolCalendarEventVisibility;
  metadataJson?: string | null;
};

