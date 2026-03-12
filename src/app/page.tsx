"use client";

import { useState, useCallback } from "react";
import ImageUploader from "@/components/ImageUploader";
import AnalysisResultComponent from "@/components/AnalysisResult";
import ImageTypeSelector from "@/components/ImageTypeSelector";
import ImagePlanEditor from "@/components/ImagePlanEditor";
import ResultGallery from "@/components/ResultGallery";
import { IMAGE_TYPE_ORDER } from "@/lib/types";
import type { AnalysisResult, ImageType, ImagePlan, GenerationJob } from "@/lib/types";
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
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (originalImages.length === 0) return;
    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: originalImages }),
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
  }, [originalImages]);

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
  }, [originalImages, plans]);

  const handleReset = () => {
    setStep("upload");
    setOriginalImages([]);
    setAnalysis(null);
    setPlans([]);
    setJobs([]);
    setError(null);
    setSelectedTypes([...IMAGE_TYPE_ORDER]);
  };

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              亚马逊商品图片生成器
            </h1>
            <p className="text-sm text-gray-500">
              上传商品照片 &rarr; AI 自动生成 7 张 listing 图片
            </p>
          </div>
          {step !== "upload" && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
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
                {i > 0 && <div className="w-8 h-px bg-gray-300" />}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    currentIdx === itemIdx
                      ? "bg-blue-100 text-blue-700"
                      : currentIdx > itemIdx
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
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
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="max-w-2xl mx-auto">
            <ImageUploader
              images={originalImages}
              onImagesChange={setOriginalImages}
              isProcessing={isProcessing}
              onSubmit={handleAnalyze}
            />
            <p className="text-center text-xs text-gray-400 mt-4">
              上传 1-5 张商品图，支持组合装/套装多商品
            </p>
          </div>
        )}

        {/* Step 2: Review analysis + select types */}
        {step === "review" && analysis && (
          <>
            {originalImages.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-xs text-gray-400 mb-2">
                  上传的商品图（{originalImages.length} 张）
                </p>
                <div className="flex gap-3 flex-wrap">
                  {originalImages.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`商品 ${idx + 1}`}
                      className="w-28 h-28 object-contain rounded-lg border"
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
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
              >
                <ArrowRight className="w-5 h-5" />
                生成方案（{selectedTypes.length} 张图）
              </button>
            </div>
          </>
        )}

        {/* Step 3: Plan review */}
        {step === "plan" && plans.length > 0 && (
          <>
            <ImagePlanEditor plans={plans} onChange={setPlans} />

            <div className="flex justify-center gap-4">
              <button
                onClick={() => setStep("review")}
                className="flex items-center gap-2 px-6 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                返回修改
              </button>
              <button
                onClick={handleGenerate}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-lg font-semibold shadow-lg shadow-blue-200"
              >
                <Zap className="w-5 h-5" />
                开始生成 {plans.length} 张图片
              </button>
            </div>
          </>
        )}

        {/* Step 4 & 5: Generation progress + Results */}
        {(step === "generate" || step === "results") && (
          <>
            {isGenerating && (
              <div className="flex items-center justify-center gap-3 py-4">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-blue-600 font-medium">
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
          </>
        )}
      </div>
    </main>
  );
}
