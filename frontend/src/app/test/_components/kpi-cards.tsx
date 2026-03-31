"use client";

import { Card } from "@/components/ui/card";
import { Users, TrendingUp, AlertTriangle, ClipboardCheck } from "lucide-react";
import { Student } from "../lib/types";

interface KPICardsProps {
  students: Student[];
}

export function KPICards({ students }: KPICardsProps) {
  const totalStudents = students.length;
  const avgProgress =
    students.length > 0
      ? Math.round(
          students.reduce((sum, s) => sum + s.progress, 0) / students.length,
        )
      : 0;
  const highRiskCount = students.filter((s) => s.riskLevel === "high").length;
  const pendingReview = students.filter(
    (s) => s.status === "submitted" || s.status === "processing",
  ).length;

  const kpis = [
    {
      label: "Нийт оюутан",
      value: totalStudents,
      icon: Users,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      label: "Дундаж явц",
      value: `${avgProgress}%`,
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      label: "Өндөр эрсдэл",
      value: highRiskCount,
      icon: AlertTriangle,
      color: "text-danger",
      bgColor: "bg-danger/10",
    },
    {
      label: "Хүлээж буй шалгалт",
      value: pendingReview,
      icon: ClipboardCheck,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {kpi.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {kpi.value}
              </p>
            </div>
            <div className={`rounded-lg p-2.5 ${kpi.bgColor}`}>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
