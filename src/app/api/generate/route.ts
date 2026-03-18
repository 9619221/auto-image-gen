import { NextRequest, NextResponse } from "next/server";
import { generateProductImage } from "@/lib/image-gen";
import { validatePlan } from "@/lib/generation-guard";
import { filesToDataUrls } from "@/lib/server-image";
import { validateUploadedFiles } from "@/lib/validate-upload";
import { authenticateRequest } from "@/lib/api-auth";
import type { ImagePlan, AnalysisLanguage } from "@/lib/types";

const CONCURRENCY = 8;

export async function POST(req: NextRequest) {
  const authError = authenticateRequest(req);
  if (authError) return authError;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "请求数据解析失败" }, { status: 400 });
  }

  const validation = validateUploadedFiles(formData);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  let plans: ImagePlan[];
  try {
    plans = JSON.parse(String(formData.get("plans") || "[]")) as ImagePlan[];
  } catch {
    return NextResponse.json({ error: "生成方案数据格式错误" }, { status: 400 });
  }

  if (plans.length === 0) {
    return NextResponse.json({ error: "未提供生成方案" }, { status: 400 });
  }

  const productMode = String(formData.get("productMode") || "single") as "single" | "bundle";
  const imageLanguage = String(formData.get("imageLanguage") || "en") as AnalysisLanguage;
  const originalImages = await filesToDataUrls(validation.files);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      async function processPlan(plan: ImagePlan) {
        try {
          const planValidation = validatePlan(plan);
          if (planValidation.warnings.length > 0) {
            send({ imageType: plan.imageType, status: "warning", warnings: planValidation.warnings });
          }

          send({ imageType: plan.imageType, status: "generating" });

          const imageDataUrl = await generateProductImage(
            originalImages,
            plan.prompt,
            productMode,
            imageLanguage,
            plan.imageType
          );

          send({
            imageType: plan.imageType,
            status: "done",
            imageUrl: imageDataUrl,
            warnings: planValidation.warnings,
          });
        } catch (error) {
          send({
            imageType: plan.imageType,
            status: "error",
            error: error instanceof Error ? error.message : "生成失败",
          });
        }
      }

      // Process plans in batches of CONCURRENCY
      for (let i = 0; i < plans.length; i += CONCURRENCY) {
        const batch = plans.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(processPlan));
      }

      send({ status: "complete" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
