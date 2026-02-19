import type { IStorageProvider } from '../types/storage';
import type { CompoundTimer } from '../types/timer';

const STORAGE_KEY = 'interval-timer:timers';

export class LocalStorageProvider implements IStorageProvider {
  private read(): CompoundTimer[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CompoundTimer[]) : [];
    } catch {
      return [];
    }
  }

  private write(timers: CompoundTimer[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  }

  async listTimers(): Promise<CompoundTimer[]> {
    return this.read().sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getTimer(id: string): Promise<CompoundTimer | null> {
    return this.read().find(t => t.id === id) ?? null;
  }

  async saveTimer(timer: CompoundTimer): Promise<void> {
    const timers = this.read();
    const idx = timers.findIndex(t => t.id === timer.id);
    if (idx >= 0) {
      timers[idx] = timer;
    } else {
      timers.push(timer);
    }
    this.write(timers);
  }

  async deleteTimer(id: string): Promise<void> {
    this.write(this.read().filter(t => t.id !== id));
  }
}
