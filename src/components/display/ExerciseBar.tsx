import { SkipBack, SkipForward, Play, Pause } from 'lucide-react';
import type { FlatInterval } from '../../types/timer';

interface ExerciseBarProps {
  current: FlatInterval | null;
  next: FlatInterval | null;
  isRunning: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSkipForward: () => void;
  onSkipBack: () => void;
}

export function ExerciseBar({ current, next, isRunning, onPlay, onPause, onSkipForward, onSkipBack }: ExerciseBarProps) {
  return (
    <div className="flex h-20 text-white text-xl font-bold">
      <button
        onClick={onSkipBack}
        className="w-16 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
        title="Previous (Left Arrow)"
      >
        <SkipBack size={24} />
      </button>

      <div
        className="flex-1 flex items-center justify-center bg-black/20"
      >
        <span className="truncate px-4">{current?.label ?? '—'}</span>
      </div>

      <div
        className="flex-1 flex items-center justify-center transition-colors duration-300"
        style={{ backgroundColor: next?.color ?? 'rgba(0,0,0,0.4)' }}
      >
        <span className="truncate px-4 text-lg opacity-90">
          {next ? next.label : 'Finish'}
        </span>
      </div>

      <button
        onClick={onSkipForward}
        className="w-16 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
        title="Next (Right Arrow)"
      >
        <SkipForward size={24} />
      </button>

      <button
        onClick={isRunning ? onPause : onPlay}
        className="w-20 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
        title={isRunning ? 'Pause (Space)' : 'Play (Space)'}
      >
        {isRunning ? <Pause size={28} /> : <Play size={28} />}
      </button>
    </div>
  );
}
