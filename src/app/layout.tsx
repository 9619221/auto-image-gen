import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "亚马逊商品图片生成器（开发版）",
  description:
    "开发版：用于模板调优、标签测试、方案编辑和回归验证。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="text-slate-900 antialiased">{children}</body>
    </html>
  );
}
