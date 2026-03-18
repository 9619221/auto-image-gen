"use client";

import type { AnalysisResult as AnalysisResultType } from "@/lib/types";
import { Package, Users, MapPin, Ruler, Palette, Sparkles, Pencil, Plus, X } from "lucide-react";

interface AnalysisResultProps {
  analysis: AnalysisResultType;
  onChange: (analysis: AnalysisResultType) => void;
}

export default function AnalysisResult({
  analysis,
  onChange,
}: AnalysisResultProps) {
  const updateField = <K extends keyof AnalysisResultType>(
    key: K,
    value: AnalysisResultType[K]
  ) => {
    onChange({ ...analysis, [key]: value });
  };

  const updateArrayItem = (
    key: "sellingPoints" | "targetAudience" | "usageScenes",
    index: number,
    value: string
  ) => {
    const arr = [...analysis[key]];
    arr[index] = value;
    onChange({ ...analysis, [key]: arr });
  };

  const addArrayItem = (key: "sellingPoints" | "targetAudience" | "usageScenes") => {
    const arr = [...analysis[key], ""];
    onChange({ ...analysis, [key]: arr });
  };

  const removeArrayItem = (key: "sellingPoints" | "targetAudience" | "usageScenes", index: number) => {
    const arr = analysis[key].filter((_, i) => i !== index);
    onChange({ ...analysis, [key]: arr });
  };

  return (
    <div className="premium-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          AI 分析结果
        </h3>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-medium border border-amber-200">
          <Pencil className="w-3 h-3" />
          所有字段均可修改校准
        </span>
      </div>

      {/* Product Name & Category */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wide font-medium text-slate-400 mb-1.5">
            <Package className="w-3.5 h-3.5 inline mr-1" />
            商品名称
          </label>
          <input
            type="text"
            value={analysis.productName}
            onChange={(e) => updateField("productName", e.target.value)}
            className="input-premium"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide font-medium text-slate-400 mb-1.5">
            商品类目
          </label>
          <input
            type="text"
            value={analysis.category}
            onChange={(e) => updateField("category", e.target.value)}
            className="input-premium"
          />
        </div>
      </div>

      {/* Materials & Colors & Dimensions */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wide font-medium text-slate-400 mb-1.5">
            材质
          </label>
          <input
            type="text"
            value={analysis.materials}
            onChange={(e) => updateField("materials", e.target.value)}
            className="input-premium"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide font-medium text-slate-400 mb-1.5">
            <Palette className="w-3.5 h-3.5 inline mr-1" />
            颜色
          </label>
          <input
            type="text"
            value={analysis.colors}
            onChange={(e) => updateField("colors", e.target.value)}
            className="input-premium"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide font-medium text-slate-400 mb-1.5">
            <Ruler className="w-3.5 h-3.5 inline mr-1" />
            尺寸
          </label>
          <input
            type="text"
            value={analysis.estimatedDimensions}
            onChange={(e) => updateField("estimatedDimensions", e.target.value)}
            className="input-premium"
          />
        </div>
      </div>

      {/* Selling Points */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs uppercase tracking-wide font-medium text-slate-400 flex items-center">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            核心卖点
          </label>
          <button
            onClick={() => addArrayItem("sellingPoints")}
            className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加
          </button>
        </div>
        <div className="space-y-2">
          {analysis.sellingPoints.map((sp, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={sp}
                onChange={(e) =>
                  updateArrayItem("sellingPoints", i, e.target.value)
                }
                className="input-premium flex-1"
                placeholder={`卖点 ${i + 1}`}
              />
              {analysis.sellingPoints.length > 1 && (
                <button
                  onClick={() => removeArrayItem("sellingPoints", i)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Target Audience */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs uppercase tracking-wide font-medium text-slate-400 flex items-center">
            <Users className="w-3.5 h-3.5 mr-1" />
            目标人群
          </label>
          <button
            onClick={() => addArrayItem("targetAudience")}
            className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加
          </button>
        </div>
        <div className="space-y-2">
          {analysis.targetAudience.map((ta, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={ta}
                onChange={(e) =>
                  updateArrayItem("targetAudience", i, e.target.value)
                }
                className="input-premium flex-1"
                placeholder={`人群 ${i + 1}`}
              />
              {analysis.targetAudience.length > 1 && (
                <button
                  onClick={() => removeArrayItem("targetAudience", i)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Usage Scenes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs uppercase tracking-wide font-medium text-slate-400 flex items-center">
            <MapPin className="w-3.5 h-3.5 mr-1" />
            使用场景
          </label>
          <button
            onClick={() => addArrayItem("usageScenes")}
            className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加
          </button>
        </div>
        <div className="space-y-2">
          {analysis.usageScenes.map((us, i) => (
            <div key={i} className="flex items-start gap-2">
              <textarea
                value={us}
                onChange={(e) =>
                  updateArrayItem("usageScenes", i, e.target.value)
                }
                rows={2}
                className="input-premium resize-none flex-1"
                placeholder={`场景 ${i + 1}`}
              />
              {analysis.usageScenes.length > 1 && (
                <button
                  onClick={() => removeArrayItem("usageScenes", i)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors mt-2"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
