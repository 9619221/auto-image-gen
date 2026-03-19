import { NextRequest, NextResponse } from "next/server";
import { analyzeProduct } from "@/lib/analyze";
import { filesToDataUrls } from "@/lib/server-image";
import { validateUploadedFiles } from "@/lib/validate-upload";
import { authenticateRequest, checkRateLimit } from "@/lib/api-auth";

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

    const productMode = String(formData.get("productMode") || "single");
    const images = await filesToDataUrls(validation.files);
    const analysis = await analyzeProduct(images, productMode);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
