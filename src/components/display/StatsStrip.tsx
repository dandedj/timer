function formatTime(seconds: number): string {
  const m = Math.floor(Math.abs(seconds) / 60).toString().padStart(2, '0');
  const s = (Math.abs(seconds) % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface StatsStripProps {
  elapsedSeconds: number;
  intervalIndex: number;
  totalIntervals: number;
  remainingSeconds: number;
}

export function StatsStrip({ elapsedSeconds, intervalIndex, totalIntervals, remainingSeconds }: StatsStripProps) {
  return (
    <div className="flex text-white/80 bg-black/20 px-6 py-3">
      <div className="flex-1">
        <div className="text-xs uppercase tracking-wider font-semibold">Elapsed</div>
        <div className="text-2xl font-mono font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(elapsedSeconds)}
        </div>
      </div>
      <div className="flex-1 text-center">
        <div className="text-xs uppercase tracking-wider font-semibold">Intervals</div>
        <div className="text-2xl font-mono font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {intervalIndex} / {totalIntervals}
        </div>
      </div>
      <div className="flex-1 text-right">
        <div className="text-xs uppercase tracking-wider font-semibold">Remaining</div>
        <div className="text-2xl font-mono font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(remainingSeconds)}
        </div>
      </div>
    </div>
  );
}
