import OpenAI from "openai";
import sharp from "sharp";

const TARGET_SIZE = 800;

async function resizeToTarget(dataUrl: string): Promise<string> {
  const base64Match = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
  if (!base64Match) return dataUrl;

  const format = base64Match[1];
  const base64Data = base64Match[2];
  const buffer = Buffer.from(base64Data, "base64");

  const resized = await sharp(buffer)
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: "cover" })
    .png()
    .toBuffer();

  return `data:image/png;base64,${resized.toString("base64")}`;
}

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

  const globalRules = `

🚨🚨🚨 MANDATORY RULES — READ BEFORE GENERATING 🚨🚨🚨

1. ENGLISH ONLY — ZERO TOLERANCE FOR CHINESE TEXT:
   ALL text on the generated image MUST be in ENGLISH. This is NON-NEGOTIABLE.
   - The prompt below may contain Chinese words (e.g., product names, material descriptions like "凉感面料", "不锈钢", "棉质"). You MUST TRANSLATE every single Chinese word to English BEFORE rendering it on the image.
   - If you see Chinese text like "优质凉感面料", render it as "Premium Cooling Fabric" — NEVER copy the Chinese characters onto the image.
   - ZERO Chinese characters (中文/汉字) are allowed anywhere on the image — headers, labels, annotations, descriptions, ALL must be English.

2. NO MINORS — Do NOT include babies, infants, children, or anyone under 18. Only show ADULTS.

3. NO BRAND LOGOS — Do NOT include real brand names/logos (Coca-Cola, Nike, Apple, etc.). Use generic unbranded items only.

`;

  content.push({ type: "text", text: multiNote + globalRules + prompt + "\n\n⚠️ FINAL CHECK: Verify ZERO Chinese characters appear anywhere on the image. Every piece of text must be in English." });

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
  return resizeToTarget(imgData);
}
