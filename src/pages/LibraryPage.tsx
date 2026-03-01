import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TimerLibrary } from '../components/library/TimerLibrary';
import { useTimerLibrary } from '../hooks/useTimerLibrary';
import { useGoogleConnection } from '../hooks/useGoogleConnection';
import { LocalStorageProvider } from '../storage/LocalStorageProvider';
import type { CompoundTimer } from '../types/timer';

const MIGRATION_DISMISSED_KEY = 'google-drive:migration-dismissed';

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
  const { timers, loading, duplicateTimer, deleteTimer, saveTimer, refresh } = useTimerLibrary();
  const { isConnected, storageProvider } = useGoogleConnection();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Migration state
  const [localTimers, setLocalTimers] = useState<CompoundTimer[]>([]);
  const [migrating, setMigrating] = useState(false);
  const [migrationDismissed, setMigrationDismissed] = useState(
    () => localStorage.getItem(MIGRATION_DISMISSED_KEY) === 'true'
  );

  // Check for local timers when connected to Drive
  useEffect(() => {
    if (isConnected && !migrationDismissed) {
      const local = new LocalStorageProvider();
      local.listTimers().then(setLocalTimers);
    } else {
      setLocalTimers([]);
    }
  }, [isConnected, migrationDismissed]);

  const handleMigrate = useCallback(async () => {
    setMigrating(true);
    try {
      for (const timer of localTimers) {
        await storageProvider.saveTimer(timer);
      }
      // Clear local storage after successful upload
      const local = new LocalStorageProvider();
      for (const timer of localTimers) {
        await local.deleteTimer(timer.id);
      }
      setLocalTimers([]);
      setMigrationDismissed(true);
      localStorage.setItem(MIGRATION_DISMISSED_KEY, 'true');
      await refresh();
    } catch (err) {
      console.error('Migration failed:', err);
    } finally {
      setMigrating(false);
    }
  }, [localTimers, storageProvider, refresh]);

  const handleDismissMigration = useCallback(() => {
    setMigrationDismissed(true);
    localStorage.setItem(MIGRATION_DISMISSED_KEY, 'true');
  }, []);

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
      const timer = parseTimerFile(text);
      await saveTimer(timer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import file';
      setImportError(msg);
      setTimeout(() => setImportError(null), 5000);
    }
  };

  const showMigration = isConnected && !migrationDismissed && localTimers.length > 0;

  return (
    <TimerLibrary
      timers={timers}
      loading={loading}
      onDuplicate={duplicateTimer}
      onDelete={handleDelete}
      onImport={handleImport}
      importError={importError}
      deleteConfirmId={deleteConfirm}
      isCloudConnected={isConnected}
      migration={showMigration ? {
        localCount: localTimers.length,
        migrating,
        onMigrate: handleMigrate,
        onDismiss: handleDismissMigration,
      } : null}
    />
  );
}
