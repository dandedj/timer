const VOLUME_KEY = 'interval-timer:volume';

function clamp(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(0, v));
}

/** Device-wide master volume (0–1), applied to every beep. Defaults to full. */
export function getVolume(): number {
  const raw = localStorage.getItem(VOLUME_KEY);
  return raw == null ? 1 : clamp(Number(raw));
}

export function persistVolume(v: number): void {
  localStorage.setItem(VOLUME_KEY, String(clamp(v)));
}
