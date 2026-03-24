import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { geminiFetch } from "@/lib/gemini-fetch";

let _client: OpenAI | null = null;
function getClient() {
  if (_client) return _client;
  _client = new OpenAI({
    apiKey: process.env.ANALYZE_API_KEY,
    baseURL: process.env.ANALYZE_BASE_URL,
    timeout: 30_000,
    fetch: geminiFetch,
  });
  return _client;
}

export async function POST(req: NextRequest) {
  try {
    const { texts } = await req.json() as { texts: string[] };
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: "texts array required" }, { status: 400 });
    }

    const client = getClient();
    const model = process.env.ANALYZE_MODEL || "gemini-2.5-flash-preview";

    const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are a professional e-commerce translator. Translate Chinese product descriptions to English. Keep translations concise, natural, and suitable for Amazon product listings. Return ONLY a JSON array of translated strings, in the same order as input. If a text is already in English or empty, keep it as-is.`,
        },
        {
          role: "user",
          content: `Translate these Chinese texts to English for an Amazon product listing. Return ONLY a JSON array:\n\n${numbered}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content || "[]";
    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ translations: texts });
    }
    const translations = JSON.parse(match[0]) as string[];
    return NextResponse.json({ translations });
  } catch (error) {
    console.error("[translate] Error:", error);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
