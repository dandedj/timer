import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TimerLibrary } from '../components/library/TimerLibrary';
import { useTimerLibrary } from '../hooks/useTimerLibrary';
import { parseSecondsProFile } from '../import/secondsProParser';
import type { CompoundTimer } from '../types/timer';

function parseTimerFile(text: string): CompoundTimer {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid .timer file: could not parse JSON.');
  }
  const timer = raw as CompoundTimer;
  if (!timer.name || !Array.isArray(timer.circuits)) {
    throw new Error('Invalid .timer file: missing name or circuits.');
  }
  const now = new Date().toISOString();
  return { ...timer, id: uuidv4(), createdAt: now, updatedAt: now };
}

export function LibraryPage() {
  const { timers, loading, duplicateTimer, deleteTimer, saveTimer } = useTimerLibrary();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (deleteConfirm === id) {
      await deleteTimer(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const timer = file.name.endsWith('.timer')
        ? parseTimerFile(text)
        : parseSecondsProFile(text);
      await saveTimer(timer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import file';
      setImportError(msg);
      setTimeout(() => setImportError(null), 5000);
    }
  };

  return (
    <TimerLibrary
      timers={timers}
      loading={loading}
      onDuplicate={duplicateTimer}
      onDelete={handleDelete}
      onImport={handleImport}
      importError={importError}
      deleteConfirmId={deleteConfirm}
    />
  );
}
