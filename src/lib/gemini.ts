import OpenAI from "openai";
import type { AnalysisResult, AnalysisLanguage } from "./types";
import { LANGUAGE_ENGLISH_NAMES } from "./types";

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

function buildAnalysisPrompt(imageCount: number, productMode: string, language: AnalysisLanguage = "zh"): string {
  let modeNote = "";

  if (imageCount > 1 && productMode === "single") {
    modeNote = `\n⚠️ IMPORTANT: The user uploaded ${imageCount} images, but these are ALL photos of the SAME SINGLE product from different angles. Analyze them as ONE product. productName should describe only this one product.`;
  } else if (imageCount > 1 && productMode === "bundle") {
    modeNote = `\nIMPORTANT: You see ${imageCount} images of different products. These are sold together as a BUNDLE SET. Analyze the entire set as one listing — productName should describe the bundle, sellingPoints should cover the combination value, usageScenes should show how these items work together.`;
  }

  const langName = LANGUAGE_ENGLISH_NAMES[language] || "Chinese";

  // For all languages: output in chosen language + English in parentheses for image generation
  const bilingualNote = language === "en"
    ? `🚨 CRITICAL FORMAT: All text fields must be in English only.`
    : `🚨 CRITICAL FORMAT: Every text field must be BILINGUAL — ${langName} first, then English in parentheses. Example format depends on language:
- Chinese: "不锈钢保温杯 (Stainless Steel Insulated Tumbler)"
- Japanese: "ステンレス断熱タンブラー (Stainless Steel Insulated Tumbler)"
- Korean: "스테인리스 보온 텀블러 (Stainless Steel Insulated Tumbler)"
- Spanish: "Vaso térmico de acero inoxidable (Stainless Steel Insulated Tumbler)"
This format helps the user review in ${langName} while the English part in parentheses is used for image generation.`;

  const nameExample = language === "en"
    ? `"English Product Name${imageCount > 1 && productMode === "bundle" ? " — describe the bundle" : ""}"`
    : `"${langName}名称 (English Product Name)${imageCount > 1 && productMode === "bundle" ? " — describe the bundle" : ""}"`;

  const fieldExample = language === "en"
    ? {
        category: '"Product Category"',
        sp: '["Selling Point 1", "Selling Point 2", "Selling Point 3"]',
        materials: '"Material description"',
        colors: '"Color description"',
        audience: '["Audience 1", "Audience 2", "Audience 3"]',
        scenes: '["Scene 1", "Scene 2", "Scene 3"]',
      }
    : {
        category: `"${langName}类目 (English Category)"`,
        sp: `["${langName}卖点1 (English SP1)", "${langName}卖点2 (English SP2)", "${langName}卖点3 (English SP3)"]`,
        materials: `"${langName}材质 (English Material)"`,
        colors: `"${langName}颜色 (English Color)"`,
        audience: `["${langName}人群1 (English Audience 1)", "${langName}人群2 (English Audience 2)"]`,
        scenes: `["${langName}场景1 (English Scene 1)", "${langName}场景2 (English Scene 2)"]`,
      };

  return `You are a professional e-commerce product analyst. Analyze the product images and extract the following information. Return ONLY valid JSON.

${bilingualNote}${modeNote}

Return ONLY valid JSON with this structure:
{
  "productName": ${nameExample},
  "category": ${fieldExample.category},
  "sellingPoints": ${fieldExample.sp},
  "materials": ${fieldExample.materials},
  "colors": ${fieldExample.colors},
  "targetAudience": ${fieldExample.audience},
  "usageScenes": ${fieldExample.scenes},
  "estimatedDimensions": "e.g., 30 x 20 x 15 cm / 11.8 x 7.9 x 5.9 in"
}

Selling Points: Extract 3-5 core features, advantages, and unique selling points.
Target Audience: Identify 3 different buyer personas.
Usage Scenes: Describe 5 diverse, specific, vivid real-world usage scenarios.`;
}

export async function analyzeProduct(
  images: string[],
  productMode: string = "single",
  language: AnalysisLanguage = "zh"
): Promise<AnalysisResult> {
  const content: Array<{ type: "image_url"; image_url: { url: string } } | { type: "text"; text: string }> = [];

  for (const img of images) {
    content.push({ type: "image_url", image_url: { url: img } });
  }
  content.push({ type: "text", text: buildAnalysisPrompt(images.length, productMode, language) });

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
