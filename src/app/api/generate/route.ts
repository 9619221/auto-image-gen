import { NextRequest, NextResponse } from "next/server";
import { generateProductImage } from "@/lib/image-gen";
import { validatePlan } from "@/lib/generation-guard";
import { filesToDataUrls } from "@/lib/server-image";
import { validateUploadedFiles } from "@/lib/validate-upload";
import { authenticateRequest, checkRateLimit } from "@/lib/api-auth";
import type { ImagePlan, AnalysisLanguage } from "@/lib/types";

const CONCURRENCY = 10;

export async function POST(req: NextRequest) {
  const authError = authenticateRequest(req);
  if (authError) return authError;

  // 速率限制已关闭 — 单用户系统不需要
  // const rateLimitError = checkRateLimit(req, "generate");
  // if (rateLimitError) return rateLimitError;

  let plans: ImagePlan[];
  try {
    const formData = await req.formData();
    const validation = await validateUploadedFiles(formData);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    plans = JSON.parse(String(formData.get("plans") || "[]")) as ImagePlan[];

    if (plans.length === 0) {
      return NextResponse.json({ error: "未提供生成方案" }, { status: 400 });
    }

    const productMode = String(formData.get("productMode") || "single") as "single" | "bundle" | "variants";
    const imageLanguage = String(formData.get("imageLanguage") || "en") as AnalysisLanguage;
    const originalImages = await filesToDataUrls(validation.files);

    // Capture abort signal for client disconnect
    const abortSignal = req.signal;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(data: Record<string, unknown>) {
          if (abortSignal.aborted) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch { /* stream closed */ }
        }

        async function processPlan(plan: ImagePlan) {
          // Check if client disconnected before starting
          if (abortSignal.aborted) return;

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
            if (abortSignal.aborted) return;
            send({
              imageType: plan.imageType,
              status: "error",
              error: error instanceof Error ? error.message : "生成失败",
            });
          }
        }

        // Process plans in batches of CONCURRENCY
        for (let i = 0; i < plans.length; i += CONCURRENCY) {
          if (abortSignal.aborted) break;
          const batch = plans.slice(i, i + CONCURRENCY);
          await Promise.all(batch.map(processPlan));
        }

        if (!abortSignal.aborted) {
          send({ status: "complete" });
        }
        try { controller.close(); } catch { /* already closed */ }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "请求解析失败" },
      { status: 400 }
    );
  }
}
