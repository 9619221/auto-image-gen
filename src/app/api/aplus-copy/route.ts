import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, checkRateLimit } from "@/lib/api-auth";
import { sanitizeForPrompt, sanitizeArray, extractJSON } from "@/lib/sanitize";
import OpenAI from "openai";
import { geminiFetch } from "@/lib/gemini-fetch";
import type { AnalysisResult } from "@/lib/types";

function getClient() {
  const apiKey = process.env.ANALYZE_API_KEY;
  if (!apiKey) throw new Error("未配置分析 API Key");
  return new OpenAI({
    apiKey,
    baseURL: process.env.ANALYZE_BASE_URL,
    fetch: geminiFetch,
  });
}

export async function POST(req: NextRequest) {
  const authError = authenticateRequest(req);
  if (authError) return authError;
  const rateLimitError = checkRateLimit(req, "default");
  if (rateLimitError) return rateLimitError;

  try {
    const { analysis } = (await req.json()) as {
      analysis: AnalysisResult;
    };

    if (!analysis?.productName) {
      return NextResponse.json({ error: "缺少商品信息" }, { status: 400 });
    }

    const safeName = sanitizeForPrompt(analysis.productName, 200);
    const safeCategory = sanitizeForPrompt(analysis.category || "", 100);
    const safePoints = sanitizeArray(analysis.sellingPoints || []).join("；");
    const safeMaterials = sanitizeForPrompt(analysis.materials || "", 100);
    const safeAudience = sanitizeArray(analysis.targetAudience || []).join("；");
    const safeScenes = sanitizeArray(analysis.usageScenes || []).join("；");

    const prompt = `你是一位亚马逊A+页面（Enhanced Brand Content）内容策划专家。

根据以下商品信息，生成A+页面文案模块：

商品信息：
- 商品名称: ${safeName}
- 类目: ${safeCategory}
- 核心卖点: ${safePoints}
- 材质: ${safeMaterials}
- 目标人群: ${safeAudience}
- 使用场景: ${safeScenes}

## A+文案模块（按顺序）：
1. **品牌故事模块** - 简短品牌理念（2-3句话）
2. **核心价值主张** - 一句话概括产品核心优势
3. **4个特性模块** - 每个包含标题+描述（图文并排用）
4. **使用场景描述** - 2-3个场景的描述文案
5. **规格参数模块** - 关键规格整理
6. **FAQ模块** - 3个常见问题及回答

## 规则：
- 全部中文
- 简洁有力，避免冗长
- 每个模块标题控制在10字以内
- 描述控制在50-80字
- 突出产品价值，不夸大
- 适合配合图片使用

仅返回有效JSON:
{
  "brandStory": "品牌故事...",
  "valueProposition": "核心价值主张...",
  "features": [
    {"title": "特性标题", "description": "特性描述..."},
    {"title": "特性标题", "description": "特性描述..."},
    {"title": "特性标题", "description": "特性描述..."},
    {"title": "特性标题", "description": "特性描述..."}
  ],
  "scenes": [
    {"title": "场景标题", "description": "场景描述..."},
    {"title": "场景标题", "description": "场景描述..."}
  ],
  "specs": [
    {"label": "规格名", "value": "规格值"},
    {"label": "规格名", "value": "规格值"}
  ],
  "faq": [
    {"question": "问题?", "answer": "回答..."},
    {"question": "问题?", "answer": "回答..."},
    {"question": "问题?", "answer": "回答..."}
  ]
}`;

    const response = await getClient().chat.completions.create({
      model: process.env.ANALYZE_MODEL || "gemini-3.1-flash-image-preview",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 3000,
    });

    const text = response.choices[0]?.message?.content ?? "";
    const result = extractJSON(text);

    if (!result) {
      return NextResponse.json({ error: "A+文案解析失败" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "A+文案生成失败" },
      { status: 500 }
    );
  }
}
