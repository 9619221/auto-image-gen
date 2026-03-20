"use client";

import { useState, useCallback, useRef } from "react";
import {
  Plus,
  Play,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Upload,
  X,
  Globe,
  Square,
  Pause,
  ImageIcon,
  Package,
  Camera,
  Palette,
} from "lucide-react";
import type { SalesRegion, ProductMode, ImageType, ImagePlan } from "@/lib/types";
import { REGION_CONFIGS, REGION_ORDER, IMAGE_TYPE_ORDER, IMAGE_TYPE_LABELS, regionToLanguage } from "@/lib/types";
import { generatePlans } from "@/lib/prompt-templates";

const MAX_IMAGES_PER_TASK = 5;

interface BatchImage {
  file: File;
  previewUrl: string;
}

export interface BatchTask {
  id: string;
  images: BatchImage[];
  productMode: ProductMode;
  salesRegion: SalesRegion;
  selectedTypes: ImageType[];
  status: "queued" | "analyzing" | "generating" | "done" | "error";
  progress: string;
  productName: string;
  error: string;
  completedImages: number;
  totalImages: number;
}

interface BatchProcessorProps {
  onExit: () => void;
}

export default function BatchProcessor({ onExit }: BatchProcessorProps) {
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(-1);
  const [completedCount, setCompletedCount] = useState(0);
  const abortRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 用于新增任务的临时状态
  const [addingTask, setAddingTask] = useState(false);
  const [newImages, setNewImages] = useState<BatchImage[]>([]);
  const [newMode, setNewMode] = useState<ProductMode>("single");
  const [newRegion, setNewRegion] = useState<SalesRegion>("us");
  const [newTypes, setNewTypes] = useState<ImageType[]>([...IMAGE_TYPE_ORDER]);

  const addFilesToNew = useCallback(
    (files: FileList | File[]) => {
      const remaining = MAX_IMAGES_PER_TASK - newImages.length;
      if (remaining <= 0) return;
      const items = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, remaining)
        .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
      if (items.length > 0) {
        setNewImages((prev) => [...prev, ...items]);
      }
    },
    [newImages.length]
  );

  const confirmAddTask = useCallback(() => {
    if (newImages.length === 0) return;
    const task: BatchTask = {
      id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      images: newImages,
      productMode: newMode,
      salesRegion: newRegion,
      selectedTypes: newTypes.length > 0 ? newTypes : [...IMAGE_TYPE_ORDER],
      status: "queued",
      progress: "等待处理",
      productName: "",
      error: "",
      completedImages: 0,
      totalImages: newTypes.length || IMAGE_TYPE_ORDER.length,
    };
    setTasks((prev) => [...prev, task]);
    setNewImages([]);
    setNewMode("single");
    setNewRegion("us");
    setNewTypes([...IMAGE_TYPE_ORDER]);
    setAddingTask(false);
  }, [newImages, newMode, newRegion, newTypes]);

  const removeTask = useCallback(
    (id: string) => {
      if (isRunning) return;
      setTasks((prev) => {
        const task = prev.find((t) => t.id === id);
        if (task) {
          task.images.forEach((img) => {
            if (img.previewUrl.startsWith("blob:")) URL.revokeObjectURL(img.previewUrl);
          });
        }
        return prev.filter((t) => t.id !== id);
      });
    },
    [isRunning]
  );

  const updateTask = useCallback((id: string, update: Partial<BatchTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...update } : t)));
  }, []);

  // ---- 核心：处理单个任务 ----
  const processTask = useCallback(
    async (task: BatchTask): Promise<boolean> => {
      if (abortRef.current) return false;

      // Step 1: 分析
      updateTask(task.id, { status: "analyzing", progress: "AI 分析中..." });

      const formData = new FormData();
      task.images.forEach((img) => formData.append("images", img.file, img.file.name));
      formData.append("productMode", task.productMode);

      let analysis;
      try {
        const res = await fetch("/api/analyze", { method: "POST", body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        analysis = data;
        updateTask(task.id, { productName: analysis.productName || "未知商品" });
      } catch (err) {
        updateTask(task.id, {
          status: "error",
          error: `分析失败: ${err instanceof Error ? err.message : "未知错误"}`,
          progress: "失败",
        });
        return false;
      }

      if (abortRef.current) return false;

      // Step 2: 生成计划
      updateTask(task.id, { progress: "生成方案中..." });
      let plans: ImagePlan[];
      try {
        plans = generatePlans(analysis, task.selectedTypes, task.salesRegion);
        updateTask(task.id, { totalImages: plans.length });
      } catch (err) {
        updateTask(task.id, {
          status: "error",
          error: `方案生成失败: ${err instanceof Error ? err.message : "未知错误"}`,
          progress: "失败",
        });
        return false;
      }

      if (abortRef.current) return false;

      // Step 3: 生成图片
      updateTask(task.id, { status: "generating", progress: "生成图片 0/" + plans.length });

      try {
        const genFormData = new FormData();
        task.images.forEach((img) => genFormData.append("images", img.file, img.file.name));
        genFormData.append("plans", JSON.stringify(plans));
        genFormData.append("productMode", task.productMode);
        genFormData.append("imageLanguage", regionToLanguage(task.salesRegion));
        genFormData.append("salesRegion", task.salesRegion);

        const response = await fetch("/api/generate", { method: "POST", body: genFormData });
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error("无法启动生成流");

        let buffer = "";
        let completed = 0;
        const generatedImages: { imageType: string; imageUrl: string }[] = [];

        while (true) {
          if (abortRef.current) break;
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

            if (data.status === "complete") continue;

            if (data.status === "done" && data.imageUrl) {
              completed++;
              generatedImages.push({
                imageType: data.imageType as string,
                imageUrl: data.imageUrl as string,
              });
              updateTask(task.id, {
                completedImages: completed,
                progress: `生成图片 ${completed}/${plans.length}`,
              });
            }
          }
        }

        if (abortRef.current) return false;

        // Step 4: 保存到历史
        if (generatedImages.length > 0) {
          updateTask(task.id, { progress: "保存中..." });
          try {
            await fetch("/api/history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                productName: analysis.productName || "批量商品",
                salesRegion: task.salesRegion,
                imageCount: generatedImages.length,
                images: generatedImages,
              }),
            });
          } catch {
            /* ignore save errors */
          }
        }

        updateTask(task.id, {
          status: "done",
          progress: `完成 ${generatedImages.length}/${plans.length} 张`,
          completedImages: generatedImages.length,
        });
        return true;
      } catch (err) {
        updateTask(task.id, {
          status: "error",
          error: `生成失败: ${err instanceof Error ? err.message : "未知错误"}`,
          progress: "失败",
        });
        return false;
      }
    },
    [updateTask]
  );

  // ---- 开始批量处理 ----
  const startBatch = useCallback(async () => {
    const queuedTasks = tasks.filter((t) => t.status === "queued");
    if (queuedTasks.length === 0) return;

    setIsRunning(true);
    abortRef.current = false;
    setCompletedCount(0);

    for (let i = 0; i < queuedTasks.length; i++) {
      if (abortRef.current) break;
      setCurrentTaskIndex(tasks.findIndex((t) => t.id === queuedTasks[i].id));
      const success = await processTask(queuedTasks[i]);
      if (success) {
        setCompletedCount((prev) => prev + 1);
      }
    }

    setIsRunning(false);
    setCurrentTaskIndex(-1);
  }, [tasks, processTask]);

  const stopBatch = useCallback(() => {
    abortRef.current = true;
  }, []);

  const clearCompleted = useCallback(() => {
    if (isRunning) return;
    setTasks((prev) => {
      prev
        .filter((t) => t.status === "done" || t.status === "error")
        .forEach((t) => {
          t.images.forEach((img) => {
            if (img.previewUrl.startsWith("blob:")) URL.revokeObjectURL(img.previewUrl);
          });
        });
      return prev.filter((t) => t.status !== "done" && t.status !== "error");
    });
  }, [isRunning]);

  const queuedCount = tasks.filter((t) => t.status === "queued").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const errorCount = tasks.filter((t) => t.status === "error").length;
  const totalCount = tasks.length;

  const toggleType = (type: ImageType) => {
    setNewTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 顶部状态栏 */}
      <div className="premium-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-500" />
              批量产品处理
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              添加多个产品到队列，自动完成分析→生成→保存，可挂机运行
            </p>
          </div>
          <button onClick={onExit} className="btn-ghost px-4 py-2 text-sm" disabled={isRunning}>
            退出批量模式
          </button>
        </div>

        {/* 统计 */}
        {totalCount > 0 && (
          <div className="flex items-center gap-4 text-sm mb-4">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600">
              <ImageIcon className="w-3.5 h-3.5" /> 总计 {totalCount} 个产品
            </span>
            {queuedCount > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600">
                等待中 {queuedCount}
              </span>
            )}
            {doneCount > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> 完成 {doneCount}
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600">
                <XCircle className="w-3.5 h-3.5" /> 失败 {errorCount}
              </span>
            )}
          </div>
        )}

        {/* 进度条 */}
        {isRunning && totalCount > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>批量进度</span>
              <span>
                {doneCount + errorCount} / {tasks.filter((t) => t.status !== "queued" || isRunning).length}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                style={{
                  width: `${totalCount > 0 ? ((doneCount + errorCount) / totalCount) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          {!isRunning ? (
            <>
              <button
                onClick={() => setAddingTask(true)}
                className="btn-ghost flex items-center gap-2 px-4 py-2.5 text-sm"
                disabled={addingTask}
              >
                <Plus className="w-4 h-4" />
                添加产品
              </button>
              {queuedCount > 0 && (
                <button
                  onClick={startBatch}
                  className="btn-accent flex items-center gap-2 px-6 py-2.5 text-sm"
                >
                  <Play className="w-4 h-4" />
                  开始处理 ({queuedCount} 个产品)
                </button>
              )}
              {(doneCount > 0 || errorCount > 0) && (
                <button
                  onClick={clearCompleted}
                  className="btn-ghost flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400"
                >
                  <Trash2 className="w-4 h-4" />
                  清除已完成
                </button>
              )}
            </>
          ) : (
            <button
              onClick={stopBatch}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
            >
              <Square className="w-4 h-4" />
              停止处理
            </button>
          )}
        </div>
      </div>

      {/* 添加产品面板 */}
      {addingTask && (
        <div className="premium-card p-6 border-2 border-indigo-200 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-500" />
              添加新产品到队列
            </h3>
            <button
              onClick={() => {
                newImages.forEach((img) => {
                  if (img.previewUrl.startsWith("blob:")) URL.revokeObjectURL(img.previewUrl);
                });
                setNewImages([]);
                setAddingTask(false);
              }}
              className="p-1 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* 上传图片 */}
          <div className="space-y-4">
            {newImages.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-xl border-slate-200 hover:border-indigo-400 transition-colors cursor-pointer"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFilesToNew(e.dataTransfer.files);
                }}
              >
                <Upload className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">点击或拖拽上传商品图片</p>
                <p className="text-xs text-slate-300 mt-1">最多 {MAX_IMAGES_PER_TASK} 张</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-500">
                    已选 {newImages.length}/{MAX_IMAGES_PER_TASK} 张
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {newImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative w-20 h-20 rounded-lg border border-slate-200 overflow-hidden group"
                    >
                      <img src={img.previewUrl} alt="" className="w-full h-full object-contain p-0.5" />
                      <button
                        onClick={() => {
                          if (img.previewUrl.startsWith("blob:")) URL.revokeObjectURL(img.previewUrl);
                          setNewImages((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  {newImages.length < MAX_IMAGES_PER_TASK && (
                    <button
                      onClick={() => inputRef.current?.click()}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center hover:border-indigo-400 transition-colors"
                    >
                      <Plus className="w-5 h-5 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) addFilesToNew(e.target.files);
                e.target.value = "";
              }}
            />

            {/* 产品模式 & 地区 (紧凑排列) */}
            {newImages.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 模式 */}
                {newImages.length > 1 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2 font-medium">拍摄模式</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setNewMode("single")}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          newMode === "single"
                            ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm"
                            : "bg-white text-slate-600 border border-slate-200"
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5 inline mr-1" />
                        单品多角度
                      </button>
                      <button
                        onClick={() => setNewMode("bundle")}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          newMode === "bundle"
                            ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm"
                            : "bg-white text-slate-600 border border-slate-200"
                        }`}
                      >
                        <Package className="w-3.5 h-3.5 inline mr-1" />
                        套装组合
                      </button>
                      <button
                        onClick={() => setNewMode("variants")}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          newMode === "variants"
                            ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm"
                            : "bg-white text-slate-600 border border-slate-200"
                        }`}
                      >
                        <Palette className="w-3.5 h-3.5 inline mr-1" />
                        多色/多规格
                      </button>
                    </div>
                  </div>
                )}

                {/* 地区 */}
                <div>
                  <p className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" />
                    销售地区
                  </p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {REGION_ORDER.map((regionCode) => {
                      const config = REGION_CONFIGS[regionCode];
                      return (
                        <button
                          key={regionCode}
                          onClick={() => setNewRegion(regionCode)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-center ${
                            newRegion === regionCode
                              ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm"
                              : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-300"
                          }`}
                        >
                          {config.flag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 图片类型选择 */}
            {newImages.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-500 font-medium">生成图片类型</p>
                  <button
                    onClick={() =>
                      setNewTypes((prev) =>
                        prev.length === IMAGE_TYPE_ORDER.length ? [] : [...IMAGE_TYPE_ORDER]
                      )
                    }
                    className="text-xs text-indigo-500 hover:text-indigo-700"
                  >
                    {newTypes.length === IMAGE_TYPE_ORDER.length ? "取消全选" : "全选"}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {IMAGE_TYPE_ORDER.map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        newTypes.includes(type)
                          ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                          : "bg-white text-slate-400 border border-slate-200"
                      }`}
                    >
                      {IMAGE_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 确认按钮 */}
            {newImages.length > 0 && (
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    newImages.forEach((img) => {
                      if (img.previewUrl.startsWith("blob:")) URL.revokeObjectURL(img.previewUrl);
                    });
                    setNewImages([]);
                    setAddingTask(false);
                  }}
                  className="btn-ghost px-4 py-2 text-sm"
                >
                  取消
                </button>
                <button
                  onClick={confirmAddTask}
                  disabled={newTypes.length === 0}
                  className="btn-accent flex items-center gap-2 px-5 py-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  加入队列 ({newImages.length} 张图, {newTypes.length} 种类型)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 任务列表 */}
      {tasks.length === 0 && !addingTask && (
        <div className="premium-card p-12 text-center">
          <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">队列为空，点击"添加产品"开始</p>
          <p className="text-slate-300 text-xs mt-2">
            每个产品将自动完成：AI分析 → 生成方案 → 生成全套图片 → 保存历史
          </p>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="space-y-3">
          {tasks.map((task, idx) => (
            <TaskCard
              key={task.id}
              task={task}
              index={idx}
              isCurrent={isRunning && idx === currentTaskIndex}
              onRemove={() => removeTask(task.id)}
              canRemove={!isRunning}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- 单个任务卡片 ----
function TaskCard({
  task,
  index,
  isCurrent,
  onRemove,
  canRemove,
}: {
  task: BatchTask;
  index: number;
  isCurrent: boolean;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const regionConfig = REGION_CONFIGS[task.salesRegion];
  const statusColor = {
    queued: "bg-slate-100 text-slate-500",
    analyzing: "bg-blue-50 text-blue-600",
    generating: "bg-indigo-50 text-indigo-600",
    done: "bg-emerald-50 text-emerald-600",
    error: "bg-red-50 text-red-600",
  }[task.status];

  const statusIcon = {
    queued: <div className="w-2 h-2 rounded-full bg-slate-300" />,
    analyzing: <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />,
    generating: <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />,
    done: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
    error: <XCircle className="w-3.5 h-3.5 text-red-500" />,
  }[task.status];

  return (
    <div
      className={`premium-card p-4 transition-all ${
        isCurrent ? "ring-2 ring-indigo-400 ring-offset-2" : ""
      } ${task.status === "done" ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-4">
        {/* 序号 */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-400">
          {index + 1}
        </div>

        {/* 缩略图 */}
        <div className="flex-shrink-0 flex gap-1">
          {task.images.slice(0, 3).map((img, i) => (
            <img
              key={i}
              src={img.previewUrl}
              alt=""
              className="w-12 h-12 object-contain rounded-lg border border-slate-100"
            />
          ))}
          {task.images.length > 3 && (
            <div className="w-12 h-12 rounded-lg border border-slate-100 flex items-center justify-center text-xs text-slate-400 bg-slate-50">
              +{task.images.length - 3}
            </div>
          )}
        </div>

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800 truncate">
              {task.productName || `产品 ${index + 1}`}
            </span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">
              {regionConfig.flag} {task.images.length} 张参考图
            </span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">
              {task.selectedTypes.length} 种类型
            </span>
            {task.productMode === "bundle" && (
              <span className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">
                套装
              </span>
            )}
            {task.productMode === "variants" && (
              <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">
                多规格
              </span>
            )}
          </div>

          {/* 进度 */}
          <div className="flex items-center gap-2 mt-1">
            {statusIcon}
            <span className={`text-xs px-2 py-0.5 rounded-md ${statusColor}`}>
              {task.progress}
            </span>
            {task.status === "generating" && task.totalImages > 0 && (
              <div className="flex-1 max-w-[200px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${(task.completedImages / task.totalImages) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>

          {/* 错误信息 */}
          {task.error && (
            <p className="text-xs text-red-500 mt-1 truncate">{task.error}</p>
          )}
        </div>

        {/* 删除 */}
        {canRemove && task.status !== "analyzing" && task.status !== "generating" && (
          <button
            onClick={onRemove}
            className="flex-shrink-0 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
