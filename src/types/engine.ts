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
  secondsRemaining: number;
  elapsedTotalSeconds: number;
  totalDurationSeconds: number;
  intervalIndex: number;
  totalIntervals: number;
  setNumber: number;
  totalSets: number;
}
