"use client";

import { type ElementType, useEffect, useMemo, useState } from "react";
import { AiContentBadge, type AiContentSource } from "@/components/ai-content-badge";
import MathPreviewText from "@/components/math-preview-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildRuntimeApiUrl, fetchRuntimeJson } from "@/lib/runtime-api";
import { approveTakeExamAttempt } from "@/lib/take-exam-dashboard-api";
import { QuestionReview, SubmittedAttempt } from "../lib/types";

interface ReviewTabProps {
  attempts: SubmittedAttempt[];
  onApproved?: () => void;
}

export function ReviewTab({ attempts, onApproved }: ReviewTabProps) {
  const [approvingAttemptId, setApprovingAttemptId] = useState<string | null>(
    null,
  );
  const [explanationDrafts, setExplanationDrafts] = useState<
    Record<string, string>
  >({});
  const [loadingExplanationKeys, setLoadingExplanationKeys] = useState<
    Record<string, true>
  >({});
  const [explanationSources, setExplanationSources] = useState<
    Record<string, AiContentSource>
  >({});
  const [manualScores, setManualScores] = useState<Record<string, number>>({});
  const [reviewedQuestions, setReviewedQuestions] = useState<Record<string, true>>(
    {},
  );
  const [selectedMonitoringDialog, setSelectedMonitoringDialog] = useState<{
    attemptId: string;
    type: "warning" | "danger" | "focus";
  } | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(
    attempts[0]?.id ?? null,
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    attempts[0]?.questions[0]?.id ?? null,
  );

  useEffect(() => {
    if (attempts.length === 0) {
      setSelectedAttemptId(null);
      setSelectedQuestionId(null);
      return;
    }

    const hasSelectedAttempt = attempts.some(
      (attempt) => attempt.id === selectedAttemptId,
    );
    const nextAttempt = hasSelectedAttempt
      ? attempts.find((attempt) => attempt.id === selectedAttemptId) ?? attempts[0]
      : attempts[0];

    if (nextAttempt.id !== selectedAttemptId) {
      setSelectedAttemptId(nextAttempt.id);
    }

    const hasSelectedQuestion = nextAttempt.questions.some(
      (question) => question.id === selectedQuestionId,
    );
    const nextQuestionId = hasSelectedQuestion
      ? selectedQuestionId
      : nextAttempt.questions[0]?.id ?? null;

    if (nextQuestionId !== selectedQuestionId) {
      setSelectedQuestionId(nextQuestionId);
    }
  }, [attempts, selectedAttemptId, selectedQuestionId]);

  const selectedAttempt = useMemo(
    () =>
      attempts.find((attempt) => attempt.id === selectedAttemptId) ??
      attempts[0] ??
      null,
    [attempts, selectedAttemptId],
  );

  const selectedQuestion = useMemo(
    () =>
      selectedAttempt?.questions.find(
        (question) => question.id === selectedQuestionId,
      ) ??
      selectedAttempt?.questions[0] ??
      null,
    [selectedAttempt, selectedQuestionId],
  );
  const selectedQuestionKey =
    selectedAttempt && selectedQuestion
      ? getQuestionKey(selectedAttempt.id, selectedQuestion.id)
      : null;

  useEffect(() => {
    if (!selectedQuestion || !selectedAttempt) {
      setScoreInput("");
      return;
    }

    const questionKey = getQuestionKey(selectedAttempt.id, selectedQuestion.id);
    const nextScore = manualScores[questionKey] ?? selectedQuestion.points;
    setScoreInput(String(nextScore));
  }, [manualScores, selectedAttempt, selectedQuestion]);

  const attemptScorePreview = useMemo(() => {
    if (!selectedAttempt) {
      return null;
    }

    const hasPendingManualReview = selectedAttempt.questions.some((question) => {
      if (!question.requiresManualReview) {
        return false;
      }

      const questionKey = getQuestionKey(selectedAttempt.id, question.id);
      return !reviewedQuestions[questionKey];
    });

    const earnedPoints = selectedAttempt.questions.reduce((sum, question) => {
      const questionKey = getQuestionKey(selectedAttempt.id, question.id);
      return sum + (manualScores[questionKey] ?? question.points);
    }, 0);
    const maxPoints = selectedAttempt.questions.reduce(
      (sum, question) => sum + question.maxPoints,
      0,
    );

    return {
      earnedPoints,
      hasPendingManualReview,
      maxPoints,
      percentage:
        maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0,
    };
  }, [manualScores, reviewedQuestions, selectedAttempt]);
  const selectedQuestionEffectiveState = getEffectiveReviewState(
    selectedAttempt,
    selectedQuestion,
    manualScores,
    reviewedQuestions,
  );
  const selectedQuestionFallbackExplanation = selectedQuestion
    ? hasMeaningfulReviewText(
        selectedQuestion.aiAnalysis,
        selectedQuestion.explanation,
      )
      ? getDefaultReviewExplanation(selectedQuestion)
      : buildLocalExplanationFallback(selectedQuestion)
    : "";
  const selectedQuestionExplanation =
    selectedQuestion && selectedQuestionKey
      ? explanationDrafts[selectedQuestionKey] ??
        selectedQuestionFallbackExplanation
      : "";
  const selectedQuestionAiSource =
    (selectedQuestionKey ? explanationSources[selectedQuestionKey] : undefined) ??
    selectedQuestion?.aiSource;
  const showReviewAdvice =
    selectedQuestionEffectiveState !== "correct" && Boolean(selectedQuestion);

  const waitingCount = attempts.filter(
    (attempt) => attempt.status !== "reviewed",
  ).length;
  const selectedMonitoringEvents =
    selectedAttempt && selectedMonitoringDialog
      ? selectedAttempt.monitoringSummary.events.filter(
          (event) => event.type === selectedMonitoringDialog.type,
        )
      : [];

  useEffect(() => {
    if (
      !selectedAttempt ||
      !selectedQuestion ||
      !selectedQuestionKey ||
      !showReviewAdvice
    ) {
      return;
    }

    if (explanationDrafts[selectedQuestionKey]?.trim()) {
      return;
    }

    if (hasMeaningfulReviewText(selectedQuestion.aiAnalysis, selectedQuestion.explanation)) {
      return;
    }

    let cancelled = false;
    const localFallback = buildLocalExplanationFallback(selectedQuestion);

    setExplanationDrafts((current) =>
      current[selectedQuestionKey]
        ? current
        : {
            ...current,
            [selectedQuestionKey]: localFallback,
          },
    );

    setLoadingExplanationKeys((current) =>
      current[selectedQuestionKey]
        ? current
        : { ...current, [selectedQuestionKey]: true },
    );

    void fetchRuntimeJson<{
      feedback?: string;
      source?: AiContentSource;
    }>("/api/take-exam-question-feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        competency: selectedQuestion.competency,
        correctAnswer: normalizeUnavailableAnswer(selectedQuestion.correctAnswer),
        questionText: selectedQuestion.questionText,
        questionType: selectedQuestion.questionType,
        studentAnswer: selectedQuestion.studentAnswer,
      }),
    })
      .then((payload) => {
        if (cancelled || !payload.feedback?.trim()) {
          return;
        }

        setExplanationDrafts((current) =>
          !current[selectedQuestionKey] ||
          current[selectedQuestionKey] === localFallback
            ? {
                ...current,
                [selectedQuestionKey]: payload.feedback!.trim(),
              }
            : current,
        );
        if (payload.source) {
          const nextSource = payload.source as AiContentSource;
          setExplanationSources((current) => ({
            ...current,
            [selectedQuestionKey]: nextSource,
          }));
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setExplanationDrafts((current) => current);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setLoadingExplanationKeys((current) => {
          const next = { ...current };
          delete next[selectedQuestionKey];
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    explanationDrafts,
    selectedAttempt,
    selectedQuestion,
    selectedQuestionKey,
    showReviewAdvice,
  ]);

  const handleSaveManualScore = () => {
    if (!selectedAttempt || !selectedQuestion) {
      return;
    }

    const parsed = Number(scoreInput);
    const normalized = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 0), selectedQuestion.maxPoints)
      : 0;
    const questionKey = getQuestionKey(selectedAttempt.id, selectedQuestion.id);

    setManualScores((current) => ({
      ...current,
      [questionKey]: normalized,
    }));
    setReviewedQuestions((current) => ({
      ...current,
      [questionKey]: true,
    }));
    setScoreInput(String(normalized));
  };

  const handleQuickEditReview = () => {
    if (!selectedAttempt || !selectedQuestion || typeof window === "undefined") {
      return;
    }

    const questionKey = getQuestionKey(selectedAttempt.id, selectedQuestion.id);
    const currentScore = String(
      manualScores[questionKey] ?? selectedQuestion.points ?? 0,
    );
    const nextScore = window.prompt(
      `${selectedQuestion.maxPoints} онооноос хэдэн оноо өгөх вэ?`,
      currentScore,
    );

    if (nextScore === null) {
      return;
    }

    const parsed = Number(nextScore);
    const normalized = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 0), selectedQuestion.maxPoints)
      : 0;

    setManualScores((current) => ({
      ...current,
      [questionKey]: normalized,
    }));
    setReviewedQuestions((current) => ({
      ...current,
      [questionKey]: true,
    }));
    setScoreInput(String(normalized));

    const currentExplanation =
      explanationDrafts[questionKey] ?? getDefaultReviewExplanation(selectedQuestion);
    const nextExplanation = window.prompt(
      "Тайлбар / зөвлөмжийг шинэчлэх үү?",
      currentExplanation,
    );

    if (nextExplanation !== null) {
      setExplanationDrafts((current) => ({
        ...current,
        [questionKey]: nextExplanation,
      }));
    }
  };

  const handleMarkReviewed = () => {
    if (!selectedAttempt || !selectedQuestion) {
      return;
    }

    const questionKey = getQuestionKey(selectedAttempt.id, selectedQuestion.id);
    setReviewedQuestions((current) => ({
      ...current,
      [questionKey]: true,
    }));
  };

  const handleApproveAttempt = async () => {
    if (!selectedAttempt) {
      return;
    }

    const review = {
      questionReviews: selectedAttempt.questions.map((question) => {
        const questionKey = getQuestionKey(selectedAttempt.id, question.id);
        const pointsAwarded = clampScore(
          manualScores[questionKey] ?? question.points,
          question.maxPoints,
        );
        const explanation =
          explanationDrafts[questionKey] ?? getDefaultReviewExplanation(question);
        const reviewState = getEffectiveReviewState(
          selectedAttempt,
          question,
          manualScores,
          reviewedQuestions,
        );

        return {
          explanation: explanation.trim() || null,
          isCorrect: reviewState === "correct",
          maxPoints: question.maxPoints,
          pointsAwarded,
          questionId: question.id,
        };
      }),
    };

    setApprovingAttemptId(selectedAttempt.id);

    try {
      await approveTakeExamAttempt({
        attemptId: selectedAttempt.id,
        review,
      });

      onApproved?.();
    } finally {
      setApprovingAttemptId(null);
    }
  };

  if (attempts.length === 0) {
    return (
      <Card className="flex h-full min-h-[480px] items-center justify-center rounded-2xl border-border bg-card">
        <div className="text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Хянах илгээмж хараахан ирээгүй байна.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[438px_minmax(0,1fr)]">
      <Card className="flex min-h-0 flex-col overflow-hidden rounded-[18px] border border-[#dfe5ee] bg-card shadow-none">
        <div className="border-b border-[#e7ecf3] px-6 py-5">
          <h3 className="text-[17px] font-medium text-foreground">
            Хянах дараалал
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {waitingCount} хүлээж байна
          </p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_120px_60px] border-b border-[#eef2f6] px-6 py-4 text-[13px] text-muted-foreground">
          <span>Оюутан</span>
          <span>Төлөв</span>
          <span className="text-right">Тоо</span>
        </div>

        <ScrollArea className="h-[720px]">
          <div className="divide-y divide-border">
            {attempts.map((attempt) => (
              <button
                key={attempt.id}
                type="button"
                onClick={() => {
                  setSelectedAttemptId(attempt.id);
                  setSelectedQuestionId(attempt.questions[0]?.id ?? null);
                }}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1fr)_120px_60px] items-center gap-3 px-6 py-4 text-left transition-colors",
                  selectedAttempt?.id === attempt.id
                    ? "bg-[#f8fbff]"
                    : "hover:bg-[#fafcff]",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <CircleUserRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {attempt.studentName}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatTime(attempt.submissionTime)}
                    </p>
                  </div>
                </div>

                <div>
                  <ReviewStatusBadge status={attempt.status} />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <span className="text-[15px] text-foreground">
                    {attempt.reviewableItems}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <Card className="flex min-h-0 flex-col overflow-hidden rounded-[18px] border border-[#dfe5ee] bg-card shadow-none">
        {selectedAttempt ? (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-[#e7ecf3] px-6 py-5">
              <div>
                <h3 className="text-[15px] font-medium text-foreground">
                  {selectedAttempt.studentName}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                  <span>
                    Оноо:{" "}
                    {attemptScorePreview
                      ? attemptScorePreview.hasPendingManualReview
                        ? "Хүлээгдэж байна"
                        : `${attemptScorePreview.percentage}%`
                      : selectedAttempt.score !== undefined
                        ? `${selectedAttempt.score}%`
                      : "Хүлээгдэж байна"}
                  </span>
                  <span>•</span>
                  <span>
                    Эх сурвалж:{" "}
                    {selectedAttempt.answerKeySource === "teacher_service"
                      ? "Гараар"
                      : selectedAttempt.answerKeySource === "local"
                        ? "Автомат"
                        : selectedAttempt.answerKeySource}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-[10px] border-[#dbe3ec] bg-[#f8fafc] px-4 text-[13px] font-medium text-foreground shadow-none hover:bg-[#f1f5f9]"
                >
                  Алгасах
                </Button>
                <Button
                  size="sm"
                  className="h-9 rounded-[10px] px-4 text-[13px] font-medium shadow-none"
                  disabled={approvingAttemptId === selectedAttempt.id}
                  onClick={handleApproveAttempt}
                >
                  Бүгдийг батлах
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 border-b border-[#e7ecf3] px-6 py-3.5 text-[13px] text-muted-foreground">
              <ReviewMetaItem
                icon={AlertTriangle}
                label="Анхааруулгууд"
                onClick={() =>
                  setSelectedMonitoringDialog({
                    attemptId: selectedAttempt.id,
                    type: "warning",
                  })
                }
                tone="text-warning"
                value={selectedAttempt.monitoringSummary.warningCount}
              />
              <ReviewMetaItem
                icon={XCircle}
                label="Аюултай"
                onClick={() =>
                  setSelectedMonitoringDialog({
                    attemptId: selectedAttempt.id,
                    type: "danger",
                  })
                }
                tone="text-danger"
                value={selectedAttempt.monitoringSummary.dangerCount}
              />
              <ReviewMetaItem
                icon={Clock3}
                label="Анхаарал алдсан"
                onClick={() =>
                  setSelectedMonitoringDialog({
                    attemptId: selectedAttempt.id,
                    type: "focus",
                  })
                }
                tone="text-muted-foreground"
                value={selectedAttempt.monitoringSummary.focusLostCount}
              />
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="w-[152px] border-r border-[#e7ecf3] bg-[#fdfefe]">
                <ScrollArea className="h-full">
                  <div className="p-2.5">
                    {selectedAttempt.questions.map((question) => {
                      const effectiveReviewState = getEffectiveReviewState(
                        selectedAttempt,
                        question,
                        manualScores,
                        reviewedQuestions,
                      );

                      return (
                        <button
                          key={question.id}
                          className={cn(
                            "mb-1 flex w-full items-center justify-between rounded-[10px] border px-3 py-2.5 text-left text-[14px] transition-colors",
                            getQuestionRailClassName(
                              effectiveReviewState,
                              selectedQuestion?.id === question.id,
                            ),
                          )}
                          onClick={() => setSelectedQuestionId(question.id)}
                          type="button"
                        >
                          <span>{`Асуулт ${question.questionNumber}`}</span>
                          <QuestionStateIcon reviewState={effectiveReviewState} />
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              <div className="min-h-0 flex-1">
                <ScrollArea className="h-full">
                  {selectedQuestion ? (
                    <div className="space-y-5 p-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Асуулт {selectedQuestion.questionNumber}
                        </p>
                        <MathPreviewText
                          content={selectedQuestion.questionText}
                          className="mt-2.5 text-[15px] leading-7 text-foreground"
                          displayMode={selectedQuestion.questionType === "math"}
                        />
                      </div>

                      <div className="border-t border-[#e7ecf3]" />

                      <AnswerBlock
                        badgeClassName={getAnswerBadgeClassName(
                          selectedQuestionEffectiveState,
                        )}
                        badgeLabel={getQuestionBadgeLabel(
                          selectedQuestion,
                          selectedAttempt,
                          manualScores,
                          reviewedQuestions,
                        )}
                        className={getStudentAnswerClassName(
                          selectedQuestionEffectiveState,
                        )}
                        displayMode={selectedQuestion.questionType === "math"}
                        forceMath={selectedQuestion.questionType === "math"}
                        title="ОЮУТНЫ ХАРИУЛТ"
                        value={selectedQuestion.studentAnswer}
                      />

                      {Boolean(
                        normalizeUnavailableAnswer(selectedQuestion.correctAnswer),
                      ) && (
                        <AnswerBlock
                          className="border-[#dfe5ee] bg-[#f7f9fc]"
                          displayMode={selectedQuestion.questionType === "math"}
                          forceMath={selectedQuestion.questionType === "math"}
                          title="ЗӨВ ХАРИУЛТ"
                          value={normalizeUnavailableAnswer(
                            selectedQuestion.correctAnswer,
                          )}
                        />
                      )}

                      {showReviewAdvice ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              ТАЙЛБАР
                            </h4>
                            <AiContentBadge source={selectedQuestionAiSource} />
                          </div>
                          <MathPreviewText
                            content={selectedQuestionExplanation}
                            className="text-[14px] leading-7 text-foreground/85"
                          />
                        </div>
                      ) : null}

                      {(selectedQuestion.requiresManualReview ||
                        selectedQuestionEffectiveState !== "correct") && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 flex-1 rounded-[8px] border-[#dbe3ec] bg-[#f8fafc] text-[14px] font-medium text-foreground shadow-none hover:bg-[#f1f5f9]"
                            onClick={handleQuickEditReview}
                          >
                            Оноо өөрчлөх
                          </Button>
                          <Button
                            size="sm"
                            className="h-10 flex-1 rounded-[8px] text-[14px] font-medium shadow-none"
                            onClick={handleMarkReviewed}
                          >
                            Хянасан гэж тэмдэглэх
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                      Хянах асуултыг сонгоно уу
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </>
        ) : null}
      </Card>

      <Dialog
        open={
          Boolean(selectedAttempt) &&
          Boolean(selectedMonitoringDialog) &&
          selectedMonitoringDialog?.attemptId === selectedAttempt?.id
        }
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMonitoringDialog(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedMonitoringDialog?.type === "warning"
                ? "Анхааруулгын дэлгэрэнгүй"
                : selectedMonitoringDialog?.type === "danger"
                  ? "Аюултай дохионы дэлгэрэнгүй"
                  : "Анхаарал алдсан үйлдлүүд"}
            </DialogTitle>
            <DialogDescription>
              {selectedAttempt?.studentName} дээр бүртгэгдсэн хяналтын event-үүд.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[420px] pr-4">
            <div className="space-y-3">
              {selectedMonitoringEvents.length > 0 ? (
                selectedMonitoringEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {event.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {event.code ?? "event"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          event.severity === "danger"
                            ? "border-danger/30 bg-danger/10 text-danger"
                            : event.type === "focus"
                              ? "border-info/30 bg-info/10 text-info"
                              : "border-warning/30 bg-warning/10 text-warning"
                        }
                      >
                        {formatMonitoringType(event.type)}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-foreground/90">
                      {event.detail}
                    </p>
                    {event.mode || event.screenshotUrl ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {event.mode ? (
                          <Badge variant="outline" className="text-[10px]">
                            {formatMonitoringCaptureMode(event.mode)}
                          </Badge>
                        ) : null}
                        {event.screenshotUrl ? (
                          <a
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-medium text-foreground hover:bg-secondary"
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
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDateTime(event.occurredAt)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Энэ төрөл дээр харуулах event алга байна.
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getQuestionKey(attemptId: string, questionId: string) {
  return `${attemptId}:${questionId}`;
}

function clampScore(value: number, maxPoints: number) {
  return Math.max(0, Math.min(Math.round(value), maxPoints));
}

function getDefaultReviewExplanation(question: QuestionReview) {
  return (
    question.aiAnalysis ??
    question.explanation ??
    "Тайлбар хараахан нэмэгдээгүй байна."
  );
}

function hasMeaningfulReviewText(...values: Array<string | undefined>) {
  return values.some((value) => {
    const trimmed = value?.trim();
    return Boolean(
      trimmed &&
        trimmed !== "AI дүгнэлт хараахан ирээгүй байна." &&
        trimmed !== "Тайлбар хараахан нэмэгдээгүй байна.",
    );
  });
}

function formatMonitoringCaptureMode(mode?: string) {
  switch (mode) {
    case "screen-capture-enabled":
      return "Screen capture";
    case "fallback-dom-capture":
      return "Fallback capture";
    case "limited-monitoring":
      return "Limited monitoring";
    default:
      return "Monitoring";
  }
}

function normalizeUnavailableAnswer(value: string) {
  const trimmed = value.trim();
  return trimmed === "Зөв хариулт ирээгүй" ? "" : trimmed;
}

function buildLocalExplanationFallback(question: QuestionReview) {
  const studentAnswer = question.studentAnswer.trim();
  const correctAnswer = normalizeUnavailableAnswer(question.correctAnswer);
  const prompt = question.questionText.trim();
  const subtractionMatch = prompt
    .replace(/\s+/g, " ")
    .replace(/[=?:]+/g, " ")
    .replace(/[^\d+\- ]/g, " ")
    .match(/(^| )(-?\d+)\s*-\s*(-?\d+)( |$)/);

  if (
    subtractionMatch &&
    studentAnswer &&
    correctAnswer &&
    !studentAnswer.startsWith("-") &&
    correctAnswer.startsWith("-")
  ) {
    return `Та ${subtractionMatch[2]}-${subtractionMatch[3]} үйлдлийн тэмдгийг алдсан байна. Бага тооноос их тоог хасахад хариу сөрөг тэмдэгтэй гардаг тул ${correctAnswer} гэж бодох ёстой. Тооны шулуун ашиглаад ижил төрлийн жишээг дахин ажиллаарай.`;
  }

  if (
    question.questionType === "math" &&
    correctAnswer.includes("+ C") &&
    studentAnswer &&
    !studentAnswer.includes("+ C")
  ) {
    return `Та үндсэн илэрхийллээ олсон ч интегралын тогтмол болох +C-г орхигдуулсан байна. Эцсийн хариуг ${correctAnswer} хэлбэрээр бичих ёстойг дахин анхаараарай.`;
  }

  if (studentAnswer && correctAnswer) {
    return `Таны хариулт "${studentAnswer}" байсан ч зөв хариулт нь "${correctAnswer}" байна. Гол ойлголт болон бодолтын дарааллаа дахин шалгаж, ижил төрлийн жишээ ажиллаарай.`;
  }

  if (correctAnswer) {
    return `Энэ асуултад хариулаагүй эсвэл дутуу хариулсан байна. Зөв хариулт нь "${correctAnswer}" юм. Суурь дүрэм, жишээ бодлогуудаа дахин давтаарай.`;
  }

  return "Энэ асуултын гол ойлголтоо дахин нэгтгэж, бодолтын алхам бүрээ тайлбарлаж давтах хэрэгтэй байна.";
}

function getAnswerBadgeClassName(reviewState: QuestionReview["reviewState"]) {
  if (reviewState === "correct") {
    return "border-success/25 bg-emerald-100 text-emerald-700 shadow-none";
  }

  if (reviewState === "incorrect") {
    return "border-danger/25 bg-rose-100 text-rose-700 shadow-none";
  }

  return "border-info/25 bg-sky-100 text-sky-700 shadow-none";
}

function getStudentAnswerClassName(reviewState: QuestionReview["reviewState"]) {
  if (reviewState === "correct") {
    return "border-emerald-200 bg-emerald-50";
  }

  if (reviewState === "incorrect") {
    return "border-rose-200 bg-rose-50";
  }

  return "border-sky-200 bg-sky-50";
}

function getQuestionRailClassName(
  reviewState: QuestionReview["reviewState"],
  selected: boolean,
) {
  if (selected) {
    return "border-[#93c5fd] bg-[#f7fbff] text-foreground shadow-none";
  }

  if (reviewState === "correct") {
    return "border-transparent bg-transparent text-foreground hover:bg-[#f7fbff]";
  }

  if (reviewState === "incorrect") {
    return "border-transparent bg-transparent text-foreground hover:bg-[#fff8f8]";
  }

  return "border-transparent bg-transparent text-muted-foreground hover:bg-secondary/30 hover:text-foreground";
}

function QuestionStateIcon({
  reviewState,
}: {
  reviewState: QuestionReview["reviewState"];
}) {
  if (reviewState === "correct") {
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  }

  if (reviewState === "incorrect") {
    return <XCircle className="h-4 w-4 text-danger" />;
  }

  return <Clock3 className="h-4 w-4 text-info" />;
}

function getEffectiveReviewState(
  attempt: SubmittedAttempt | null,
  question: QuestionReview | null,
  manualScores: Record<string, number>,
  reviewedQuestions: Record<string, true>,
): QuestionReview["reviewState"] {
  if (!attempt || !question || !question.requiresManualReview) {
    if (!attempt || !question) {
      return question?.reviewState ?? "pending";
    }

    const questionKey = getQuestionKey(attempt.id, question.id);
    if (!(questionKey in manualScores) && !reviewedQuestions[questionKey]) {
      return question.reviewState;
    }
  }

  const questionKey = getQuestionKey(attempt.id, question.id);
  if (!reviewedQuestions[questionKey]) {
    return "pending";
  }

  const effectivePoints = manualScores[questionKey] ?? question.points;
  if (effectivePoints >= question.maxPoints) {
    return "correct";
  }

  return "incorrect";
}

function getQuestionBadgeLabel(
  question: QuestionReview,
  attempt: SubmittedAttempt | null,
  manualScores: Record<string, number>,
  reviewedQuestions: Record<string, true>,
) {
  if (!attempt || !question.requiresManualReview) {
    if (question.reviewState === "pending") {
      return "Хүлээгдэж байна";
    }

    return `${question.points}/${question.maxPoints} pts`;
  }

  const questionKey = getQuestionKey(attempt.id, question.id);
  if (!reviewedQuestions[questionKey]) {
    return "Хүлээгдэж байна";
  }

  const effectivePoints = manualScores[questionKey] ?? question.points;
  return `${effectivePoints}/${question.maxPoints} pts`;
}

function AnswerBlock({
  badgeClassName,
  badgeLabel,
  className,
  contentClassName,
  displayMode,
  forceMath,
  title,
  value,
}: {
  badgeClassName?: string;
  badgeLabel?: string;
  className: string;
  contentClassName?: string;
  displayMode?: boolean;
  forceMath?: boolean;
  title: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h4>
        {badgeLabel ? (
          <Badge
            variant="outline"
            className={cn("rounded-full px-2 py-0.5 text-[12px]", badgeClassName)}
          >
            {badgeLabel}
          </Badge>
        ) : null}
      </div>
      <div
        className={cn(
          "mt-2 rounded-[8px] border px-4 py-3 text-sm text-foreground",
          className,
        )}
      >
        <MathPreviewText
          content={value}
          className={cn("leading-7", contentClassName)}
          displayMode={displayMode}
          forceMath={forceMath}
        />
      </div>
    </div>
  );
}

function ReviewMetaItem({
  icon: Icon,
  label,
  onClick,
  tone,
  value,
}: {
  icon: ElementType;
  label: string;
  onClick?: () => void;
  tone: string;
  value: number;
}) {
  const content = (
    <div className="flex items-center gap-2 text-[13px]">
      <Icon className={cn("h-3.5 w-3.5", tone)} />
      <span className="font-medium text-foreground">{value}</span>
      <span>{label}</span>
    </div>
  );

  if (!onClick) {
    return content;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-1 py-0.5 transition-colors hover:bg-secondary/60"
    >
      {content}
    </button>
  );
}

function ReviewStatusBadge({ status }: { status: SubmittedAttempt["status"] }) {
  const configs: Record<
    SubmittedAttempt["status"],
    { className: string; label: string }
  > = {
    pending: {
      className: "border-warning/30 bg-warning/15 text-warning",
      label: "Хүлээж байна",
    },
    "in-review": {
      className: "border-info/30 bg-sky-100 text-sky-700",
      label: "Хянаж байна",
    },
    reviewed: {
      className: "border-success/30 bg-success/15 text-success",
      label: "Хянасан",
    },
  };

  const config = configs[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 justify-center rounded-full px-2.5 text-[11px] whitespace-nowrap shadow-none",
        config.className,
      )}
    >
      {config.label}
    </Badge>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("sv-SE", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMonitoringType(type: "warning" | "danger" | "focus") {
  switch (type) {
    case "danger":
      return "Аюултай";
    case "focus":
      return "Анхаарал алдсан";
    default:
      return "Анхааруулга";
  }
}
