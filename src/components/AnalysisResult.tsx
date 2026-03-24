"use client";

import { useState, useCallback, useRef } from "react";
import type { AnalysisResult as AnalysisResultType } from "@/lib/types";
import { Package, Users, MapPin, Ruler, Palette, Sparkles, Pencil, Plus, X, RefreshCw, Loader2, Languages } from "lucide-react";

interface AnalysisResultProps {
  analysis: AnalysisResultType;
  onChange: (analysis: AnalysisResultType | ((prev: AnalysisResultType) => AnalysisResultType)) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

// Parse "中文 (English)" format into { cn, en }
function splitCnEn(value: string): { cn: string; en: string } {
  // Find the LAST top-level parentheses pair that contains English text
  // e.g. "可调节腕力训练器 (Adjustable Wrist Forearm Exerciser)"
  // e.g. "哑光黑色机身 (#000000)，泡沫垫 (Matte black body, foam pad)" — last () has English
  const lastOpenParen = value.lastIndexOf("(");
  if (lastOpenParen > 0 && value.endsWith(")")) {
    const cn = value.slice(0, lastOpenParen).trim();
    const en = value.slice(lastOpenParen + 1, -1).trim();
    // Verify: cn should have Chinese, en should have Latin letters
    if (/[\u4e00-\u9fff]/.test(cn) && /[a-zA-Z]/.test(en)) {
      return { cn, en };
    }
  }
  // Try "中文 / English" pattern
  const slashMatch = value.match(/^(.+?)\s*[/／]\s*(.+)$/);
  if (slashMatch) {
    const left = slashMatch[1].trim();
    const right = slashMatch[2].trim();
    if (/[\u4e00-\u9fff]/.test(left) && /[a-zA-Z]/.test(right)) return { cn: left, en: right };
  }
  // If has Chinese, treat as Chinese-only
  if (/[\u4e00-\u9fff]/.test(value)) return { cn: value, en: "" };
  // All English
  return { cn: "", en: value };
}

// Combine back to "中文 (English)" format
function combineCnEn(cn: string, en: string): string {
  if (!cn && !en) return "";
  if (!en) return cn;
  if (!cn) return en;
  return `${cn} (${en})`;
}

export default function AnalysisResult({
  analysis,
  onChange,
  onRegenerate,
  isRegenerating = false,
}: AnalysisResultProps) {
  const [translating, setTranslating] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTranslationsRef = useRef<Map<string, string>>(new Map());

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

  const addArrayItem = (key: "sellingPoints" | "targetAudience" | "usageScenes") => {
    const arr = [...analysis[key], ""];
    onChange({ ...analysis, [key]: arr });
  };

  const removeArrayItem = (key: "sellingPoints" | "targetAudience" | "usageScenes", index: number) => {
    const arr = analysis[key].filter((_, i) => i !== index);
    onChange({ ...analysis, [key]: arr });
  };

  // Update Chinese part of a field, schedule translation
  const updateCnPart = (
    fieldKey: string,
    fullValue: string,
    newCn: string,
    updateFn: (combined: string) => void
  ) => {
    const { en } = splitCnEn(fullValue);
    const combined = combineCnEn(newCn, en);
    updateFn(combined);

    // Schedule batch translation
    if (newCn.trim()) {
      pendingTranslationsRef.current.set(fieldKey, newCn);
      scheduleBatchTranslation();
    }
  };

  // Update English part directly
  const updateEnPart = (
    fullValue: string,
    newEn: string,
    updateFn: (combined: string) => void
  ) => {
    const { cn } = splitCnEn(fullValue);
    updateFn(combineCnEn(cn, newEn));
  };

  // Batch translate after user stops typing
  const scheduleBatchTranslation = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      const pending = new Map(pendingTranslationsRef.current);
      pendingTranslationsRef.current.clear();
      if (pending.size === 0) return;

      const keys = Array.from(pending.keys());
      const texts = Array.from(pending.values());

      setTranslating(true);
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts }),
        });
        if (!res.ok) throw new Error("translate failed");
        const { translations } = await res.json() as { translations: string[] };

        // Apply translations - need to read current analysis from DOM
        onChange((prev: AnalysisResultType) => {
          const updated = { ...prev };
          keys.forEach((key, i) => {
            const translated = translations[i] || "";
            if (key === "productName") {
              const { cn } = splitCnEn(updated.productName);
              updated.productName = combineCnEn(cn, translated);
            } else if (key === "category") {
              const { cn } = splitCnEn(updated.category);
              updated.category = combineCnEn(cn, translated);
            } else if (key === "materials") {
              const { cn } = splitCnEn(updated.materials);
              updated.materials = combineCnEn(cn, translated);
            } else if (key === "colors") {
              const { cn } = splitCnEn(updated.colors);
              updated.colors = combineCnEn(cn, translated);
            } else if (key === "estimatedDimensions") {
              const { cn } = splitCnEn(updated.estimatedDimensions);
              updated.estimatedDimensions = combineCnEn(cn, translated);
            } else if (key.startsWith("sellingPoints.")) {
              const idx = parseInt(key.split(".")[1]);
              if (idx < updated.sellingPoints.length) {
                const { cn } = splitCnEn(updated.sellingPoints[idx]);
                updated.sellingPoints = [...updated.sellingPoints];
                updated.sellingPoints[idx] = combineCnEn(cn, translated);
              }
            } else if (key.startsWith("targetAudience.")) {
              const idx = parseInt(key.split(".")[1]);
              if (idx < updated.targetAudience.length) {
                const { cn } = splitCnEn(updated.targetAudience[idx]);
                updated.targetAudience = [...updated.targetAudience];
                updated.targetAudience[idx] = combineCnEn(cn, translated);
              }
            } else if (key.startsWith("usageScenes.")) {
              const idx = parseInt(key.split(".")[1]);
              if (idx < updated.usageScenes.length) {
                const { cn } = splitCnEn(updated.usageScenes[idx]);
                updated.usageScenes = [...updated.usageScenes];
                updated.usageScenes[idx] = combineCnEn(cn, translated);
              }
            }
          });
          return updated;
        });
      } catch (e) {
        console.error("Translation error:", e);
      } finally {
        setTranslating(false);
      }
    }, 1500);
  }, [onChange]);

  // Render a bilingual field pair
  const BilingualField = ({
    label,
    icon,
    value,
    fieldKey,
    onUpdate,
  }: {
    label: string;
    icon?: React.ReactNode;
    value: string;
    fieldKey: string;
    onUpdate: (combined: string) => void;
  }) => {
    const { cn, en } = splitCnEn(value);
    return (
      <div>
        <label className="block text-xs uppercase tracking-wide font-medium text-slate-400 mb-1.5">
          {icon}{label}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={cn}
            onChange={(e) => updateCnPart(fieldKey, value, e.target.value, onUpdate)}
            className="input-premium"
            placeholder="中文"
          />
          <input
            type="text"
            value={en}
            onChange={(e) => updateEnPart(value, e.target.value, onUpdate)}
            className="input-premium text-slate-500"
            placeholder="English (auto)"
          />
        </div>
      </div>
    );
  };

  // Render a bilingual array
  const BilingualArrayField = ({
    label,
    icon,
    arrayKey,
    items,
    useTextarea = false,
  }: {
    label: string;
    icon?: React.ReactNode;
    arrayKey: "sellingPoints" | "targetAudience" | "usageScenes";
    items: string[];
    useTextarea?: boolean;
  }) => (
    <div className={isRegenerating ? "opacity-50 pointer-events-none animate-pulse" : ""}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs uppercase tracking-wide font-medium text-slate-400 flex items-center">
          {icon}{label}
        </label>
        <button
          onClick={() => addArrayItem(arrayKey)}
          className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          添加
        </button>
      </div>
      {/* Column headers */}
      <div className="grid grid-cols-2 gap-2 mb-1 px-1">
        <span className="text-[10px] text-slate-300 uppercase tracking-wider">中文</span>
        <span className="text-[10px] text-slate-300 uppercase tracking-wider">English (auto-translate)</span>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => {
          const { cn, en } = splitCnEn(item);
          return (
            <div key={i} className="flex items-start gap-2">
              <div className="grid grid-cols-2 gap-2 flex-1">
                {useTextarea ? (
                  <>
                    <textarea
                      value={cn}
                      onChange={(e) =>
                        updateCnPart(
                          `${arrayKey}.${i}`,
                          item,
                          e.target.value,
                          (combined) => updateArrayItem(arrayKey, i, combined)
                        )
                      }
                      rows={2}
                      className="input-premium resize-none"
                      placeholder={`中文 ${i + 1}`}
                    />
                    <textarea
                      value={en}
                      onChange={(e) =>
                        updateEnPart(item, e.target.value, (combined) =>
                          updateArrayItem(arrayKey, i, combined)
                        )
                      }
                      rows={2}
                      className="input-premium resize-none text-slate-500"
                      placeholder={`English ${i + 1}`}
                    />
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={cn}
                      onChange={(e) =>
                        updateCnPart(
                          `${arrayKey}.${i}`,
                          item,
                          e.target.value,
                          (combined) => updateArrayItem(arrayKey, i, combined)
                        )
                      }
                      className="input-premium"
                      placeholder={`中文 ${i + 1}`}
                    />
                    <input
                      type="text"
                      value={en}
                      onChange={(e) =>
                        updateEnPart(item, e.target.value, (combined) =>
                          updateArrayItem(arrayKey, i, combined)
                        )
                      }
                      className="input-premium text-slate-500"
                      placeholder={`English ${i + 1}`}
                    />
                  </>
                )}
              </div>
              {items.length > 1 && (
                <button
                  onClick={() => removeArrayItem(arrayKey, i)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors mt-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="premium-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          AI 分析结果
        </h3>
        <div className="flex items-center gap-3">
          {translating && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium border border-blue-200 animate-pulse">
              <Languages className="w-3 h-3" />
              翻译中...
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-medium border border-amber-200">
            <Pencil className="w-3 h-3" />
            改中文自动翻译英文
          </span>
        </div>
      </div>

      {/* Product Name & Category */}
      <div className="grid grid-cols-2 gap-4">
        <BilingualField
          label="商品名称"
          icon={<Package className="w-3.5 h-3.5 inline mr-1" />}
          value={analysis.productName}
          fieldKey="productName"
          onUpdate={(v) => updateField("productName", v)}
        />
        <BilingualField
          label="商品类目"
          value={analysis.category}
          fieldKey="category"
          onUpdate={(v) => updateField("category", v)}
        />
      </div>

      {/* Materials & Colors & Dimensions */}
      <div className="grid grid-cols-3 gap-4">
        <BilingualField
          label="材质"
          value={analysis.materials}
          fieldKey="materials"
          onUpdate={(v) => updateField("materials", v)}
        />
        <BilingualField
          label="颜色"
          icon={<Palette className="w-3.5 h-3.5 inline mr-1" />}
          value={analysis.colors}
          fieldKey="colors"
          onUpdate={(v) => updateField("colors", v)}
        />
        <BilingualField
          label="尺寸"
          icon={<Ruler className="w-3.5 h-3.5 inline mr-1" />}
          value={analysis.estimatedDimensions}
          fieldKey="estimatedDimensions"
          onUpdate={(v) => updateField("estimatedDimensions", v)}
        />
      </div>

      {/* Divider: base fields above, AI-derived fields below */}
      {onRegenerate && (
        <div className="relative border-t border-dashed border-slate-200 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              以下字段由 AI 根据上方基础信息自动生成，修改上方信息后可点击重新生成
            </p>
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-sm font-medium border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isRegenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {isRegenerating ? "AI 重新生成中..." : "AI 重新生成"}
            </button>
          </div>
        </div>
      )}

      {/* Selling Points */}
      <BilingualArrayField
        label="核心卖点"
        icon={<Sparkles className="w-3.5 h-3.5 mr-1" />}
        arrayKey="sellingPoints"
        items={analysis.sellingPoints}
      />

      {/* Target Audience */}
      <BilingualArrayField
        label="目标人群"
        icon={<Users className="w-3.5 h-3.5 mr-1" />}
        arrayKey="targetAudience"
        items={analysis.targetAudience}
      />

      {/* Usage Scenes */}
      <BilingualArrayField
        label="使用场景"
        icon={<MapPin className="w-3.5 h-3.5 mr-1" />}
        arrayKey="usageScenes"
        items={analysis.usageScenes}
        useTextarea
      />
    </div>
  );
}
