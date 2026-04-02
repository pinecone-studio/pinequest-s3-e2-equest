"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  FileQuestion,
  GraduationCap,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STUDENT_PORTAL_URL =
  "https://take-exam-service.tsetsegulziiocherdene.workers.dev";

type NavigationItem =
  | {
      href: string;
      icon: LucideIcon;
      label: string;
      disabled?: false;
    }
  | {
      icon: LucideIcon;
      label: string;
      disabled: true;
      href?: never;
    };

const navigationItems: NavigationItem[] = [
  {
    href: "/test/live-dashboard",
    icon: ListChecks,
    label: "Миний шалгалтууд",
  },
  {
    href: "/test/exam-report",
    icon: BarChart3,
    label: "Шалгалтын тайлан",
  },

  {
    href: "/test/material-builder",
    icon: FileQuestion,
    label: "Шалгалтын материал үүсгэх",
  },
  {
    href: "/test/ai-scheduler",
    icon: CalendarClock,
    label: "Шалгалт товлох",
  },
];

const digitalExamSubItems = [
  {
    href: "/test/live-dashboard",
    icon: ListChecks,
    label: "Миний шалгалтууд",
  },
  {
    href: "/test/exam-progress",
    icon: CheckSquare,
    label: "Шалгалтын явц",
  },
] as const;

export function TestSidebar({
  collapsible = false,
  compact = false,
  onToggleCompact,
}: {
  collapsible?: boolean;
  compact?: boolean;
  onToggleCompact?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const primaryItem = navigationItems[0];
  const secondaryItems = navigationItems.slice(1);
  const isDigitalExamActive = digitalExamSubItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const brandTextClassName = cn(
    "min-w-0 flex-1 overflow-hidden transition-[max-width,opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
    compact
      ? "max-w-0 -translate-x-1 opacity-0"
      : "max-w-full translate-x-0 opacity-100",
  );
  const navLabelClassName = cn(
    "overflow-hidden whitespace-nowrap transition-[max-width,opacity,padding,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
    compact
      ? "max-w-0 -translate-x-1 pl-0 opacity-0"
      : "max-w-[180px] translate-x-0 pl-3 opacity-100",
  );
  const utilityLabelClassName = cn(
    "overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
    compact
      ? "max-w-0 -translate-x-1 opacity-0"
      : "max-w-[180px] translate-x-0 opacity-100",
  );

  return (
    <aside className="row-start-1 row-end-3 col-start-1 flex min-h-0 flex-col border-r border-slate-200 bg-white transition-[background-color,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
      <div
        className={cn(
          "flex h-[72px] items-center border-b border-slate-200 transition-[padding,justify-content] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          compact ? "justify-center px-3" : "gap-3 px-6",
        )}
      >
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#0b5cab] text-white">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className={brandTextClassName}>
          <p className="truncate text-[18px] font-bold text-[#0b5cab]">
            Шалгалт систем
          </p>
        </div>
      </div>

      <nav
        className={cn(
          "flex-1 overflow-y-auto px-3 py-4",
          compact && "flex flex-col items-center",
        )}
      >
        {collapsible && onToggleCompact ? (
          <div className={cn("mb-3", compact ? "w-full" : "px-1")}>
            <button
              type="button"
              onClick={onToggleCompact}
              className={cn(
                "flex items-center rounded-2xl   bg-white py-3 text-left text-[15px] font-semibold text-slate-500 transition-[background-color,color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#f5f7fb] hover:text-[#0b5cab]",
                compact ? "h-14 w-14 justify-center px-0" : "w-full gap-3 px-4",
              )}
              aria-label={compact ? " Дэлгэх" : "Хураах"}
              title={compact ? "Дэлгэх" : " Хураах"}
            >
              {compact ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <PanelLeftOpen className="h-5 w-5 shrink-0" />
                </span>
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <PanelLeftClose className="h-5 w-5 shrink-0" />
                </span>
              )}
              <span className={utilityLabelClassName}>
                {compact ? " Дэлгэх" : "Хураах"}
              </span>
            </button>
          </div>
        ) : null}

        <div>
          <button
            type="button"
            onClick={() => {
              if (primaryItem?.href) {
                router.push(primaryItem.href);
              }
            }}
            className={cn(
              "flex items-center rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-[background-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              compact
                ? "h-14 w-14 justify-center px-0"
                : "w-full justify-between",
              isDigitalExamActive
                ? "bg-[#f5f7fb] text-[#0b5cab]"
                : "text-slate-500 hover:bg-[#f5f7fb] hover:text-[#0b5cab]",
            )}
            aria-label="Цахим шалгалт"
            title={compact ? "Цахим шалгалт" : undefined}
          >
            <span className="flex min-w-0 items-center">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                <CheckSquare className="h-5 w-5 shrink-0" />
              </span>
              <span className={navLabelClassName}>Цахим шалгалт</span>
            </span>
            {compact ? null : (
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform",
                  isDigitalExamActive && "rotate-180",
                )}
              />
            )}
          </button>

          {primaryItem &&
          !primaryItem.disabled &&
          isDigitalExamActive &&
          !compact ? (
            <div className="mt-2 space-y-1 pl-8">
              {digitalExamSubItems.map((item) => {
                const isSubItemActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-semibold transition-[background-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isSubItemActive
                        ? "bg-[#e8f0ff] text-[#0b5cab] shadow-[inset_0_0_0_1px_rgba(11,92,171,0.08)]"
                        : "text-slate-400 hover:bg-[#f5f7fb] hover:text-[#0b5cab]"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}

          {primaryItem &&
          !primaryItem.disabled &&
          isDigitalExamActive &&
          compact ? (
            <div className="mt-3 flex w-full flex-col items-center gap-2">
              {digitalExamSubItems.map((item) => {
                const isSubItemActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-2xl transition-[background-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      isSubItemActive
                        ? "bg-[#e8f0ff] text-[#0b5cab] shadow-[inset_0_0_0_1px_rgba(11,92,171,0.08)]"
                        : "text-slate-400 hover:bg-[#f5f7fb] hover:text-[#0b5cab]",
                    )}
                    aria-label={item.label}
                    title={item.label}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      <item.icon className="h-5 w-5 shrink-0" />
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className={cn("mt-4 space-y-2", compact && "w-full")}>
          {secondaryItems.map((item) => {
            const isActive =
              !item.disabled &&
              Boolean(
                item.href &&
                (pathname === item.href ||
                  pathname.startsWith(`${item.href}/`)),
              );

            const iconClassName = "h-5 w-5";

            const className = cn(
              "flex items-center rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-[background-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              compact ? "h-14 w-14 justify-center px-0" : "w-full gap-3",
              isActive
                ? "bg-[#e8f0ff] text-[#0b5cab]"
                : item.disabled
                  ? "cursor-not-allowed text-slate-400 opacity-70"
                  : "text-slate-500 hover:bg-[#f5f7fb] hover:text-[#0b5cab]",
            );

            if (item.disabled) {
              return (
                <button
                  key={item.label}
                  type="button"
                  disabled
                  className={className}
                  aria-label={item.label}
                  title={compact ? item.label : undefined}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <item.icon className={iconClassName} />
                  </span>
                  <span className={utilityLabelClassName}>{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={className}
                aria-label={item.label}
                title={compact ? item.label : undefined}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <item.icon className={iconClassName} />
                </span>
                <span className={utilityLabelClassName}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-slate-200 px-4 py-4">
        <a
          href={STUDENT_PORTAL_URL}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "flex items-center rounded-2xl border border-[#d6e5f7] bg-[#f8fbff] py-3 text-left text-[15px] font-semibold text-[#0b5cab] transition-[background-color,color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#eef5ff]",
            compact ? "h-14 w-14 justify-center px-0" : "w-full gap-3 px-4",
          )}
          aria-label="Сурагч портал нээх"
          title={compact ? "Сурагч портал нээх" : undefined}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <ArrowUpRight className="h-5 w-5 shrink-0" />
          </span>
          <span className={utilityLabelClassName}>Сурагч портал нээх</span>
        </a>
      </div>
    </aside>
  );
}
