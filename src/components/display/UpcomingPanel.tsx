import { useRef, useEffect, useState } from 'react';
import type { FlatInterval } from '../../types/timer';

interface UpcomingPanelProps {
  upcoming: FlatInterval[];
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

function fingerprint(intervals: FlatInterval[]): string {
  return intervals.map(i => i.id).join(',');
}

export function UpcomingPanel({ upcoming }: UpcomingPanelProps) {
  const items = upcoming.slice(0, 5);
  const prevFingerprint = useRef('');
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const fp = fingerprint(items);
    if (fp !== prevFingerprint.current) {
      prevFingerprint.current = fp;
      setAnimKey(k => k + 1);
    }
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="w-56 flex flex-col p-2 bg-black/20 overflow-hidden">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-white/50 px-1 mb-1.5 shrink-0">
        Up Next
      </div>
      <div className="flex-1 flex flex-col gap-1.5 min-h-0">
        {items.map((interval, i) => (
          <div
            key={`${animKey}-${i}`}
            className="flex-1 rounded-lg px-3 py-2 flex flex-col justify-center min-h-0 upcoming-card"
            style={{
              backgroundColor: interval.color,
              opacity: 1 - i * 0.1,
              animationDelay: `${i * 60}ms`,
            }}
          >
            <div className="text-white font-bold text-sm truncate">{interval.label}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-white/80 text-xs font-mono">{formatDuration(interval.durationSeconds)}</span>
              {interval.repCount != null && interval.repCount > 0 && (
                <span className="text-white/80 text-xs">{interval.repCount} reps</span>
              )}
              {interval.kind !== 'work' && (
                <span className="text-white/60 text-[10px] uppercase">rest</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
