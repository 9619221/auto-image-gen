"use client";

import type { ImageScore } from "@/lib/types";
import { IMAGE_TYPE_LABELS } from "@/lib/types";
import { useState } from "react";
import { Loader2, ArrowUpDown, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";

interface OrderItem {
  position: number;
  imageType: string;
  reason: string;
}

interface OrderData {
  recommendedOrder: OrderItem[];
  needRegenerate: string[];
  overallAssessment: string;
  tips: string[];
}

interface ImageOrderOptimizerProps {
  scores: Record<string, ImageScore>;
  imageTypes: string[];
}

export default function ImageOrderOptimizer({ scores, imageTypes }: ImageOrderOptimizerProps) {
  const [data, setData] = useState<OrderData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scoredCount = Object.keys(scores).length;

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/image-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores, imageTypes }),
      });
      const result = await res.json();
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (scoredCount === 0) return null;

  return (
    <div className="premium-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <ArrowUpDown className="w-5 h-5 text-purple-500" />
          图片顺序优化
        </h3>
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-purple-200 transition-all text-sm font-medium disabled:opacity-50"
        >
          {isAnalyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          {isAnalyzing ? "分析中..." : "AI 优化排序"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm mb-4">
          {error}
        </div>
      )}

      {!isAnalyzing && !data && !error && (
        <p className="text-sm text-slate-400 text-center py-2">
          已评分 {scoredCount} 张图片，点击按钮获取最优排列建议
        </p>
      )}

      {isAnalyzing && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* 推荐顺序 */}
          <div className="space-y-2">
            {data.recommendedOrder.map((item) => {
              const label = IMAGE_TYPE_LABELS[item.imageType as keyof typeof IMAGE_TYPE_LABELS] || item.imageType;
              const score = scores[item.imageType];
              const needRegen = data.needRegenerate.includes(item.imageType);
              return (
                <div
                  key={item.position}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    needRegen
                      ? "border-red-200 bg-red-50/50"
                      : "border-[var(--color-border-subtle)]"
                  }`}
                >
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {item.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{label}</span>
                      {score && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                          score.overall >= 8
                            ? "text-emerald-600 bg-emerald-50"
                            : score.overall >= 6
                            ? "text-amber-600 bg-amber-50"
                            : "text-red-600 bg-red-50"
                        }`}>
                          {score.overall}/10
                        </span>
                      )}
                      {needRegen && (
                        <span className="text-[10px] text-red-500 flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          建议重新生成
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{item.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 整体评价 */}
          <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-medium text-purple-700">整体评价</span>
            </div>
            <p className="text-sm text-slate-700">{data.overallAssessment}</p>
          </div>

          {/* 优化建议 */}
          {data.tips.length > 0 && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
              <span className="text-xs font-medium text-indigo-700 mb-1 block">优化建议</span>
              {data.tips.map((tip, i) => (
                <p key={i} className="text-sm text-slate-700">
                  {i + 1}. {tip}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
