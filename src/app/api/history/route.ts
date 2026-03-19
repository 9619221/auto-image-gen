import { NextRequest, NextResponse } from "next/server";
import { saveHistory, listHistory, getHistoryEntry } from "@/lib/history";
import { authenticateRequest } from "@/lib/api-auth";

// GET /api/history — list all history entries
// GET /api/history?id=xxx — get specific entry with images
export async function GET(req: NextRequest) {
  const authError = authenticateRequest(req);
  if (authError) return authError;

  const id = req.nextUrl.searchParams.get("id");

  if (id) {
    const entry = await getHistoryEntry(id);
    if (!entry) {
      return NextResponse.json({ error: "历史记录不存在" }, { status: 404 });
    }
    return NextResponse.json(entry);
  }

  const entries = await listHistory();
  return NextResponse.json(entries);
}

// POST /api/history — save a new history entry
export async function POST(req: NextRequest) {
  const authError = authenticateRequest(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    if (!body || !body.productName || !Array.isArray(body.images) || body.images.length === 0) {
      return NextResponse.json({ error: "缺少必要字段" }, { status: 400 });
    }
    const id = await saveHistory(body);
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存失败" },
      { status: 500 }
    );
  }
}
