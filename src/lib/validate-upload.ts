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

export function validateUploadedFiles(formData: FormData): UploadValidation {
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
    if (!ALLOWED_TYPES.has(file.type)) {
      return {
        ok: false,
        error: `不支持的文件类型: ${file.type || "unknown"}`,
        files: [],
      };
    }
    if (file.size > MAX_FILE_SIZE) {
      return {
        ok: false,
        error: `文件 ${file.name} 超过 10MB 限制`,
        files: [],
      };
    }
  }

  return { ok: true, files };
}
