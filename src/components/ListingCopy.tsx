"use client";

import type { AnalysisResult } from "@/lib/types";
import { useState } from "react";
import { Loader2, List, Search, Copy, Check, Zap } from "lucide-react";

interface BulletPoint {
  emoji: string;
  title: string;
  content: string;
}

interface ListingCopyProps {
  analysis: AnalysisResult;
}

export default function ListingCopy({ analysis }: ListingCopyProps) {
  const [bulletPoints, setBulletPoints] = useState<BulletPoint[]>([]);
  const [searchTerms, setSearchTerms] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/listing-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setBulletPoints(data.bulletPoints || []);
        setSearchTerms(data.searchTerms || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyAllBullets = () => {
    const text = bulletPoints
      .map((bp) => `【${bp.title}】${bp.content}`)
      .join("\n\n");
    copyText(text, "all-bullets");
  };

  return (
    <div className="premium-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <List className="w-5 h-5 text-blue-500" />
          五点描述 & 搜索词
        </h3>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all text-sm font-medium disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          {isGenerating ? "生成中..." : "AI 生成文案"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm mb-4">
          {error}
        </div>
      )}

      {!isGenerating && bulletPoints.length === 0 && !error && (
        <p className="text-sm text-slate-400 text-center py-4">
          点击按钮，AI 将生成亚马逊五点描述和后台搜索词
        </p>
      )}

      {isGenerating && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      )}

      {bulletPoints.length > 0 && (
        <div className="space-y-4">
          {/* 五点描述 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide font-medium text-slate-400 flex items-center gap-1">
                <List className="w-3.5 h-3.5" />
                五点描述 (Bullet Points)
              </span>
              <button
                onClick={copyAllBullets}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
              >
                {copiedField === "all-bullets" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    全部复制
                  </>
                )}
              </button>
            </div>
            <div className="space-y-2">
              {bulletPoints.map((bp, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-[var(--color-border-subtle)] hover:border-blue-300 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="text-sm font-bold text-blue-700">
                        {bp.emoji} 【{bp.title}】
                      </span>
                      <span className="text-sm text-slate-700">{bp.content}</span>
                    </div>
                    <button
                      onClick={() => copyText(`【${bp.title}】${bp.content}`, `bp-${idx}`)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                      {copiedField === `bp-${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {`【${bp.title}】${bp.content}`.length} 字符
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 后台搜索词 */}
          {searchTerms && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wide font-medium text-slate-400 flex items-center gap-1">
                  <Search className="w-3.5 h-3.5" />
                  后台搜索词 (Search Terms)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">
                    {new Blob([searchTerms]).size}/250 字节
                  </span>
                  <button
                    onClick={() => copyText(searchTerms, "search")}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {copiedField === "search" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500">已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        复制
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-sm text-slate-700 font-mono break-all leading-relaxed">
                  {searchTerms}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
