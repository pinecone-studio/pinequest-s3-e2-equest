"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronRight,
  ChevronDown,
  House,
  RefreshCw,
  UserRound,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TeacherVariant = "default" | "switcher" | "live" | "none";

type TeacherProfile = {
  id: string;
  name: string;
  role: string;
};

export type BreadcrumbItem = {
  active?: boolean;
  href?: string;
  label: string;
};

type TestHeaderBarProps = {
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  breadcrumbItems?: BreadcrumbItem[];
  description?: string;
  isTeacherRefreshing?: boolean;
  meta?: ReactNode;
  onTeacherRefresh?: (() => void) | null;
  rightSlot?: ReactNode;
  teacherVariant?: TeacherVariant;
  title: string;
};

const STORAGE_KEY = "test-shell-selected-teacher";

const MOCK_TEACHERS: TeacherProfile[] = [
  {
    id: "teacher-jargalmaa",
    name: "С.Жаргалмаа",
    role: "Математикийн багш",
  },
  {
    id: "teacher-nomin",
    name: "Б.Номин",
    role: "Физикийн багш",
  },
  {
    id: "teacher-temuulen",
    name: "Э.Тэмүүлэн",
    role: "Химийн багш",
  },
];

export function TestHeaderBar({
  actions,
  breadcrumb,
  breadcrumbItems,
  description,
  isTeacherRefreshing = false,
  meta,
  onTeacherRefresh = null,
  rightSlot,
  teacherVariant = "default",
  title,
}: TestHeaderBarProps) {
  const pathname = usePathname();
  const [selectedTeacherId, setSelectedTeacherId] = useState(MOCK_TEACHERS[0].id);

  useEffect(() => {
    const storedTeacherId = window.localStorage.getItem(STORAGE_KEY);
    if (
      storedTeacherId &&
      MOCK_TEACHERS.some((teacher) => teacher.id === storedTeacherId)
    ) {
      setSelectedTeacherId(storedTeacherId);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, selectedTeacherId);
  }, [selectedTeacherId]);

  const selectedTeacher =
    MOCK_TEACHERS.find((teacher) => teacher.id === selectedTeacherId) ??
    MOCK_TEACHERS[0];
  const resolvedBreadcrumbItems = breadcrumbItems ?? buildBreadcrumbItems(pathname, title);
  const shouldRenderBreadcrumb =
    breadcrumb !== undefined || resolvedBreadcrumbItems.length > 0;

  return (
    <header className="row-start-1 col-start-2 flex items-center justify-between border-b border-slate-200 bg-white px-8">
      <div className="min-w-0">
        {shouldRenderBreadcrumb ? (
          breadcrumb ?? <TestBreadcrumb items={resolvedBreadcrumbItems} />
        ) : (
          <h1 className="truncate text-[18px] font-bold leading-tight text-slate-900">
            {title}
          </h1>
        )}
        {description ? (
          <p className="mt-1 truncate text-[13px] font-medium text-slate-500">
            {description}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        {meta ? (
          <div className="hidden items-center gap-3 text-[14px] font-medium text-slate-500 xl:flex">
            {meta}
          </div>
        ) : null}
        {actions ? (
          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            {actions}
          </div>
        ) : null}
        {rightSlot ? (
          rightSlot
        ) : teacherVariant === "none" ? null : (
          <TeacherControl
            isRefreshing={isTeacherRefreshing}
            onRefresh={onTeacherRefresh}
            selectedTeacher={selectedTeacher}
            selectedTeacherId={selectedTeacherId}
            setSelectedTeacherId={setSelectedTeacherId}
            variant={teacherVariant}
          />
        )}
      </div>
    </header>
  );
}

function TestBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="breadcrumb"
      className="inline-flex max-w-full items-center gap-2 rounded-[24px] border border-[#e7edf5] bg-white p-2 pr-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
            {index === 0 ? (
              item.href ? (
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-[18px] px-3 py-2 text-[15px] font-semibold text-slate-900 transition hover:bg-[#f4f7fb]"
                >
                  <House className="h-4 w-4 text-slate-700" />
                  {item.label}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-[18px] px-3 py-2 text-[15px] font-semibold text-slate-900">
                  <House className="h-4 w-4 text-slate-700" />
                  {item.label}
                </span>
              )
            ) : item.active ? (
              <span className="inline-flex items-center whitespace-nowrap rounded-[18px] bg-[#e8f2fd] px-4 py-2 text-[15px] font-semibold text-[#0b5cab]">
                {item.label}
              </span>
            ) : item.href ? (
              <Link
                href={item.href}
                className="inline-flex items-center whitespace-nowrap rounded-[18px] px-3 py-2 text-[15px] font-semibold text-slate-900 transition hover:bg-[#f4f7fb]"
              >
                {item.label}
              </Link>
            ) : (
              <span className="inline-flex items-center whitespace-nowrap rounded-[18px] px-3 py-2 text-[15px] font-semibold text-slate-900">
                {item.label}
              </span>
            )}

            {!isLast ? <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" /> : null}
          </div>
        );
      })}
    </nav>
  );
}

function buildBreadcrumbItems(pathname: string, title: string): BreadcrumbItem[] {
  const homeItem: BreadcrumbItem = { href: "/test/live-dashboard", label: "Нүүр" };

  if (pathname.startsWith("/test/material-builder")) {
    return [homeItem, { active: true, label: "Шалгалтын материал үүсгэх" }];
  }

  if (pathname.startsWith("/test/live-dashboard")) {
    if (title !== "Миний шалгалтууд") {
      return [
        homeItem,
        { href: "/test/live-dashboard", label: "Миний шалгалтууд" },
        { active: true, label: title },
      ];
    }

    return [homeItem, { active: true, label: "Миний шалгалтууд" }];
  }

  if (pathname.startsWith("/test/exam-progress")) {
    if (title !== "Шалгалтын явц") {
      return [
        homeItem,
        { href: "/test/exam-progress", label: "Шалгалтын явц" },
        { active: true, label: title },
      ];
    }

    return [homeItem, { active: true, label: "Шалгалтын явц" }];
  }

  if (pathname.startsWith("/test/exam-report")) {
    return [homeItem, { active: true, label: "Шалгалтын тайлан" }];
  }

  return [homeItem, { active: true, label: title }];
}

function TeacherControl({
  isRefreshing = false,
  onRefresh = null,
  selectedTeacher,
  selectedTeacherId,
  setSelectedTeacherId,
  variant,
}: {
  isRefreshing?: boolean;
  onRefresh?: (() => void) | null;
  selectedTeacher: TeacherProfile;
  selectedTeacherId: string;
  setSelectedTeacherId: (value: string) => void;
  variant: TeacherVariant;
}) {
  if (variant === "switcher") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 rounded-[14px] border border-slate-200 bg-white px-4 py-2 text-left shadow-none transition hover:bg-slate-50">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#eef4ff] text-[#0b5cab]">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="hidden sm:block">
              <p className="text-[15px] font-semibold leading-none text-slate-900">
                {selectedTeacher.name}
              </p>
              <p className="mt-1 text-[13px] leading-none text-slate-500">
                {selectedTeacher.role}
              </p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel>Багш сонгох</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={selectedTeacherId}
            onValueChange={setSelectedTeacherId}
          >
            {MOCK_TEACHERS.map((teacher) => (
              <DropdownMenuRadioItem key={teacher.id} value={teacher.id}>
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900">
                    {teacher.name}
                  </span>
                  <span className="text-xs text-slate-500">{teacher.role}</span>
                </div>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === "live") {
    return (
      <div className="flex items-center gap-3 rounded-[14px] border border-slate-200 bg-white px-4 py-2 shadow-none">
        <button
          type="button"
          onClick={() => onRefresh?.()}
          disabled={!onRefresh}
          className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:cursor-default disabled:opacity-80"
          aria-label="Шинэчлэх"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </button>
        <div>
          <p className="text-[15px] font-semibold leading-none text-slate-900">
            {selectedTeacher.name}
          </p>
          <p className="mt-1 text-[13px] leading-none text-slate-500">
            {selectedTeacher.role}
          </p>
        </div>
      </div>
    );
  }

  return (
    <button className="flex items-center gap-2 rounded-xl px-2 py-1 text-left transition hover:bg-white/70">
      <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-slate-100 text-slate-700">
        <UserRound className="h-5 w-5" />
      </div>
      <div className="hidden sm:block">
        <p className="text-sm font-semibold text-slate-900">Багш</p>
        <p className="text-xs text-slate-500">Teacher</p>
      </div>
      <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:block" />
    </button>
  );
}
