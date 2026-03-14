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
    modeNote = `\n⚠️ 重要：用户上传了 ${imageCount} 张图片，但这些都是【同一个商品】的不同角度照片。请将它们视为同一件单品来分析，不要误判为多件商品或套装。productName 应该只描述这一个商品。`;
  } else if (imageCount > 1 && productMode === "bundle") {
    modeNote = `\n重要：你看到的是 ${imageCount} 张不同商品的图片。这些商品作为组合装/套装一起销售。请将整个套装作为一个 listing 来分析——productName 应描述整个套装，sellingPoints 应涵盖组合价值，usageScenes 应展示这些商品如何搭配使用。`;
  }

  return `你是一位专业的电商产品分析师。分析商品图片，提取以下信息并以 JSON 格式返回。所有输出必须使用中文。${modeNote}

仅返回有效的 JSON，结构如下：
{
  "productName": "简洁的商品名称${imageCount > 1 && productMode === "bundle" ? "（描述套装组合）" : ""}",
  "category": "商品类目（如：厨房电器、户外装备、电子产品）",
  "sellingPoints": ["卖点1", "卖点2", "卖点3", "卖点4", "卖点5"],
  "materials": "材质描述（如：不锈钢、食品级PP塑料）",
  "colors": "颜色描述（如：哑光黑配银色点缀）",
  "targetAudience": ["目标人群1", "目标人群2", "目标人群3"],
  "usageScenes": ["场景1描述", "场景2描述", "场景3描述", "场景4描述", "场景5描述"],
  "estimatedDimensions": "预估尺寸（如：30 x 20 x 15 厘米）"
}

卖点：提取3-5个核心功能、优势和独特卖点。
目标人群：识别3个不同的买家画像。
使用场景：描述5个多样化的、具体的真实使用场景，要生动具体（如"一位上班族妈妈在阳台上晾晒宝宝的小衣服和袜子"，而不是"晾衣服"）。`;
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
