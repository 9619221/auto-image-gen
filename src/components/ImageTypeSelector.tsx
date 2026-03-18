"use client";

import { IMAGE_TYPE_LABELS, IMAGE_TYPE_ORDER } from "@/lib/types";
import type { ImageType } from "@/lib/types";

interface ImageTypeSelectorProps {
  selected: ImageType[];
  onChange: (selected: ImageType[]) => void;
}

export default function ImageTypeSelector({
  selected,
  onChange,
}: ImageTypeSelectorProps) {
  const helperText: Record<ImageType, string> = {
    main: '高点击主图',
    features: '痛点解决方案',
    closeup: '细节与品质感',
    dimensions: '尺寸说明',
    lifestyle: '场景使用图',
    packaging: '差异化价值',
    comparison: '我们 vs 普通产品',
    lifestyle2: 'A+多场景收束',
  };

  const toggle = (type: ImageType) => {
    if (selected.includes(type)) {
      onChange(selected.filter((t) => t !== type));
    } else {
      onChange([...selected, type]);
    }
  };

  const selectAll = () => onChange([...IMAGE_TYPE_ORDER]);
  const deselectAll = () => onChange([]);

  return (
    <div className="premium-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900">
          选择要生成的图片类型
        </h3>
        <div className="flex gap-2 text-sm">
          <button
            onClick={selectAll}
            className="text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            全选
          </button>
          <span className="text-slate-200">|</span>
          <button
            onClick={deselectAll}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            取消全选
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {IMAGE_TYPE_ORDER.map((type, idx) => (
          <button
            key={type}
            onClick={() => toggle(type)}
            className={`relative p-4 rounded-xl border-2 text-left transition-all ${
              selected.includes(type)
                ? "border-indigo-500 bg-gradient-to-br from-[var(--color-accent-subtle)] to-violet-50 ring-1 ring-indigo-200"
                : "border-[var(--color-border-subtle)] hover:border-indigo-300"
            }`}
          >
            <div className="text-xs text-slate-400 mb-1">#{idx + 1}</div>
            <div className="text-sm font-medium text-slate-800">
              {IMAGE_TYPE_LABELS[type]}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {helperText[type]}
            </div>
            {selected.includes(type) && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center shadow-md">
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
