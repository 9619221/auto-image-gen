"use client";

import type { GenerationJob } from "@/lib/types";
import { IMAGE_TYPE_LABELS } from "@/lib/types";
import { Smartphone, X } from "lucide-react";
import { useState } from "react";

interface MobilePreviewProps {
  jobs: GenerationJob[];
}

export default function MobilePreview({ jobs }: MobilePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const completedJobs = jobs.filter((j) => j.status === "done" && j.finalImageUrl);
  if (completedJobs.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-xl hover:shadow-lg transition-all text-sm font-medium"
      >
        <Smartphone className="w-4 h-4" />
        移动端预览
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                移动端预览 — 买家视角
              </h2>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 flex gap-6">
              {/* 手机模拟框 */}
              <div className="flex-shrink-0">
                <div className="w-[280px] bg-white border-[3px] border-slate-800 rounded-[2rem] overflow-hidden shadow-xl">
                  {/* 状态栏 */}
                  <div className="bg-slate-800 text-white text-[10px] flex items-center justify-between px-4 py-1">
                    <span>9:41</span>
                    <span>●●●●●</span>
                  </div>

                  {/* 搜索栏 */}
                  <div className="bg-white px-3 py-2 border-b border-slate-100">
                    <div className="bg-slate-100 rounded-lg px-3 py-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                      🔍 Amazon.com
                    </div>
                  </div>

                  {/* 主图 */}
                  <div className="bg-white px-2 pt-2">
                    <div className="aspect-square bg-slate-50 rounded-lg overflow-hidden">
                      <img
                        src={completedJobs[selectedIdx]?.finalImageUrl}
                        alt="preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  {/* 缩略图行 */}
                  <div className="px-2 py-2 flex gap-1 overflow-x-auto">
                    {completedJobs.map((job, idx) => (
                      <button
                        key={job.imageType}
                        onClick={() => setSelectedIdx(idx)}
                        className={`w-10 h-10 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                          selectedIdx === idx
                            ? "border-orange-500 shadow-sm"
                            : "border-slate-200 opacity-60"
                        }`}
                      >
                        <img
                          src={job.finalImageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>

                  {/* 价格区 */}
                  <div className="px-3 pb-3">
                    <div className="text-[10px] text-slate-400">商品名称示例标题...</div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-[11px] text-slate-400">$</span>
                      <span className="text-lg font-bold text-slate-900">29</span>
                      <span className="text-[11px] text-slate-400">.99</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex">
                        {[1,2,3,4].map(i => (
                          <span key={i} className="text-amber-400 text-[10px]">★</span>
                        ))}
                        <span className="text-slate-300 text-[10px]">★</span>
                      </div>
                      <span className="text-[10px] text-blue-600">1,234</span>
                    </div>
                  </div>

                  {/* 底部导航 */}
                  <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex justify-center">
                    <div className="w-24 h-1 bg-slate-300 rounded-full" />
                  </div>
                </div>

                <p className="text-center text-[11px] text-slate-400 mt-3">
                  iPhone 模拟 · 375×812
                </p>
              </div>

              {/* 图片列表 + 说明 */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-slate-700 mb-3">点击切换查看每张图：</h4>
                <div className="grid grid-cols-3 gap-2">
                  {completedJobs.map((job, idx) => (
                    <button
                      key={job.imageType}
                      onClick={() => setSelectedIdx(idx)}
                      className={`rounded-xl overflow-hidden border-2 transition-all ${
                        selectedIdx === idx
                          ? "border-indigo-500 shadow-lg shadow-indigo-100"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="aspect-square bg-slate-50">
                        <img
                          src={job.finalImageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-1.5 bg-white">
                        <span className={`text-[10px] font-medium ${
                          selectedIdx === idx ? "text-indigo-600" : "text-slate-500"
                        }`}>
                          #{idx + 1} {IMAGE_TYPE_LABELS[job.imageType]}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-xs font-medium text-amber-700">移动端注意事项：</span>
                  <ul className="text-[11px] text-amber-600 mt-1 space-y-0.5">
                    <li>· 主图在搜索结果中显示为小缩略图，产品需占满画面</li>
                    <li>· 文字在手机上可能看不清，确保字号足够大</li>
                    <li>· 买家通常只看前3-4张图，关键信息放前面</li>
                    <li>· 第1张图决定点击率，第2-3张决定转化率</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
