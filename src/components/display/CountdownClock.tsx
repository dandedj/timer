function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function CountdownClock({ seconds }: { seconds: number }) {
  return (
    <div
      className="font-mono font-black text-white leading-none tracking-tight"
      style={{ fontSize: 'clamp(6rem, 22vw, 20rem)', fontVariantNumeric: 'tabular-nums' }}
    >
      {formatTime(seconds)}
    </div>
  );
}
