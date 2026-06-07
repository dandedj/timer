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
  const dirtyRef = useRef(false);

  useEffect(() => {
    setLoaded(false);
    dirtyRef.current = false;
    setSaveStatus('idle');
    if (timerId) {
      storage.getTimer(timerId).then((t) => {
        if (t) {
          setTimer(t);
          setLoaded(true);
        } else {
          navigate('/library');
        }
      });
    } else {
      setTimer(createEmptyTimer());
      setLoaded(true);
    }
  }, [timerId, storage, navigate]);

  // Mark edits and let the autosave effect persist them.
  const handleChange = useCallback((t: CompoundTimer) => {
    dirtyRef.current = true;
    if (hasContent(t)) setSaveStatus('saving');
    setTimer(t);
  }, []);

  // Debounced autosave — persists as you edit, no Save click needed.
  useEffect(() => {
    if (!loaded || !dirtyRef.current || !hasContent(timer)) return;
    const id = setTimeout(() => {
      saveTimer(timer).then(() => setSaveStatus('saved'));
    }, 700);
    return () => clearTimeout(id);
  }, [timer, loaded, saveTimer]);

  const handleSave = async () => {
    if (hasContent(timer)) await saveTimer(timer);
    navigate('/library');
  };

  const handlePreview = async () => {
    await saveTimer(timer);
    navigate(`/display/${timer.id}`);
  };

  const handleCheatsheet = async () => {
    await saveTimer(timer);
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
      onCancel={() => navigate('/library')}
    />
  );
}
