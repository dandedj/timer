import { useState } from 'react';
import { TimerLibrary } from '../components/library/TimerLibrary';
import { useTimerLibrary } from '../hooks/useTimerLibrary';

export function LibraryPage() {
  const { timers, loading, duplicateTimer, deleteTimer } = useTimerLibrary();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (deleteConfirm === id) {
      await deleteTimer(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  return (
    <TimerLibrary
      timers={timers}
      loading={loading}
      onDuplicate={duplicateTimer}
      onDelete={handleDelete}
    />
  );
}
