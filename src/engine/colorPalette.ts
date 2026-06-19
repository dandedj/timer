export const EXERCISE_COLORS = [
  '#D81B60',
  '#8E24AA',
  '#E91E63',
  '#7B1FA2',
  '#C2185B',
  '#AB47BC',
  '#AD1457',
  '#6A1B9A',
  '#EC407A',
  '#9C27B0',
] as const;

// Rests are always gray so they read instantly as "not an exercise" — dark
// enough that the white clock and labels stay legible on the full-screen fill.
export const REST_COLOR = '#6B7280';
export const REST_SET_COLOR = '#4B5563';
export const REST_CIRCUIT_COLOR = '#374151';
export const WARMUP_COLOR = '#B45309';

export function colorForIndex(index: number): string {
  return EXERCISE_COLORS[index % EXERCISE_COLORS.length];
}
