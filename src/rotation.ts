/** Whole-turn controls wrap; anatomical joints stop at their physical limits. */
export function stepRotation(
  value: number,
  delta: number,
  min: number,
  max: number,
  wrap = true,
) {
  const next = value + delta;
  if (!wrap) return Math.max(min, Math.min(max, next));
  if (next >= min && next <= max) return next;
  const span = max - min;
  return ((((next - min) % span) + span) % span) + min;
}
