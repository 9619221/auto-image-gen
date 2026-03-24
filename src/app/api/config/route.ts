import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const ENV_PATH = join(process.cwd(), ".env.local");

async function readEnvFile(): Promise<Record<string, string>> {
  try {
    const content = await readFile(ENV_PATH, "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        vars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
      }
    }
    return vars;
  } catch {
    return {};
  }
}

async function writeEnvFile(vars: Record<string, string>) {
  const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`);
  await writeFile(ENV_PATH, lines.join("\n") + "\n", "utf-8");
}

// GET: return current config
export async function GET() {
  const vars = await readEnvFile();
  return NextResponse.json({
    analyzeModel: vars.ANALYZE_MODEL || "gemini-2.5-flash-preview",
    analyzeApiKey: vars.ANALYZE_API_KEY ? `${vars.ANALYZE_API_KEY.slice(0, 6)}...${vars.ANALYZE_API_KEY.slice(-4)}` : "",
    analyzeBaseUrl: vars.ANALYZE_BASE_URL || "",
    generateModel: vars.GENERATE_MODEL || "gemini-3.1-flash-image-preview",
    generateApiKey: vars.GENERATE_API_KEY ? `${vars.GENERATE_API_KEY.slice(0, 6)}...${vars.GENERATE_API_KEY.slice(-4)}` : "",
    generateBaseUrl: vars.GENERATE_BASE_URL || "",
  });
}

// POST: update config and invalidate singleton clients
export async function POST(req: NextRequest) {
  const body = await req.json();
  const vars = await readEnvFile();

  if (body.analyzeModel) vars.ANALYZE_MODEL = body.analyzeModel;
  if (body.analyzeApiKey) vars.ANALYZE_API_KEY = body.analyzeApiKey;
  if (body.analyzeBaseUrl) vars.ANALYZE_BASE_URL = body.analyzeBaseUrl;
  if (body.generateModel) vars.GENERATE_MODEL = body.generateModel;
  if (body.generateApiKey) vars.GENERATE_API_KEY = body.generateApiKey;
  if (body.generateBaseUrl) vars.GENERATE_BASE_URL = body.generateBaseUrl;

  await writeEnvFile(vars);

  // Update process.env so singleton clients pick up changes
  if (body.analyzeModel) process.env.ANALYZE_MODEL = body.analyzeModel;
  if (body.analyzeApiKey) process.env.ANALYZE_API_KEY = body.analyzeApiKey;
  if (body.analyzeBaseUrl) process.env.ANALYZE_BASE_URL = body.analyzeBaseUrl;
  if (body.generateModel) process.env.GENERATE_MODEL = body.generateModel;
  if (body.generateApiKey) process.env.GENERATE_API_KEY = body.generateApiKey;
  if (body.generateBaseUrl) process.env.GENERATE_BASE_URL = body.generateBaseUrl;

  // Invalidate singleton clients by calling reset functions
  const { resetAnalyzeClient } = await import("@/lib/analyze");
  const { resetGenerateClient } = await import("@/lib/image-gen");
  resetAnalyzeClient();
  resetGenerateClient();

  return NextResponse.json({ ok: true });
}
