"use client";

import type { AnalysisResult as AnalysisResultType } from "@/lib/types";
import { Package, Users, MapPin, Ruler, Palette, Sparkles } from "lucide-react";

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

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-500" />
        AI 分析结果
      </h3>

      {/* Product Name & Category */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            <Package className="w-4 h-4 inline mr-1" />
            商品名称
          </label>
          <input
            type="text"
            value={analysis.productName}
            onChange={(e) => updateField("productName", e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            商品类目
          </label>
          <input
            type="text"
            value={analysis.category}
            onChange={(e) => updateField("category", e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Materials & Colors & Dimensions */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            材质
          </label>
          <input
            type="text"
            value={analysis.materials}
            onChange={(e) => updateField("materials", e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            <Palette className="w-4 h-4 inline mr-1" />
            颜色
          </label>
          <input
            type="text"
            value={analysis.colors}
            onChange={(e) => updateField("colors", e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            <Ruler className="w-4 h-4 inline mr-1" />
            尺寸
          </label>
          <input
            type="text"
            value={analysis.estimatedDimensions}
            onChange={(e) => updateField("estimatedDimensions", e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Selling Points */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">
          <Sparkles className="w-4 h-4 inline mr-1" />
          核心卖点
        </label>
        <div className="space-y-2">
          {analysis.sellingPoints.map((sp, i) => (
            <input
              key={i}
              type="text"
              value={sp}
              onChange={(e) =>
                updateArrayItem("sellingPoints", i, e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder={`卖点 ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Target Audience */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">
          <Users className="w-4 h-4 inline mr-1" />
          目标人群
        </label>
        <div className="space-y-2">
          {analysis.targetAudience.map((ta, i) => (
            <input
              key={i}
              type="text"
              value={ta}
              onChange={(e) =>
                updateArrayItem("targetAudience", i, e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder={`人群 ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Usage Scenes */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">
          <MapPin className="w-4 h-4 inline mr-1" />
          使用场景
        </label>
        <div className="space-y-2">
          {analysis.usageScenes.map((us, i) => (
            <textarea
              key={i}
              value={us}
              onChange={(e) =>
                updateArrayItem("usageScenes", i, e.target.value)
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              placeholder={`场景 ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
