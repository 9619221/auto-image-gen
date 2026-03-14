"use client";

import { IMAGE_TYPE_LABELS } from "@/lib/types";
import type { GenerationJob } from "@/lib/types";
import { Download, Loader2, AlertCircle, Check } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

interface ResultGalleryProps {
  jobs: GenerationJob[];
  productName: string;
}

function base64ToBlob(base64: string): Blob {
  const parts = base64.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const raw = atob(parts[1]);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function ResultGallery({
  jobs,
  productName,
}: ResultGalleryProps) {
  const completedJobs = jobs.filter((j) => j.status === "done");

  const downloadSingle = (job: GenerationJob) => {
    if (!job.finalImageUrl) return;
    const blob = base64ToBlob(job.finalImageUrl);
    saveAs(blob, `${productName}-${job.imageType}.jpg`);
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

  if (jobs.length === 0) return null;

  const statusText: Record<string, string> = {
    pending: "等待中",
    generating: "生成中",
    compositing: "合成中",
    done: "完成",
    error: "失败",
  };

  return (
    <div className="premium-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-900">生成结果</h3>
        {completedJobs.length > 0 && (
          <button
            onClick={downloadAll}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-200 transition-all text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            全部下载 ({completedJobs.length}) ZIP
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {jobs.map((job) => (
          <div
            key={job.imageType}
            className="relative rounded-xl border border-[var(--color-border-subtle)] overflow-hidden group hover:shadow-lg transition-shadow"
          >
            {/* Status badge */}
            <div className="absolute top-2 left-2 z-10">
              <span className="px-2 py-1 rounded-lg text-[10px] font-medium bg-black/50 backdrop-blur-sm text-white">
                {IMAGE_TYPE_LABELS[job.imageType]}
              </span>
            </div>

            {/* Image or loading state */}
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

            {/* Download button */}
            {job.status === "done" && (
              <button
                onClick={() => downloadSingle(job)}
                className="absolute bottom-2 right-2 p-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title="下载"
              >
                <Download className="w-4 h-4 text-slate-700" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
