import type { ImagePlan } from "./types";

export interface PlanValidationResult {
  ok: boolean;
  warnings: string[];
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function validatePlan(plan: ImagePlan): PlanValidationResult {
  const warnings: string[] = [];
  const prompt = plan.prompt || "";
  const words = wordCount(prompt);

  if (words > 320) {
    warnings.push(`Prompt too long: ${words} words`);
  }

  const textOverlayMentions = (prompt.match(/text overlay|header text|sub-header|label each|annotations?|badges?|headline/gi) || []).length;
  if (textOverlayMentions >= 5) {
    warnings.push(`Prompt likely overloaded with text/layout instructions (${textOverlayMentions} mentions)`);
  }

  const duplicateLines = prompt
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line, index, arr) => arr.indexOf(line) !== index);
  if (duplicateLines.length > 0) {
    warnings.push("Prompt contains repeated instructions");
  }

  if (/do not add dimension lines/i.test(prompt) && /dimension/i.test(prompt) && plan.imageType !== 'dimensions') {
    warnings.push('Prompt still references dimensions while forbidding them');
  }

  if (plan.imageType === 'features' && words > 220) {
    warnings.push('Feature image prompt is too heavy for a clean Amazon support image');
  }

  if (plan.imageType === 'lifestyle2' && /4 scenes|four scenes|2x2 GRID/i.test(prompt)) {
    warnings.push('A+ multi-scene image still asks for too many scenes');
  }

  if (
    plan.imageType === 'lifestyle' &&
    /(add|include|use).*(subtitle|sub-header|paragraph)|(subtitle|sub-header|paragraph).*(add|include|use)/i.test(prompt)
  ) {
    warnings.push('Usage-scene image still asks for too much copy');
  }

  if (plan.imageType === 'dimensions' && /all important measurements|any other key dimensions|crowded|many dimensions/i.test(prompt)) {
    warnings.push('Dimensions image prompt is still too dense');
  }

  if (!/keep all four corners completely clean/i.test(prompt)) {
    warnings.push('Prompt is missing strong clean-corner anti-watermark rule');
  }

  if (!/product identity rule/i.test(prompt)) {
    warnings.push('Prompt is missing product-identity locking rule');
  }

  if (!/structure lock rule/i.test(prompt)) {
    warnings.push('Prompt is missing structure-lock rule');
  }

  return {
    ok: warnings.length === 0,
    warnings,
  };
}
