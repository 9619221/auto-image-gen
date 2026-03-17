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

    const prompt = `你是一位专业的亚马逊商品标题撰写专家，擅长撰写高转化率的中文商品标题。

根据以下商品信息生成优化的亚马逊中文商品标题：

- 商品名称: ${analysis.productName}
- 类目: ${analysis.category}
- 核心卖点: ${analysis.sellingPoints.join("；")}
- 材质: ${analysis.materials}
- 颜色: ${analysis.colors}
- 尺寸: ${analysis.estimatedDimensions}

亚马逊中文标题规则：
1. 长度控制在80-120个中文字符
2. 开头用 [品牌名] 占位符，然后是商品核心名称
3. 包含最重要的搜索关键词（材质、用途、特性）
4. 包含关键差异化卖点（材质、尺寸、颜色、数量等）
5. 用"/"或"|"或","作为分隔符
6. 禁止夸大宣传用语（"最好"、"第一"、"顶级"等违规词）
7. 不使用特殊符号或表情
8. 标题必须全部使用中文

生成3个标题变体：
- 标题1: 关键词密集型（最大搜索曝光）
- 标题2: 卖点突出型（强调核心价值）
- 标题3: 简洁精炼型（短小精悍，高端感）

仅返回有效JSON:
{
  "titles": [
    {"label": "关键词优化版", "title": "..."},
    {"label": "卖点突出版", "title": "..."},
    {"label": "简洁精炼版", "title": "..."}
  ]
}`;

    const response = await getClient().chat.completions.create({
      model: process.env.ANALYZE_MODEL || "gemini-3.1-flash-image-preview",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ error: "标题生成解析失败" }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "标题生成失败" },
      { status: 500 }
    );
  }
}
