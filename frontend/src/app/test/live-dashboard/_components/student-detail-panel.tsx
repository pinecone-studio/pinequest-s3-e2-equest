"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  X,
  Wifi,
  WifiOff,
  RefreshCw,
  EyeOff,
  Smartphone,
  Clock,
  AlertTriangle,
  AlertOctagon,
  User,
  Camera,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  MonitoringEvent,
  MonitoringState,
  RiskLevel,
  Student,
} from "../lib/types";

interface StudentDetailPanelProps {
  student: Student;
  events: MonitoringEvent[];
  onClose: () => void;
}

export function StudentDetailPanel({
  student,
  events,
  onClose,
}: StudentDetailPanelProps) {
  const studentEvents = events.filter((e) => e.studentId === student.id);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">
              {student.name}
            </h3>
            <p className="text-xs text-muted-foreground">{student.studentId}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4 space-y-6">
          {/* Current State */}
          <div>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Одоогийн төлөв
            </h4>
            <div className="flex flex-wrap gap-2">
              <StateChip state={student.monitoringState} />
              <RiskChip risk={student.riskLevel} />
              <StatusChip status={student.status} />
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Progress & Score */}
          <div>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Явц
            </h4>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground">
                    Гүйцэтгэл
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {student.progress}%
                  </span>
                </div>
                <Progress value={student.progress} className="h-2" />
              </div>
              {student.score !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Оноо</span>
                  <span className="text-lg font-semibold text-foreground">
                    {student.score}%
                  </span>
                </div>
              )}
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Monitoring Summary */}
          <div>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Хяналтын хураангуй
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-warning/10 p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span className="text-lg font-semibold text-foreground">
                    {student.warningCount}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Анхааруулга
                </p>
              </div>
              <div className="rounded-lg bg-danger/10 p-3">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="h-4 w-4 text-danger" />
                  <span className="text-lg font-semibold text-foreground">
                    {student.dangerCount}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Аюултай үйлдэл
                </p>
              </div>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Activity Timeline */}
          <div>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Үйл ажиллагааны түүх
            </h4>
            {studentEvents.length > 0 ? (
              <div className="space-y-3">
                {studentEvents.map((event) => (
                  <TimelineEvent key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Үйл явдал бүртгэгдээгүй
              </p>
            )}
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
}

function StateChip({ state }: { state: MonitoringState }) {
  const configs: Record<
    MonitoringState,
    { icon: React.ElementType; label: string; className: string }
  > = {
    online: {
      icon: Wifi,
      label: "Холбогдсон",
      className: "bg-success/20 text-success border-success/30",
    },
    offline: {
      icon: WifiOff,
      label: "Салсан",
      className: "bg-danger/20 text-danger border-danger/30",
    },
    reconnected: {
      icon: RefreshCw,
      label: "Дахин холбогдсон",
      className: "bg-info/20 text-info border-info/30",
    },
    "tab-hidden": {
      icon: EyeOff,
      label: "Таб нуугдсан",
      className: "bg-warning/20 text-warning border-warning/30",
    },
    "device-switch": {
      icon: Smartphone,
      label: "Төхөөрөмж солисон",
      className: "bg-danger/20 text-danger border-danger/30",
    },
    idle: {
      icon: Clock,
      label: "Идэвхгүй",
      className: "bg-warning/20 text-warning border-warning/30",
    },
  };

  const config = configs[state];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1.5", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function RiskChip({ risk }: { risk: RiskLevel }) {
  const configs: Record<RiskLevel, { label: string; className: string }> = {
    low: {
      label: "Бага эрсдэл",
      className: "bg-success/20 text-success border-success/30",
    },
    medium: {
      label: "Дунд эрсдэл",
      className: "bg-warning/20 text-warning border-warning/30",
    },
    high: {
      label: "Өндөр эрсдэл",
      className: "bg-danger/20 text-danger border-danger/30",
    },
  };

  const config = configs[risk];

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function StatusChip({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    "in-progress": {
      label: "Явагдаж байна",
      className: "bg-info/20 text-info border-info/30",
    },
    processing: {
      label: "Боловсруулж байна",
      className: "bg-warning/20 text-warning border-warning/30",
    },
    submitted: {
      label: "Илгээсэн",
      className: "bg-accent/20 text-accent border-accent/30",
    },
    approved: {
      label: "Баталгаажсан",
      className: "bg-success/20 text-success border-success/30",
    },
  };

  const config = configs[status] || {
    label: status,
    className: "bg-secondary text-secondary-foreground",
  };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function TimelineEvent({ event }: { event: MonitoringEvent }) {
  const severityColors = {
    info: "bg-info",
    warning: "bg-warning",
    danger: "bg-danger",
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn("h-2 w-2 rounded-full", severityColors[event.severity])}
        />
        <div className="flex-1 w-px bg-border" />
      </div>
      <div className="flex-1 pb-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{event.title}</p>
          <span className="text-xs text-muted-foreground">
            {event.timestamp.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
        {event.mode || event.screenshotUrl ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {event.mode ? (
              <Badge variant="outline" className="text-[10px]">
                {formatMonitoringMode(event.mode)}
              </Badge>
            ) : null}
            {event.screenshotCapturedAt ? (
              <span className="text-[10px] text-muted-foreground">
                {event.screenshotCapturedAt.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            ) : null}
            {event.screenshotUrl ? (
              <a
                className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground underline-offset-4 hover:underline"
                href={event.screenshotUrl}
                rel="noreferrer"
                target="_blank"
              >
                <Camera className="h-3 w-3" />
                Screenshot
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatMonitoringMode(mode: NonNullable<MonitoringEvent["mode"]>) {
  switch (mode) {
    case "screen-capture-enabled":
      return "Screen capture";
    case "fallback-dom-capture":
      return "Fallback capture";
    case "limited-monitoring":
      return "Limited monitoring";
    default:
      return mode;
  }
}
