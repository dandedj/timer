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

export type SoundPreset = 'classic' | 'soft' | 'sharp' | 'bell';

export interface AudioSettings {
  preset: SoundPreset;
  countdownEnabled: boolean;
}

export interface CompoundTimer {
  id: string;
  name: string;
  circuits: Circuit[];
  audioSettings?: AudioSettings;
  /** Lead-in warm-up in seconds, played first and counted down on open. */
  warmupSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export type IntervalKind = 'warmup' | 'work' | 'rest-exercise' | 'rest-set' | 'rest-circuit';

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
