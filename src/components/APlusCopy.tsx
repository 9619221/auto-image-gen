"use client";

import type { AnalysisResult } from "@/lib/types";
import { useState } from "react";
import { Loader2, FileText, Copy, Check, Zap, ChevronDown, ChevronUp } from "lucide-react";

interface APlusData {
  brandStory: string;
  valueProposition: string;
  features: { title: string; description: string }[];
  scenes: { title: string; description: string }[];
  specs: { label: string; value: string }[];
  faq: { question: string; answer: string }[];
}

interface APlusCopyProps {
  analysis: AnalysisResult;
}

export default function APlusCopy({ analysis }: APlusCopyProps) {
  const [data, setData] = useState<APlusData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/aplus-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });
      const result = await res.json();
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
        setExpanded(true);
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

  const copyAll = () => {
    if (!data) return;
    const parts = [
      `【品牌故事】\n${data.brandStory}`,
      `【核心价值】\n${data.valueProposition}`,
      `【产品特性】\n${data.features.map((f) => `${f.title}: ${f.description}`).join("\n")}`,
      `【使用场景】\n${data.scenes.map((s) => `${s.title}: ${s.description}`).join("\n")}`,
      `【规格参数】\n${data.specs.map((s) => `${s.label}: ${s.value}`).join("\n")}`,
      `【常见问题】\n${data.faq.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}`,
    ];
    copyText(parts.join("\n\n"), "all");
  };

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={() => copyText(text, field)}
      className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {copiedField === field ? (
        <Check className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
      )}
    </button>
  );

  return (
    <div className="premium-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-rose-500" />
          A+ 页面文案
        </h3>
        <div className="flex items-center gap-2">
          {data && (
            <button
              onClick={copyAll}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600 transition-colors"
            >
              {copiedField === "all" ? (
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
          )}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl hover:shadow-lg hover:shadow-rose-200 transition-all text-sm font-medium disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {isGenerating ? "生成中..." : "AI 生成A+文案"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm mb-4">
          {error}
        </div>
      )}

      {!isGenerating && !data && !error && (
        <p className="text-sm text-slate-400 text-center py-4">
          点击按钮，AI 将生成 A+ 页面所需的全部文案模块
        </p>
      )}

      {isGenerating && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? "收起详情" : "展开详情"}
          </button>

          {expanded && (
            <>
              {/* 品牌故事 */}
              <div className="p-3 rounded-xl border border-[var(--color-border-subtle)] group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">品牌故事</span>
                  <CopyBtn text={data.brandStory} field="brand" />
                </div>
                <p className="text-sm text-slate-700">{data.brandStory}</p>
              </div>

              {/* 核心价值 */}
              <div className="p-3 rounded-xl border border-[var(--color-border-subtle)] group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">核心价值主张</span>
                  <CopyBtn text={data.valueProposition} field="value" />
                </div>
                <p className="text-sm text-slate-800 font-medium">{data.valueProposition}</p>
              </div>

              {/* 四大特性 */}
              <div>
                <span className="text-xs uppercase tracking-wide font-medium text-slate-400 mb-2 block">产品特性模块</span>
                <div className="grid grid-cols-2 gap-2">
                  {data.features.map((f, i) => (
                    <div key={i} className="p-3 rounded-xl border border-[var(--color-border-subtle)] group">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800">{f.title}</span>
                        <CopyBtn text={`${f.title}: ${f.description}`} field={`feat-${i}`} />
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{f.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 场景 */}
              <div>
                <span className="text-xs uppercase tracking-wide font-medium text-slate-400 mb-2 block">使用场景</span>
                <div className="space-y-2">
                  {data.scenes.map((s, i) => (
                    <div key={i} className="p-3 rounded-xl border border-[var(--color-border-subtle)] group">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800">{s.title}</span>
                        <CopyBtn text={`${s.title}: ${s.description}`} field={`scene-${i}`} />
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{s.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 规格参数 */}
              <div>
                <span className="text-xs uppercase tracking-wide font-medium text-slate-400 mb-2 block">规格参数</span>
                <div className="p-3 rounded-xl border border-[var(--color-border-subtle)]">
                  <table className="w-full text-sm">
                    <tbody>
                      {data.specs.map((s, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0">
                          <td className="py-1.5 text-slate-500 w-28">{s.label}</td>
                          <td className="py-1.5 text-slate-700">{s.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* FAQ */}
              <div>
                <span className="text-xs uppercase tracking-wide font-medium text-slate-400 mb-2 block">常见问题 FAQ</span>
                <div className="space-y-2">
                  {data.faq.map((f, i) => (
                    <div key={i} className="p-3 rounded-xl border border-[var(--color-border-subtle)] group">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800">Q: {f.question}</span>
                        <CopyBtn text={`Q: ${f.question}\nA: ${f.answer}`} field={`faq-${i}`} />
                      </div>
                      <p className="text-xs text-slate-600 mt-1">A: {f.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
