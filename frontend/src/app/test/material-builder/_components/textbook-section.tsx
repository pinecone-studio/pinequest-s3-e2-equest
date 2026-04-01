"use client";

import { BookOpen, ChevronDown, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  textbookDifficultyStats,
  textbookSections,
  textbookTypeStats,
  textareaClassName,
} from "./material-builder-config";
import {
  TextbookBadgeField,
  TextbookQuestionCard,
  TextbookStatField,
} from "./material-builder-ui";

export function TextbookSection() {
  return (
    <section className="mt-5 space-y-4">
      <div className="flex items-center gap-3 text-[15px] font-semibold text-slate-900">
        <BookOpen className="h-5 w-5 text-[#2563eb]" />
        Ном
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[404px_minmax(0,1fr)]">
        <aside className="rounded-[24px] border border-[#e3e9f4] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
          <h3 className="text-[20px] font-semibold text-[#0b5cab]">Математик-12</h3>

          <div className="relative mt-4">
            <Input
              defaultValue=""
              placeholder="Хичээлийн сэдвээр хайх"
              className="!h-[40px] rounded-[12px] border-[#dbe4f3] bg-white pr-10 text-[14px] text-slate-800"
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="mt-4 space-y-3">
            {textbookSections.map((section) => (
              <div key={section.id} className="space-y-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={false}
                    className="mt-0.5 h-4 w-4 rounded-[5px] border-[#dbe4f3] bg-white data-checked:border-[#0b5cab] data-checked:bg-[#0b5cab]"
                  />
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                    <p className="text-[15px] font-semibold leading-6 text-slate-900">
                      {section.title}
                    </p>
                    <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-700" />
                  </div>
                </div>

                {"lessons" in section ? (
                  <div className="space-y-2 pl-7">
                    {section.lessons.map((lesson) => (
                      <label
                        key={lesson.id}
                        className="flex items-start gap-3 text-[15px] leading-6 text-slate-900"
                      >
                        <Checkbox
                          checked={Boolean("active" in lesson && lesson.active)}
                          className="mt-1 h-4 w-4 rounded-[5px] border-[#dbe4f3] bg-white data-checked:border-[#0b5cab] data-checked:bg-[#0b5cab]"
                        />
                        <span>{lesson.label}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            <TextbookStatField label="Тестийн тоо" value="3" />

            <div className="space-y-2">
              <p className="text-[15px] font-medium text-slate-900">Тестийн төрлүүд</p>
              <div className="space-y-3">
                {textbookTypeStats.map((item) => (
                  <TextbookBadgeField
                    key={item.label}
                    label={item.label}
                    value={item.value}
                  />
                ))}
              </div>
            </div>

            <TextbookStatField label="Задгай даалгаврын тоо" value="2" />
            <TextbookStatField label="Нийт оноо" value="10" />

            <div className="space-y-2">
              <p className="text-[15px] font-medium text-slate-900">Хүндрэлийн зэрэг</p>
              <div className="space-y-3">
                {textbookDifficultyStats.map((item) => (
                  <TextbookBadgeField
                    key={item.label}
                    label={item.label}
                    value={item.value}
                  />
                ))}
              </div>
            </div>

            <Button className="!h-[44px] w-full rounded-[12px] bg-[#0b5cab] text-[18px] font-semibold hover:bg-[#0a4f96]">
              <Sparkles className="h-4 w-4" />
              Шалгалт үүсгэх
            </Button>
          </div>
        </aside>

        <div className="space-y-5">
          <TextbookQuestionCard
            answers={["3", "4", "5", "6"]}
            explanation={`Бодолт:
1. +5-ыг нөгөө тал руу шилжүүлнэ:
   2x = 13 - 5
2. Хасна:
   2x = 8
3. 2-оор хуваана:
   x = 4`}
            content={
              <Textarea
                defaultValue="2x+5=13 тэгшитгэлийг бод."
                className={textareaClassName}
              />
            }
          />

          <TextbookQuestionCard
            answers={[
              "1a, 2b, 3c, 4d",
              "1a, 2b, 3c, 4d",
              "1a, 2b, 3c, 4d",
              "1a, 2b, 3c, 4d",
            ]}
            content={
              <div className="rounded-[10px] border border-[#e2e8f0] bg-[#eef3ff] px-5 py-5 text-[15px] text-slate-800">
                <p className="mb-5 font-medium">
                  Дараах илэрхийлэлүүдийг зөв хариутай нь харгалзуулна уу.
                </p>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <p className="font-medium">Илэрхийлэл</p>
                    <ol className="space-y-4 pl-5">
                      <li>x²−4</li>
                      <li>√16</li>
                      <li>2³</li>
                      <li>x²+2x+1</li>
                    </ol>
                  </div>
                  <div className="space-y-4">
                    <p className="font-medium">Хариулт</p>
                    <ol className="space-y-4 pl-5">
                      <li>a. (x+1)²</li>
                      <li>b. 4</li>
                      <li>c. 8</li>
                      <li>d. (x−2)(x+2)</li>
                    </ol>
                  </div>
                </div>
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}
