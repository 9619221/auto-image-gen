"use client";

import type { ImagePlan } from "@/lib/types";
import { IMAGE_TYPE_LABELS } from "@/lib/types";
import { FileImage, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface ImagePlanEditorProps {
  plans: ImagePlan[];
  onChange: (plans: ImagePlan[]) => void;
}

export default function ImagePlanEditor({
  plans,
  onChange,
}: ImagePlanEditorProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const updatePlan = (index: number, field: keyof ImagePlan, value: string) => {
    const updated = [...plans];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="premium-card p-6 space-y-4">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <FileImage className="w-5 h-5 text-indigo-500" />
        图片生成方案
      </h3>
      <p className="text-sm text-slate-400">
        AI 已为每张图片制定了生成方案，你可以编辑描述来调整生成效果。
      </p>

      <div className="space-y-3">
        {plans.map((plan, idx) => (
          <div
            key={plan.imageType}
            className="border border-[var(--color-border-subtle)] rounded-xl overflow-hidden hover:border-[var(--color-border-default)] transition-colors"
          >
            {/* Header - always visible */}
            <button
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
              className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-surface-raised)] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                  {idx + 1}
                </span>
                <div>
                  <span className="text-sm font-medium text-slate-800">
                    {IMAGE_TYPE_LABELS[plan.imageType]}
                  </span>
                  <span className="text-xs text-slate-400 ml-2">
                    {plan.title}
                  </span>
                </div>
              </div>
              {expandedIdx === idx ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Description - always visible as summary */}
            <div className="px-4 pb-3">
              <p className="text-sm text-slate-500">{plan.description}</p>
            </div>

            {/* Expanded: editable fields */}
            {expandedIdx === idx && (
              <div className="px-4 pb-4 space-y-3 border-t border-[var(--color-border-subtle)] pt-3">
                <div>
                  <label className="block text-xs uppercase tracking-wide font-medium text-slate-400 mb-1">
                    方案描述（中文）
                  </label>
                  <textarea
                    value={plan.description}
                    onChange={(e) =>
                      updatePlan(idx, "description", e.target.value)
                    }
                    rows={2}
                    className="input-premium resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide font-medium text-slate-400 mb-1">
                    生成提示词（英文，发送给 AI）
                  </label>
                  <textarea
                    value={plan.prompt}
                    onChange={(e) =>
                      updatePlan(idx, "prompt", e.target.value)
                    }
                    rows={4}
                    className="input-premium resize-none font-mono text-xs text-slate-500"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
