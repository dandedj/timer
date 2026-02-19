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

export const REST_COLOR = '#0B7689';
export const REST_SET_COLOR = '#086070';
export const REST_CIRCUIT_COLOR = '#064E5C';

export function colorForIndex(index: number): string {
  return EXERCISE_COLORS[index % EXERCISE_COLORS.length];
}
