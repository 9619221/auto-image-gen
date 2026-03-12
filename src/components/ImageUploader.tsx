"use client";

import { useCallback, useRef } from "react";
import { Upload, Loader2, X, Plus } from "lucide-react";

const MAX_IMAGES = 5;

interface ImageUploaderProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  isProcessing: boolean;
  onSubmit: () => void;
}

export default function ImageUploader({
  images,
  onImagesChange,
  isProcessing,
  onSubmit,
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
          className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all border-gray-300 hover:border-gray-400 bg-gray-50 ${
            isProcessing ? "opacity-60 pointer-events-none" : ""
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <div className="p-3 bg-blue-100 rounded-full">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700">
                拖拽商品图片到此处
              </p>
              <p className="text-sm text-gray-400 mt-1">
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
          className="border-2 border-dashed border-gray-200 rounded-xl p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">
              已上传 {images.length}/{MAX_IMAGES} 张商品图
            </p>
            {images.length > 1 && (
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
                组合装模式
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {images.map((img, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-lg border border-gray-200 overflow-hidden group bg-white"
              >
                <img
                  src={img}
                  alt={`商品 ${idx + 1}`}
                  className="w-full h-full object-contain p-1"
                />
                {!isProcessing && (
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <span className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1.5 py-0.5 rounded">
                  {idx + 1}
                </span>
              </div>
            ))}

            {/* Add more button */}
            {images.length < MAX_IMAGES && !isProcessing && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Plus className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-400 mt-1">添加</span>
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

          {/* Submit button */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={onSubmit}
              disabled={isProcessing}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
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
