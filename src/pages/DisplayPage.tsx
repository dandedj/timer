import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TimerDisplay } from '../components/display/TimerDisplay';
import { useTimerEngine } from '../hooks/useTimerEngine';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useStorage } from '../storage/storageContext';
import type { CompoundTimer } from '../types/timer';

export function DisplayPage() {
  const { timerId } = useParams();
  const navigate = useNavigate();
  const storage = useStorage();
  const [timer, setTimer] = useState<CompoundTimer | null>(null);
  const { snapshot, play, pause, reset, skipForward, skipBack } = useTimerEngine(timer);

  useEffect(() => {
    if (!timerId) {
      navigate('/library');
      return;
    }
    storage.getTimer(timerId).then((t) => {
      if (t) setTimer(t);
      else navigate('/library');
    });
  }, [timerId, storage, navigate]);

  const handleBack = useCallback(() => {
    reset();
    navigate('/library');
  }, [reset, navigate]);

  useKeyboardShortcuts({
    onPlay: play,
    onPause: pause,
    onReset: reset,
    onSkipForward: skipForward,
    onSkipBack: skipBack,
    isRunning: snapshot.status === 'running',
  });

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') handleBack();
      if (e.code === 'KeyF') toggleFullscreen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleBack, toggleFullscreen]);

  if (!timer) return null;

  return (
    <TimerDisplay
      snapshot={snapshot}
      onPlay={play}
      onPause={pause}
      onSkipForward={skipForward}
      onSkipBack={skipBack}
      onBack={handleBack}
    />
  );
}
