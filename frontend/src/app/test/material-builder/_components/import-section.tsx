"use client";

import { Download } from "lucide-react";
import { importOptions } from "./material-builder-config";

export function ImportSection() {
  return (
    <section className="mt-5 rounded-[18px] border border-[#e3e9f4] bg-white px-5 py-8 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:px-6">
      <div className="mb-8 flex items-center gap-3 text-[15px] font-semibold text-slate-900">
        <Download className="h-5 w-5 text-[#2563eb]" />
        Файл
      </div>

      <div>
        <p className="mb-5 text-[18px] font-medium text-slate-900">Файл оруулах</p>

        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          {importOptions.map((option) => {
            const Icon = option.icon;

            return (
              <button
                key={option.id}
                type="button"
                className="flex h-[48px] w-full items-center gap-4 rounded-[12px] border border-[#d9e2f2] bg-[#eef3ff] px-4 text-left text-[16px] font-medium text-slate-800 transition hover:bg-[#e7efff]"
              >
                <Icon className="h-5 w-5 text-slate-900" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
