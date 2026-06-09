const RESUME_KEY = 'interval-timer:resume';

export interface ResumeSnapshot {
  timerId: string;
  currentIndex: number;
  secondsRemaining: number;
  label: string;
  savedAt: number;
}

export function readResume(): ResumeSnapshot | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResumeSnapshot;
    if (
      typeof parsed.timerId !== 'string' ||
      typeof parsed.currentIndex !== 'number' ||
      typeof parsed.secondsRemaining !== 'number' ||
      typeof parsed.label !== 'string' ||
      typeof parsed.savedAt !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeResume(snapshot: ResumeSnapshot): void {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage full or unavailable — resume is best-effort.
  }
}

export function clearResume(): void {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {
    // ignore
  }
}
