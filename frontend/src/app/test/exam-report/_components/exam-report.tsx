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
  aggregateClassLabelForChart?: string | null;
  selectedClassNameForChart?: string | null;
}

export function ExamReport({
  dataSource,
  report,
  aggregateClassLabelForChart,
  selectedClassNameForChart,
}: ExamReportProps) {
  const failingStudents = report.students.filter((student) => {
    return (
      typeof student.score === "number" &&
      student.score < FAILING_SCORE_THRESHOLD
    );
  });
  const scoredStudents = report.students.filter((student) => {
    return typeof student.score === "number";
  });
  const highestStudents =
    typeof report.highestScore === "number"
      ? scoredStudents.filter((student) => student.score === report.highestScore)
      : [];
  const lowestStudents =
    typeof report.lowestScore === "number"
      ? scoredStudents.filter((student) => student.score === report.lowestScore)
      : [];

  return (
    <div className="space-y-6">
      <ReportSummaryCards
        averageScore={report.summaryAverage}
        averageStudents={scoredStudents}
        failingCount={report.failingCount}
        failingStudents={failingStudents}
        highestScore={report.highestScore}
        highestStudents={highestStudents}
        lowestScore={report.lowestScore}
        lowestStudents={lowestStudents}
      />

      <div className="grid items-stretch gap-6 lg:grid-cols-[0.95fr_1.05fr] xl:grid-cols-[0.9fr_1.1fr]">
        <ReportWeakQuestions questions={report.weakQuestions} />
        <ReportScoreChart
          currentClassName={report.exam.class}
          dataSource={dataSource}
          aggregateClassLabel={aggregateClassLabelForChart}
          selectedClassName={selectedClassNameForChart}
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
