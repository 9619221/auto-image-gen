import OpenAI from "openai";

function getClient() {
  return new OpenAI({
    apiKey: process.env.LLM_API_KEY!,
    baseURL: process.env.LLM_BASE_URL!,
  });
}

const MODEL = "gemini-3.1-flash-image-preview";

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
  prompt: string
): Promise<string> {
  const content: Array<{ type: "image_url"; image_url: { url: string } } | { type: "text"; text: string }> = [];

  for (const img of productImages) {
    content.push({ type: "image_url", image_url: { url: img } });
  }

  const multiNote =
    productImages.length > 1
      ? `\n\nIMPORTANT: You are given ${productImages.length} different product reference images. These products are sold together as a BUNDLE SET. ALL ${productImages.length} products MUST appear together in the generated image. Do NOT omit any product.\n\n`
      : "";

  content.push({ type: "text", text: multiNote + prompt });

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
