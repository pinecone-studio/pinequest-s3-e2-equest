"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  FileQuestion,
  type LucideIcon,
} from "lucide-react";

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
    icon: Activity,
    label: "Шууд хяналт",
  },
  {
    href: "/test/exam-report",
    icon: BarChart3,
    label: "Шалгалтын тайлан",
  },
  {
    disabled: true,
    icon: ClipboardCheck,
    label: "Гүйцэтгэлийн хяналт",
  },
  {
    href: "/test/material-builder",
    icon: FileQuestion,
    label: "Шалгалтын материал үүсгэх",
  },
  {
    href: "/ai-scheduler",
    icon: CalendarClock,
    label: "Шалгалт товлох",
  },
];

export function TestSidebar() {
  const pathname = usePathname();

  return (
    <aside className="row-start-2 col-start-1 overflow-y-auto border-r border-slate-200 bg-[#f3f6f9] p-2">
      <nav className="space-y-2">
        {navigationItems.map((item) => {
          const isActive =
            !item.disabled &&
            Boolean(
              item.href &&
              (pathname === item.href || pathname.startsWith(`${item.href}/`)),
            );

          const count = item.label === "Шалгалтын тайлан" ? "12" : undefined;
          const iconClassName =
            item.label === "Шалгалтын материал үүсгэх" ? "h-5 w-5" : "h-4 w-4";

          const className = `flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-left text-sm font-medium transition-all duration-200 ${
            isActive
              ? "border-[#d6ebfb] bg-[#e6f5fd] text-[#1287c7] shadow-sm"
              : item.disabled
                ? "cursor-not-allowed text-slate-400 opacity-70"
                : "text-slate-700 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-100 hover:shadow-sm"
          }`;

          if (item.disabled) {
            return (
              <button
                key={item.label}
                type="button"
                disabled
                className={className}
              >
                <item.icon className={iconClassName} />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <Link key={item.label} href={item.href} className={className}>
              <item.icon className={iconClassName} />
              <span>{item.label}</span>
              {count ? (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1 text-[11px] font-semibold text-slate-700">
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
