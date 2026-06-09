import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { TimerBuilder } from '../components/builder/TimerBuilder';
import { useTimerLibrary } from '../hooks/useTimerLibrary';
import { useStorage } from '../storage/storageContext';
import type { CompoundTimer } from '../types/timer';
import { colorForIndex } from '../engine/colorPalette';

type SaveStatus = 'idle' | 'saving' | 'saved';

function hasContent(timer: CompoundTimer): boolean {
  return timer.name.trim() !== '' ||
    timer.circuits.some((c) => c.exercises.some((e) => e.name.trim() !== ''));
}

function createEmptyTimer(): CompoundTimer {
  return {
    id: uuidv4(),
    name: '',
    warmupSeconds: 600,
    circuits: [
      {
        id: uuidv4(),
        name: 'Circuit 1',
        exercises: [
          { id: uuidv4(), name: '', durationSeconds: 30, color: colorForIndex(0) },
        ],
        restBetweenExercisesSeconds: 10,
        sets: 1,
        restBetweenCircuitsSeconds: 30,
      },
    ],
    createdAt: '',
    updatedAt: '',
  };
}

export function BuilderPage() {
  const { timerId } = useParams();
  const navigate = useNavigate();
  const { saveTimer } = useTimerLibrary();
  const storage = useStorage();
  const [timer, setTimer] = useState<CompoundTimer>(() => createEmptyTimer());
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  // Latest edits and whether they are persisted yet — refs so the flush paths
  // (unmount, navigation, beforeunload) always see the current state.
  const timerRef = useRef(timer);
  const pendingRef = useRef(false);

  // Persist any not-yet-saved edits immediately. Safe to call from anywhere; no-op when clean.
  const flushSave = useCallback(async () => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    const t = timerRef.current;
    if (!hasContent(t)) return;
    await saveTimer(t);
    // A newer edit may have arrived while the save was in flight — stay on 'saving' then.
    if (!pendingRef.current) setSaveStatus('saved');
  }, [saveTimer]);

  useEffect(() => {
    // Flush edits to a previously loaded timer before switching.
    void flushSave();
    setLoaded(false);
    setSaveStatus('idle');
    if (timerId) {
      storage.getTimer(timerId).then((t) => {
        if (t) {
          timerRef.current = t;
          setTimer(t);
          setLoaded(true);
        } else {
          navigate('/library');
        }
      });
    } else {
      const t = createEmptyTimer();
      timerRef.current = t;
      setTimer(t);
      setLoaded(true);
    }
  }, [timerId, storage, navigate, flushSave]);

  // Mark edits and let the autosave effect persist them.
  const handleChange = useCallback((t: CompoundTimer) => {
    pendingRef.current = true;
    timerRef.current = t;
    if (hasContent(t)) setSaveStatus('saving');
    setTimer(t);
  }, []);

  // Debounced autosave — persists as you edit, no Save click needed.
  useEffect(() => {
    if (!loaded || !pendingRef.current || !hasContent(timer)) return;
    const id = setTimeout(() => {
      void flushSave();
    }, 700);
    return () => clearTimeout(id);
  }, [timer, loaded, flushSave]);

  // Leaving the builder (X, back button, route change) must never drop the last edits.
  useEffect(() => {
    return () => {
      void flushSave();
    };
  }, [flushSave]);

  // Closing, reloading, or backgrounding the tab persists pending edits instead of
  // warning: the local write inside saveTimer completes synchronously, so it lands
  // even while the page is being torn down. pagehide covers iOS Safari/PWA, where
  // beforeunload is unreliable.
  useEffect(() => {
    const handler = () => {
      void flushSave();
    };
    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
    };
  }, [flushSave]);

  const handleSave = async () => {
    if (hasContent(timer)) {
      pendingRef.current = false;
      await saveTimer(timer);
      setSaveStatus('saved');
    }
    navigate('/library');
  };

  const handleCancel = async () => {
    await flushSave();
    navigate('/library');
  };

  const handlePreview = async () => {
    pendingRef.current = false;
    await saveTimer(timer);
    setSaveStatus('saved');
    navigate(`/display/${timer.id}`);
  };

  const handleCheatsheet = async () => {
    pendingRef.current = false;
    await saveTimer(timer);
    setSaveStatus('saved');
    navigate(`/cheatsheet/${timer.id}`);
  };

  if (!loaded) return null;

  return (
    <TimerBuilder
      timer={timer}
      onChange={handleChange}
      saveStatus={saveStatus}
      onSave={handleSave}
      onPreview={handlePreview}
      onCheatsheet={handleCheatsheet}
      onCancel={handleCancel}
    />
  );
}
