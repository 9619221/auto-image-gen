import OpenAI from "openai";
import type { AnalysisResult } from "./types";
import { extractJSON, validateShape } from "./sanitize";

// 单例客户端
let _analyzeClient: OpenAI | null = null;
function getClient() {
  if (_analyzeClient) return _analyzeClient;
  const apiKey = process.env.ANALYZE_API_KEY;
  if (!apiKey) {
    throw new Error("未配置分析 API Key，请设置环境变量 ANALYZE_API_KEY");
  }
  _analyzeClient = new OpenAI({
    apiKey,
    baseURL: process.env.ANALYZE_BASE_URL,
    timeout: 60_000, // 1分钟超时
  });
  return _analyzeClient;
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
  "colors": "精确颜色描述，包含近似hex色值 (Precise color with approximate hex. e.g., '裸粉色 (Dusty Rose Pink ~#D4A0A0), 玫瑰金瓶盖 (Rose Gold Cap ~#B76E79)')",
  "targetAudience": ["中文人群1 (English Audience 1)", "中文人群2 (English Audience 2)", "中文人群3 (English Audience 3)"],
  "usageScenes": ["中文场景1 (English Scene 1)", "中文场景2 (English Scene 2)", "中文场景3 (English Scene 3)"],
  "estimatedDimensions": "尺寸 (e.g., 30 x 20 x 15 cm / 11.8 x 7.9 x 5.9 in)",
}

Colors: Describe the PRECISE product colors with approximate hex values. Include all distinct color zones (body color, cap/lid color, accent colors). This is CRITICAL — these colors will be used to ensure color consistency across 8 generated listing images.
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
  const defaults: AnalysisResult = {
    productName: "未知商品",
    category: "",
    sellingPoints: [],
    materials: "",
    colors: "",
    targetAudience: [],
    usageScenes: [],
    estimatedDimensions: "",
  };

  const parsed = extractJSON<AnalysisResult>(text, defaults);
  if (!parsed) {
    throw new Error("Failed to parse analysis result");
  }

  return validateShape<AnalysisResult>(
    parsed,
    ["productName", "category", "sellingPoints", "materials", "colors", "targetAudience", "usageScenes", "estimatedDimensions"],
    defaults
  );
}

/**
 * Regenerate derived fields (sellingPoints, targetAudience, usageScenes)
 * based on user-edited base fields + original product images.
 */
export async function regenerateAnalysisFields(
  images: string[],
  currentAnalysis: AnalysisResult,
  productMode: string = "single"
): Promise<Pick<AnalysisResult, "sellingPoints" | "targetAudience" | "usageScenes">> {
  const content: Array<{ type: "image_url"; image_url: { url: string } } | { type: "text"; text: string }> = [];

  for (const img of images) {
    content.push({ type: "image_url", image_url: { url: img } });
  }

  const prompt = `You are a professional e-commerce product analyst. The user has reviewed and corrected the base product information below. Based on these CONFIRMED facts and the product images, generate NEW selling points, target audience, and usage scenes.

🚨 CRITICAL: Use the user-confirmed product info below as ground truth. Do NOT contradict it.

Confirmed product info:
- Product Name: ${currentAnalysis.productName}
- Category: ${currentAnalysis.category}
- Materials: ${currentAnalysis.materials}
- Colors: ${currentAnalysis.colors}
- Dimensions: ${currentAnalysis.estimatedDimensions}

🚨 CRITICAL FORMAT: Every text field must be BILINGUAL — Chinese first, then English in parentheses.

Return ONLY valid JSON:
{
  "sellingPoints": ["中文卖点1 (English SP1)", "中文卖点2 (English SP2)", ...],
  "targetAudience": ["中文人群1 (English Audience 1)", "中文人群2 (English Audience 2)", "中文人群3 (English Audience 3)"],
  "usageScenes": ["中文场景1 (English Scene 1)", "中文场景2 (English Scene 2)", ...]
}

Selling Points: Generate 3-5 core features and unique selling points that match the confirmed product name, category, and materials.
Target Audience: Identify 3 different buyer personas who would buy this specific product.
Usage Scenes: Describe 5 diverse, specific, vivid real-world usage scenarios.`;

  content.push({ type: "text", text: prompt });

  const response = await getClient().chat.completions.create({
    model: process.env.ANALYZE_MODEL || "gemini-3.1-flash-image-preview",
    messages: [{ role: "user", content }],
    max_tokens: 1500,
  });

  const text = response.choices[0]?.message?.content ?? "";
  const defaults = {
    sellingPoints: currentAnalysis.sellingPoints,
    targetAudience: currentAnalysis.targetAudience,
    usageScenes: currentAnalysis.usageScenes,
  };

  const parsed = extractJSON<typeof defaults>(text, defaults);
  if (!parsed) {
    throw new Error("Failed to parse regenerated fields");
  }

  return {
    sellingPoints: Array.isArray(parsed.sellingPoints) ? parsed.sellingPoints : defaults.sellingPoints,
    targetAudience: Array.isArray(parsed.targetAudience) ? parsed.targetAudience : defaults.targetAudience,
    usageScenes: Array.isArray(parsed.usageScenes) ? parsed.usageScenes : defaults.usageScenes,
  };
}
