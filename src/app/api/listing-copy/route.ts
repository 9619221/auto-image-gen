import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import OpenAI from "openai";
import type { AnalysisResult } from "@/lib/types";

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

  try {
    const { analysis } = (await req.json()) as {
      analysis: AnalysisResult;
    };

    if (!analysis?.productName) {
      return NextResponse.json({ error: "缺少商品信息" }, { status: 400 });
    }

    const prompt = `你是一位资深亚马逊运营专家，精通Listing优化和A9搜索算法。

根据以下商品信息，生成**五点描述（Bullet Points）**和**后台搜索词（Search Terms）**：

商品信息：
- 商品名称: ${analysis.productName}
- 类目: ${analysis.category}
- 核心卖点: ${analysis.sellingPoints.join("；")}
- 材质: ${analysis.materials}
- 颜色: ${analysis.colors}
- 尺寸: ${analysis.estimatedDimensions}
- 目标人群: ${analysis.targetAudience.join("；")}
- 使用场景: ${analysis.usageScenes.join("；")}

## 五点描述规则：
1. 每条以【大写关键词短语】开头（如 ✅ 【优质材料】）
2. 每条150-200字符，突出一个核心价值
3. 第1条：核心功能/最大卖点
4. 第2条：材质/品质保障
5. 第3条：使用便捷性/用户体验
6. 第4条：适用场景/人群
7. 第5条：售后保障/附加价值
8. 包含高搜索量关键词
9. 避免违禁词（最好、第一、保证治愈等）
10. 全部使用中文

## 后台搜索词规则：
1. 总长度不超过250字节
2. 不重复标题中已有的词
3. 包含同义词、相关词、长尾词
4. 用空格分隔，不用逗号
5. 不含品牌名、ASIN、标点符号
6. 包含常见拼写变体
7. 全部使用小写英文（亚马逊后台搜索词用英文效果最佳）

仅返回有效JSON:
{
  "bulletPoints": [
    {"emoji": "✅", "title": "关键词短语", "content": "详细描述..."},
    {"emoji": "✅", "title": "关键词短语", "content": "详细描述..."},
    {"emoji": "✅", "title": "关键词短语", "content": "详细描述..."},
    {"emoji": "✅", "title": "关键词短语", "content": "详细描述..."},
    {"emoji": "✅", "title": "关键词短语", "content": "详细描述..."}
  ],
  "searchTerms": "keyword1 keyword2 keyword3..."
}`;

    const response = await getClient().chat.completions.create({
      model: process.env.ANALYZE_MODEL || "gemini-3.1-flash-image-preview",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ error: "Listing文案解析失败" }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Listing文案生成失败" },
      { status: 500 }
    );
  }
}
