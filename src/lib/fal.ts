import OpenAI from "openai";

function getClient() {
  const apiKey = process.env.GENERATE_API_KEY;
  if (!apiKey) {
    throw new Error("未配置生图 API Key，请设置环境变量 GENERATE_API_KEY");
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.GENERATE_BASE_URL,
  });
}

const MODEL = process.env.GENERATE_MODEL || "gemini-3.1-flash-image-preview";

function extractImageBase64(content: string): string | null {
  const match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
  return match ? match[0] : null;
}

/**
 * Generate a complete product image with all products naturally integrated into a scene.
 * Sends all product reference images + prompt to Gemini.
 */
export async function generateProductImage(
  productImages: string[],
  prompt: string,
  productMode: "single" | "bundle" = "single"
): Promise<string> {
  const content: Array<{ type: "image_url"; image_url: { url: string } } | { type: "text"; text: string }> = [];

  for (const img of productImages) {
    content.push({ type: "image_url", image_url: { url: img } });
  }

  let multiNote = "";
  if (productImages.length > 1) {
    if (productMode === "bundle") {
      multiNote = `\n\nIMPORTANT: You are given ${productImages.length} different product reference images. These products are sold together as a BUNDLE SET. ALL ${productImages.length} products MUST appear together in the generated image. Do NOT omit any product.\n\n`;
    } else {
      multiNote = `\n\nIMPORTANT: You are given ${productImages.length} reference images of the SAME SINGLE product taken from different angles. These are NOT different products - they are multiple views of ONE product. Generate the image showing only ONE product. Do NOT duplicate the product or show multiple copies.\n\n`;
    }
  }

  const englishRuleBefore = "\n\nCRITICAL LANGUAGE RULE: ALL text, labels, annotations, headers, and any written content on the generated image MUST be in ENGLISH ONLY. No Chinese characters (中文) should appear anywhere in the generated image. If any part of the prompt below contains Chinese text, you MUST translate it to English before rendering it on the image.\n\n";

  const noChildrenRule = "\n\n🚫 STRICT RULE — NO MINORS: Do NOT include any babies, infants, toddlers, children, or underage persons in the generated image. If the scene requires showing people, use ONLY adults (18+ years old). This rule applies to ALL image types with no exceptions.\n\n";

  const noBrandRule = "\n\n🚫 STRICT RULE — NO BRAND LOGOS: Do NOT include any real brand names, logos, or trademarks in the generated image (e.g., Coca-Cola, Nike, Apple, Samsung, etc.). If the scene needs to show items like bottles, cups, phones, etc., use GENERIC unbranded versions only. This avoids trademark infringement.\n\n";

  const englishRuleAfter = "\n\n⚠️ FINAL REMINDER — ENGLISH ONLY: Every single piece of text rendered on this image MUST be in English. Do NOT write any Chinese characters (中文/汉字) anywhere on the image. This includes headers, labels, annotations, captions, feature descriptions, and any other visible text. Translate all Chinese content to English. This is a STRICT requirement.";

  content.push({ type: "text", text: multiNote + englishRuleBefore + noChildrenRule + noBrandRule + prompt + englishRuleAfter });

  const response = await getClient().chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content }],
    max_tokens: 4000,
  });

  const text = response.choices[0]?.message?.content ?? "";
  const imgData = extractImageBase64(text);
  if (!imgData) {
    throw new Error("AI 未能生成图片，请重试");
  }
  return imgData;
}
