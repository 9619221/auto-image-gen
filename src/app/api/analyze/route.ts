import { NextRequest, NextResponse } from "next/server";
import { analyzeProduct } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { images, productMode, language } = await req.json();
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }
    const analysis = await analyzeProduct(images, productMode || "single", language || "zh");
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
