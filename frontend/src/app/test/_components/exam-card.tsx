"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, Clock, TrendingUp } from "lucide-react";
import { Exam } from "../lib/types";

interface ExamCardProps {
  exam: Exam;
  onClick: () => void;
}

export function ExamCard({ exam, onClick }: ExamCardProps) {
  const isLive = exam.liveStudentCount > 0 && !exam.endTime;
  const [timeAgo, setTimeAgo] = useState("Шалгалт эхэлсэн");

  useEffect(() => {
    const updateTimeAgo = () => {
      setTimeAgo(getTimeAgo(exam.startTime));
    };

    updateTimeAgo();
    const intervalId = window.setInterval(updateTimeAgo, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [exam.startTime]);

  return (
    <Card
      className="group cursor-pointer border-border bg-card p-5 transition-all hover:border-accent hover:bg-secondary/50"
      onClick={onClick}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant={isLive ? "default" : "secondary"}
            className={isLive ? "bg-success text-success-foreground" : ""}
          >
            {isLive ? (
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                Шууд
              </span>
            ) : (
              "Дууссан"
            )}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">{timeAgo}</span>
      </div>

      <h3 className="mb-1 text-lg font-semibold text-foreground group-hover:text-accent">
        {exam.title}
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        {exam.subject} • {exam.topic}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <span>{exam.questionCount} асуулт</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            {isLive ? (
              <>
                <span className="text-success">{exam.liveStudentCount}</span> /{" "}
                {exam.totalStudentCount}
              </>
            ) : (
              `${exam.totalStudentCount} оюутан`
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{exam.class}</span>
        </div>
        {exam.averageScore !== undefined && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Дундаж: {exam.averageScore}%</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins} минутын өмнө эхэлсэн`;
  if (diffHours < 24) return `${diffHours} цагийн өмнө эхэлсэн`;
  return `${diffDays} өдрийн өмнө`;
}
