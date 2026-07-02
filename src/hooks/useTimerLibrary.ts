import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useGoogleConnection } from './useGoogleConnection';
import type { CompoundTimer } from '../types/timer';
import { v4 as uuidv4 } from 'uuid';

export function useTimerLibrary() {
  const { storage, authStatus, isConnected, syncStatus, lastSyncedAt, syncNow } = useGoogleConnection();

  // Subscribe to the local cache. The list grows/updates in place on save, delete,
  // background sync, or a change in another tab — it is never replaced by an async
  // provider swap, so it cannot flash empty.
  const timers = useSyncExternalStore(storage.subscribe, storage.getLibrarySnapshot);

  const deviceTimers = useMemo(() => timers.filter((t) => t.origin === 'device'), [timers]);
  const driveTimers = useMemo(() => timers.filter((t) => t.origin === 'drive'), [timers]);

  // Only ever a true blocking state on a cold start with no cache yet (e.g. a returning
  // Drive user whose local cache was cleared by the old migration) while we restore.
  const loading = authStatus === 'restoring' && timers.length === 0;

  const saveTimer = useCallback(async (timer: CompoundTimer) => {
    const now = new Date().toISOString();
    const toSave: CompoundTimer = {
      ...timer,
      updatedAt: now,
      createdAt: timer.createdAt || now,
      id: timer.id || uuidv4(),
    };
    await storage.saveTimer(toSave);
    return toSave;
  }, [storage]);

  const deleteTimer = useCallback((id: string) => storage.deleteTimer(id), [storage]);

  const promoteToDrive = useCallback((id: string) => storage.promoteToDrive(id), [storage]);

  return {
    timers,
    deviceTimers,
    driveTimers,
    loading,
    isConnected,
    syncStatus,
    lastSyncedAt,
    syncNow,
    saveTimer,
    deleteTimer,
    promoteToDrive,
  };
}
