"use client";

import { useCallback, useRef } from "react";
import { Upload, Loader2, X, Plus, Globe } from "lucide-react";
import type { AnalysisLanguage } from "@/lib/types";
import { LANGUAGE_LABELS } from "@/lib/types";

const MAX_IMAGES = 5;

export type ProductMode = "single" | "bundle";

interface ImageUploaderProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  isProcessing: boolean;
  onSubmit: () => void;
  productMode: ProductMode;
  onProductModeChange: (mode: ProductMode) => void;
  language: AnalysisLanguage;
  onLanguageChange: (lang: AnalysisLanguage) => void;
}

export default function ImageUploader({
  images,
  onImagesChange,
  isProcessing,
  onSubmit,
  productMode,
  onProductModeChange,
  language,
  onLanguageChange,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const remaining = MAX_IMAGES - images.length;
      if (remaining <= 0) return;

      const toProcess = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, remaining);

      let loaded = 0;
      const newImages: string[] = [];

      toProcess.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          newImages.push(e.target?.result as string);
          loaded++;
          if (loaded === toProcess.length) {
            onImagesChange([...images, ...newImages]);
          }
        };
        reader.readAsDataURL(file);
      });
    },
    [images, onImagesChange]
  );

  const removeImage = useCallback(
    (index: number) => {
      onImagesChange(images.filter((_, i) => i !== index));
    },
    [images, onImagesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const hasImages = images.length > 0;

  return (
    <div className="w-full space-y-4">
      {/* Upload area - shown when no images yet */}
      {!hasImages && (
        <label
          className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl cursor-pointer transition-all border-[var(--color-border-default)] hover:border-indigo-400 bg-gradient-to-b from-[var(--color-accent-subtle)] to-transparent ${
            isProcessing ? "opacity-60 pointer-events-none" : ""
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl shadow-lg shadow-indigo-200 transition-transform hover:scale-105">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-700">
                拖拽商品图片到此处
              </p>
              <p className="text-sm text-slate-400 mt-1">
                支持多张图片（最多 {MAX_IMAGES} 张），适合组合装/套装
              </p>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
            disabled={isProcessing}
          />
        </label>
      )}

      {/* Image grid - shown after upload */}
      {hasImages && (
        <div
          className="premium-card p-5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-500">
              已上传 {images.length}/{MAX_IMAGES} 张商品图
            </p>
          </div>

          {/* Product Mode Selector */}
          {images.length > 1 && (
            <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50/50 border border-slate-200">
              <p className="text-xs text-slate-500 mb-2 font-medium">请选择拍摄模式：</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onProductModeChange("single")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    productMode === "single"
                      ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  📷 单品多角度
                  <span className="block text-xs mt-0.5 opacity-80">
                    同一商品的不同角度照片
                  </span>
                </button>
                <button
                  onClick={() => onProductModeChange("bundle")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    productMode === "bundle"
                      ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  📦 套装组合
                  <span className="block text-xs mt-0.5 opacity-80">
                    多件不同商品组合销售
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {images.map((img, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-xl border border-[var(--color-border-subtle)] overflow-hidden group bg-white hover:shadow-lg transition-shadow"
              >
                <img
                  src={img}
                  alt={`商品 ${idx + 1}`}
                  className="w-full h-full object-contain p-1"
                />
                {!isProcessing && (
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <span className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1.5 py-0.5 rounded-md">
                  {idx + 1}
                </span>
              </div>
            ))}

            {/* Add more button */}
            {images.length < MAX_IMAGES && !isProcessing && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-[var(--color-border-default)] flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-[var(--color-accent-subtle)] transition-all">
                <Plus className="w-6 h-6 text-slate-400" />
                <span className="text-xs text-slate-400 mt-1">添加</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          {/* Language Selector */}
          <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-blue-50/50 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-slate-500 font-medium">分析语言 / Analysis Language：</p>
            </div>
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as AnalysisLanguage)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            >
              {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>

          {/* Submit button */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={onSubmit}
              disabled={isProcessing}
              className="btn-accent flex items-center gap-2 px-6 py-3"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  AI 分析中...
                </>
              ) : (
                <>开始 AI 分析（{images.length} 张图）</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
