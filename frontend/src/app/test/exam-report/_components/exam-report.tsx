import type { ExamReportData } from "../lib/report-adapters";
import { ReportResultsTable } from "./report-results-table";
import { ReportScoreChart } from "./report-score-chart";
import { ReportSummaryCards } from "./report-summary-cards";
import { ReportWeakQuestions } from "./report-weak-questions";

const FAILING_SCORE_THRESHOLD = 60;
type ReportDataSource = "mock" | "real";

interface ExamReportProps {
  dataSource: ReportDataSource;
  report: ExamReportData;
}

export function ExamReport({ dataSource, report }: ExamReportProps) {
  const failingStudents = report.students.filter((student) => {
    return (
      typeof student.score === "number" &&
      student.score < FAILING_SCORE_THRESHOLD
    );
  });

  return (
    <div className="space-y-6">
      <ReportSummaryCards
        averageScore={report.summaryAverage}
        failingCount={report.failingCount}
        failingStudents={failingStudents}
        highestScore={report.highestScore}
        lowestScore={report.lowestScore}
      />

      <div className="grid items-stretch gap-6 lg:grid-cols-[0.95fr_1.05fr] xl:grid-cols-[0.9fr_1.1fr]">
        <ReportWeakQuestions questions={report.weakQuestions} />
        <ReportScoreChart
          currentClassName={report.exam.class}
          dataSource={dataSource}
          trend={report.scoreTrend}
        />
      </div>

      <ReportResultsTable
        currentClassName={report.exam.class}
        currentExamId={report.exam.id}
        rows={report.students}
        trend={report.scoreTrend}
      />
    </div>
  );
}
