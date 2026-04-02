import { Card, CardContent } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { ReportStudentRow } from "../lib/report-adapters";

interface ReportSummaryCardsProps {
  averageScore: number | null;
  averageStudents: Array<Pick<ReportStudentRow, "id" | "name" | "score">>;
  failingCount: number;
  failingStudents: Array<Pick<ReportStudentRow, "id" | "name" | "score">>;
  highestScore: number | null;
  highestStudents: Array<Pick<ReportStudentRow, "id" | "name" | "score">>;
  lowestScore: number | null;
  lowestStudents: Array<Pick<ReportStudentRow, "id" | "name" | "score">>;
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
  averageStudents,
  failingCount,
  failingStudents,
  highestScore,
  highestStudents,
  lowestScore,
  lowestStudents,
}: ReportSummaryCardsProps) {
  const values: Record<SummaryCardKey, string> = {
    average: formatPercent(averageScore),
    failing: `${failingCount}`,
    highest: formatPercent(highestScore),
    lowest: formatPercent(lowestScore),
  };

  const hoverDetails: Partial<
    Record<
      SummaryCardKey,
      {
        title: string;
        description: string;
        tone: string;
        border: string;
        background: string;
        students: Array<Pick<ReportStudentRow, "id" | "name" | "score">>;
      }
    >
  > = {
    highest: {
      title: "Хамгийн өндөр оноо",
      description: `Хамгийн өндөр оноо авсан ${
        highestStudents.length
      } сурагчийн жагсаалт.`,
      tone: "text-[#006E06]",
      border: "border-[#d9e8d9]",
      background: "bg-[#f4fff6]",
      students: [...highestStudents].sort((left, right) =>
        left.name.localeCompare(right.name, "mn"),
      ),
    },
    lowest: {
      title: "Хамгийн бага оноо",
      description: `Хамгийн бага оноо авсан ${
        lowestStudents.length
      } сурагчийн жагсаалт.`,
      tone: "text-orange-700",
      border: "border-[#f1ddd1]",
      background: "bg-[#fff7f1]",
      students: [...lowestStudents].sort((left, right) =>
        left.name.localeCompare(right.name, "mn"),
      ),
    },
    failing: {
      title: "Тэнцээгүй сурагчид",
      description: `60%-аас доош оноотой ${failingStudents.length} сурагч байна.`,
      tone: "text-[#892200]",
      border: "border-[#ead9d4]",
      background: "bg-[#fffaf8]",
      students: failingStudents,
    },
  };

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {summaryCards.map((card) => {
        const hoverDetail = hoverDetails[card.key];
        const hasHover =
          hoverDetail &&
          Array.isArray(hoverDetail.students) &&
          hoverDetail.students.length > 0;
        const cardNode = (
          <Card
            key={card.key}
            className={`rounded-md bg-card/95 py-0 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)] transition-transform duration-200 ${card.toneClassName} ${
              hasHover
                ? "cursor-pointer hover:-translate-y-0.5"
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

        if (!hasHover || !hoverDetail) {
          return cardNode;
        }

        return (
          <HoverCard key={card.key} closeDelay={120} openDelay={150}>
            <HoverCardTrigger asChild>
              <div
                aria-label={`${hoverDetail.title} мэдээллийг харах`}
                className={`rounded-md outline-none focus-visible:ring-2 ${hoverDetail.tone.replace(
                  "text",
                  "focus-visible:ring",
                )}/20`}
                tabIndex={0}
              >
                {cardNode}
              </div>
            </HoverCardTrigger>
            <HoverCardContent
              align="start"
              className={`w-80 rounded-2xl border ${hoverDetail.border} ${hoverDetail.background} p-0 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.35)]`}
              side="top"
              sideOffset={10}
            >
              <div className={`border-b ${hoverDetail.border} px-4 py-3`}>
                <p
                  className={`text-sm font-semibold ${hoverDetail.tone}`}
                >
                  {hoverDetail.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {hoverDetail.description}
                </p>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto px-4 py-3">
                {hoverDetail.students.map((student, index) => (
                  <div
                    key={`${student.id}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/90 px-3 py-2"
                  >
                    <p className="truncate text-sm font-medium text-[#1f2937]">
                      {student.name}
                    </p>
                    <p className={`shrink-0 text-sm font-semibold ${hoverDetail.tone}`}>
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
