import OpenAI from "openai";
import type { AnalysisResult } from "./types";

function getClient() {
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 API Key，请设置环境变量 LLM_API_KEY");
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL,
  });
}

function buildAnalysisPrompt(imageCount: number): string {
  const multiNote =
    imageCount > 1
      ? `\nIMPORTANT: You are looking at ${imageCount} different product images. These products are sold together as a BUNDLE/COMBO SET. Analyze the ENTIRE set as one listing — the productName should describe the bundle, sellingPoints should cover the combined value, and usageScenes should show how the products work together.`
      : "";

  return `You are an expert e-commerce product analyst. Analyze the product image(s) and extract the following information in JSON format. All output must be in English.${multiNote}

Return ONLY valid JSON with this exact structure:
{
  "productName": "concise product name${imageCount > 1 ? " (describe the bundle set)" : ""}",
  "category": "product category (e.g., Kitchen Appliances, Outdoor Gear, Electronics)",
  "sellingPoints": ["selling point 1", "selling point 2", "selling point 3", "selling point 4", "selling point 5"],
  "materials": "material description (e.g., stainless steel, BPA-free plastic)",
  "colors": "color description (e.g., matte black with silver accents)",
  "targetAudience": ["audience 1", "audience 2", "audience 3"],
  "usageScenes": ["scene 1 description", "scene 2 description", "scene 3 description", "scene 4 description", "scene 5 description"],
  "estimatedDimensions": "estimated dimensions (e.g., 12 x 8 x 6 inches)"
}

For sellingPoints: identify 3-5 core features, benefits, and unique selling propositions.
For targetAudience: identify 3 distinct buyer personas.
For usageScenes: describe 5 diverse, specific real-world usage scenarios that would appeal to different buyer personas. Be vivid and specific (e.g., "A home cook preparing a weeknight dinner in a modern kitchen" not just "kitchen use").`;
}

export async function analyzeProduct(
  images: string[]
): Promise<AnalysisResult> {
  const content: Array<{ type: "image_url"; image_url: { url: string } } | { type: "text"; text: string }> = [];

  for (const img of images) {
    content.push({ type: "image_url", image_url: { url: img } });
  }
  content.push({ type: "text", text: buildAnalysisPrompt(images.length) });

  const response = await getClient().chat.completions.create({
    model: "gemini-3.1-flash-image-preview",
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
