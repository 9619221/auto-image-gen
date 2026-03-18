import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import OpenAI from "openai";
import type { ImageScore } from "@/lib/types";

function getClient() {
  const apiKey = process.env.ANALYZE_API_KEY;
  if (!apiKey) {
    throw new Error("未配置分析 API Key");
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.ANALYZE_BASE_URL,
  });
}

const IMAGE_TYPE_CRITERIA: Record<string, string> = {
  main: "This is a MAIN/HERO image for Amazon. Key criteria: pure white background (#FFFFFF), product fills 85%+ of frame, no text/watermarks/logos, professional studio lighting, sharp focus, no props.",
  features: "This is a FEATURES/BENEFITS infographic. Key criteria: clear pain-point headlines, readable text labels, good visual hierarchy, benefit-focused messaging, professional layout.",
  closeup: "This is a CLOSE-UP/DETAIL shot. Key criteria: sharp macro detail, clear material/texture visibility, good lighting on details, demonstrates build quality.",
  dimensions: "This is a DIMENSIONS/SIZE guide. Key criteria: clear size indicators, readable measurements, reference objects for scale, accurate-looking proportions.",
  lifestyle: "This is a LIFESTYLE/SCENE image. Key criteria: realistic usage context, relatable setting, product is clearly visible in scene, aspirational but believable.",
  packaging: "This is a PACKAGING/VALUE image. Key criteria: shows what's included, clear value proposition, professional arrangement, highlights bundle/package contents.",
  comparison: "This is a COMPARISON image (Ours vs Ordinary). Key criteria: clear side-by-side, obvious visual advantage, fair but favorable comparison, readable labels.",
  lifestyle2: "This is an A+ LIFESTYLE closing image. Key criteria: multiple benefit showcase, aspirational lifestyle, cohesive visual story, strong closing impression.",
};

export async function POST(req: NextRequest) {
  const authError = authenticateRequest(req);
  if (authError) return authError;

  try {
    const { imageUrl, imageType } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "缺少图片数据" }, { status: 400 });
    }

    const typeCriteria = IMAGE_TYPE_CRITERIA[imageType] || "This is an Amazon product listing image.";

    const prompt = `You are an expert Amazon product image reviewer and e-commerce visual merchandiser.

Evaluate this generated product listing image. ${typeCriteria}

Score each dimension from 1-10 (10 = perfect):

1. **clarity** (产品清晰度): Is the product sharp, well-lit, and clearly identifiable? Is the main subject prominent?
2. **composition** (构图质量): Is the layout professional, balanced, and visually appealing? Good use of space?
3. **textQuality** (文字可读性): If there are text labels/badges, are they readable, well-positioned, and professional? If no text, score based on whether text-free areas are clean. Score 7 if no text is expected for this image type.
4. **compliance** (亚马逊合规): Does it meet Amazon image standards for this image type? (white bg for main, informative for infographics, etc.)
5. **appeal** (购买吸引力): Would this image make a shopper want to buy? Does it convey value and quality?

Also provide 1-3 short, actionable improvement suggestions in Chinese (中文).

Return ONLY valid JSON:
{
  "clarity": <number>,
  "composition": <number>,
  "textQuality": <number>,
  "compliance": <number>,
  "appeal": <number>,
  "suggestions": ["建议1", "建议2"]
}`;

    const response = await getClient().chat.completions.create({
      model: process.env.ANALYZE_MODEL || "gemini-3.1-flash-image-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: prompt },
          ],
        },
      ],
      max_tokens: 800,
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ error: "评分解析失败" }, { status: 500 });
    }

    const raw = JSON.parse(jsonMatch[0]);
    const score: ImageScore = {
      clarity: Math.min(10, Math.max(1, Number(raw.clarity) || 5)),
      composition: Math.min(10, Math.max(1, Number(raw.composition) || 5)),
      textQuality: Math.min(10, Math.max(1, Number(raw.textQuality) || 5)),
      compliance: Math.min(10, Math.max(1, Number(raw.compliance) || 5)),
      appeal: Math.min(10, Math.max(1, Number(raw.appeal) || 5)),
      overall: 0,
      suggestions: Array.isArray(raw.suggestions) ? raw.suggestions.slice(0, 3) : [],
    };

    score.overall = Math.round(
      ((score.clarity + score.composition + score.textQuality + score.compliance + score.appeal) / 5) * 10
    ) / 10;

    return NextResponse.json(score);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "评分失败" },
      { status: 500 }
    );
  }
}
