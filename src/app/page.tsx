"use client";

import { useState, useCallback } from "react";
import ImageUploader from "@/components/ImageUploader";
import type { ProductMode } from "@/components/ImageUploader";
import AnalysisResultComponent from "@/components/AnalysisResult";
import ImageTypeSelector from "@/components/ImageTypeSelector";
import ImagePlanEditor from "@/components/ImagePlanEditor";
import ResultGallery from "@/components/ResultGallery";
import { IMAGE_TYPE_ORDER } from "@/lib/types";
import type { AnalysisResult, ImageType, ImagePlan, GenerationJob, AnalysisLanguage } from "@/lib/types";
import { generatePlans } from "@/lib/prompt-templates";
import { Loader2, Zap, RotateCcw, ArrowRight } from "lucide-react";

type Step = "upload" | "review" | "plan" | "generate" | "results";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<ImageType[]>([
    ...IMAGE_TYPE_ORDER,
  ]);
  const [plans, setPlans] = useState<ImagePlan[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [productMode, setProductMode] = useState<ProductMode>("single");
  const [language, setLanguage] = useState<AnalysisLanguage>("zh");
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (originalImages.length === 0) return;
    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: originalImages, productMode, language }),
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
  }, [originalImages, productMode, language]);

  const handleProceedToPlan = useCallback(() => {
    if (!analysis) return;
    const imagePlans = generatePlans(analysis, selectedTypes);
    setPlans(imagePlans);
    setStep("plan");
  }, [analysis, selectedTypes]);

  const handleGenerate = useCallback(async () => {
    if (originalImages.length === 0 || plans.length === 0) return;

    setIsGenerating(true);
    setStep("generate");

    const initialJobs: GenerationJob[] = plans.map((p) => ({
      imageType: p.imageType,
      status: "pending",
    }));
    setJobs(initialJobs);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plans,
          originalImages,
          productMode,
        }),
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
          const data = JSON.parse(line.slice(6));

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
                status: data.status,
                finalImageUrl: data.imageUrl || job.finalImageUrl,
                error: data.error,
              };
            })
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
      setIsGenerating(false);
    }
  }, [originalImages, plans, productMode]);

  const handleReset = () => {
    setStep("upload");
    setOriginalImages([]);
    setAnalysis(null);
    setPlans([]);
    setJobs([]);
    setError(null);
    setSelectedTypes([...IMAGE_TYPE_ORDER]);
    setProductMode("single");
    setLanguage("zh");
  };

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="glass-card sticky top-0 z-50 border-b border-[var(--color-border-subtle)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              亚马逊商品图片生成器
            </h1>
            <p className="text-sm text-slate-400">
              上传商品照片 &rarr; AI 自动生成 7 张 listing 图片
            </p>
          </div>
          {step !== "upload" && (
            <button
              onClick={handleReset}
              className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              重新开始
            </button>
          )}
        </div>
      </header>

      {/* Progress Steps */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center gap-2 text-sm">
          {[
            { key: "upload", label: "1. 上传" },
            { key: "review", label: "2. 商品分析" },
            { key: "plan", label: "3. 方案确认" },
            { key: "generate", label: "4. 生成" },
            { key: "results", label: "5. 下载" },
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

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 pb-12 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm animate-fade-in-up">
            {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="max-w-2xl mx-auto animate-fade-in-up">
            <ImageUploader
              images={originalImages}
              onImagesChange={setOriginalImages}
              isProcessing={isProcessing}
              onSubmit={handleAnalyze}
              productMode={productMode}
              onProductModeChange={setProductMode}
              language={language}
              onLanguageChange={setLanguage}
            />
            <p className="text-center text-xs text-slate-400 mt-4">
              上传 1-5 张商品图，支持组合装/套装多商品
            </p>
          </div>
        )}

        {/* Step 2: Review analysis + select types */}
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
                      src={img}
                      alt={`商品 ${idx + 1}`}
                      className="w-28 h-28 object-contain rounded-xl border border-[var(--color-border-subtle)] hover:shadow-lg transition-shadow"
                    />
                  ))}
                </div>
              </div>
            )}

            <AnalysisResultComponent
              analysis={analysis}
              onChange={setAnalysis}
            />

            <ImageTypeSelector
              selected={selectedTypes}
              onChange={setSelectedTypes}
            />

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

        {/* Step 3: Plan review */}
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

        {/* Step 4 & 5: Generation progress + Results */}
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
            />
          </div>
        )}
      </div>
    </main>
  );
}
