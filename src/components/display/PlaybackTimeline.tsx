import { memo, useMemo } from 'react';
import type { FlatInterval } from '../../types/timer';
import { WARMUP_COLOR } from '../../engine/colorPalette';

const REST_BAR_COLOR = '#9ca3af'; // gray-400, matches the builder timeline

const CROSSHATCH = `repeating-linear-gradient(
  45deg,
  transparent,
  transparent 2px,
  rgba(255,255,255,0.3) 2px,
  rgba(255,255,255,0.3) 4px
)`;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

interface PlaybackTimelineProps {
  sequence: FlatInterval[];
  currentIndex: number;
  elapsedSeconds: number;
  totalSeconds: number;
  onJump: (intervalId: string) => void;
}

function PlaybackTimelineImpl({ sequence, currentIndex, elapsedSeconds, totalSeconds, onJump }: PlaybackTimelineProps) {
  // Block geometry only depends on the sequence — compute once per timer load.
  const blocks = useMemo(
    () =>
      sequence.map((interval, i) => ({
        interval,
        i,
        startSeconds: sequence.slice(0, i).reduce((s, x) => s + x.durationSeconds, 0),
      })),
    [sequence]
  );

  if (sequence.length === 0 || totalSeconds <= 0) return null;
  const playheadPct = Math.max(0, Math.min(100, (elapsedSeconds / totalSeconds) * 100));

  return (
    <div className="px-4 pb-3 shrink-0">
      <div className="relative h-7 rounded-lg overflow-hidden flex bg-black/25">
        {blocks.map(({ interval, i, startSeconds }) => {
          const isRest = interval.kind !== 'work';
          const isCurrent = i === currentIndex;
          const kindName =
            interval.kind === 'warmup' ? 'Warm Up' :
            interval.kind === 'work' ? (interval.label || 'Exercise') : 'Rest';
          return (
            <button
              key={interval.id}
              type="button"
              onClick={() => onJump(interval.id)}
              title={`${kindName} — ${formatDuration(interval.durationSeconds)}  ·  starts at ${formatDuration(startSeconds)}\nClick to start here`}
              className="h-full transition-[filter,opacity] hover:brightness-125 focus:outline-none focus:brightness-125"
              style={{
                width: `${(interval.durationSeconds / totalSeconds) * 100}%`,
                minWidth: '3px',
                backgroundColor: interval.kind === 'warmup' ? WARMUP_COLOR : isRest ? REST_BAR_COLOR : interval.color,
                opacity: isRest ? 0.55 : isCurrent ? 1 : 0.82,
                ...(isRest ? { backgroundImage: CROSSHATCH } : {}),
                boxShadow: isCurrent ? 'inset 0 0 0 2px rgba(255,255,255,0.9)' : undefined,
              }}
            />
          );
        })}
        {/* Play head */}
        <div
          className="absolute top-0 bottom-0 w-[3px] -ml-[1.5px] bg-white pointer-events-none"
          style={{ left: `${playheadPct}%`, boxShadow: '0 0 6px rgba(0,0,0,0.6)' }}
        >
          <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-white" />
        </div>
      </div>
    </div>
  );
}

export const PlaybackTimeline = memo(PlaybackTimelineImpl);
