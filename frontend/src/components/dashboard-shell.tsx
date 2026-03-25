"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import {
  BookCheck,
  CalendarDays,
  Gauge,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  School,
  UserCircle2,
} from "lucide-react";

type DashboardShellProps = {
  children: ReactNode;
};

const items = [
  { href: "/", label: "Дашбоард", icon: Gauge },
  { href: "/electronic-exam", label: "Цахим шалгалт", icon: NotebookPen },
  { href: "/electronic-exam/new", label: "Шинэ сорил", icon: BookCheck },
  { href: "/calendar", label: "Хуанли", icon: CalendarDays, disabled: true },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter((value): value is string => Boolean(value)).join(" ");
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const showLabels = !collapsed || mobileOpen;

  return (
    <div className="min-h-screen bg-[#f3f3f4] text-slate-900">
      <button
        type="button"
        aria-label="close menu"
        className={cx(
          "fixed inset-0 z-30 bg-black/25 transition md:hidden",
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex border-r border-slate-200 bg-white shadow-[0_20px_60px_-40px_rgba(0,0,0,0.35)] transition-all duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "w-[260px] md:w-[84px]" : "w-[260px]",
        )}
      >
        <button
          type="button"
          aria-label={collapsed ? "Нээх" : "Хаах"}
          onClick={() => setCollapsed((value) => !value)}
          className="absolute top-[56px] mr-6 mt-3 right-[3px] hidden h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 md:inline-flex"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
        <div
          className={cx(
            "flex w-full flex-col p-3",
            showLabels ? "items-stretch" : "items-center",
          )}
        >
          <div
            className={cx(
              "flex w-full items-center gap-3",
              showLabels ? "justify-between" : "justify-center",
            )}
          >
            <div
              className={cx(
                "flex items-center gap-2",
                !showLabels && "justify-center",
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ebf3ff] text-[#2563eb]">
                <School className="h-5 w-5" />
              </div>
              {showLabels ? (
                <p className="text-lg font-semibold tracking-tight">eSchool</p>
              ) : null}
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="flex justify-center">
              <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-200 text-slate-500 mt-10">
                <UserCircle2 className="h-10 w-10" />
              </div>
            </div>
          </div>

          <nav
            className={cx(
              "mt-6 w-full space-y-1.5",
              !showLabels && "flex flex-col items-center",
            )}
          >
            {items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.disabled ? "#" : item.href}
                  aria-disabled={item.disabled ? "true" : undefined}
                  className={cx(
                    "flex h-11 items-center rounded-xl text-sm font-medium transition",
                    showLabels ? "w-full gap-3 px-3" : "w-11 justify-center",
                    item.disabled && "pointer-events-none opacity-40",
                    active
                      ? "bg-[#ffece6] text-[#ff5a1f] ring-1 ring-[#ffd6c8]"
                      : "text-slate-600 hover:bg-slate-100",
                  )}
                  title={!showLabels ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {showLabels ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <div
        className={cx(
          "transition-[padding-left] duration-300",
          collapsed ? "md:pl-[84px]" : "md:pl-[260px]",
        )}
      >
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
          <p className="text-base font-semibold">eSchool</p>
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300"
          >
            ≡
          </button>
        </header>
        <main className="p-3 md:p-6">{children}</main>
      </div>
    </div>
  );
}
