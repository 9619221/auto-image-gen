import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, checkRateLimit } from "@/lib/api-auth";
import { sanitizeForPrompt } from "@/lib/sanitize";
import { extractJSON } from "@/lib/sanitize";
import OpenAI from "openai";

function getClient() {
  const apiKey = process.env.ANALYZE_API_KEY;
  if (!apiKey) throw new Error("未配置分析 API Key");
  return new OpenAI({
    apiKey,
    baseURL: process.env.ANALYZE_BASE_URL,
  });
}

export async function POST(req: NextRequest) {
  const authError = authenticateRequest(req);
  if (authError) return authError;
  const rateLimitError = checkRateLimit(req, "default");
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const competitorTitle = sanitizeForPrompt(body?.competitorTitle ?? "", 300);
    const myProductName = sanitizeForPrompt(body?.myProductName ?? "", 200);

    if (!competitorTitle) {
      return NextResponse.json({ error: "请输入竞品标题" }, { status: 400 });
    }

    const prompt = `你是一位亚马逊SEO分析专家，精通关键词提取和竞品分析。

分析以下竞品标题，提取有价值的关键词，并给出优化建议：

竞品标题: "${competitorTitle}"
我的商品: "${myProductName || "未指定"}"

## 分析要求：
1. **核心关键词** - 提取标题中的核心搜索词（3-5个）
2. **长尾关键词** - 提取长尾搜索词组合（3-5个）
3. **属性关键词** - 材质、颜色、尺寸等属性词（2-4个）
4. **场景关键词** - 使用场景相关词（2-3个）
5. **竞品策略分析** - 简短分析竞品标题策略
6. **我可以借鉴的词** - 如果提供了我的商品名，建议可以加入的关键词

仅返回有效JSON:
{
  "coreKeywords": [{"word": "关键词", "searchVolume": "高/中/低", "relevance": "高/中/低"}],
  "longTailKeywords": [{"phrase": "长尾词组", "intent": "搜索意图"}],
  "attributeKeywords": ["属性词1", "属性词2"],
  "sceneKeywords": ["场景词1", "场景词2"],
  "strategyAnalysis": "竞品标题策略分析...",
  "suggestions": ["建议1", "建议2", "建议3"]
}`;

    const response = await getClient().chat.completions.create({
      model: process.env.ANALYZE_MODEL || "gemini-3.1-flash-image-preview",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    });

    const text = response.choices[0]?.message?.content ?? "";
    const result = extractJSON(text);

    if (!result) {
      return NextResponse.json({ error: "关键词分析失败" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "竞品分析失败" },
      { status: 500 }
    );
  }
}
