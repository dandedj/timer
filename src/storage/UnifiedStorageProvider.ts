import type { IStorageProvider } from '../types/storage';
import type { CompoundTimer } from '../types/timer';
import type { LibraryTimer, SyncStatus } from '../types/sync';
import { LocalStorageProvider, TIMERS_KEY } from './LocalStorageProvider';
import { GoogleDriveStorageProvider } from './GoogleDriveStorageProvider';
import { readMeta, writeMeta } from './syncMetaStore';
import { AuthExpiredError } from '../auth/GoogleAuthProvider';

const META_KEY = 'interval-timer:sync-meta';

export interface UnifiedStorageOptions {
  onStatus?: (status: SyncStatus, lastSyncedAt?: string) => void;
  tryRefresh?: () => Promise<boolean>;
}

/**
 * The single storage provider the whole app reads from. localStorage is the source
 * of truth and is painted on the first frame, connected or not, so the library never
 * flashes empty. Google Drive (when attached) is a background mirror: it merges into
 * the local cache additively and pushes local edits, but a network/auth failure can
 * never blank what is already on screen.
 */
export class UnifiedStorageProvider implements IStorageProvider {
  private local = new LocalStorageProvider();
  private drive: GoogleDriveStorageProvider | null = null;
  private opts: UnifiedStorageOptions;
  private subscribers = new Set<() => void>();
  private cachedSnapshot: LibraryTimer[] | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(opts: UnifiedStorageOptions = {}) {
    this.opts = opts;
    // Re-read the cache when another tab mutates it, so two open tabs stay consistent.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === TIMERS_KEY || e.key === META_KEY) this.notify();
      });
    }
  }

  // ── Connection wiring (called by the connection hook) ──────────────────────

  /** Attach/detach the Drive mirror. Detaching keeps the cached timers visible. */
  setDrive(drive: GoogleDriveStorageProvider | null): void {
    this.drive = drive;
  }

  get connected(): boolean {
    return this.drive !== null;
  }

  // ── UI subscription ────────────────────────────────────────────────────────

  // Arrow fields so identity is stable when passed to useSyncExternalStore.
  subscribe = (cb: () => void): (() => void) => {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  };

  /** Cached, referentially-stable snapshot for useSyncExternalStore (recomputed on notify). */
  getLibrarySnapshot = (): LibraryTimer[] => {
    if (this.cachedSnapshot === null) this.cachedSnapshot = this.computeLibrary();
    return this.cachedSnapshot;
  };

  /** The two-section library view: every cached timer tagged with its origin. */
  listLibrary(): LibraryTimer[] {
    return this.getLibrarySnapshot();
  }

  private computeLibrary(): LibraryTimer[] {
    const meta = readMeta();
    return this.local
      .readAll()
      .filter((t) => !meta[t.id]?.deletedAt)
      .map((t) => ({
        ...t,
        origin: meta[t.id]?.origin ?? 'device',
        dirty: meta[t.id]?.dirty,
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  private notify(): void {
    this.cachedSnapshot = null; // invalidate so the next snapshot reflects the change
    this.subscribers.forEach((cb) => cb());
  }

  // ── IStorageProvider (used by deep-link pages and generic reads) ───────────

  async listTimers(): Promise<CompoundTimer[]> {
    return this.local.listTimers();
  }

  async getTimer(id: string): Promise<CompoundTimer | null> {
    return this.local.getTimer(id);
  }

  async saveTimer(timer: CompoundTimer): Promise<void> {
    return this.run(async () => {
      const existed = this.local.readAll().some((t) => t.id === timer.id);
      // 1. Optimistic local write — instant, offline-safe.
      this.upsertLocal(timer);
      const meta = readMeta();
      const m = meta[timer.id];
      // Origin is sticky: a timer stays where it is once placed. Only a genuinely new
      // timer created while connected defaults to Drive (legacy timers without meta
      // that are merely edited stay on the device until explicitly "Save to Drive").
      const belongsOnDrive = m?.origin === 'drive' || (!existed && this.connected);
      meta[timer.id] = {
        origin: belongsOnDrive ? 'drive' : 'device',
        driveFileId: m?.driveFileId,
        lastSyncedAt: m?.lastSyncedAt,
        dirty: belongsOnDrive ? true : undefined,
      };
      writeMeta(meta);
      this.notify();
      // 2. Background push — serialized on the same chain so two rapid saves can't both
      //    create a Drive file, and it holds the slot for its whole duration (no meta race).
      if (belongsOnDrive && this.drive) {
        void this.run(() => this.pushToDrive(timer));
      }
    });
  }

  async deleteTimer(id: string): Promise<void> {
    return this.run(async () => {
      const meta = readMeta();
      const m = meta[id];
      this.removeLocal(id);
      if (m?.origin === 'drive' && m.driveFileId) {
        // Tombstone so the Drive file is removed (now, or on the next sync if offline).
        meta[id] = { ...m, deletedAt: this.now() };
        writeMeta(meta);
        this.notify();
        if (this.drive) {
          try {
            await this.withRefresh((d) => d.remove(m.driveFileId!));
            this.clearMeta(id);
            this.report('synced', this.now());
          } catch {
            this.report('error');
          }
        }
      } else {
        this.clearMeta(id);
        this.notify();
      }
    });
  }

  // ── Section actions ────────────────────────────────────────────────────────

  /** Move a device-only timer into the Synced-to-Drive section. */
  async promoteToDrive(id: string): Promise<void> {
    return this.run(async () => {
      const timer = await this.local.getTimer(id);
      if (!timer || !this.drive) return;
      const meta = readMeta();
      meta[id] = { ...meta[id], origin: 'drive', dirty: true };
      writeMeta(meta);
      this.notify();
      await this.pushToDrive(timer);
    });
  }

  // ── Sync engine ──────────────────────────────────────────────────────────

  /** Reconcile Drive ↔ local cache. Safe to call repeatedly; serialized internally. */
  async sync(): Promise<void> {
    return this.run(async () => {
      if (!this.drive) return;
      this.report('syncing');
      let result;
      try {
        result = await this.withRefresh((d) => d.listDetailed());
      } catch (e) {
        this.report(this.isOffline(e) ? 'offline' : 'error');
        return;
      }

      const now = this.now();
      const meta = readMeta();
      const localById = new Map(this.local.readAll().map((t) => [t.id, t]));
      const driveById = new Map(result.timers.map((d) => [d.timer.id, d]));
      let changed = false;

      // Phase A — flush local deletions (tombstones) up to Drive.
      for (const [id, m] of Object.entries(meta)) {
        if (!m.deletedAt) continue;
        if (m.driveFileId && driveById.has(id)) {
          try {
            await this.withRefresh((d) => d.remove(m.driveFileId!));
          } catch {
            continue; // retry next sync
          }
        }
        delete meta[id];
        driveById.delete(id);
        changed = true;
      }

      // Phase B — reconcile timers present on Drive.
      for (const [id, d] of driveById) {
        const localT = localById.get(id);
        const m = meta[id];
        // Still tombstoned (its Drive delete failed in Phase A) — never resurrect it.
        if (m?.deletedAt) continue;
        if (localT && m?.dirty && localT.updatedAt >= d.timer.updatedAt) {
          // Local edits are newer → push them.
          try {
            await this.withRefresh((dr) => dr.update(d.driveFileId, localT));
            meta[id] = { origin: 'drive', driveFileId: d.driveFileId, lastSyncedAt: now, dirty: false };
            changed = true;
          } catch {
            // keep dirty; retry next sync
          }
        } else if (!localT || d.timer.updatedAt > localT.updatedAt) {
          // Drive is newer (or new to this device) → pull into the cache.
          localById.set(id, d.timer);
          meta[id] = { origin: 'drive', driveFileId: d.driveFileId, lastSyncedAt: now, dirty: false };
          changed = true;
        } else {
          meta[id] = { origin: 'drive', driveFileId: d.driveFileId, lastSyncedAt: now, dirty: false };
        }
      }

      // Phase C — local 'drive' timers that Drive didn't return.
      for (const t of [...localById.values()]) {
        const m = meta[t.id];
        if (!m || m.origin !== 'drive' || m.deletedAt) continue;
        if (driveById.has(t.id)) continue;
        if (m.dirty || !m.driveFileId) {
          // Never pushed (or edited offline) → (re)create on Drive.
          try {
            const fileId = await this.withRefresh((d) => d.create(t));
            meta[t.id] = { origin: 'drive', driveFileId: fileId, lastSyncedAt: now, dirty: false };
            changed = true;
          } catch {
            // retry next sync
          }
        } else if (result.complete) {
          // Confirmed removed on another device (only trust this when the list was complete).
          localById.delete(t.id);
          delete meta[t.id];
          changed = true;
        }
        // else: incomplete list — keep the timer, never delete on a partial fetch.
      }

      this.local.writeAll([...localById.values()]);
      writeMeta(meta);
      this.report('synced', now);
      if (changed) this.notify();
    });
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async pushToDrive(timer: CompoundTimer): Promise<void> {
    if (!this.drive) return;
    this.report('syncing');
    try {
      const existingFileId = readMeta()[timer.id]?.driveFileId;
      let fileId: string;
      if (existingFileId) {
        await this.withRefresh((d) => d.update(existingFileId, timer));
        fileId = existingFileId;
      } else {
        fileId = await this.withRefresh((d) => d.create(timer));
      }
      // Re-read meta right before writing so we never overwrite a concurrent change.
      const after = readMeta();
      after[timer.id] = {
        ...after[timer.id],
        origin: 'drive',
        driveFileId: fileId,
        dirty: false,
        lastSyncedAt: this.now(),
      };
      writeMeta(after);
      this.report('synced', this.now());
    } catch (e) {
      // Stays dirty; a later sync() retries. Surface why so the pill can explain it.
      this.report(this.isOffline(e) ? 'offline' : 'error');
    }
    this.notify();
  }

  /** Run a Drive op, transparently refreshing the token once on expiry. */
  private async withRefresh<T>(op: (drive: GoogleDriveStorageProvider) => Promise<T>): Promise<T> {
    if (!this.drive) throw new AuthExpiredError();
    try {
      return await op(this.drive);
    } catch (e) {
      if (e instanceof AuthExpiredError && this.opts.tryRefresh) {
        const ok = await this.opts.tryRefresh();
        if (ok && this.drive) return op(this.drive);
      }
      throw e;
    }
  }

  private upsertLocal(timer: CompoundTimer): void {
    const all = this.local.readAll();
    const idx = all.findIndex((t) => t.id === timer.id);
    if (idx >= 0) all[idx] = timer;
    else all.push(timer);
    this.local.writeAll(all);
  }

  private removeLocal(id: string): void {
    this.local.writeAll(this.local.readAll().filter((t) => t.id !== id));
  }

  private clearMeta(id: string): void {
    const meta = readMeta();
    delete meta[id];
    writeMeta(meta);
  }

  /** Serialize all mutating ops so a sync can't clobber a concurrent save. */
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private report(status: SyncStatus, lastSyncedAt?: string): void {
    this.opts.onStatus?.(status, lastSyncedAt);
  }

  private isOffline(e: unknown): boolean {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    return e instanceof TypeError; // fetch network failure
  }

  private now(): string {
    return new Date().toISOString();
  }
}
