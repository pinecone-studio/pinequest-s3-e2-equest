"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TestHeaderBar, type BreadcrumbItem } from "./test-header-bar";
import { TestSidebar } from "./test-sidebar";

interface TestShellProps {
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  breadcrumbItems?: BreadcrumbItem[];
  children: ReactNode;
  compactSidebar?: boolean;
  contentClassName?: string;
  description?: string;
  headerRightSlot?: ReactNode;
  hideHeader?: boolean;
  hideSidebar?: boolean;
  isTeacherRefreshing?: boolean;
  meta?: ReactNode;
  onTeacherRefresh?: (() => void) | null;
  sidebarCollapsible?: boolean;
  teacherVariant?: "default" | "switcher" | "live" | "none";
  title: string;
}

export function TestShell({
  actions,
  breadcrumb,
  breadcrumbItems,
  children,
  compactSidebar = false,
  contentClassName,
  description,
  headerRightSlot,
  hideHeader,
  hideSidebar = false,
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
      <div className="h-screen overflow-hidden bg-[#edf2f7]">
        <div
          className={cn(
            "mx-auto grid h-full w-full max-w-[1440px] grid-rows-[minmax(0,1fr)] overflow-hidden border border-slate-200/90 bg-white transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            hideSidebar
              ? "grid-cols-1"
              : isSidebarCompact
                ? "grid-cols-[84px_1fr]"
                : "grid-cols-[272px_1fr]",
          )}
        >
          {hideSidebar ? null : (
            <TestSidebar
              collapsible={sidebarCollapsible}
              compact={isSidebarCompact}
              onToggleCompact={
                sidebarCollapsible
                  ? () => setIsSidebarCompact((current) => !current)
                  : undefined
              }
            />
          )}

          <div
            className={cn(
              hideSidebar
                ? "row-start-1 col-start-1 min-h-0 overflow-y-auto bg-[#f3f6fb]"
                : "row-start-1 col-start-2 min-h-0 overflow-y-auto bg-[#f3f6fb]",
            )}
          >
            {hideHeader ? null : (
              <TestHeaderBar
                actions={actions}
                breadcrumb={breadcrumb}
                breadcrumbItems={breadcrumbItems}
                description={description}
                isTeacherRefreshing={isTeacherRefreshing}
                meta={meta}
                onTeacherRefresh={onTeacherRefresh}
                rightSlot={headerRightSlot}
                teacherVariant={teacherVariant}
                title={title}
              />
            )}

            <main className={cn("p-8", contentClassName)}>
              <div className="w-full">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
