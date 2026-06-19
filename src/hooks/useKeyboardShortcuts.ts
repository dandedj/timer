import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
  onPlay?: () => void;
  onPause?: () => void;
  /** Reset is requested, not performed — the caller confirms while running. */
  onResetRequest?: () => void;
  onSkipForward?: () => void;
  onSkipBack?: () => void;
  /** Step back to the previous exercise (skips rests). Bound to Shift+Left. */
  onPreviousExercise?: () => void;
  isRunning?: boolean;
  /** Set false to suspend all shortcuts (e.g. while a dialog is open). */
  enabled?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

export function useKeyboardShortcuts({ onPlay, onPause, onResetRequest, onSkipForward, onSkipBack, onPreviousExercise, isRunning, enabled = true }: KeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isRunning) {
          onPause?.();
        } else {
          onPlay?.();
        }
      } else if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onResetRequest?.();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onSkipForward?.();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (e.shiftKey) onPreviousExercise?.();
        else onSkipBack?.();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPlay, onPause, onResetRequest, onSkipForward, onSkipBack, onPreviousExercise, isRunning, enabled]);
}
