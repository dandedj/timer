import { useState, useEffect, useCallback } from 'react';
import { useStorage } from '../storage/storageContext';
import type { CompoundTimer } from '../types/timer';
import { v4 as uuidv4 } from 'uuid';

export function useTimerLibrary() {
  const storage = useStorage();
  const [timers, setTimers] = useState<CompoundTimer[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setTimers(await storage.listTimers());
    setLoading(false);
  }, [storage]);

  useEffect(() => { refresh(); }, [refresh]);

  const saveTimer = useCallback(async (timer: CompoundTimer) => {
    const now = new Date().toISOString();
    const toSave: CompoundTimer = {
      ...timer,
      updatedAt: now,
      createdAt: timer.createdAt || now,
      id: timer.id || uuidv4(),
    };
    await storage.saveTimer(toSave);
    await refresh();
    return toSave;
  }, [storage, refresh]);

  const deleteTimer = useCallback(async (id: string) => {
    await storage.deleteTimer(id);
    await refresh();
  }, [storage, refresh]);

  const duplicateTimer = useCallback(async (id: string) => {
    const original = await storage.getTimer(id);
    if (!original) return;
    const copy: CompoundTimer = {
      ...original,
      id: uuidv4(),
      name: `${original.name} (copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      circuits: original.circuits.map(c => ({
        ...c,
        id: uuidv4(),
        exercises: c.exercises.map(e => ({ ...e, id: uuidv4() })),
      })),
    };
    await storage.saveTimer(copy);
    await refresh();
    return copy;
  }, [storage, refresh]);

  return { timers, loading, saveTimer, deleteTimer, duplicateTimer, refresh };
}
