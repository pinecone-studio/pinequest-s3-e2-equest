import { Card, CardContent } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { ReportStudentRow } from "../lib/report-adapters";

interface ReportSummaryCardsProps {
  averageScore: number | null;
  failingCount: number;
  failingStudents: Array<Pick<ReportStudentRow, "id" | "name" | "score">>;
  highestScore: number | null;
  lowestScore: number | null;
}

type SummaryCardKey = "average" | "failing" | "highest" | "lowest";

interface SummaryCard {
  key: SummaryCardKey;
  label: string;
  labelClassName?: string;
  toneClassName: string;
  valueClassName: string;
}

const summaryCards: SummaryCard[] = [
  {
    key: "average",
    label: "Дундаж оноо",
    toneClassName: "border-l-[4px] border-l-[#00478D]",
    valueClassName: "text-[#00478D]",
  },
  {
    key: "highest",
    label: "Хамгийн өндөр оноо",
    toneClassName: "border-l-[4px] border-l-[#006E06]",
    valueClassName: "text-[#006E06]",
  },
  {
    key: "lowest",
    label: "Хамгийн бага оноо",
    toneClassName: "border-l-[4px] border-l-orange-700",
    valueClassName: "text-orange-700",
  },
  {
    key: "failing",
    label: "Тэнцээгүй сурагчид",

    toneClassName: "border-l-[4px] border-l-[#892200]",
    valueClassName: "text-foreground",
  },
] as const;

export function ReportSummaryCards({
  averageScore,
  failingCount,
  failingStudents,
  highestScore,
  lowestScore,
}: ReportSummaryCardsProps) {
  const values: Record<SummaryCardKey, string> = {
    average: formatPercent(averageScore),
    failing: `${failingCount}`,
    highest: formatPercent(highestScore),
    lowest: formatPercent(lowestScore),
  };

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {summaryCards.map((card) => {
        const cardNode = (
          <Card
            key={card.key}
            className={`rounded-md bg-card/95 py-0 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)] transition-transform duration-200 ${card.toneClassName} ${
              card.key === "failing" && failingStudents.length > 0
                ? "cursor-help hover:-translate-y-0.5"
                : ""
            }`}
          >
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${
                    card.labelClassName ?? "text-muted-foreground"
                  }`}
                >
                  {card.label}
                </p>
                <p
                  className={`mt-5 text-4xl font-semibold ${card.valueClassName}`}
                >
                  {values[card.key]}
                </p>
              </div>
            </CardContent>
          </Card>
        );

        if (card.key !== "failing" || failingStudents.length === 0) {
          return cardNode;
        }

        return (
          <HoverCard key={card.key} closeDelay={120} openDelay={150}>
            <HoverCardTrigger asChild>
              <div
                aria-label={`Тэнцээгүй ${failingStudents.length} сурагчийн мэдээллийг харах`}
                className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#892200]/20"
                tabIndex={0}
              >
                {cardNode}
              </div>
            </HoverCardTrigger>
            <HoverCardContent
              align="start"
              className="w-80 rounded-2xl border border-[#ead9d4] bg-[#fffaf8] p-0 shadow-[0_20px_45px_-30px_rgba(137,34,0,0.45)]"
              side="top"
              sideOffset={10}
            >
              <div className="border-b border-[#ead9d4] px-4 py-3">
                <p className="text-sm font-semibold text-[#892200]">
                  Тэнцээгүй сурагчид
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#7c5a4b]">
                  60%-аас доош оноотой {failingStudents.length} сурагч байна.
                </p>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto px-4 py-3">
                {failingStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/90 px-3 py-2"
                  >
                    <p className="truncate text-sm font-medium text-[#1f2937]">
                      {student.name}
                    </p>
                    <p className="shrink-0 text-sm font-semibold text-[#892200]">
                      {formatPercent(student.score)}
                    </p>
                  </div>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
}

function formatPercent(value: number | null): string {
  if (typeof value !== "number") {
    return "--";
  }

  return `${value.toFixed(1)}%`;
}
