export const DEFAULT_AI_WIDTH = 336;
const MIN_AI_WIDTH = 280;
const MAX_AI_WIDTH = 640;

export function aiWidthRange(available: number) {
  const max = Math.max(1, Math.min(MAX_AI_WIDTH, Math.floor(available)));
  return { min: Math.min(MIN_AI_WIDTH, max), max };
}

export function clampAiWidth(width: number, min: number, max: number) {
  return Math.round(
    Math.min(
      max,
      Math.max(min, Number.isFinite(width) ? width : DEFAULT_AI_WIDTH),
    ),
  );
}
