import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TimerLibrary, type ImportResult } from '../components/library/TimerLibrary';
import { UndoToast } from '../components/library/UndoToast';
import { useTimerLibrary } from '../hooks/useTimerLibrary';
import { useGoogleConnection } from '../hooks/useGoogleConnection';
import { parseImportAll, isFailedImport, type ImportEntry } from '../import/parseImport';
import { isLikelyUrl, fetchTimerText } from '../import/importFromUrl';
import type { CompoundTimer } from '../types/timer';

/** How long a confirmed delete stays undoable before it commits (also to Drive). */
const UNDO_DELETE_MS = 8000;

export function LibraryPage() {
  const {
    timers, deviceTimers, driveTimers, loading, isConnected, syncStatus, lastSyncedAt,
    syncNow, deleteTimer, saveTimer, promoteToDrive,
  } = useTimerLibrary();
  const { authStatus, driveAvailable, connecting, connect } = useGoogleConnection();
  const navigate = useNavigate();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const pendingDeleteRef = useRef<{ id: string; timeout: ReturnType<typeof setTimeout> } | null>(null);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [importing, setImporting] = useState(false);

  // Commit the pending delete now — on toast expiry, when a newer delete starts, or on unmount.
  const commitPendingDelete = useCallback(() => {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    clearTimeout(pending.timeout);
    pendingDeleteRef.current = null;
    setPendingDelete(null);
    void deleteTimer(pending.id);
  }, [deleteTimer]);

  const undoDelete = useCallback(() => {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    clearTimeout(pending.timeout);
    pendingDeleteRef.current = null;
    setPendingDelete(null);
  }, []);

  // A delete still pending when the page unmounts must not be lost — flush it.
  useEffect(() => () => commitPendingDelete(), [commitPendingDelete]);

  // Tab close / reload / PWA discard during the undo window must also commit, or the
  // "deleted" timer resurrects on the next launch. deleteTimer's local removal and
  // tombstone are synchronous, so they persist even mid-unload. pagehide covers iOS
  // Safari/PWA, where beforeunload is unreliable.
  useEffect(() => {
    window.addEventListener('pagehide', commitPendingDelete);
    window.addEventListener('beforeunload', commitPendingDelete);
    return () => {
      window.removeEventListener('pagehide', commitPendingDelete);
      window.removeEventListener('beforeunload', commitPendingDelete);
    };
  }, [commitPendingDelete]);

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      setDeleteConfirm(null);
      // Deferred delete: hide the timer immediately, commit only after the undo window.
      commitPendingDelete();
      const name = timers.find((t) => t.id === id)?.name || 'Timer';
      const timeout = setTimeout(commitPendingDelete, UNDO_DELETE_MS);
      pendingDeleteRef.current = { id, timeout };
      setPendingDelete({ id, name });
    } else {
      setDeleteConfirm(id);
      // Disarm only this timer's confirmation — never a newer one on another timer.
      setTimeout(() => setDeleteConfirm((cur) => (cur === id ? null : cur)), 3000);
    }
  };

  // Hide the pending-delete timer from every list until it commits or is undone.
  const pendingId = pendingDelete?.id ?? null;
  const visibleTimers = useMemo(
    () => (pendingId ? timers.filter((t) => t.id !== pendingId) : timers),
    [timers, pendingId]
  );
  const visibleDeviceTimers = useMemo(
    () => (pendingId ? deviceTimers.filter((t) => t.id !== pendingId) : deviceTimers),
    [deviceTimers, pendingId]
  );
  const visibleDriveTimers = useMemo(
    () => (pendingId ? driveTimers.filter((t) => t.id !== pendingId) : driveTimers),
    [driveTimers, pendingId]
  );

  // Import every timer the text contains, reporting each outcome individually.
  const importAll = useCallback(async (text: string, label: string): Promise<ImportResult[]> => {
    let parsed: ImportEntry[];
    try {
      parsed = parseImportAll(text);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'could not be read.';
      return [{ name: label, ok: false, message: reason }];
    }
    const results: ImportResult[] = [];
    for (const entry of parsed) {
      if (isFailedImport(entry)) {
        results.push({ name: entry.name, ok: false, message: entry.error });
        continue;
      }
      const { timer, warnings } = entry;
      try {
        await saveTimer(timer);
        results.push({ name: timer.name || label, ok: true, warnings });
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'could not be saved.';
        results.push({ name: timer.name || label, ok: false, message: reason });
      }
    }
    return results;
  }, [saveTimer]);

  // A copy exists to be built on — save it, then open it in the builder.
  const handleCopy = useCallback(async (copy: CompoundTimer) => {
    try {
      const saved = await saveTimer(copy);
      navigate(`/builder/${saved.id}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'it could not be saved.';
      window.alert(`The copy was not created — ${reason}`);
    }
  }, [saveTimer, navigate]);

  const handleImportFiles = useCallback(async (files: File[]) => {
    const results: ImportResult[] = [];
    for (const file of files) {
      const text = await file.text().catch(() => '');
      results.push(...(await importAll(text, file.name)));
    }
    setImportResults(results);
  }, [importAll]);

  const handleImportText = useCallback(async (text: string) => {
    // A pasted link → fetch the timer file (e.g. an intervaltimer.com shared timer).
    if (isLikelyUrl(text)) {
      const label = text.trim();
      setImporting(true);
      try {
        const body = await fetchTimerText(label);
        setImportResults(await importAll(body, label));
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'could not be fetched.';
        setImportResults([{ name: label, ok: false, message: reason }]);
      } finally {
        setImporting(false);
      }
      return;
    }
    setImportResults(await importAll(text, 'Pasted timer'));
  }, [importAll]);

  return (
    <>
      <TimerLibrary
        timers={visibleTimers}
        deviceTimers={visibleDeviceTimers}
        driveTimers={visibleDriveTimers}
        loading={loading}
        driveAvailable={driveAvailable}
        isConnected={isConnected}
        authStatus={authStatus}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        connecting={connecting}
        onConnect={connect}
        onSyncNow={syncNow}
        onCopy={handleCopy}
        onDelete={handleDelete}
        onPromote={promoteToDrive}
        deleteConfirmId={deleteConfirm}
        onImportFiles={handleImportFiles}
        onImportText={handleImportText}
        importing={importing}
        importResults={importResults}
        onDismissResults={() => setImportResults(null)}
      />
      {pendingDelete && (
        <UndoToast message={`Deleted “${pendingDelete.name}”`} onUndo={undoDelete} />
      )}
    </>
  );
}
