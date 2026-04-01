"use client";

import type { MaterialSourceId } from "./material-builder-config";
import { sourceOptions } from "./material-builder-config";

interface SourceSelectorProps {
  source: MaterialSourceId;
  onChange: (source: MaterialSourceId) => void;
}

export function SourceSelector({ source, onChange }: SourceSelectorProps) {
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      {sourceOptions.map((option) => {
        const Icon = option.icon;
        const active = source === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-[16px] border px-5 text-[14px] font-semibold transition-all duration-200 ${
              active
                ? "border-[#cfe1ff] bg-white text-[#215da8] shadow-[0_8px_18px_rgba(59,130,246,0.10)]"
                : "border-[#e3e8f2] bg-white text-slate-700 hover:-translate-y-0.5 hover:border-[#cfe1ff] hover:bg-slate-50 hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
            }`}
          >
            <Icon className="h-4 w-4 text-[#2563eb]" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
