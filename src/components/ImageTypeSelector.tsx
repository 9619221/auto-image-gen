"use client";

import { IMAGE_TYPE_LABELS, IMAGE_TYPE_ORDER } from "@/lib/types";
import type { ImageType } from "@/lib/types";

interface ImageTypeSelectorProps {
  selected: ImageType[];
  onChange: (selected: ImageType[]) => void;
}

export default function ImageTypeSelector({
  selected,
  onChange,
}: ImageTypeSelectorProps) {
  const toggle = (type: ImageType) => {
    if (selected.includes(type)) {
      onChange(selected.filter((t) => t !== type));
    } else {
      onChange([...selected, type]);
    }
  };

  const selectAll = () => onChange([...IMAGE_TYPE_ORDER]);
  const deselectAll = () => onChange([]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          选择要生成的图片类型
        </h3>
        <div className="flex gap-2 text-sm">
          <button
            onClick={selectAll}
            className="text-blue-600 hover:underline"
          >
            全选
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={deselectAll}
            className="text-gray-500 hover:underline"
          >
            取消全选
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {IMAGE_TYPE_ORDER.map((type, idx) => (
          <button
            key={type}
            onClick={() => toggle(type)}
            className={`relative p-4 rounded-lg border-2 text-left transition-all ${
              selected.includes(type)
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="text-xs text-gray-400 mb-1">#{idx + 1}</div>
            <div className="text-sm font-medium text-gray-800">
              {IMAGE_TYPE_LABELS[type]}
            </div>
            {selected.includes(type) && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
