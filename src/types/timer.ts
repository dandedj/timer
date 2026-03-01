export interface Exercise {
  id: string;
  name: string;
  durationSeconds: number;
  repCount?: number;
  color: string;
}

export interface Circuit {
  id: string;
  name: string;
  exercises: Exercise[];
  restBetweenExercisesSeconds: number;
  sets: number;
  restBetweenCircuitsSeconds: number;
}

export interface CompoundTimer {
  id: string;
  name: string;
  circuits: Circuit[];
  createdAt: string;
  updatedAt: string;
}

export type IntervalKind = 'work' | 'rest-exercise' | 'rest-set' | 'rest-circuit';

export interface FlatInterval {
  id: string;
  kind: IntervalKind;
  label: string;
  durationSeconds: number;
  color: string;
  repCount?: number;
  circuitName: string;
  circuitIndex: number;
  setNumber: number;
  totalSets: number;
  intervalIndexGlobal: number;
  totalIntervalsGlobal: number;
}
