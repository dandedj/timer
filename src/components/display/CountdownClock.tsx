function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface CountdownClockProps {
  seconds: number;
  /** Portrait fills the narrow width; landscape leaves room for the side panel. */
  orientation?: 'landscape' | 'portrait';
}

export function CountdownClock({ seconds, orientation = 'landscape' }: CountdownClockProps) {
  // Portrait sizing tracks BOTH axes (min of width/height) so the clock shrinks
  // to fit a short viewport instead of overflowing its flex box.
  const fontSize =
    orientation === 'portrait' ? 'clamp(3rem, min(28vw, 24vh), 16rem)' : 'clamp(6rem, 22vw, 20rem)';
  return (
    <div
      className="font-mono font-black text-white leading-none tracking-tight"
      style={{ fontSize, fontVariantNumeric: 'tabular-nums' }}
    >
      {formatTime(seconds)}
    </div>
  );
}
