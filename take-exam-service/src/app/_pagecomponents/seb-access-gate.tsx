"use client";

import { Loader2, RefreshCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type SebAccessGateProps = {
  isChecking: boolean;
  message: string | null;
  onRetry: () => void;
};

function SebGateSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-5 w-48 bg-slate-200" />
        <Skeleton className="h-10 w-80 bg-slate-200" />
        <Skeleton className="h-4 w-[30rem] bg-slate-200" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-36 rounded-2xl bg-slate-200" />
        <Skeleton className="h-36 rounded-2xl bg-slate-200" />
        <Skeleton className="h-36 rounded-2xl bg-slate-200" />
      </div>

      <Skeleton className="h-64 rounded-3xl bg-slate-200" />
    </div>
  );
}

export function SebAccessGate({
  isChecking,
  message,
  onRetry,
}: SebAccessGateProps) {
  return (
    <div className="min-h-screen bg-[#eceff3] p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[1440px] items-center justify-center">
        <div className="w-full rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-8 flex items-start gap-4">
            <div
              className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${
                isChecking
                  ? "bg-[#e6f5fd] text-[#1695d9]"
                  : "bg-rose-50 text-rose-600"
              }`}
            >
              {isChecking ? (
                <ShieldCheck className="h-7 w-7" />
              ) : (
                <ShieldAlert className="h-7 w-7" />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Safe Exam Browser
              </p>
              <h1 className="text-3xl font-semibold text-slate-900">
                {isChecking
                  ? "SEB орчныг шалгаж байна"
                  : "SEB баталгаажуулалт шаардлагатай"}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-500">
                {isChecking
                  ? "Шалгалтын орчин хамгаалагдсан эсэхийг нягталж байна. Баталгаажуулалт амжилттай болмогц шалгалтын жагсаалт автоматаар харагдана."
                  : message ||
                    "Энэ шалгалтыг зөвхөн Safe Exam Browser-ээр нээх шаардлагатай."}
              </p>
            </div>
          </div>

          {isChecking ? (
            <SebGateSkeleton />
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-slate-900">
                    Safe Exam Browser-ээр дахин нээнэ үү
                  </p>
                  <p className="max-w-2xl text-sm text-slate-500">
                    Зөв SEB session-ээр орсон үед тестүүд нээгдэнэ. Хэрэв SEB
                    дотроос нээсэн бол доорх товчоор дахин шалгаж болно.
                  </p>
                </div>

                <button
                  onClick={onRetry}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#18a7eb] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f95d6]"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Дахин шалгах
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Loader2
              className={`h-4 w-4 ${isChecking ? "animate-spin" : "hidden"}`}
            />
            <span>
              {isChecking
                ? "SEB verification хүлээгдэж байна..."
                : "SEB баталгаажуулалт амжилтгүй байна."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
