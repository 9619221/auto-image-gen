export type ImageType =
  | "main"
  | "features"
  | "closeup"
  | "dimensions"
  | "lifestyle"
  | "packaging"
  | "lifestyle2";

export const IMAGE_TYPE_LABELS: Record<ImageType, string> = {
  main: "主图",
  features: "功能卖点图",
  closeup: "细节特写图",
  dimensions: "尺寸规格图",
  lifestyle: "场景图",
  packaging: "包装配件图",
  lifestyle2: "场景图 2",
};

export const IMAGE_TYPE_ORDER: ImageType[] = [
  "main",
  "features",
  "closeup",
  "dimensions",
  "lifestyle",
  "packaging",
  "lifestyle2",
];

export interface AnalysisResult {
  productName: string;
  category: string;
  sellingPoints: string[];
  materials: string;
  colors: string;
  targetAudience: string[];
  usageScenes: string[];
  estimatedDimensions: string;
}

export interface ImagePlan {
  imageType: ImageType;
  title: string;
  description: string;
  prompt: string;
}

export interface GenerationJob {
  imageType: ImageType;
  status: "pending" | "generating" | "done" | "error";
  finalImageUrl?: string;
  error?: string;
}
