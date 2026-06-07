import type { IStorageProvider } from '../types/storage';
import type { CompoundTimer } from '../types/timer';

export const TIMERS_KEY = 'interval-timer:timers';

export class LocalStorageProvider implements IStorageProvider {
  /** Synchronous read of the full cache — the offline-first source of truth. */
  readAll(): CompoundTimer[] {
    try {
      const raw = localStorage.getItem(TIMERS_KEY);
      return raw ? (JSON.parse(raw) as CompoundTimer[]) : [];
    } catch {
      return [];
    }
  }

  /** Synchronous write of the full cache. */
  writeAll(timers: CompoundTimer[]): void {
    localStorage.setItem(TIMERS_KEY, JSON.stringify(timers));
  }

  async listTimers(): Promise<CompoundTimer[]> {
    return this.readAll().sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getTimer(id: string): Promise<CompoundTimer | null> {
    return this.readAll().find(t => t.id === id) ?? null;
  }

  async saveTimer(timer: CompoundTimer): Promise<void> {
    const timers = this.readAll();
    const idx = timers.findIndex(t => t.id === timer.id);
    if (idx >= 0) {
      timers[idx] = timer;
    } else {
      timers.push(timer);
    }
    this.writeAll(timers);
  }

  async deleteTimer(id: string): Promise<void> {
    this.writeAll(this.readAll().filter(t => t.id !== id));
  }
}
