export async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export async function filesToDataUrls(files: File[]): Promise<string[]> {
  return Promise.all(files.map(fileToDataUrl));
}
