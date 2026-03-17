import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import OpenAI from "openai";
import type { ImageScore } from "@/lib/types";

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
    const { scores, imageTypes } = (await req.json()) as {
      scores: Record<string, ImageScore>;
      imageTypes: string[];
    };

    if (!scores || Object.keys(scores).length === 0) {
      return NextResponse.json({ error: "请先对图片评分" }, { status: 400 });
    }

    const scoreDetails = imageTypes.map((type) => {
      const s = scores[type];
      return s
        ? `${type}: 综合${s.overall}/10 (清晰度${s.clarity}, 构图${s.composition}, 文字${s.textQuality}, 合规${s.compliance}, 吸引力${s.appeal})`
        : `${type}: 未评分`;
    }).join("\n");

    const prompt = `你是一位亚马逊Listing图片优化专家，精通图片排列策略。

根据以下图片评分数据，给出最优的图片排列顺序和理由：

当前图片评分:
${scoreDetails}

## 亚马逊图片排列最佳实践：
1. 第1张必须是主图（白底纯产品图）
2. 第2张应该是最吸引人的卖点图（高吸引力分数优先）
3. 第3-4张展示核心功能和使用场景
4. 第5-6张补充信息（尺寸、对比、包装等）
5. 第7张（最后）放A+收束图或生活场景图
6. 低分图片建议重新生成，不要放在前3位

## 分析要求：
- 给出推荐排序
- 每个位置说明放该图的理由
- 标出需要重新生成的图片（评分<7）
- 给出整体Listing图片评价

仅返回有效JSON:
{
  "recommendedOrder": [
    {"position": 1, "imageType": "xxx", "reason": "原因..."},
    {"position": 2, "imageType": "xxx", "reason": "原因..."}
  ],
  "needRegenerate": ["imageType1", "imageType2"],
  "overallAssessment": "整体评价...",
  "tips": ["优化建议1", "优化建议2"]
}`;

    const response = await getClient().chat.completions.create({
      model: process.env.ANALYZE_MODEL || "gemini-3.1-flash-image-preview",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ error: "排序分析失败" }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "排序优化失败" },
      { status: 500 }
    );
  }
}
