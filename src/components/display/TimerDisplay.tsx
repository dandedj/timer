import { ArrowLeft } from 'lucide-react';
import { CountdownClock } from './CountdownClock';
import { StatsStrip } from './StatsStrip';
import { ExerciseBar } from './ExerciseBar';
import { SetIndicator } from './SetIndicator';
import { RepDisplay } from './RepDisplay';
import { UpcomingPanel } from './UpcomingPanel';
import type { EngineSnapshot } from '../../types/engine';

interface TimerDisplayProps {
  snapshot: EngineSnapshot;
  onPlay: () => void;
  onPause: () => void;
  onSkipForward: () => void;
  onSkipBack: () => void;
  onBack: () => void;
}

export function TimerDisplay({ snapshot, onPlay, onPause, onSkipForward, onSkipBack, onBack }: TimerDisplayProps) {
  const bgColor = snapshot.current?.color ?? '#1a1a2e';
  const isRunning = snapshot.status === 'running';

  return (
    <div
      className="flex h-screen select-none transition-colors duration-300"
      style={{ backgroundColor: bgColor }}
    >
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex justify-between items-start p-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-white/80 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Timers
          </button>
          <SetIndicator
            setNumber={snapshot.setNumber}
            totalSets={snapshot.totalSets}
            circuitName={snapshot.current?.circuitName ?? ''}
          />
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <CountdownClock seconds={snapshot.secondsRemaining} />
            {snapshot.current?.repCount != null && snapshot.current.repCount > 0 && (
              <RepDisplay repCount={snapshot.current.repCount} />
            )}
          </div>
        </div>

        <StatsStrip
          elapsedSeconds={snapshot.elapsedTotalSeconds}
          intervalIndex={snapshot.intervalIndex}
          totalIntervals={snapshot.totalIntervals}
          remainingSeconds={Math.max(0, snapshot.totalDurationSeconds - snapshot.elapsedTotalSeconds)}
        />

        <ExerciseBar
          current={snapshot.current}
          next={snapshot.next}
          isRunning={isRunning}
          onPlay={onPlay}
          onPause={onPause}
          onSkipForward={onSkipForward}
          onSkipBack={onSkipBack}
        />
      </div>

      <UpcomingPanel upcoming={snapshot.upcoming} />
    </div>
  );
}
