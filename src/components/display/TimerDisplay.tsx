import { useCallback, useState } from 'react';
import { ArrowLeft, Smartphone, Monitor } from 'lucide-react';
import { CountdownClock } from './CountdownClock';
import { StatsStrip } from './StatsStrip';
import { ExerciseBar } from './ExerciseBar';
import { SetIndicator } from './SetIndicator';
import { RepDisplay } from './RepDisplay';
import { UpcomingPanel } from './UpcomingPanel';
import { PlaybackTimeline } from './PlaybackTimeline';
import { VolumeControl } from './VolumeControl';
import type { EngineSnapshot } from '../../types/engine';

const PORTRAIT_KEY = 'timer:portrait';

function readPortrait(): boolean {
  try {
    return localStorage.getItem(PORTRAIT_KEY) === '1';
  } catch {
    return false;
  }
}

interface TimerDisplayProps {
  snapshot: EngineSnapshot;
  onPlay: () => void;
  onPause: () => void;
  onSkipForward: () => void;
  onSkipBack: () => void;
  onPreviousExercise: () => void;
  onJump: (intervalId: string) => void;
  onReset: () => void;
  onVolumeChange: (volume: number) => void;
  onVolumePreview: () => void;
  onBack: () => void;
}

export function TimerDisplay({ snapshot, onPlay, onPause, onSkipForward, onSkipBack, onPreviousExercise, onJump, onReset, onVolumeChange, onVolumePreview, onBack }: TimerDisplayProps) {
  const bgColor = snapshot.current?.color ?? '#1a1a2e';
  const isRunning = snapshot.status === 'running';
  const [portrait, setPortrait] = useState(readPortrait);

  const togglePortrait = useCallback(() => {
    setPortrait((p) => {
      const next = !p;
      try {
        localStorage.setItem(PORTRAIT_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable — keep the in-memory toggle */
      }
      return next;
    });
  }, []);

  const header = (
    <div className="flex justify-between items-start p-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-white/80 hover:text-white transition-colors text-sm font-medium"
      >
        <ArrowLeft size={16} />
        Timers
      </button>
      <div className="flex items-center gap-3">
        <VolumeControl onChange={onVolumeChange} onPreview={onVolumePreview} />
        <button
          onClick={togglePortrait}
          title={portrait ? 'Switch to wide (landscape) layout' : 'Switch to tall (portrait) layout'}
          aria-pressed={portrait}
          className="flex items-center justify-center p-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-white/80 hover:text-white transition-colors"
        >
          {portrait ? <Monitor size={18} /> : <Smartphone size={18} />}
        </button>
        <SetIndicator
          setNumber={snapshot.setNumber}
          totalSets={snapshot.totalSets}
          circuitName={snapshot.current?.circuitName ?? ''}
        />
      </div>
    </div>
  );

  const clock = (
    <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
      <div className="flex flex-col items-center gap-4">
        <CountdownClock seconds={snapshot.secondsRemaining} orientation={portrait ? 'portrait' : 'landscape'} />
        {snapshot.current?.repCount != null && snapshot.current.repCount > 0 && (
          <RepDisplay repCount={snapshot.current.repCount} />
        )}
      </div>
    </div>
  );

  const stats = (
    <StatsStrip
      elapsedSeconds={snapshot.elapsedTotalSeconds}
      intervalIndex={snapshot.intervalIndex}
      totalIntervals={snapshot.totalIntervals}
      remainingSeconds={Math.max(0, snapshot.totalDurationSeconds - snapshot.elapsedTotalSeconds)}
    />
  );

  const exerciseBar = (
    <ExerciseBar
      current={snapshot.current}
      next={snapshot.next}
      isRunning={isRunning}
      onPlay={onPlay}
      onPause={onPause}
      onSkipForward={onSkipForward}
      onSkipBack={onSkipBack}
      onPreviousExercise={onPreviousExercise}
      onReset={onReset}
    />
  );

  const timeline = (
    <PlaybackTimeline
      sequence={snapshot.sequence}
      currentIndex={snapshot.currentIndex}
      elapsedSeconds={snapshot.elapsedTotalSeconds}
      totalSeconds={snapshot.totalDurationSeconds}
      onJump={onJump}
    />
  );

  if (portrait) {
    return (
      <div
        className="flex flex-col h-[100dvh] select-none transition-colors duration-300"
        style={{ backgroundColor: bgColor }}
      >
        {header}
        {clock}
        {stats}
        <UpcomingPanel upcoming={snapshot.upcoming} onSelect={onJump} layout="strip" />
        {timeline}
        {exerciseBar}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-screen select-none transition-colors duration-300"
      style={{ backgroundColor: bgColor }}
    >
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-w-0">
          {header}
          {clock}
          {stats}
        </div>
        <UpcomingPanel upcoming={snapshot.upcoming} onSelect={onJump} layout="sidebar" />
      </div>

      {timeline}
      {exerciseBar}
    </div>
  );
}
