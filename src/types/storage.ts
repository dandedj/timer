import type { CompoundTimer } from './timer';

export interface IStorageProvider {
  listTimers(): Promise<CompoundTimer[]>;
  getTimer(id: string): Promise<CompoundTimer | null>;
  saveTimer(timer: CompoundTimer): Promise<void>;
  deleteTimer(id: string): Promise<void>;
}
