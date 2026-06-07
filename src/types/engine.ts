import type { FlatInterval } from './timer';

export type EngineStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface EngineState {
  status: EngineStatus;
  sequence: FlatInterval[];
  currentIndex: number;
  ticksRemaining: number;
  elapsedTotalSeconds: number;
  totalDurationSeconds: number;
}

export interface EngineSnapshot {
  status: EngineStatus;
  current: FlatInterval | null;
  next: FlatInterval | null;
  upcoming: FlatInterval[];
  /** The full interval sequence (stable reference; for rendering a playback timeline). */
  sequence: FlatInterval[];
  /** 0-based index of the current interval within `sequence`. */
  currentIndex: number;
  secondsRemaining: number;
  elapsedTotalSeconds: number;
  totalDurationSeconds: number;
  intervalIndex: number;
  totalIntervals: number;
  setNumber: number;
  totalSets: number;
}
