import type { CompoundTimer } from './timer';

/**
 * Where a timer lives. 'device' = browser localStorage only. 'drive' = mirrored
 * to the user's Google Drive (and cached locally). This is derived metadata kept
 * in a side-table, NEVER serialized into the timer JSON (it is device-local and
 * would be meaningless once a file syncs to another device).
 */
export type TimerOrigin = 'device' | 'drive';

/** Per-timer sync bookkeeping, stored under `interval-timer:sync-meta`. */
export interface SyncMeta {
  origin: TimerOrigin;
  /** Google Drive file id for 'drive' timers. Absent for 'device' timers. */
  driveFileId?: string;
  /** ISO timestamp of the last successful push/pull for this timer. */
  lastSyncedAt?: string;
  /** Local edit that has not yet been pushed to Drive. */
  dirty?: boolean;
  /** Tombstone: a 'drive' timer was deleted locally and the Drive file still needs removing. */
  deletedAt?: string;
}

export type SyncMetaMap = Record<string, SyncMeta>;

/** Overall connection lifecycle, resolved before the Drive section commits to a state. */
export type AuthStatus = 'restoring' | 'connected' | 'local';

/** Background sync state surfaced to the user as a status pill. */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

/** A timer plus its (in-memory only) location, for rendering the two library sections. */
export type LibraryTimer = CompoundTimer & { origin: TimerOrigin; dirty?: boolean };
