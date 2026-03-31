"use client";

import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  EyeOff,
  Clock,
  WifiOff,
  RefreshCw,
  Smartphone,
  CheckCircle,
  FileEdit,
  Activity,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { MonitoringEvent } from "../lib/types";

interface LiveFeedProps {
  events: MonitoringEvent[];
}

export function LiveFeed({ events }: LiveFeedProps) {
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-medium text-foreground">Шууд мэдээлэл</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
          <span className="text-xs text-muted-foreground">Шууд</span>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {events.length > 0 ? (
            <div className="space-y-2">
              {events.map((event) => (
                <EventItem key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[160px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
              Энэ шалгалтад хяналтын event хараахан бүртгэгдээгүй байна.
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

function EventItem({ event }: { event: MonitoringEvent }) {
  const Icon = getEventIcon(event.type);
  const severityColors = {
    info: "border-l-info bg-info/5",
    warning: "border-l-warning bg-warning/5",
    danger: "border-l-danger bg-danger/5",
  };

  const iconColors = {
    info: "text-info",
    warning: "text-warning",
    danger: "text-danger",
  };

  return (
    <div
      className={cn(
        "rounded-md border-l-2 p-3 transition-colors",
        severityColors[event.severity],
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5", iconColors[event.severity])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground truncate">
              {event.studentName}
            </p>
            <div className="flex items-center gap-2">
              {event.count && event.count > 1 ? (
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-foreground">
                  x{event.count}
                </span>
              ) : null}
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatTime(event.timestamp)}
              </span>
            </div>
          </div>
          <p className="mt-0.5 text-sm text-foreground">{event.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
        </div>
      </div>
    </div>
  );
}

function getEventIcon(type: MonitoringEvent["type"]) {
  switch (type) {
    case "focus-lost":
      return EyeOff;
    case "idle":
      return Clock;
    case "offline":
      return WifiOff;
    case "reconnected":
      return RefreshCw;
    case "device-switch":
      return Smartphone;
    case "submitted":
      return CheckCircle;
    case "answer-revision":
      return FileEdit;
    default:
      return Activity;
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
