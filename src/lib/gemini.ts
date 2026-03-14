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

🚨 CRITICAL: ALL output text MUST be in ENGLISH. Do NOT use Chinese or any other language. Every field value must be written in English.${modeNote}

Return ONLY valid JSON with this structure:
{
  "productName": "Concise product name in English${imageCount > 1 && productMode === "bundle" ? " (describe the bundle)" : ""}",
  "category": "Product category in English (e.g., Kitchen Appliances, Outdoor Gear, Electronics)",
  "sellingPoints": ["Selling point 1", "Selling point 2", "Selling point 3", "Selling point 4", "Selling point 5"],
  "materials": "Material description in English (e.g., Stainless Steel, Food-Grade PP Plastic)",
  "colors": "Color description in English (e.g., Matte Black with Silver Accents)",
  "targetAudience": ["Target audience 1", "Target audience 2", "Target audience 3"],
  "usageScenes": ["Scene 1 description", "Scene 2 description", "Scene 3 description", "Scene 4 description", "Scene 5 description"],
  "estimatedDimensions": "Estimated dimensions (e.g., 30 x 20 x 15 cm / 11.8 x 7.9 x 5.9 in)"
}

Selling Points: Extract 3-5 core features, advantages, and unique selling points.
Target Audience: Identify 3 different buyer personas.
Usage Scenes: Describe 5 diverse, specific, vivid real-world usage scenarios (e.g., "A busy professional organizing keys, wallet and sunglasses on the entryway table after coming home" instead of just "organizing items").`;
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
