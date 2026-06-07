import { useState, useCallback } from 'react';
import { TimerLibrary, type ImportResult } from '../components/library/TimerLibrary';
import { useTimerLibrary } from '../hooks/useTimerLibrary';
import { useGoogleConnection } from '../hooks/useGoogleConnection';
import { parseImport } from '../import/parseImport';

export function LibraryPage() {
  const {
    deviceTimers, driveTimers, loading, isConnected, syncStatus, lastSyncedAt,
    syncNow, duplicateTimer, deleteTimer, saveTimer, promoteToDrive,
  } = useTimerLibrary();
  const { authStatus, driveAvailable, connecting, connect } = useGoogleConnection();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);

  const handleDelete = async (id: string) => {
    if (deleteConfirm === id) {
      await deleteTimer(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const importOne = useCallback(async (text: string, label: string): Promise<ImportResult> => {
    try {
      const timer = parseImport(text);
      await saveTimer(timer);
      return { name: timer.name || label, ok: true };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'could not be read.';
      return { name: label, ok: false, message: reason };
    }
  }, [saveTimer]);

  const handleImportFiles = useCallback(async (files: File[]) => {
    const results: ImportResult[] = [];
    for (const file of files) {
      const text = await file.text().catch(() => '');
      results.push(await importOne(text, file.name));
    }
    setImportResults(results);
  }, [importOne]);

  const handleImportText = useCallback(async (text: string) => {
    setImportResults([await importOne(text, 'Pasted timer')]);
  }, [importOne]);

  return (
    <TimerLibrary
      deviceTimers={deviceTimers}
      driveTimers={driveTimers}
      loading={loading}
      driveAvailable={driveAvailable}
      isConnected={isConnected}
      authStatus={authStatus}
      syncStatus={syncStatus}
      lastSyncedAt={lastSyncedAt}
      connecting={connecting}
      onConnect={connect}
      onSyncNow={syncNow}
      onDuplicate={duplicateTimer}
      onDelete={handleDelete}
      onPromote={promoteToDrive}
      deleteConfirmId={deleteConfirm}
      onImportFiles={handleImportFiles}
      onImportText={handleImportText}
      importResults={importResults}
      onDismissResults={() => setImportResults(null)}
    />
  );
}
