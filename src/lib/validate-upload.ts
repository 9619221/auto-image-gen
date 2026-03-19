import { detectImageMime } from "./server-image";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_FILES = 5;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export interface UploadValidation {
  ok: boolean;
  error?: string;
  files: File[];
}

export async function validateUploadedFiles(formData: FormData): Promise<UploadValidation> {
  const files = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return { ok: false, error: "未提供图片", files: [] };
  }

  if (files.length > MAX_FILES) {
    return { ok: false, error: `最多上传 ${MAX_FILES} 张图片`, files: [] };
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return {
        ok: false,
        error: `文件 ${file.name} 超过 10MB 限制`,
        files: [],
      };
    }

    // Verify actual file type via magic bytes instead of trusting client MIME
    const buffer = Buffer.from(await file.arrayBuffer());
    const actualMime = detectImageMime(buffer);
    if (!ALLOWED_TYPES.has(actualMime)) {
      return {
        ok: false,
        error: `文件 ${file.name} 不是支持的图片格式`,
        files: [],
      };
    }
  }

  return { ok: true, files };
}
