"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import ImageUploader from "@/components/ImageUploader";
import type { UploadImageItem } from "@/components/ImageUploader";
import type { ProductMode } from "@/lib/types";
import AnalysisResultComponent from "@/components/AnalysisResult";
import ImageTypeSelector from "@/components/ImageTypeSelector";
import ImagePlanEditor from "@/components/ImagePlanEditor";
import ResultGallery from "@/components/ResultGallery";
import MobilePreview from "@/components/MobilePreview";
import ImageOrderOptimizer from "@/components/ImageOrderOptimizer";
import { IMAGE_TYPE_ORDER, IMAGE_TYPE_LABELS, regionToLanguage } from "@/lib/types";
import type { AnalysisResult, ImageType, ImagePlan, GenerationJob, SalesRegion, ImageSize, ImageScore } from "@/lib/types";
import { IMAGE_SIZE_OPTIONS } from "@/lib/types";
import { generatePlans } from "@/lib/prompt-templates";
import BatchProcessor from "@/components/BatchProcessor";
import { Loader2, Zap, RotateCcw, ArrowRight, History, X, Type, Copy, Check, Layers } from "lucide-react";

type Step = "upload" | "review" | "plan" | "generate" | "results";

interface HistoryMeta {
  id: string;
  timestamp: number;
  productName: string;
  salesRegion: string;
  imageCount: number;
}

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalImages, setOriginalImages] = useState<UploadImageItem[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<ImageType[]>(
    [...IMAGE_TYPE_ORDER]
  );
  const [plans, setPlans] = useState<ImagePlan[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [productMode, setProductMode] = useState<ProductMode>("single");
  const [salesRegion, setSalesRegion] = useState<SalesRegion>("us");
  const [imageSize, setImageSize] = useState<ImageSize>("800x800");
  const [error, setError] = useState<string | null>(null);

  // 标题生成
  const [generatedTitles, setGeneratedTitles] = useState<{ label: string; title: string }[]>([]);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // 重新生成分析字段
  const [isRegenerating, setIsRegenerating] = useState(false);

  // 图片评分（从 ResultGallery 回传）
  const [imageScores, setImageScores] = useState<Record<string, ImageScore>>({});

  // 批量模式
  const [batchMode, setBatchMode] = useState(false);

  // 历史记录
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<HistoryMeta[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Cleanup blob URLs on unmount to prevent memory leaks
  // 使用 ref 追踪最新的 images，避免依赖数组变化时误撤销正在使用的 blob URL
  const imagesRef = useRef(originalImages);
  imagesRef.current = originalImages;
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((item) => {
        if (item.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendImagesToFormData = (formData: FormData, images: UploadImageItem[]) => {
    images.forEach((item) => {
      formData.append("images", item.file, item.file.name);
    });
  };

  // 加载历史列表
  const loadHistoryList = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (Array.isArray(data)) setHistoryList(data);
    } catch { /* ignore */ }
    setLoadingHistory(false);
  }, []);

  // 查看历史记录详情
  const loadHistoryEntry = useCallback(async (id: string) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/history?id=${id}`);
      const data = await res.json();
      if (data.images) {
        const loadedJobs: GenerationJob[] = data.images.map((img: { imageType: string; imageUrl: string }) => ({
          imageType: img.imageType as ImageType,
          status: "done" as const,
          finalImageUrl: img.imageUrl,
        }));
        setJobs(loadedJobs);
        setStep("results");
        setShowHistory(false);
        setAnalysis({ productName: data.productName } as AnalysisResult);
      }
    } catch {
      setError("加载历史记录失败");
    }
    setLoadingHistory(false);
  }, []);

  // 保存到历史
  const saveToHistory = useCallback(async () => {
    const completedJobs = jobs.filter((j) => j.status === "done" && j.finalImageUrl);
    if (completedJobs.length === 0) return;

    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: analysis?.productName || "未命名商品",
          salesRegion,
          imageCount: completedJobs.length,
          images: completedJobs.map((j) => ({
            imageType: j.imageType,
            imageUrl: j.finalImageUrl,
          })),
        }),
      });
    } catch { /* ignore save errors */ }
  }, [jobs, analysis, salesRegion]);

  const handleAnalyze = useCallback(async () => {
    if (originalImages.length === 0) return;
    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      appendImagesToFormData(formData, originalImages);
      formData.append("productMode", productMode);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.error) {
        setAnalysis({
          productName: "商品名称",
          category: "商品类目",
          sellingPoints: ["卖点 1", "卖点 2", "卖点 3"],
          materials: "材质",
          colors: "颜色",
          targetAudience: ["普通消费者"],
          usageScenes: ["日常使用", "办公场景", "户外使用"],
          estimatedDimensions: "尺寸",
        });
        setError(`AI 分析失败（${data.error}），请手动填写商品信息。`);
      } else {
        setAnalysis(data);
      }
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "处理失败");
    } finally {
      setIsProcessing(false);
    }
  }, [originalImages, productMode]);

  const handleRegenerateFields = useCallback(async () => {
    if (!analysis || originalImages.length === 0) return;
    setIsRegenerating(true);
    setError(null);
    try {
      const formData = new FormData();
      appendImagesToFormData(formData, originalImages);
      formData.append("analysis", JSON.stringify(analysis));
      formData.append("productMode", productMode);

      const res = await fetch("/api/regenerate-analysis", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        setError(`重新生成失败：${data.error}`);
      } else {
        setAnalysis(prev => prev ? { ...prev, ...data } : prev);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "重新生成失败");
    } finally {
      setIsRegenerating(false);
    }
  }, [analysis, originalImages, productMode]);

  const handleProceedToPlan = useCallback(() => {
    if (!analysis) return;
    const imagePlans = generatePlans(analysis, selectedTypes, salesRegion, imageSize, productMode);
    setPlans(imagePlans);
    setStep("plan");
  }, [analysis, selectedTypes, salesRegion, imageSize]);

  const handleGenerate = useCallback(async () => {
    if (originalImages.length === 0 || plans.length === 0) return;

    setIsGenerating(true);
    setStep("generate");
    setGeneratedTitles([]);

    const initialJobs: GenerationJob[] = plans.map((p) => ({
      imageType: p.imageType,
      status: "pending",
    }));
    setJobs(initialJobs);

    // 标题与图片并行生成
    if (analysis) {
      setIsGeneratingTitle(true);
      fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, salesRegion }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.titles) setGeneratedTitles(data.titles);
        })
        .catch(() => {})
        .finally(() => setIsGeneratingTitle(false));
    }

    try {
      const formData = new FormData();
      appendImagesToFormData(formData, originalImages);
      formData.append("plans", JSON.stringify(plans));
      formData.append("productMode", productMode);
      formData.append("imageLanguage", regionToLanguage(salesRegion));
      formData.append("salesRegion", salesRegion);
      formData.append("imageSize", imageSize);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("无法启动生成流");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (data.status === "complete") {
            setStep("results");
            setIsGenerating(false);
            continue;
          }

          setJobs((prev) =>
            prev.map((job) => {
              if (job.imageType !== data.imageType) return job;
              return {
                ...job,
                status: data.status as GenerationJob["status"],
                finalImageUrl: (data.imageUrl as string) || job.finalImageUrl,
                error: data.error as string | undefined,
              };
            })
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
      setIsGenerating(false);
    }
  }, [originalImages, plans, productMode, salesRegion, analysis]);

  // 生成完成后自动保存历史（仅保存一次）
  const historySavedRef = useRef(false);
  useEffect(() => {
    if (step === "results" && !isGenerating && !historySavedRef.current) {
      historySavedRef.current = true;
      saveToHistory();
    }
    if (step !== "results") {
      historySavedRef.current = false;
    }
  }, [step, isGenerating, saveToHistory]);

  // 单张重新生成回调
  const handleJobUpdate = useCallback((imageType: string, update: Partial<GenerationJob>) => {
    setJobs((prev) =>
      prev.map((job) => (job.imageType === imageType ? { ...job, ...update } : job))
    );
  }, []);

  const copyTitle = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleReset = () => {
    originalImages.forEach((item) => {
      if (item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setStep("upload");
    setOriginalImages([]);
    setAnalysis(null);
    setPlans([]);
    setJobs([]);
    setError(null);
    setSelectedTypes([...IMAGE_TYPE_ORDER]);
    setProductMode("single");
    setSalesRegion("us");
    setGeneratedTitles([]);
  };

  return (
    <main className="min-h-screen">
      <header className="glass-card sticky top-0 z-50 border-b border-[var(--color-border-subtle)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              亚马逊商品图片生成器
            </h1>
            <p className="text-sm text-slate-400">
              AI 智能生成高转化率 Listing 图片
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 批量模式按钮 */}
            {!batchMode && step === "upload" && (
              <button
                onClick={() => setBatchMode(true)}
                className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm"
              >
                <Layers className="w-4 h-4" />
                批量模式
              </button>
            )}
            {/* 历史记录按钮 */}
            <button
              onClick={() => { setShowHistory(true); loadHistoryList(); }}
              className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm"
            >
              <History className="w-4 h-4" />
              历史记录
            </button>
            {step !== "upload" && !batchMode && (
              <button
                onClick={handleReset}
                className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                重新开始
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 历史记录面板 */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">生成历史</h2>
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-slate-100 rounded-lg" aria-label="关闭历史记录">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : historyList.length === 0 ? (
                <p className="text-center text-slate-400 py-8">暂无历史记录</p>
              ) : (
                <div className="space-y-3">
                  {historyList.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => loadHistoryEntry(entry.id)}
                      className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800 text-sm">{entry.productName}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(entry.timestamp).toLocaleDateString("zh-CN", {
                            month: "numeric",
                            day: "numeric",
                            hour: "numeric",
                            minute: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">{entry.imageCount} 张图片</span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400">{entry.salesRegion.toUpperCase()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 批量模式 */}
      {batchMode && (
        <div className="max-w-6xl mx-auto px-6 py-6">
          <BatchProcessor onExit={() => setBatchMode(false)} />
        </div>
      )}

      {!batchMode && <><div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center gap-2 text-sm">
          {[
            { key: "upload", label: "1. 上传图片" },
            { key: "review", label: "2. AI 分析" },
            { key: "plan", label: "3. 确认方案" },
            { key: "generate", label: "4. 生成图片" },
            { key: "results", label: "5. 下载结果" },
          ].map((s, i) => {
            const stepOrder = ["upload", "review", "plan", "generate", "results"];
            const currentIdx = stepOrder.indexOf(step);
            const itemIdx = stepOrder.indexOf(s.key);
            return (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <div className="w-8 h-px bg-slate-200" />}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    currentIdx === itemIdx
                      ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200"
                      : currentIdx > itemIdx
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-12 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm animate-fade-in-up">
            {error}
          </div>
        )}

        {step === "upload" && (
          <div className="max-w-2xl mx-auto animate-fade-in-up">
            <ImageUploader
              images={originalImages}
              onImagesChange={setOriginalImages}
              isProcessing={isProcessing}
              onSubmit={handleAnalyze}
              productMode={productMode}
              onProductModeChange={setProductMode}
              salesRegion={salesRegion}
              onSalesRegionChange={setSalesRegion}
            />
            <p className="text-center text-xs text-slate-400 mt-4">
              上传 1-5 张商品图，支持组合装/套装多商品
            </p>
          </div>
        )}

        {step === "review" && analysis && (
          <div className="animate-fade-in-up space-y-6">
            {originalImages.length > 0 && (
              <div className="premium-card p-6">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                  上传的商品图（{originalImages.length} 张）
                </p>
                <div className="flex gap-3 flex-wrap">
                  {originalImages.map((img, idx) => (
                    <img
                      key={idx}
                      src={img.previewUrl}
                      alt={`商品 ${idx + 1}`}
                      className="w-28 h-28 object-contain rounded-xl border border-[var(--color-border-subtle)] hover:shadow-lg transition-shadow"
                    />
                  ))}
                </div>
              </div>
            )}

            <AnalysisResultComponent
              analysis={analysis}
              onChange={(valOrFn) => {
                if (typeof valOrFn === "function") {
                  setAnalysis((prev) => prev ? valOrFn(prev) : prev);
                } else {
                  setAnalysis(valOrFn);
                }
              }}
              onRegenerate={handleRegenerateFields}
              isRegenerating={isRegenerating}
            />

            <ImageTypeSelector
              selected={selectedTypes}
              onChange={setSelectedTypes}
            />

            {/* 图片尺寸选择 */}
            <div className="premium-card p-4">
              <p className="text-sm text-slate-700 font-semibold mb-2">📐 输出图片尺寸</p>
              <div className="flex gap-2">
                {IMAGE_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setImageSize(opt.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                      imageSize === opt.value
                        ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-bold">{opt.label}</span>
                    <span className="text-xs ml-1 opacity-70">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleProceedToPlan}
                disabled={selectedTypes.length === 0}
                className="btn-accent flex items-center gap-2 px-8 py-3 text-lg"
              >
                <ArrowRight className="w-5 h-5" />
                生成方案（{selectedTypes.length} 张图）
              </button>
            </div>
          </div>
        )}

        {step === "plan" && plans.length > 0 && (
          <div className="animate-fade-in-up space-y-6">
            <ImagePlanEditor plans={plans} onChange={setPlans} />

            <div className="flex justify-center gap-4">
              <button
                onClick={() => setStep("review")}
                className="btn-ghost flex items-center gap-2 px-6 py-3"
              >
                返回修改
              </button>
              <button
                onClick={handleGenerate}
                className="btn-accent flex items-center gap-2 px-8 py-3 text-lg"
              >
                <Zap className="w-5 h-5" />
                开始生成 {plans.length} 张图片
              </button>
            </div>
          </div>
        )}

        {(step === "generate" || step === "results") && (
          <div className="animate-fade-in-up space-y-6">
            {isGenerating && (
              <div className="flex items-center justify-center gap-3 py-4">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <span className="text-indigo-600 font-medium">
                  正在生成图片... (
                  {jobs.filter((j) => j.status === "done").length}/
                  {jobs.length})
                </span>
              </div>
            )}

            <ResultGallery
              jobs={jobs}
              productName={analysis?.productName || "商品"}
              plans={plans}
              originalImages={originalImages.map((img) => img.file)}
              productMode={productMode}
              imageLanguage={regionToLanguage(salesRegion)}
              onJobUpdate={handleJobUpdate}
              onScoresChange={setImageScores}
            />

            {/* 标题生成结果（与图片并行生成） */}
            {(isGeneratingTitle || generatedTitles.length > 0) && (
              <div className="premium-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Type className="w-5 h-5 text-violet-500" />
                    商品标题
                  </h3>
                </div>

                {isGeneratingTitle && (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                    <span className="text-sm text-violet-500">标题生成中...</span>
                  </div>
                )}

                {generatedTitles.length > 0 && (
                  <div className="space-y-3">
                    {generatedTitles.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-[var(--color-border-subtle)] hover:border-violet-300 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">
                            {item.label}
                          </span>
                          <button
                            onClick={() => copyTitle(item.title, idx)}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-violet-600 transition-colors"
                          >
                            {copiedIdx === idx ? (
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
                        <p className="text-sm text-slate-700 leading-relaxed break-all">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {item.title.length} 字符
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === "results" && !isGenerating && (
              <>
                <div className="flex items-center justify-center gap-3">
                  <MobilePreview jobs={jobs} />
                  <span className="text-xs text-slate-400">
                    不满意？悬浮图片点击 🔄 可单张重新生成
                  </span>
                </div>

                {/* 图片顺序优化 */}
                <ImageOrderOptimizer
                  scores={imageScores}
                  imageTypes={jobs.map((j) => j.imageType)}
                />
              </>
            )}
          </div>
        )}
      </div></>}
    </main>
  );
}
