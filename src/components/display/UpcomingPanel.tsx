import { useRef, useEffect, useState } from 'react';
import type { FlatInterval } from '../../types/timer';

interface UpcomingPanelProps {
  upcoming: FlatInterval[];
  onSelect?: (intervalId: string) => void;
  /** 'sidebar' = vertical column (landscape); 'strip' = horizontal row (portrait). */
  layout?: 'sidebar' | 'strip';
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

function fingerprint(intervals: FlatInterval[]): string {
  return intervals.map(i => i.id).join(',');
}

// Words dropped from the acronym entirely (articles) vs. kept as a lowercase letter (connectors).
const ACRONYM_DROP = new Set(['the', 'a', 'an']);
const ACRONYM_MINOR = new Set(['on', 'of', 'in', 'at', 'to', 'for', 'with', 'and', 'by', 'or', 'per', 'from']);

/**
 * A 2–3 character token readable across a room, inferred from an exercise name:
 * "Bicep Curl" → "BC", "March on the Spot" → "MoS", "Warm Up" → "WU", "Squats" → "Squ".
 */
function acronym(label: string): string {
  const words = (label ?? '').trim().split(/\s+/).filter(Boolean);
  const significant = words.filter((w) => !ACRONYM_DROP.has(w.toLowerCase().replace(/[^a-z0-9]/gi, '')));
  if (significant.length === 0) return (label ?? '').trim().slice(0, 3).toUpperCase();
  if (significant.length === 1) {
    const w = significant[0].replace(/[^a-zA-Z0-9]/g, '');
    return w.charAt(0).toUpperCase() + w.slice(1, 3).toLowerCase();
  }
  return significant
    .map((w) => {
      const clean = w.replace(/[^a-zA-Z0-9]/g, '');
      const ch = clean.charAt(0);
      return ACRONYM_MINOR.has(clean.toLowerCase()) ? ch.toLowerCase() : ch.toUpperCase();
    })
    .join('')
    .slice(0, 3);
}

export function UpcomingPanel({ upcoming, onSelect, layout = 'sidebar' }: UpcomingPanelProps) {
  const isStrip = layout === 'strip';
  const items = upcoming.slice(0, isStrip ? 3 : 5);
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

  const cards = items.map((interval, i) => {
    const isRest = interval.kind !== 'work' && interval.kind !== 'warmup';
    // Big across-the-room token: an acronym for exercises, plain "Rest" for breaks.
    const token = isRest ? 'Rest' : acronym(interval.label);
    return (
      <button
        key={`${animKey}-${i}`}
        type="button"
        onClick={() => onSelect?.(interval.id)}
        title={`Jump to ${interval.label}`}
        className={
          isStrip
            ? 'flex-1 min-w-0 rounded-lg px-3 py-1.5 flex flex-col justify-center upcoming-card text-left transition-transform hover:scale-[1.03] hover:ring-2 hover:ring-white/60 cursor-pointer'
            : 'flex-1 rounded-lg px-3 py-2 flex flex-col justify-center min-h-0 upcoming-card text-left w-full transition-transform hover:scale-[1.03] hover:ring-2 hover:ring-white/60 cursor-pointer'
        }
        style={{
          backgroundColor: interval.color,
          opacity: 1 - i * 0.1,
          animationDelay: `${i * 60}ms`,
        }}
      >
        <div
          className="text-white font-black leading-none truncate"
          style={{ fontSize: isStrip ? 'clamp(1.35rem, 6vw, 2rem)' : 'clamp(2rem, 4.5vw, 3.75rem)' }}
        >
          {token}
        </div>
        {!isRest && !isStrip && (
          <div className="text-white/85 text-xs font-semibold truncate mt-1">{interval.label}</div>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-white/80 text-xs font-mono">{formatDuration(interval.durationSeconds)}</span>
          {interval.repCount != null && interval.repCount > 0 && (
            <span className="text-white/80 text-xs">{interval.repCount} reps</span>
          )}
        </div>
      </button>
    );
  });

  if (isStrip) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-black/20 shrink-0">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-white/50 shrink-0 leading-tight w-12">
          Up Next
        </div>
        <div className="flex-1 flex gap-2 min-w-0">{cards}</div>
      </div>
    );
  }

  return (
    <div className="w-56 flex flex-col p-2 bg-black/20 overflow-hidden">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-white/50 px-1 mb-1.5 shrink-0">
        Up Next
      </div>
      <div className="flex-1 flex flex-col gap-1.5 min-h-0">{cards}</div>
    </div>
  );
}
