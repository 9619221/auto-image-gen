import fs from "fs/promises";
import path from "path";

const HISTORY_DIR = path.join(process.cwd(), "data", "history");
const MAX_HISTORY = 50; // Keep last 50 generations

export interface HistoryEntry {
  id: string;
  timestamp: number;
  productName: string;
  salesRegion: string;
  imageCount: number;
  images: Array<{
    imageType: string;
    imageUrl: string; // stored as file path, served as data URL
  }>;
}

export interface HistoryMeta {
  id: string;
  timestamp: number;
  productName: string;
  salesRegion: string;
  imageCount: number;
  thumbnail?: string; // first image as small thumbnail
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Validate history ID to prevent path traversal */
function isValidId(id: string): boolean {
  return /^[\d]+-[a-z0-9]+$/.test(id) && !id.includes("..") && !id.includes("/") && !id.includes("\\");
}

export async function saveHistory(entry: Omit<HistoryEntry, "id" | "timestamp">): Promise<string> {
  await ensureDir(HISTORY_DIR);

  const id = generateId();
  const entryDir = path.join(HISTORY_DIR, id);
  await ensureDir(entryDir);

  // Save each image as a separate file
  const imageRefs: Array<{ imageType: string; filename: string; mime: string }> = [];
  for (const img of entry.images) {
    const base64Match = img.imageUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
    const ext = base64Match?.[1] === "jpeg" ? "jpg" : (base64Match?.[1] || "png");
    const mime = base64Match ? `image/${base64Match[1]}` : "image/png";
    const filename = `${img.imageType}.${ext}`;
    if (base64Match) {
      await fs.writeFile(path.join(entryDir, filename), Buffer.from(base64Match[2], "base64"));
    }
    imageRefs.push({ imageType: img.imageType, filename, mime });
  }

  // Save metadata
  const meta = {
    id,
    timestamp: Date.now(),
    productName: entry.productName,
    salesRegion: entry.salesRegion,
    imageCount: entry.imageCount,
    images: imageRefs,
  };
  await fs.writeFile(path.join(entryDir, "meta.json"), JSON.stringify(meta, null, 2));

  // Cleanup old entries
  await cleanupOldEntries();

  return id;
}

export async function listHistory(): Promise<HistoryMeta[]> {
  await ensureDir(HISTORY_DIR);

  const entries: HistoryMeta[] = [];
  const dirs = await fs.readdir(HISTORY_DIR);

  for (const dir of dirs) {
    // Skip dirs that don't match safe ID pattern
    if (!isValidId(dir)) continue;

    const metaPath = path.join(HISTORY_DIR, dir, "meta.json");
    try {
      const raw = await fs.readFile(metaPath, "utf-8");
      const meta = JSON.parse(raw);

      entries.push({
        id: meta.id,
        timestamp: meta.timestamp,
        productName: meta.productName,
        salesRegion: meta.salesRegion,
        imageCount: meta.imageCount,
      });
    } catch { /* skip invalid entries */ }
  }

  // Sort newest first
  entries.sort((a, b) => b.timestamp - a.timestamp);
  return entries;
}

export async function getHistoryEntry(id: string): Promise<HistoryEntry | null> {
  if (!isValidId(id)) return null;
  const entryDir = path.join(HISTORY_DIR, id);
  const metaPath = path.join(entryDir, "meta.json");

  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    const meta = JSON.parse(raw);

    const images: Array<{ imageType: string; imageUrl: string }> = [];
    for (const ref of meta.images) {
      const imgPath = path.join(entryDir, ref.filename);
      try {
        const imgBuf = await fs.readFile(imgPath);
        const mime = ref.mime || (ref.filename.endsWith(".jpg") ? "image/jpeg" : "image/png");
        images.push({
          imageType: ref.imageType,
          imageUrl: `data:${mime};base64,${imgBuf.toString("base64")}`,
        });
      } catch { /* skip missing images */ }
    }

    return {
      id: meta.id,
      timestamp: meta.timestamp,
      productName: meta.productName,
      salesRegion: meta.salesRegion,
      imageCount: meta.imageCount,
      images,
    };
  } catch {
    return null;
  }
}

async function cleanupOldEntries() {
  const entries = await listHistory();
  if (entries.length <= MAX_HISTORY) return;

  const toDelete = entries.slice(MAX_HISTORY);
  for (const entry of toDelete) {
    const entryDir = path.join(HISTORY_DIR, entry.id);
    try {
      await fs.rm(entryDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}
