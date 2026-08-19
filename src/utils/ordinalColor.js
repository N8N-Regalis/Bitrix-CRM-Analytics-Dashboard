const ORDINAL_STEPS = 7;

/** Shared by any chart where position in a fixed sequence carries meaning
 * (funnel stage, lifecycle status, ...), so color is a single-hue ordinal
 * ramp by position — not a categorical palette. See dataviz skill. */
export function ordinalFill(index, total) {
  const step = Math.min(ORDINAL_STEPS, Math.max(1, Math.round(((index + 1) / total) * ORDINAL_STEPS)));
  return `var(--ordinal-${step})`;
}
