"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
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
    icon: ClipboardCheck,
    label: "Шалгалтын материал үүсгэх",
  },
];

export function TestSidebar() {
  const pathname = usePathname();

  return (
    <aside className="row-start-2 col-start-1 overflow-y-auto border-r border-slate-200 bg-[#f3f6f9] p-2">
      <nav className="space-y-1">
        {navigationItems.map((item) => {
          const isActive =
            !item.disabled &&
            Boolean(
              item.href &&
                (pathname === item.href || pathname.startsWith(`${item.href}/`)),
            );

          const count =
            item.label === "Шалгалтын тайлан"
              ? "12"
              : item.label === "Шалгалтын материал үүсгэх"
                ? "3"
                : undefined;

          const className = `flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
            isActive
              ? "bg-[#e6f5fd] text-[#1287c7]"
              : item.disabled
                ? "cursor-not-allowed text-slate-400 opacity-70"
                : "text-slate-700 hover:bg-slate-100"
          }`;

          if (item.disabled) {
            return (
              <button
                key={item.label}
                type="button"
                disabled
                className={className}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <Link key={item.label} href={item.href} className={className}>
              <item.icon className="h-4 w-4" />
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
