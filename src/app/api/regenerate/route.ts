import { NextRequest, NextResponse } from "next/server";
import { generateProductImage } from "@/lib/image-gen";
import { validatePlan } from "@/lib/generation-guard";
import { filesToDataUrls } from "@/lib/server-image";
import { validateUploadedFiles } from "@/lib/validate-upload";
import { authenticateRequest, checkRateLimit } from "@/lib/api-auth";
import type { ImagePlan, AnalysisLanguage } from "@/lib/types";

export async function POST(req: NextRequest) {
  const authError = authenticateRequest(req);
  if (authError) return authError;
  const rateLimitError = checkRateLimit(req, "regenerate");
  if (rateLimitError) return rateLimitError;

  const formData = await req.formData();
  const validation = await validateUploadedFiles(formData);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const plan = JSON.parse(String(formData.get("plan") || "null")) as ImagePlan | null;
  if (!plan) {
    return NextResponse.json({ error: "缺少生成方案" }, { status: 400 });
  }

  const productMode = String(formData.get("productMode") || "single") as "single" | "bundle";
  const imageLanguage = String(formData.get("imageLanguage") || "en") as AnalysisLanguage;
  const originalImages = await filesToDataUrls(validation.files);

  try {
    const planValidation = validatePlan(plan);
    const imageDataUrl = await generateProductImage(
      originalImages,
      plan.prompt,
      productMode,
      imageLanguage,
      plan.imageType
    );

    return NextResponse.json({
      imageType: plan.imageType,
      imageUrl: imageDataUrl,
      warnings: planValidation.warnings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "重新生成失败" },
      { status: 500 }
    );
  }
}
