import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TimerDisplay } from '../components/display/TimerDisplay';
import { ConfirmDialog } from '../components/display/ConfirmDialog';
import { useTimerEngine } from '../hooks/useTimerEngine';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useWakeLock } from '../hooks/useWakeLock';
import { useStorage } from '../storage/storageContext';
import { readResume, writeResume, clearResume } from '../engine/resumeStore';
import type { ResumeSnapshot } from '../engine/resumeStore';
import type { CompoundTimer } from '../types/timer';

const RESUME_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const RESUME_SAVE_INTERVAL_MS = 2000;

type ConfirmAction = 'leave' | 'reset';

export function DisplayPage() {
  const { timerId } = useParams();
  const navigate = useNavigate();
  const storage = useStorage();
  const [timer, setTimer] = useState<CompoundTimer | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  // Offer to resume an interrupted class (reload, crash) while still idle.
  const [resumeOffer, setResumeOffer] = useState<ResumeSnapshot | null>(() => {
    if (!timerId) return null;
    const saved = readResume();
    const fresh = saved && saved.timerId === timerId && Date.now() - saved.savedAt < RESUME_MAX_AGE_MS;
    return fresh ? saved : null;
  });
  const lastResumeSaveRef = useRef(0);
  const { snapshot, play, pause, reset, skipForward, skipBack, jumpTo, restore, setVolume, previewBeep } = useTimerEngine(timer);
  const isRunning = snapshot.status === 'running';

  useWakeLock(isRunning);

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

  // Persist the running position at most every 2 seconds.
  useEffect(() => {
    if (!timerId || snapshot.status !== 'running') return;
    const now = Date.now();
    if (now - lastResumeSaveRef.current < RESUME_SAVE_INTERVAL_MS) return;
    lastResumeSaveRef.current = now;
    writeResume({
      timerId,
      currentIndex: snapshot.currentIndex,
      secondsRemaining: snapshot.secondsRemaining,
      label: snapshot.current?.label ?? '',
      savedAt: now,
    });
  }, [snapshot, timerId]);

  useEffect(() => {
    if (snapshot.status === 'finished') clearResume();
  }, [snapshot.status]);

  // Starting playback any way other than the Resume button retires the offer for
  // good — otherwise a later reset back to idle would resurface a stale banner.
  const handlePlay = useCallback(() => {
    setResumeOffer(null);
    play();
  }, [play]);

  const leave = useCallback(() => {
    // An explicit exit ends the class; don't offer to resume it on the next open.
    clearResume();
    reset();
    navigate('/library');
  }, [reset, navigate]);

  const handleBack = useCallback(() => {
    if (isRunning) setConfirmAction('leave');
    else leave();
  }, [isRunning, leave]);

  const handleResetRequest = useCallback(() => {
    if (isRunning) {
      setConfirmAction('reset');
    } else {
      clearResume();
      reset();
    }
  }, [isRunning, reset]);

  const handleConfirm = useCallback(() => {
    clearResume();
    if (confirmAction === 'leave') leave();
    else if (confirmAction === 'reset') reset();
    setConfirmAction(null);
  }, [confirmAction, leave, reset]);

  const handleConfirmCancel = useCallback(() => setConfirmAction(null), []);

  const handleResume = useCallback(() => {
    if (!resumeOffer) return;
    restore(resumeOffer.currentIndex, resumeOffer.secondsRemaining);
    // The Resume tap is also the gesture that unlocks audio.
    play();
    setResumeOffer(null);
  }, [resumeOffer, restore, play]);

  const handleResumeDismiss = useCallback(() => {
    clearResume();
    setResumeOffer(null);
  }, []);

  useKeyboardShortcuts({
    onPlay: handlePlay,
    onPause: pause,
    onResetRequest: handleResetRequest,
    onSkipForward: skipForward,
    onSkipBack: skipBack,
    isRunning,
    enabled: confirmAction === null,
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
      if (e.code === 'Escape') {
        // Escape's only job while fullscreen is exiting fullscreen.
        if (document.fullscreenElement) {
          document.exitFullscreen();
          return;
        }
        if (confirmAction) return; // ConfirmDialog handles Escape itself
        handleBack();
      }
      if (e.code === 'KeyF' && !e.metaKey && !e.ctrlKey && !e.altKey) toggleFullscreen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleBack, toggleFullscreen, confirmAction]);

  if (!timer) return null;

  return (
    <>
      <TimerDisplay
        snapshot={snapshot}
        onPlay={handlePlay}
        onPause={pause}
        onSkipForward={skipForward}
        onSkipBack={skipBack}
        onJump={jumpTo}
        onReset={handleResetRequest}
        onVolumeChange={setVolume}
        onVolumePreview={previewBeep}
        onBack={handleBack}
      />
      {resumeOffer && snapshot.status === 'idle' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl bg-[#1a1a2e]/95 px-4 py-3 shadow-2xl ring-1 ring-white/15">
          <span className="text-white text-sm font-medium">
            Resume at {resumeOffer.label ? `“${resumeOffer.label}”` : 'where you left off'}?
          </span>
          <button
            type="button"
            onClick={handleResume}
            className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={handleResumeDismiss}
            className="px-3 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-sm font-medium transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
      {confirmAction && (
        <ConfirmDialog
          message={confirmAction === 'leave' ? 'Leave workout?' : 'Restart from the beginning?'}
          confirmLabel={confirmAction === 'leave' ? 'Leave' : 'Restart'}
          onConfirm={handleConfirm}
          onCancel={handleConfirmCancel}
        />
      )}
    </>
  );
}
