import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { TimerBuilder } from '../components/builder/TimerBuilder';
import { useTimerLibrary } from '../hooks/useTimerLibrary';
import { useStorage } from '../storage/storageContext';
import type { CompoundTimer } from '../types/timer';
import { colorForIndex } from '../engine/colorPalette';

function createEmptyTimer(): CompoundTimer {
  return {
    id: uuidv4(),
    name: '',
    circuits: [
      {
        id: uuidv4(),
        name: 'Circuit 1',
        exercises: [
          { id: uuidv4(), name: '', durationSeconds: 30, color: colorForIndex(0) },
        ],
        restBetweenExercisesSeconds: 10,
        sets: 1,
        restBetweenCircuitsSeconds: 15,
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

  useEffect(() => {
    setLoaded(false);
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

  const handleSave = async () => {
    await saveTimer(timer);
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
      onChange={setTimer}
      onSave={handleSave}
      onPreview={handlePreview}
      onCheatsheet={handleCheatsheet}
      onCancel={() => navigate('/library')}
    />
  );
}
