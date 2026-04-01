"use client";

import type { ReactNode } from "react";
import { ChevronDown, GraduationCap, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TestSidebar } from "./test-sidebar";

interface TestShellProps {
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  description?: string;
  hideHeader?: boolean;
  meta?: ReactNode;
  title: string;
}

export function TestShell({
  actions,
  children,
  contentClassName,
  hideHeader,
  title,
}: TestShellProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="h-screen overflow-hidden bg-[#eceff3] px-4">
        <div className="mx-auto grid h-full w-full max-w-[1440px] grid-cols-[228px_1fr] grid-rows-[58px_1fr]">
          <aside className="row-start-1 col-start-1 flex items-center gap-3 border-r border-b border-slate-200 bg-white px-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#16a4e5] text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <p className="truncate text-xl font-semibold text-slate-900">
              Багш
            </p>
          </aside>

          {hideHeader ? null : (
            <header className="row-start-1 col-start-2 flex items-center justify-between border-b border-slate-200 bg-white px-6">
              <h1 className="truncate text-2xl font-semibold text-slate-900">
                {title}
              </h1>

              <div className="flex items-center gap-3">
                {actions ? (
                  <div className="hidden flex-wrap items-center gap-2 lg:flex">
                    {actions}
                  </div>
                ) : null}
                <button className="flex items-center gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-slate-50">
                  <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-slate-100 text-slate-700">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold text-slate-900">Багш</p>
                    <p className="text-xs text-slate-500">Teacher</p>
                  </div>
                  <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:block" />
                </button>
              </div>
            </header>
          )}

          <TestSidebar />

          <main
            className={cn(
              "row-start-2 col-start-2 overflow-y-auto bg-[#f5f7fa] p-5",
              contentClassName,
            )}
          >
            <div className="w-full">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
