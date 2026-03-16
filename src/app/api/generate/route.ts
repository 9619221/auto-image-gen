import { NextRequest } from "next/server";
import { generateProductImage } from "@/lib/fal";
import type { ImagePlan, AnalysisLanguage } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { plans, originalImages, productMode = "single", imageLanguage = "en" } = (await req.json()) as {
    plans: ImagePlan[];
    originalImages: string[];
    productMode?: "single" | "bundle";
    imageLanguage?: AnalysisLanguage;
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      for (const plan of plans) {
        try {
          send({ imageType: plan.imageType, status: "generating" });

          const imageDataUrl = await generateProductImage(
            originalImages,
            plan.prompt,
            productMode,
            imageLanguage
          );

          send({
            imageType: plan.imageType,
            status: "done",
            imageUrl: imageDataUrl,
          });
        } catch (error) {
          send({
            imageType: plan.imageType,
            status: "error",
            error: error instanceof Error ? error.message : "生成失败",
          });
        }
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
