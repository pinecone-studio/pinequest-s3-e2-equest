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
  ArrowLeft,
  Search,
  RefreshCw,
  Filter,
  GraduationCap,
  Activity,
  BarChart3,
  ClipboardCheck,
} from "lucide-react";
import {
  AblyConnectionStatus,
  ExamAnalytics,
  Exam,
  ExamFocusAnalysis,
  MonitoringEvent,
  OllamaConnectionStatus,
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
  exam: Exam;
  students: Student[];
  events: MonitoringEvent[];
  attempts: SubmittedAttempt[];
  focusAnalysis?: ExamFocusAnalysis | null;
  focusAnalysisError?: string | null;
  isFocusAnalysisLoading?: boolean;
  ablyStatus?: AblyConnectionStatus | null;
  ollamaStatus?: OllamaConnectionStatus | null;
  error?: string | null;
  isRefreshing?: boolean;
  lastUpdated?: Date | null;
  onBack: () => void;
  onApproveAttempt?: () => void;
  onRefresh?: () => void;
}

export function ExamDashboard({
  analytics,
  exam,
  students,
  events,
  attempts,
  focusAnalysis,
  focusAnalysisError,
  isFocusAnalysisLoading = false,
  ablyStatus = null,
  ollamaStatus = null,
  error,
  isRefreshing = false,
  lastUpdated = null,
  onBack,
  onApproveAttempt,
  onRefresh,
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                <GraduationCap className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  {exam.title}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {exam.subject} • {exam.topic} • {exam.class}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              <span>Систем идэвхтэй</span>
              <span className="text-border">|</span>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    ablyStatus
                      ? getConnectionDotClass(ablyStatus.state)
                      : "bg-muted-foreground/40"
                  }`}
                />
                <span>{formatAblyStatusLabel(ablyStatus)}</span>
              </div>
              <span className="text-border">|</span>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    ollamaStatus
                      ? ollamaStatus.reachable && ollamaStatus.modelAvailable
                        ? "bg-success"
                        : "bg-warning"
                      : "bg-muted-foreground/40"
                  }`}
                />
                <span>
                  {formatOllamaStatusLabel(ollamaStatus)}
                </span>
              </div>
              <span className="text-border">|</span>
              <span>
                Шинэчлэгдсэн{" "}
                {lastUpdated ? formatTimeAgo(lastUpdated) : "саяхан"}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw
                className={`mr-2 h-3.5 w-3.5 ${
                  isRefreshing ? "animate-spin" : ""
                }`}
              />
              Шинэчлэх
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {error && (
          <div className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        <Tabs defaultValue="monitor" className="space-y-6">
          <TabsList className="bg-card border border-border">
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

          <TabsContent value="monitor" className="space-y-6 min-h-0">
            <KPICards students={students} />

            {/* Filters */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
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
                  <DropdownMenuItem
                    onClick={() => setStatusFilter("in-progress")}
                  >
                    Явагдаж байна
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setStatusFilter("processing")}
                  >
                    Боловсруулж байна
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setStatusFilter("submitted")}
                  >
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

            {/* Main Layout */}
            <div className="grid gap-6 lg:grid-cols-4">
              {/* Student Table */}
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

              {/* Live Feed */}
              <div className="min-h-0 h-[560px]">
                <LiveFeed events={events} />
              </div>

              {/* Student Detail Panel */}
              {selectedStudent && (
                <div className="min-h-0 h-[560px] lg:col-span-1">
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

          <TabsContent value="review" className="h-[calc(100vh-14rem)]">
            <ReviewTab attempts={attempts} onApproved={onApproveAttempt ?? onRefresh} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSecs < 5) return "саяхан";
  if (diffSecs < 60) return `${diffSecs} секундын өмнө`;
  return `${Math.floor(diffSecs / 60)} минутын өмнө`;
}

function getConnectionDotClass(
  state: AblyConnectionStatus["state"],
): string {
  switch (state) {
    case "connected":
      return "bg-success";
    case "connecting":
    case "checking":
      return "bg-warning";
    case "disconnected":
    case "failed":
      return "bg-danger";
    default:
      return "bg-muted-foreground/40";
  }
}

function formatAblyStatusLabel(status: AblyConnectionStatus | null): string {
  if (!status) {
    return "Ably шалгаж байна";
  }

  switch (status.state) {
    case "connected":
      return "Ably realtime холбогдсон";
    case "connecting":
    case "checking":
      return "Ably realtime холбогдож байна";
    case "disconnected":
      return "Ably realtime тасарсан";
    case "failed":
      return "Ably realtime холбогдоогүй";
    default:
      return "Ably realtime шалгаж байна";
  }
}

function formatOllamaStatusLabel(status: OllamaConnectionStatus | null): string {
  if (!status) {
    return "Ollama AI шалгаж байна";
  }

  if (status.reachable && status.modelAvailable) {
    return `Ollama AI холбогдсон${status.model ? ` • ${status.model}` : ""}`;
  }

  if (status.reachable) {
    return "Ollama AI хүрч байна, model бэлэн биш";
  }

  return "Ollama AI холбогдоогүй";
}
