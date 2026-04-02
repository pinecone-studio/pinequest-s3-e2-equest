"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Filter,
  Activity,
  BarChart3,
  ClipboardCheck,
} from "lucide-react";
import {
  ExamAnalytics,
  ExamFocusAnalysis,
  MonitoringEvent,
  RiskLevel,
  Student,
  StudentStatus,
  SubmittedAttempt,
} from "../lib/types";
import { KPICards } from "./kpi-cards";
import { StudentTable } from "./student-table";
import { LiveFeed } from "./live-feed";
import { StudentDetailPanel } from "./student-detail-panel";
import { AnalyticsTab } from "./analytics-tab";
import { ReviewTab } from "./review-tab";

interface ExamDashboardProps {
  analytics: ExamAnalytics;
  students: Student[];
  events: MonitoringEvent[];
  attempts: SubmittedAttempt[];
  focusAnalysis?: ExamFocusAnalysis | null;
  focusAnalysisError?: string | null;
  isFocusAnalysisLoading?: boolean;
  error?: string | null;
  onApproveAttempt?: () => void;
}

export function ExamDashboard({
  analytics,
  students,
  events,
  attempts,
  focusAnalysis,
  focusAnalysisError,
  isFocusAnalysisLoading = false,
  error,
  onApproveAttempt,
}: ExamDashboardProps) {
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [statusFilter, setStatusFilter] = useState<StudentStatus | "all">(
    "all",
  );
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(search.toLowerCase()) ||
        student.studentId.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || student.status === statusFilter;
      const matchesRisk =
        riskFilter === "all" || student.riskLevel === riskFilter;
      return matchesSearch && matchesStatus && matchesRisk;
    });
  }, [students, search, statusFilter, riskFilter]);

  const selectedStudentTimelineEvents = useMemo(() => {
    if (!selectedStudent) {
      return [];
    }

    const mergedEvents = new Map<string, MonitoringEvent>();

    for (const event of events) {
      if (event.studentId !== selectedStudent.id) {
        continue;
      }

      mergedEvents.set(event.id, event);
    }

    for (const attempt of attempts) {
      if (attempt.studentId !== selectedStudent.id) {
        continue;
      }

      for (const event of attempt.monitoringSummary.events) {
        const type: MonitoringEvent["type"] =
          event.type === "focus"
            ? "focus-lost"
            : event.type === "danger"
              ? "device-switch"
              : "answer-revision";

        mergedEvents.set(event.id, {
          code: event.code,
          count: 1,
          detail: event.detail,
          id: event.id,
          mode: event.mode,
          screenshotCapturedAt: event.screenshotCapturedAt,
          screenshotUrl: event.screenshotUrl,
          severity: event.severity,
          studentId: attempt.studentId,
          studentName: attempt.studentName,
          timestamp: event.occurredAt,
          title: event.title,
          type,
        });
      }
    }

    return [...mergedEvents.values()].sort(
      (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
    );
  }, [attempts, events, selectedStudent]);

  useEffect(() => {
    if (!selectedStudent) {
      return;
    }

    const nextSelectedStudent =
      students.find((student) => student.id === selectedStudent.id) ?? null;

    setSelectedStudent(nextSelectedStudent);
  }, [selectedStudent, students]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      <Tabs defaultValue="monitor" className="space-y-6">
        <TabsList className="border border-border bg-card">
          <TabsTrigger
            value="monitor"
            className="gap-2 data-[state=active]:bg-secondary"
          >
            <Activity className="h-4 w-4" />
            Хяналт
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="gap-2 data-[state=active]:bg-secondary"
          >
            <BarChart3 className="h-4 w-4" />
            Шинжилгээ
          </TabsTrigger>
          <TabsTrigger
            value="review"
            className="gap-2 data-[state=active]:bg-secondary"
          >
            <ClipboardCheck className="h-4 w-4" />
            Хянан үзэх
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitor" className="min-h-0 space-y-6">
          <KPICards students={students} />

          <div className="flex items-center gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Оюутан хайх..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-3.5 w-3.5" />
                  Төлөв: {statusFilter === "all" ? "Бүгд" : statusFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  Бүгд
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("in-progress")}>
                  Явагдаж байна
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("processing")}>
                  Боловсруулж байна
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("submitted")}>
                  Илгээсэн
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("approved")}>
                  Баталгаажсан
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-3.5 w-3.5" />
                  Эрсдэл: {riskFilter === "all" ? "Бүгд" : riskFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setRiskFilter("all")}>
                  Бүгд
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRiskFilter("low")}>
                  Бага
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRiskFilter("medium")}>
                  Дунд
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRiskFilter("high")}>
                  Өндөр
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="grid gap-6 lg:grid-cols-4">
            <div
              className={
                selectedStudent
                  ? "min-h-0 h-[560px] lg:col-span-2"
                  : "min-h-0 h-[560px] lg:col-span-3"
              }
            >
              <StudentTable
                students={filteredStudents}
                selectedStudentId={selectedStudent?.id || null}
                onSelectStudent={setSelectedStudent}
              />
            </div>

            <div className="min-h-0 h-[560px]">
              <LiveFeed events={events} />
            </div>

            {selectedStudent && (
              <div
                className="min-h-0 h-[560px] lg:col-span-1"
              >
                <StudentDetailPanel
                  student={selectedStudent}
                  events={selectedStudentTimelineEvents}
                  onClose={() => setSelectedStudent(null)}
                />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab
            analytics={analytics}
            focusAnalysis={focusAnalysis}
            focusAnalysisError={focusAnalysisError}
            isFocusAnalysisLoading={isFocusAnalysisLoading}
          />
        </TabsContent>

        <TabsContent value="review">
          <ReviewTab attempts={attempts} onApproved={onApproveAttempt} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
