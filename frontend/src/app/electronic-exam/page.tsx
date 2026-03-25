"use client";

import {
  CirclePlus,
  ClipboardCheck,
  MoreHorizontal,
  PenTool,
  Pencil,
  Printer,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";

type ExamStatus = "Идэвхтэй" | "Төлөвлөгдсөн" | "Дууссан";

type ExamRecord = {
  id: number;
  status: ExamStatus;
  level: string;
  subject: string;
  title: string;
  questionCount: number;
  start: string;
  end: string;
  duration: number;
};

const records: ExamRecord[] = [
  {
    id: 1,
    status: "Идэвхтэй",
    level: "12-р анги",
    subject: "Иргэний ёс зүй",
    title: "Үндсэн хууль ба иргэний оролцоо",
    questionCount: 25,
    start: "2026/03/26",
    end: "2026/03/29",
    duration: 40,
  },
  {
    id: 2,
    status: "Төлөвлөгдсөн",
    level: "10-р анги",
    subject: "Физик",
    title: "Хөдөлгөөн ба хүч",
    questionCount: 20,
    start: "2026/04/02",
    end: "2026/04/04",
    duration: 30,
  },
  {
    id: 3,
    status: "Дууссан",
    level: "11-р анги",
    subject: "Математик",
    title: "Функц ба график",
    questionCount: 30,
    start: "2026/03/08",
    end: "2026/03/10",
    duration: 45,
  },
];

const actionMenuItems = [
  { label: "Засварлах", icon: Pencil },
  { label: "Устгах", icon: Trash2 },
  { label: "Шалгалт авах", icon: ClipboardCheck },
  { label: "Туршилтаар ажиллах", icon: PenTool },
  { label: "Хэвлэх", icon: Printer },
];

function normalizeDate(date: string) {
  return date.replaceAll("/", "-");
}

export default function ElectronicExamPage() {
  const [levelFilter, setLevelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const subjects = useMemo(
    () => Array.from(new Set(records.map((record) => record.subject))),
    [],
  );

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (levelFilter && record.level !== levelFilter) {
        return false;
      }
      if (statusFilter && record.status !== statusFilter) {
        return false;
      }
      if (subjectFilter && record.subject !== subjectFilter) {
        return false;
      }
      if (startDateFilter && normalizeDate(record.start) < startDateFilter) {
        return false;
      }
      if (endDateFilter && normalizeDate(record.end) > endDateFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [record.title, record.subject, record.level, record.status]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    endDateFilter,
    levelFilter,
    search,
    startDateFilter,
    statusFilter,
    subjectFilter,
  ]);

  function onSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearch(event.target.value);
  }

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-choice-menu-root="true"]')) {
        setOpenMenuId(null);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <DashboardShell>
      <div className="w-full min-h-[calc(100vh-3rem)] rounded-2xl border border-slate-200 bg-[#f6f6f7] p-5 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.3)] md:p-7">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="h-fit rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-[0_14px_35px_-30px_rgba(15,23,42,0.5)] md:px-6">
            <h1 className="text-[42px] leading-none font-semibold text-slate-900">
              Сорил
            </h1>
            <p className="mt-2 text-base text-slate-600">
              <span>Home</span>
              <span className="mx-2 text-slate-400">|</span>
              <span>Сорил</span>
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/electronic-exam/new"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#b7c6db] bg-sky-500 px-5 text-base font-semibold text-white transition hover:bg-[#d4e0f4]"
              >
                <CirclePlus className="h-5 w-5 text-white" />
                БҮТ ШАЛГАЛТ ҮҮСГЭХ
              </Link>
              <Link
                href="/electronic-exam/new"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#b7c6db] bg-sky-500 px-5 text-base font-semibold text-white transition hover:bg-[#d4e0f4]"
              >
                <CirclePlus className="h-5 w-5 text-white" />
                ШИНЭ СОРИЛ ҮҮСГЭХ
              </Link>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 p-4">
              <div className="mb-4 flex justify-end">
                <div className="relative w-full max-w-[340px]">
                  <input
                    value={search}
                    onChange={onSearchChange}
                    placeholder="Хайх..."
                    className="h-12 w-full rounded-2xl border border-[#b9c4d6] bg-white px-4 pr-12 text-base outline-none placeholder:text-slate-500 focus:border-[#8ea4c5]"
                  />
                  <Search className="pointer-events-none absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-[#3b82f6]" />
                </div>
              </div>

              <div className="overflow-visible rounded-xl border border-[#b9c4d6]">
                <table className="w-full table-fixed border-separate border-spacing-0">
                  <colgroup>
                    <col className="w-[4%]" />
                    <col className="w-[22%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[9%]" />
                  </colgroup>
                  <thead className="bg-white">
                    <tr>
                      {[
                        "№",
                        "СОРИЛЫН НЭР",
                        "ХИЧЭЭЛ",
                        "ТҮВШИН",
                        "АСУУЛТЫН ТОО",
                        "ЭХЛЭХ ОГНОО",
                        "ДУУСАХ ОГНОО",
                        "ХУГАЦАА",
                        "СОНГОЛТ",
                      ].map((head) => (
                        <th
                          key={head}
                          className="border-r border-b border-[#b9c4d6] px-2.5 py-3 text-left text-sm leading-tight font-semibold text-slate-700 last:border-r-0"
                        >
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length > 0 ? (
                      filteredRecords.map((record) => (
                        <tr key={record.id} className="bg-white">
                          <td className="border-b border-[#d0d7e3] px-2.5 py-3 text-sm text-slate-700">
                            {record.id}
                          </td>
                          <td className="border-b border-[#d0d7e3] px-2.5 py-3 text-sm leading-snug text-slate-700 break-words">
                            {record.title}
                          </td>
                          <td className="border-b border-[#d0d7e3] px-2.5 py-3 text-sm leading-snug text-slate-700 break-words">
                            {record.subject}
                          </td>
                          <td className="border-b border-[#d0d7e3] px-2.5 py-3 text-sm text-slate-700 break-words">
                            {record.level}
                          </td>
                          <td className="border-b border-[#d0d7e3] px-2.5 py-3 text-sm text-slate-700">
                            <span className="inline-flex h-9 min-w-11 items-center justify-center rounded-[14px] border border-[#d8dce2] bg-white px-2.5 text-base font-semibold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                              {record.questionCount}
                            </span>
                          </td>
                          <td className="border-b border-[#d0d7e3] px-2.5 py-3 text-sm text-slate-700">
                            {record.start}
                          </td>
                          <td className="border-b border-[#d0d7e3] px-2.5 py-3 text-sm text-slate-700">
                            {record.end}
                          </td>
                          <td className="border-b border-[#d0d7e3] px-2.5 py-3 text-sm text-slate-700">
                            {record.duration} мин
                          </td>
                          <td className="border-b border-[#d0d7e3] px-2.5 py-3 text-sm text-slate-700">
                            <div
                              className="relative flex justify-center"
                              data-choice-menu-root="true"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMenuId((current) =>
                                    current === record.id ? null : record.id,
                                  )
                                }
                                className="inline-flex h-9 w-9 items-center justify-center rounded-[16px] border border-[#99a3b1] bg-white text-[#6b7280] transition hover:bg-slate-50"
                                aria-label="Сонголтууд"
                              >
                                <MoreHorizontal className="h-5 w-5" />
                              </button>

                              {openMenuId === record.id ? (
                                <div className="absolute top-[calc(100%+8px)] right-0 z-30 w-[280px] rounded-3xl border border-[#dbe2ec] bg-white p-3 shadow-[0_18px_45px_-20px_rgba(15,23,42,0.3)]">
                                  {actionMenuItems.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                      <button
                                        key={item.label}
                                        type="button"
                                        onClick={() => setOpenMenuId(null)}
                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base text-slate-600 transition hover:bg-slate-50"
                                      >
                                        <Icon className="h-5 w-5 text-slate-500" />
                                        <span>{item.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-12 text-center text-sm text-slate-500"
                        >
                          Мэдээлэл олдсонгүй
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-5 text-base text-slate-700">
                Нийт {filteredRecords.length} илэрцийн{" "}
                {filteredRecords.length > 0 ? 1 : 0}-с {filteredRecords.length}
                -г харуулж байна.
              </p>
            </div>
          </section>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-[#f8f8f8] p-5 shadow-[0_14px_35px_-30px_rgba(15,23,42,0.5)]">
            <p className="mb-4 text-lg font-semibold text-[#1d4ed8]">
              ШҮҮЛТҮҮР
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-base font-medium text-slate-600">
                  Түвшин
                </label>
                <select
                  value={levelFilter}
                  onChange={(event) => setLevelFilter(event.target.value)}
                  className="h-12 w-full rounded-xl border border-[#b3c0d4] bg-white px-3 text-base text-slate-600 outline-none focus:border-[#8ea4c5]"
                >
                  <option value="">Сонгох</option>
                  <option value="10-р анги">10-р анги</option>
                  <option value="11-р анги">11-р анги</option>
                  <option value="12-р анги">12-р анги</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-base font-medium text-slate-600">
                  Судлагдахуун
                </label>
                <select
                  value={subjectFilter}
                  onChange={(event) => setSubjectFilter(event.target.value)}
                  className="h-12 w-full rounded-xl border border-[#b3c0d4] bg-white px-3 text-base text-slate-600 outline-none focus:border-[#8ea4c5]"
                >
                  <option value="">Сонгох</option>
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-base font-medium text-slate-600">
                  Төлөв
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as ExamStatus | "")
                  }
                  className="h-12 w-full rounded-xl border border-[#b3c0d4] bg-white px-3 text-base text-slate-600 outline-none focus:border-[#8ea4c5]"
                >
                  <option value="">Сонгох</option>
                  <option value="Идэвхтэй">Идэвхтэй</option>
                  <option value="Төлөвлөгдсөн">Төлөвлөгдсөн</option>
                  <option value="Дууссан">Дууссан</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-base font-medium text-slate-600">
                  Эхлэх огноо
                </label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(event) => setStartDateFilter(event.target.value)}
                  className="h-12 w-full rounded-xl border border-[#b3c0d4] bg-white px-3 text-base text-slate-600 outline-none focus:border-[#8ea4c5]"
                />
              </div>

              <div>
                <label className="mb-2 block text-base font-medium text-slate-600">
                  Хаагдах огноо
                </label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(event) => setEndDateFilter(event.target.value)}
                  className="h-12 w-full rounded-xl border border-[#b3c0d4] bg-white px-3 text-base text-slate-600 outline-none focus:border-[#8ea4c5]"
                />
              </div>

              <p className="pt-7 text-center text-base font-semibold tracking-wide text-[#ef4444]">
                ЦЭВЭРЛЭХ
              </p>
              <button
                type="button"
                onClick={() => {
                  setLevelFilter("");
                  setStatusFilter("");
                  setSubjectFilter("");
                  setStartDateFilter("");
                  setEndDateFilter("");
                  setSearch("");
                }}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#199ad8] text-lg font-semibold text-white transition hover:bg-[#1689c0]"
              >
                <SlidersHorizontal className="h-5 w-5" />
                ХАЙХ
              </button>
            </div>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}
