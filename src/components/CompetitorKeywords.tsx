"use client";

import { useState } from "react";
import { Loader2, Search, Copy, Check, Zap, TrendingUp } from "lucide-react";

interface KeywordData {
  coreKeywords: { word: string; searchVolume: string; relevance: string }[];
  longTailKeywords: { phrase: string; intent: string }[];
  attributeKeywords: string[];
  sceneKeywords: string[];
  strategyAnalysis: string;
  suggestions: string[];
}

interface CompetitorKeywordsProps {
  myProductName: string;
}

export default function CompetitorKeywords({ myProductName }: CompetitorKeywordsProps) {
  const [competitorTitle, setCompetitorTitle] = useState("");
  const [data, setData] = useState<KeywordData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!competitorTitle.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/competitor-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorTitle, myProductName }),
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

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const volumeColor = (vol: string) => {
    if (vol === "高") return "text-emerald-600 bg-emerald-50";
    if (vol === "中") return "text-amber-600 bg-amber-50";
    return "text-slate-500 bg-slate-50";
  };

  return (
    <div className="premium-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-500" />
          竞品关键词分析
        </h3>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={competitorTitle}
          onChange={(e) => setCompetitorTitle(e.target.value)}
          placeholder="粘贴竞品商品标题..."
          className="input-premium flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
        />
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !competitorTitle.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:shadow-lg hover:shadow-orange-200 transition-all text-sm font-medium disabled:opacity-50 whitespace-nowrap"
        >
          {isAnalyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          {isAnalyzing ? "分析中..." : "提取关键词"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm mb-4">
          {error}
        </div>
      )}

      {!isAnalyzing && !data && !error && (
        <p className="text-sm text-slate-400 text-center py-2">
          粘贴竞品标题，AI 将提取关键词并给出优化建议
        </p>
      )}

      {isAnalyzing && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* 核心关键词 */}
          <div>
            <span className="text-xs uppercase tracking-wide font-medium text-slate-400 mb-2 block">核心关键词</span>
            <div className="flex flex-wrap gap-2">
              {data.coreKeywords.map((kw, i) => (
                <button
                  key={i}
                  onClick={() => copyText(kw.word, `core-${i}`)}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border-subtle)] hover:border-orange-300 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-700">{kw.word}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${volumeColor(kw.searchVolume)}`}>
                    {kw.searchVolume}
                  </span>
                  {copiedField === `core-${i}` ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 长尾关键词 */}
          <div>
            <span className="text-xs uppercase tracking-wide font-medium text-slate-400 mb-2 block">长尾关键词</span>
            <div className="flex flex-wrap gap-2">
              {data.longTailKeywords.map((kw, i) => (
                <button
                  key={i}
                  onClick={() => copyText(kw.phrase, `long-${i}`)}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border-subtle)] hover:border-orange-300 transition-colors"
                >
                  <Search className="w-3 h-3 text-slate-400" />
                  <span className="text-sm text-slate-700">{kw.phrase}</span>
                  <span className="text-[10px] text-slate-400">({kw.intent})</span>
                  {copiedField === `long-${i}` ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 属性词 + 场景词 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs uppercase tracking-wide font-medium text-slate-400 mb-2 block">属性关键词</span>
              <div className="flex flex-wrap gap-1.5">
                {data.attributeKeywords.map((kw, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wide font-medium text-slate-400 mb-2 block">场景关键词</span>
              <div className="flex flex-wrap gap-1.5">
                {data.sceneKeywords.map((kw, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-600 border border-green-100">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 策略分析 */}
          <div className="p-3 rounded-xl bg-orange-50 border border-orange-200">
            <span className="text-xs font-medium text-orange-600 mb-1 block">竞品标题策略</span>
            <p className="text-sm text-slate-700">{data.strategyAnalysis}</p>
          </div>

          {/* 优化建议 */}
          {data.suggestions.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-xs font-medium text-emerald-600 mb-1 block">借鉴建议</span>
              {data.suggestions.map((s, i) => (
                <p key={i} className="text-sm text-slate-700">
                  {i + 1}. {s}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
