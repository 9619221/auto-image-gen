import OpenAI from "openai";
import type { AnalysisResult } from "./types";

function getClient() {
  const apiKey = process.env.ANALYZE_API_KEY;
  if (!apiKey) {
    throw new Error("未配置分析 API Key，请设置环境变量 ANALYZE_API_KEY");
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.ANALYZE_BASE_URL,
  });
}

function buildAnalysisPrompt(imageCount: number, productMode: string): string {
  let modeNote = "";

  if (imageCount > 1 && productMode === "single") {
    modeNote = `\n⚠️ IMPORTANT: The user uploaded ${imageCount} images, but these are ALL photos of the SAME SINGLE product from different angles. Analyze them as ONE product. productName should describe only this one product.`;
  } else if (imageCount > 1 && productMode === "bundle") {
    modeNote = `\nIMPORTANT: You see ${imageCount} images of different products. These are sold together as a BUNDLE SET. Analyze the entire set as one listing — productName should describe the bundle, sellingPoints should cover the combination value, usageScenes should show how these items work together.`;
  }

  return `You are a professional e-commerce product analyst. Analyze the product images and extract the following information. Return ONLY valid JSON.

🚨 CRITICAL FORMAT: Every text field must be BILINGUAL — Chinese first, then English in parentheses. Example: "不锈钢保温杯 (Stainless Steel Insulated Tumbler)"
This format helps the user review in Chinese while the English part is used for image generation.${modeNote}

Return ONLY valid JSON with this structure:
{
  "productName": "中文商品名称 (English Product Name)${imageCount > 1 && productMode === "bundle" ? " — describe the bundle" : ""}",
  "category": "中文类目 (English Category)",
  "sellingPoints": ["中文卖点1 (English SP1)", "中文卖点2 (English SP2)", "中文卖点3 (English SP3)"],
  "materials": "中文材质 (English Material)",
  "colors": "中文颜色 (English Color)",
  "targetAudience": ["中文人群1 (English Audience 1)", "中文人群2 (English Audience 2)", "中文人群3 (English Audience 3)"],
  "usageScenes": ["中文场景1 (English Scene 1)", "中文场景2 (English Scene 2)", "中文场景3 (English Scene 3)"],
  "estimatedDimensions": "尺寸 (e.g., 30 x 20 x 15 cm / 11.8 x 7.9 x 5.9 in)"
}

Selling Points: Extract 3-5 core features, advantages, and unique selling points.
Target Audience: Identify 3 different buyer personas.
Usage Scenes: Describe 5 diverse, specific, vivid real-world usage scenarios (e.g., "忙碌的上班族下班回家后在玄关桌上整理钥匙和钱包 (A busy professional organizing keys and wallet on the entryway table after coming home)").`;
}

export async function analyzeProduct(
  images: string[],
  productMode: string = "single"
): Promise<AnalysisResult> {
  const content: Array<{ type: "image_url"; image_url: { url: string } } | { type: "text"; text: string }> = [];

  for (const img of images) {
    content.push({ type: "image_url", image_url: { url: img } });
  }
  content.push({ type: "text", text: buildAnalysisPrompt(images.length, productMode) });

  const response = await getClient().chat.completions.create({
    model: process.env.ANALYZE_MODEL || "gemini-3.1-flash-image-preview",
    messages: [{ role: "user", content }],
    max_tokens: 1500,
  });

  const text = response.choices[0]?.message?.content ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse analysis result");
  }

  return JSON.parse(jsonMatch[0]) as AnalysisResult;
}
