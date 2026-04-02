"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TestHeaderBar } from "./test-header-bar";
import { TestSidebar } from "./test-sidebar";

interface TestShellProps {
  actions?: ReactNode;
  children: ReactNode;
  compactSidebar?: boolean;
  contentClassName?: string;
  description?: string;
  headerRightSlot?: ReactNode;
  hideHeader?: boolean;
  isTeacherRefreshing?: boolean;
  meta?: ReactNode;
  onTeacherRefresh?: (() => void) | null;
  sidebarCollapsible?: boolean;
  teacherVariant?: "default" | "switcher" | "live" | "none";
  title: string;
}

export function TestShell({
  actions,
  children,
  compactSidebar = false,
  contentClassName,
  description,
  headerRightSlot,
  hideHeader,
  isTeacherRefreshing,
  meta,
  onTeacherRefresh,
  sidebarCollapsible = false,
  teacherVariant,
  title,
}: TestShellProps) {
  const pathname = usePathname();
  const [isSidebarCompact, setIsSidebarCompact] = useState(compactSidebar);

  useEffect(() => {
    setIsSidebarCompact(compactSidebar);
  }, [compactSidebar, pathname]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="h-screen overflow-hidden bg-[#edf2f7] p-4">
        <div
          className={cn(
            "mx-auto grid h-full w-full max-w-[1440px] grid-rows-[72px_1fr] overflow-hidden border border-slate-200/90 bg-white transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isSidebarCompact ? "grid-cols-[84px_1fr]" : "grid-cols-[272px_1fr]",
          )}
        >
          {hideHeader ? null : (
            <TestHeaderBar
              actions={actions}
              description={description}
              isTeacherRefreshing={isTeacherRefreshing}
              rightSlot={headerRightSlot}
              meta={meta}
              onTeacherRefresh={onTeacherRefresh}
              teacherVariant={teacherVariant}
              title={title}
            />
          )}

          <TestSidebar
            collapsible={sidebarCollapsible}
            compact={isSidebarCompact}
            onToggleCompact={
              sidebarCollapsible
                ? () => setIsSidebarCompact((current) => !current)
                : undefined
            }
          />

          <main
            className={cn(
              "row-start-2 col-start-2 overflow-y-auto bg-[#f3f6fb] p-8",
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
