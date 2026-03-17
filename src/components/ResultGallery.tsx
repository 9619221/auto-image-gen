"use client";

import { IMAGE_TYPE_LABELS } from "@/lib/types";
import type { GenerationJob, ImagePlan, ImageScore } from "@/lib/types";
import { Download, Loader2, AlertCircle, RefreshCw, Star, ChevronDown, ChevronUp } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useState, useEffect } from "react";

interface ResultGalleryProps {
  jobs: GenerationJob[];
  productName: string;
  plans?: ImagePlan[];
  originalImages?: File[];
  productMode?: string;
  imageLanguage?: string;
  onJobUpdate?: (imageType: string, update: Partial<GenerationJob>) => void;
  onScoresChange?: (scores: Record<string, ImageScore>) => void;
}

function base64ToBlob(base64: string): Blob {
  const parts = base64.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const raw = atob(parts[1]);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (score >= 6) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}

function barColor(score: number): string {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 6) return "bg-amber-500";
  return "bg-red-500";
}

const SCORE_LABELS: Record<string, string> = {
  clarity: "产品清晰度",
  composition: "构图质量",
  textQuality: "文字可读性",
  compliance: "亚马逊合规",
  appeal: "购买吸引力",
};

export default function ResultGallery({
  jobs,
  productName,
  plans,
  originalImages,
  productMode,
  imageLanguage,
  onJobUpdate,
  onScoresChange,
}: ResultGalleryProps) {
  const completedJobs = jobs.filter((j) => j.status === "done");
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());
  const [scores, setScores] = useState<Record<string, ImageScore>>({});
  const [scoring, setScoring] = useState<Set<string>>(new Set());
  const [expandedScore, setExpandedScore] = useState<string | null>(null);
  const [scoringAll, setScoringAll] = useState(false);

  useEffect(() => {
    if (onScoresChange && Object.keys(scores).length > 0) {
      onScoresChange(scores);
    }
  }, [scores, onScoresChange]);

  const downloadSingle = (job: GenerationJob) => {
    if (!job.finalImageUrl) return;
    const blob = base64ToBlob(job.finalImageUrl);
    const typeIndex = jobs.indexOf(job);
    const prefix = String(typeIndex + 1).padStart(2, "0");
    saveAs(blob, `${productName}-${prefix}-${job.imageType}.jpg`);
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    completedJobs.forEach((job, idx) => {
      if (!job.finalImageUrl) return;
      const parts = job.finalImageUrl.split(",");
      const raw = atob(parts[1]);
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      zip.file(
        `${String(idx + 1).padStart(2, "0")}-${job.imageType}.jpg`,
        arr
      );
    });
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${productName}-listing-images.zip`);
  };

  const handleRegenerate = async (job: GenerationJob) => {
    if (!plans || !originalImages || !onJobUpdate) return;
    const plan = plans.find((p) => p.imageType === job.imageType);
    if (!plan) return;

    setRegenerating((prev) => new Set(prev).add(job.imageType));
    onJobUpdate(job.imageType, { status: "generating", error: undefined });

    // 如果有评分建议，注入到 prompt 中指导重新生成
    const jobScore = scores[job.imageType];
    let enhancedPlan = plan;
    if (jobScore && jobScore.suggestions.length > 0) {
      const feedbackBlock = `\n\n⚠️ CRITICAL IMPROVEMENTS (from previous attempt review):\n${jobScore.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}\nYou MUST address ALL the above issues in this new generation.`;
      enhancedPlan = { ...plan, prompt: plan.prompt + feedbackBlock };
    }

    try {
      const formData = new FormData();
      originalImages.forEach((file) => formData.append("images", file, file.name));
      formData.append("plan", JSON.stringify(enhancedPlan));
      formData.append("productMode", productMode || "single");
      formData.append("imageLanguage", imageLanguage || "en");

      const res = await fetch("/api/regenerate", { method: "POST", body: formData });
      const data = await res.json();

      if (data.error) {
        onJobUpdate(job.imageType, { status: "error", error: data.error });
      } else {
        onJobUpdate(job.imageType, { status: "done", finalImageUrl: data.imageUrl });
        // 重新生成后清除旧评分
        setScores((prev) => {
          const next = { ...prev };
          delete next[job.imageType];
          return next;
        });
      }
    } catch (err) {
      onJobUpdate(job.imageType, {
        status: "error",
        error: err instanceof Error ? err.message : "重新生成失败",
      });
    } finally {
      setRegenerating((prev) => {
        const next = new Set(prev);
        next.delete(job.imageType);
        return next;
      });
    }
  };

  const scoreImage = async (job: GenerationJob) => {
    if (!job.finalImageUrl || scoring.has(job.imageType)) return;

    setScoring((prev) => new Set(prev).add(job.imageType));
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: job.finalImageUrl,
          imageType: job.imageType,
        }),
      });
      const data = await res.json();
      if (data.error) {
        console.error("评分失败:", data.error);
      } else {
        setScores((prev) => ({ ...prev, [job.imageType]: data }));
      }
    } catch (err) {
      console.error("评分请求失败:", err);
    } finally {
      setScoring((prev) => {
        const next = new Set(prev);
        next.delete(job.imageType);
        return next;
      });
    }
  };

  const scoreAll = async () => {
    setScoringAll(true);
    const toScore = completedJobs.filter(
      (j) => j.finalImageUrl && !scores[j.imageType]
    );
    // 并行评分，最大加速
    await Promise.all(toScore.map((job) => scoreImage(job)));
    setScoringAll(false);
  };

  if (jobs.length === 0) return null;

  const statusText: Record<string, string> = {
    pending: "等待中",
    generating: "生成中",
    compositing: "合成中",
    done: "完成",
    error: "失败",
  };

  const scoredCount = Object.keys(scores).length;
  const avgScore = scoredCount > 0
    ? Math.round((Object.values(scores).reduce((sum, s) => sum + s.overall, 0) / scoredCount) * 10) / 10
    : 0;

  return (
    <div className="premium-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-900">生成结果</h3>
          {scoredCount > 0 && (
            <span className={`px-3 py-1.5 rounded-xl text-sm font-bold border ${scoreColor(avgScore)}`}>
              平均 {avgScore}/10
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {completedJobs.length > 0 && (
            <>
              <button
                onClick={scoreAll}
                disabled={scoringAll || completedJobs.every((j) => scores[j.imageType])}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-200 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scoringAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Star className="w-4 h-4" />
                )}
                {scoringAll ? "评分中..." : completedJobs.every((j) => scores[j.imageType]) ? "已全部评分" : `全部评分 (${completedJobs.length})`}
              </button>
              <button
                onClick={downloadAll}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-200 transition-all text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                全部下载 ZIP
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {jobs.map((job) => {
          const jobScore = scores[job.imageType];
          const isExpanded = expandedScore === job.imageType;
          const isScoring = scoring.has(job.imageType);

          return (
            <div
              key={job.imageType}
              className="relative rounded-xl border border-[var(--color-border-subtle)] overflow-hidden group hover:shadow-lg transition-shadow"
            >
              {/* 类型标签 */}
              <div className="absolute top-2 left-2 z-10">
                <span className="px-2 py-1 rounded-lg text-[10px] font-medium bg-black/50 backdrop-blur-sm text-white">
                  {IMAGE_TYPE_LABELS[job.imageType]}
                </span>
              </div>

              {/* 评分徽章 */}
              {jobScore && (
                <button
                  onClick={() => setExpandedScore(isExpanded ? null : job.imageType)}
                  className={`absolute top-2 right-2 z-10 px-3 py-1.5 rounded-xl text-sm font-bold border backdrop-blur-sm transition-all hover:scale-105 shadow-sm ${scoreColor(jobScore.overall)}`}
                >
                  {jobScore.overall}/10
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 inline ml-1" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 inline ml-1" />
                  )}
                </button>
              )}

              {/* 图片或加载状态 */}
              <div className="aspect-square bg-[var(--color-surface-raised)] flex items-center justify-center">
                {job.status === "done" && job.finalImageUrl ? (
                  <img
                    src={job.finalImageUrl}
                    alt={IMAGE_TYPE_LABELS[job.imageType]}
                    className="w-full h-full object-cover"
                  />
                ) : job.status === "error" ? (
                  <div className="flex flex-col items-center text-red-500 p-4">
                    <AlertCircle className="w-8 h-8 mb-2" />
                    <span className="text-xs text-center">{job.error}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <span className="text-xs">{statusText[job.status] || job.status}...</span>
                  </div>
                )}
              </div>

              {/* 评分详情面板 */}
              {isExpanded && jobScore && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-2">
                  {(["clarity", "composition", "textQuality", "compliance", "appeal"] as const).map(
                    (key) => (
                      <div key={key} className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-500 w-16 shrink-0">
                          {SCORE_LABELS[key]}
                        </span>
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColor(jobScore[key])}`}
                            style={{ width: `${jobScore[key] * 10}%` }}
                          />
                        </div>
                        <span className="text-slate-600 font-medium w-4 text-right">
                          {jobScore[key]}
                        </span>
                      </div>
                    )
                  )}
                  {jobScore.suggestions.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-200">
                      <p className="text-[10px] text-slate-400 mb-1">改进建议:</p>
                      {jobScore.suggestions.map((s, i) => (
                        <p key={i} className="text-[11px] text-slate-600 leading-tight">
                          · {s}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 操作按钮 */}
              {(job.status === "done" || job.status === "error") && (
                <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* 评分按钮 */}
                  {job.status === "done" && !jobScore && (
                    <button
                      onClick={() => scoreImage(job)}
                      disabled={isScoring}
                      className="p-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:bg-amber-50 transition-colors"
                      title="AI 评分"
                    >
                      {isScoring ? (
                        <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                      ) : (
                        <Star className="w-4 h-4 text-amber-500" />
                      )}
                    </button>
                  )}
                  {/* 重新生成按钮 */}
                  {plans && onJobUpdate && (
                    <button
                      onClick={() => handleRegenerate(job)}
                      disabled={regenerating.has(job.imageType)}
                      className="p-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:bg-indigo-50 transition-colors"
                      title="重新生成此图"
                    >
                      <RefreshCw className={`w-4 h-4 text-indigo-600 ${regenerating.has(job.imageType) ? "animate-spin" : ""}`} />
                    </button>
                  )}
                  {/* 下载按钮 */}
                  {job.status === "done" && (
                    <button
                      onClick={() => downloadSingle(job)}
                      className="p-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:bg-emerald-50 transition-colors"
                      title="下载此图"
                    >
                      <Download className="w-4 h-4 text-slate-700" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
