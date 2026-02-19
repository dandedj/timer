import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
  onPlay?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  onSkipForward?: () => void;
  onSkipBack?: () => void;
  isRunning?: boolean;
}

export function useKeyboardShortcuts({ onPlay, onPause, onReset, onSkipForward, onSkipBack, isRunning }: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isRunning) {
          onPause?.();
        } else {
          onPlay?.();
        }
      } else if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onReset?.();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onSkipForward?.();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onSkipBack?.();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPlay, onPause, onReset, onSkipForward, onSkipBack, isRunning]);
}
