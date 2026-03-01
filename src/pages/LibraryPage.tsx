import { useState } from 'react';
import { TimerLibrary } from '../components/library/TimerLibrary';
import { useTimerLibrary } from '../hooks/useTimerLibrary';
import { parseSecondsProFile } from '../import/secondsProParser';

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
      const timer = parseSecondsProFile(text);
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
