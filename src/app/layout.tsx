import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "亚马逊商品图片生成器",
  description:
    "AI 自动生成亚马逊产品 listing 全套图片。上传商品照片，一键生成 7 张专业 listing 图。",
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
