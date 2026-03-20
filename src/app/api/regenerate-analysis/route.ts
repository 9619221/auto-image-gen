import { NextRequest, NextResponse } from "next/server";
import { regenerateAnalysisFields } from "@/lib/analyze";
import { filesToDataUrls } from "@/lib/server-image";
import { validateUploadedFiles } from "@/lib/validate-upload";
import { authenticateRequest, checkRateLimit } from "@/lib/api-auth";
import type { AnalysisResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  const authError = authenticateRequest(req);
  if (authError) return authError;
  const rateLimitError = checkRateLimit(req, "analyze");
  if (rateLimitError) return rateLimitError;

  try {
    const formData = await req.formData();
    const validation = await validateUploadedFiles(formData);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const analysisRaw = formData.get("analysis");
    if (!analysisRaw) {
      return NextResponse.json({ error: "缺少分析数据" }, { status: 400 });
    }

    const analysis = JSON.parse(String(analysisRaw)) as AnalysisResult;
    const productMode = String(formData.get("productMode") || "single");
    const images = await filesToDataUrls(validation.files);
    const result = await regenerateAnalysisFields(images, analysis, productMode);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Regenerate analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "重新生成失败" },
      { status: 500 }
    );
  }
}
