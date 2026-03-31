"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  EyeOff,
  Smartphone,
  Clock,
  AlertTriangle,
  AlertOctagon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  MonitoringState,
  RiskLevel,
  Student,
  StudentStatus,
} from "../lib/types";

interface StudentTableProps {
  students: Student[];
  selectedStudentId: string | null;
  onSelectStudent: (student: Student) => void;
}

export function StudentTable({
  students,
  selectedStudentId,
  onSelectStudent,
}: StudentTableProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <ScrollArea className="min-h-0 flex-1">
        <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">Оюутан</TableHead>
            <TableHead className="text-muted-foreground">Төлөв</TableHead>
            <TableHead className="text-muted-foreground">Явц</TableHead>
            <TableHead className="text-muted-foreground">Эрсдэл</TableHead>
            <TableHead className="text-center text-muted-foreground">
              Тэмдэглэл
            </TableHead>
            <TableHead className="text-muted-foreground">Оноо</TableHead>
            <TableHead className="text-muted-foreground">
              Сүүлийн идэвхи
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
            <TableRow
              key={student.id}
              className={cn(
                "cursor-pointer border-border transition-colors",
                selectedStudentId === student.id
                  ? "bg-accent/10"
                  : "hover:bg-secondary/50",
              )}
              onClick={() => onSelectStudent(student)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <MonitoringStateIcon state={student.monitoringState} />
                  <div>
                    <p className="font-medium text-foreground">
                      {student.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {student.studentId}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={student.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={student.progress} className="h-1.5 w-16" />
                  <span className="text-sm text-muted-foreground">
                    {student.progress}%
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <RiskBadge risk={student.riskLevel} />
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-center gap-2">
                  {student.warningCount > 0 && (
                    <div className="flex items-center gap-1 text-warning">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">
                        {student.warningCount}
                      </span>
                    </div>
                  )}
                  {student.dangerCount > 0 && (
                    <div className="flex items-center gap-1 text-danger">
                      <AlertOctagon className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">
                        {student.dangerCount}
                      </span>
                    </div>
                  )}
                  {student.warningCount === 0 && student.dangerCount === 0 && (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {student.score !== undefined ? (
                  <span className="font-medium text-foreground">
                    {student.score}%
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {formatTimeAgo(student.lastActivity)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </ScrollArea>
    </div>
  );
}

function MonitoringStateIcon({ state }: { state: MonitoringState }) {
  const iconProps = "h-4 w-4";

  switch (state) {
    case "online":
      return <Wifi className={cn(iconProps, "text-success")} />;
    case "offline":
      return <WifiOff className={cn(iconProps, "text-danger")} />;
    case "reconnected":
      return <RefreshCw className={cn(iconProps, "text-info")} />;
    case "tab-hidden":
      return <EyeOff className={cn(iconProps, "text-warning")} />;
    case "device-switch":
      return <Smartphone className={cn(iconProps, "text-danger")} />;
    case "idle":
      return <Clock className={cn(iconProps, "text-warning")} />;
    default:
      return <Wifi className={cn(iconProps, "text-muted-foreground")} />;
  }
}

function StatusBadge({ status }: { status: StudentStatus }) {
  const variants: Record<StudentStatus, { className: string; label: string }> =
    {
      "in-progress": {
        className: "bg-info/20 text-info border-info/30",
        label: "Явагдаж байна",
      },
      processing: {
        className: "bg-warning/20 text-warning border-warning/30",
        label: "Боловсруулж байна",
      },
      submitted: {
        className: "bg-accent/20 text-accent border-accent/30",
        label: "Илгээсэн",
      },
      approved: {
        className: "bg-success/20 text-success border-success/30",
        label: "Баталгаажсан",
      },
    };

  const variant = variants[status];

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const variants: Record<RiskLevel, { className: string; label: string }> = {
    low: {
      className: "bg-success/20 text-success border-success/30",
      label: "Бага",
    },
    medium: {
      className: "bg-warning/20 text-warning border-warning/30",
      label: "Дунд",
    },
    high: {
      className: "bg-danger/20 text-danger border-danger/30",
      label: "Өндөр",
    },
  };

  const variant = variants[risk];

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffSecs < 60) return `${diffSecs} сек өмнө`;
  if (diffMins < 60) return `${diffMins} мин өмнө`;
  return `${Math.floor(diffMins / 60)} цаг өмнө`;
}
