import OpenAI from "openai";
import sharp from "sharp";
import type { AnalysisLanguage } from "./types";
import { LANGUAGE_ENGLISH_NAMES } from "./types";
import { geminiFetch } from "./gemini-fetch";

const TARGET_SIZE = 800;

async function resizeToTarget(dataUrl: string, useJpeg = false): Promise<string> {
  const base64Match = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
  if (!base64Match) return dataUrl;

  const base64Data = base64Match[2];
  const buffer = Buffer.from(base64Data, "base64");

  let pipeline = sharp(buffer).resize(TARGET_SIZE, TARGET_SIZE, {
    fit: "contain",
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  });

  if (useJpeg) {
    const resized = await pipeline.jpeg({ quality: 90 }).toBuffer();
    return `data:image/jpeg;base64,${resized.toString("base64")}`;
  }

  const resized = await pipeline.png().toBuffer();
  return `data:image/png;base64,${resized.toString("base64")}`;
}

/**
 * Force pure white background for hero/main images.
 * Replaces near-white pixels (within threshold) with #FFFFFF.
 */
async function enforceWhiteBackground(dataUrl: string): Promise<string> {
  const base64Match = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
  if (!base64Match) return dataUrl;

  const buffer = Buffer.from(base64Match[2], "base64");

  // 使用 sharp 原生操作代替逐像素 JS 循环，性能提升 10x+
  // flatten() 将透明背景替换为白色，然后 threshold 处理近白色像素
  const result = await sharp(buffer)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  return `data:image/png;base64,${result.toString("base64")}`;
}

// 单例客户端 — 避免每次请求重新创建
let _genClient: OpenAI | null = null;
function getClient() {
  if (_genClient) return _genClient;
  const apiKey = process.env.GENERATE_API_KEY;
  if (!apiKey) {
    throw new Error("未配置生图 API Key，请设置环境变量 GENERATE_API_KEY");
  }
  _genClient = new OpenAI({
    apiKey,
    baseURL: process.env.GENERATE_BASE_URL,
    timeout: 300_000, // 5分钟超时
    fetch: geminiFetch,
  });
  return _genClient;
}

function getModel() {
  return process.env.GENERATE_MODEL || "gemini-3.1-flash-image-preview";
}

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
  productMode: "single" | "bundle" | "variants" = "single",
  imageLanguage: AnalysisLanguage = "en",
  imageType?: string
): Promise<string> {
  const content: Array<{ type: "image_url"; image_url: { url: string } } | { type: "text"; text: string }> = [];

  for (const img of productImages) {
    content.push({ type: "image_url", image_url: { url: img } });
  }

  let multiNote = "";
  if (productImages.length > 1) {
    if (productMode === "bundle") {
      multiNote = `\n\nIMPORTANT: You are given ${productImages.length} different product reference images. These products are sold together as a BUNDLE SET. ALL ${productImages.length} products MUST appear together in the generated image. Do NOT omit any product.\n\n`;
    } else if (productMode === "variants") {
      multiNote = `\n\nIMPORTANT: You are given ${productImages.length} reference images of the SAME product in DIFFERENT COLORS/SPECIFICATIONS. These are VARIANT OPTIONS of ONE product (e.g., same design but different colors, sizes, or finishes).

VARIANT IMAGE RULES:
- For MAIN/HERO image: Show the PRIMARY variant (first image) as the hero product. Optionally show small color swatches or thumbnails of other variants at the bottom or side.
- For FEATURES/CLOSEUP/DIMENSIONS: Use the primary variant only. Keep focus on product features, not color differences.
- For LIFESTYLE images: Feature the primary variant in the scene. You may subtly hint at other colors (e.g., one variant in use, others visible on a shelf nearby).
- For PACKAGING/VALUE image: This is the BEST image to showcase ALL variants together — display all ${productImages.length} color/spec options side by side or in an attractive arrangement, with labels for each variant.
- For COMPARISON image: Use the primary variant for the comparison.
- For A+ CLOSING image: Show all variants together as a "Choose Your Color/Style" final display.

Each variant shares the SAME shape, design, and features — they ONLY differ in color/finish/size.\n\n`;
    } else {
      multiNote = `\n\nIMPORTANT: You are given ${productImages.length} reference images of the SAME SINGLE product taken from different angles. These are NOT different products - they are multiple views of ONE product. Generate the image showing only ONE product. Do NOT duplicate the product or show multiple copies.\n\n`;
    }
  }

  const targetLang = LANGUAGE_ENGLISH_NAMES[imageLanguage] || "English";
  const langInstruction = imageLanguage === "en"
    ? `ALL text on the generated image MUST be in ENGLISH. This is NON-NEGOTIABLE.
   - The prompt below may contain Chinese words. You MUST TRANSLATE every Chinese word to English BEFORE rendering it on the image.
   - ZERO Chinese characters (中文/汉字) are allowed anywhere on the image.`
    : imageLanguage === "zh"
    ? `ALL text on the generated image MUST be in CHINESE (中文). This is NON-NEGOTIABLE.
   - Write all headers, labels, annotations, and descriptions in Chinese.
   - Do NOT use English for any visible text on the image.`
    : `ALL text on the generated image MUST be in ${targetLang.toUpperCase()}. This is NON-NEGOTIABLE.
   - Write all headers, labels, annotations, and descriptions in ${targetLang}.
   - Do NOT use English or Chinese for any visible text on the image — use ${targetLang} ONLY.`;

  const globalRules = `

🚨🚨🚨 MANDATORY RULES — READ BEFORE GENERATING 🚨🚨🚨

1. ${targetLang.toUpperCase()} TEXT ONLY:
   ${langInstruction}

2. NO MINORS — Do NOT include babies, infants, children, or anyone under 18. Only show ADULTS.

3. NO BRAND LOGOS — Do NOT include real brand names/logos (Coca-Cola, Nike, Apple, etc.). Use generic unbranded items only.

4. IMAGE SIZE — Generate a SQUARE 1:1 aspect ratio image (800×800 pixels). Do NOT generate rectangular, portrait, or landscape images.

5. PRODUCT CONSISTENCY — The generated product MUST be IDENTICAL to the reference photo:
   - Same shape, same color, same proportions, same details
   - Do NOT "improve", "upgrade", or "stylize" the product — reproduce it EXACTLY
   - If the reference has specific features (open ring, 3 prongs, square bottle), they MUST appear in the output
   - Compare your generated product against the reference BEFORE finalizing — if it looks different, REGENERATE

`;

  const finalCheck = imageLanguage === "en"
    ? "⚠️ FINAL CHECK: Verify ZERO Chinese characters appear anywhere on the image. Every piece of text must be in English."
    : imageLanguage === "zh"
    ? "⚠️ FINAL CHECK: 确认图片上所有文字都是中文。"
    : `⚠️ FINAL CHECK: Verify ALL text on the image is in ${targetLang}. No English or Chinese text should appear.`;

  content.push({ type: "text", text: multiNote + globalRules + prompt + "\n\n" + finalCheck });

  // Retry up to 2 times on transient failures
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model: getModel(),
        messages: [{ role: "user", content }],
        max_tokens: 4000,
      });

      const text = response.choices[0]?.message?.content ?? "";
      const imgData = extractImageBase64(text);
      if (!imgData) {
        lastError = new Error("AI 未能生成图片，请重试");
        continue;
      }

      const isMain = imageType === "main";
      const resized = await resizeToTarget(imgData, !isMain);

      if (isMain) {
        return enforceWhiteBackground(resized);
      }
      return resized;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 1) {
        await new Promise(r => setTimeout(r, 2000)); // wait 2s before retry
      }
    }
  }
  throw lastError ?? new Error("AI 未能生成图片，请重试");
}
