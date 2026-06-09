import { v4 as uuidv4 } from 'uuid';
import type { IStorageProvider } from '../types/storage';
import type { CompoundTimer } from '../types/timer';
import type { LibraryTimer, SyncStatus } from '../types/sync';
import { LocalStorageProvider, TIMERS_KEY } from './LocalStorageProvider';
import { GoogleDriveStorageProvider } from './GoogleDriveStorageProvider';
import { readMeta, writeMeta } from './syncMetaStore';
import { AuthExpiredError } from '../auth/GoogleAuthProvider';

const META_KEY = 'interval-timer:sync-meta';
const ACCOUNT_KEY = 'interval-timer:drive-account';

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
  /** True only when the connected Drive is confirmed to be the adopted account. While
   *  false, a timer missing from a Drive listing must never be treated as deleted. */
  private accountVerified = false;
  /** Bumped on every setDrive. In-flight Drive work captured under an older generation
   *  must abandon its write-backs — they were decided against a connection (and meta
   *  state) that no longer exists, e.g. after an account switch demoted everything. */
  private generation = 0;

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

  /** Attach/detach the Drive mirror. Detaching keeps the cached timers visible.
   *  `accountId` identifies the Google account; connecting a different account than the
   *  one this library was synced with re-homes the drive timers to the device instead of
   *  letting a sync against the wrong Drive delete them. Unknown (null/undefined) means
   *  neither adopt nor demote — sync still runs, but never treats absence as deletion. */
  setDrive(drive: GoogleDriveStorageProvider | null, accountId?: string | null): void {
    this.drive = drive;
    this.generation++;
    if (!drive || accountId == null) {
      this.accountVerified = false;
      return;
    }
    const stored = localStorage.getItem(ACCOUNT_KEY);
    if (stored !== null && stored !== accountId) {
      this.demoteDriveTimers();
    } else if (stored === null && this.hasDriveMeta()) {
      // A library synced before account tracking existed: we can't know which account
      // it belongs to, so demote rather than adopt blindly. If this IS the right
      // account, the first sync's listing re-homes every timer to Drive unchanged;
      // if it's the wrong one, nothing gets deleted.
      this.demoteDriveTimers();
    }
    localStorage.setItem(ACCOUNT_KEY, accountId);
    this.accountVerified = true;
  }

  private hasDriveMeta(): boolean {
    return Object.values(readMeta()).some((m) => m.origin === 'drive' && m.driveFileId);
  }

  /** A different Google account connected: its Drive has none of these files, so move
   *  every drive timer to the device section rather than risking their deletion. */
  private demoteDriveTimers(): void {
    const meta = readMeta();
    let changed = false;
    for (const [id, m] of Object.entries(meta)) {
      if (m.origin !== 'drive') continue;
      // Tombstones keep their file id: if this turns out to be the right account after
      // all, Phase A can still flush the delete (a foreign account's listing can never
      // contain the id, so the file is only ever removed where it actually lives).
      // Live entries keep dirty AND driveUpdatedAt so a re-homing sync still pushes
      // unpushed edits — or forks a conflict — instead of silently pulling over them.
      meta[id] = m.deletedAt
        ? { origin: m.origin, deletedAt: m.deletedAt, driveFileId: m.driveFileId }
        : { origin: 'device', dirty: m.dirty, driveUpdatedAt: m.driveUpdatedAt };
      changed = true;
    }
    if (changed) {
      writeMeta(meta);
      this.notify();
    }
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

  // saveTimer/deleteTimer persist locally SYNCHRONOUSLY — never behind the serialized
  // chain, where a stalled Drive call could leave an edit unpersisted for minutes and
  // lose it with the tab. Only the Drive I/O itself rides the chain.

  async saveTimer(timer: CompoundTimer): Promise<void> {
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
      driveUpdatedAt: m?.driveUpdatedAt,
      lastSyncedAt: m?.lastSyncedAt,
      dirty: belongsOnDrive ? true : undefined,
    };
    writeMeta(meta);
    this.notify();
    // 2. Background push — serialized on the chain so two rapid saves can't both create
    //    a Drive file (the second push re-reads meta and sees the first one's file id).
    if (belongsOnDrive && this.drive) {
      const gen = this.generation;
      void this.run(() => this.pushToDrive(timer, gen));
    }
  }

  async deleteTimer(id: string): Promise<void> {
    const meta = readMeta();
    const m = meta[id];
    this.removeLocal(id);
    if (m?.origin === 'drive' && m.driveFileId) {
      // Tombstone so the Drive file is removed (now, or on the next sync if offline).
      meta[id] = { ...m, deletedAt: this.now() };
      writeMeta(meta);
      this.notify();
      if (this.drive) {
        const gen = this.generation;
        void this.run(async () => {
          // The connection changed while queued (account switch/disconnect): the
          // tombstone no longer points at this Drive — leave it for the next sync.
          if (gen !== this.generation) return;
          // A re-save of the same id while this waited on the chain cancels the
          // tombstone (the live file is wanted again) — never remove it then.
          const cur = readMeta()[id];
          if (!cur?.deletedAt || cur.driveFileId !== m.driveFileId) return;
          try {
            await this.withRefresh((d) => d.remove(m.driveFileId!));
            // Same recheck after the await: if a re-save landed mid-remove, keep its
            // meta — the trashed file makes its push fail dirty, and the next sync's
            // Phase C recreates the file, so the re-created timer self-heals.
            const after = readMeta()[id];
            if (after?.deletedAt && after.driveFileId === m.driveFileId) this.clearMeta(id);
            this.report('synced', this.now());
          } catch (e) {
            this.report(this.isOffline(e) ? 'offline' : 'error');
          }
        });
      }
    } else {
      this.clearMeta(id);
      this.notify();
    }
  }

  // ── Section actions ────────────────────────────────────────────────────────

  /** Move a device-only timer into the Synced-to-Drive section. The re-homing is
   *  recorded locally even when Drive is unreachable (expired session, offline) —
   *  the dirty flag makes the next sync's Phase C create the file. */
  async promoteToDrive(id: string): Promise<void> {
    const timer = this.local.readAll().find((t) => t.id === id);
    if (!timer) return;
    const meta = readMeta();
    meta[id] = { ...meta[id], origin: 'drive', dirty: true };
    writeMeta(meta);
    this.notify();
    if (this.drive) {
      const gen = this.generation;
      await this.run(() => this.pushToDrive(timer, gen));
    }
  }

  // ── Sync engine ──────────────────────────────────────────────────────────

  /** Reconcile Drive ↔ local cache. Safe to call repeatedly; serialized internally. */
  async sync(): Promise<void> {
    return this.run(async () => {
      if (!this.drive) return;
      const gen = this.generation;
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
      // Tombstones as of this snapshot: the merge below must distinguish a tombstone
      // this sync flushed (apply our deletion) from one a mid-sync delete just wrote
      // (preserve it). `meta` is mutated in place by the phases, so capture now.
      const tombstonesBefore = new Map(
        Object.entries(meta)
          .filter(([, m]) => m.deletedAt)
          .map(([id, m]) => [id, m.deletedAt])
      );
      const localById = new Map(this.local.readAll().map((t) => [t.id, t]));
      const driveById = new Map(result.timers.map((d) => [d.timer.id, d]));
      // Saves are NOT serialized behind this sync, so localStorage can move while we
      // await Drive. Record per-id deltas and merge them onto the LIVE state at
      // write-back time — never rewrite the whole blob from the stale snapshot.
      const upserts = new Map<string, CompoundTimer>();
      const removals = new Set<string>();
      const metaDelta = new Set<string>(); // ids whose meta entry this sync changed
      // The local updatedAt each upsert/removal decision was based on. If the live
      // copy has moved past it by write-back time, that id's decision is stale and
      // must be skipped (it gets re-reconciled next sync).
      const basis = new Map<string, string | undefined>();
      // Conflict forks paired to their originals: a fork must not be committed when
      // its original was skipped, or every sync would mint another stale copy.
      const forkOf = new Map<string, string>();
      let failure: unknown = null;
      let failed = false;
      let changed = false;

      // Phase A — flush local deletions (tombstones) up to Drive.
      for (const [id, m] of Object.entries(meta)) {
        if (gen !== this.generation) return; // connection changed under us — abandon
        if (!m.deletedAt) continue;
        const remote = driveById.get(id);
        if (m.driveFileId && remote) {
          if (remote.timer.updatedAt > m.deletedAt) {
            // The Drive copy was edited AFTER this delete → the tombstone is stale.
            // Drop it and let Phase B pull the newer timer back in.
            delete meta[id];
            metaDelta.add(id);
            changed = true;
            continue;
          }
          try {
            await this.withRefresh((d) => d.remove(m.driveFileId!));
          } catch (e) {
            failure = e;
            failed = true;
            continue; // retry next sync
          }
        } else if (m.driveFileId && !result.complete) {
          // Can't confirm the file is gone on a partial listing — keep the tombstone.
          continue;
        }
        delete meta[id];
        metaDelta.add(id);
        driveById.delete(id);
        changed = true;
      }

      // Phase B — reconcile timers present on Drive.
      for (const [id, d] of driveById) {
        if (gen !== this.generation) return; // connection changed under us — abandon
        const localT = localById.get(id);
        const m = meta[id];
        // Still tombstoned (its Drive delete failed in Phase A) — never resurrect it.
        if (m?.deletedAt) continue;
        if (
          localT &&
          m?.dirty &&
          m.driveUpdatedAt !== undefined &&
          d.timer.updatedAt !== m.driveUpdatedAt &&
          // Equal content timestamps mean the sides already converged (e.g. our own
          // push landed but its meta write-back was abandoned) — not a conflict; the
          // push branch below re-records the meta with a harmless no-op update.
          d.timer.updatedAt !== localT.updatedAt
        ) {
          // CONFLICT: both sides changed since the last sync. Never discard either —
          // keep the Drive copy under the original id and fork the local edits into a
          // new device timer so they stay visible.
          const fork: CompoundTimer = {
            ...localT,
            id: uuidv4(),
            name: `${localT.name} (conflicted copy)`,
          };
          localById.set(fork.id, fork);
          upserts.set(fork.id, fork);
          basis.set(fork.id, undefined);
          forkOf.set(fork.id, id);
          meta[fork.id] = { origin: 'device' };
          metaDelta.add(fork.id);
          localById.set(id, d.timer);
          upserts.set(id, d.timer);
          basis.set(id, localT.updatedAt);
          meta[id] = { origin: 'drive', driveFileId: d.driveFileId, driveUpdatedAt: d.timer.updatedAt, lastSyncedAt: now, dirty: false };
          metaDelta.add(id);
          changed = true;
        } else if (localT && m?.dirty && (m.driveUpdatedAt !== undefined || localT.updatedAt >= d.timer.updatedAt)) {
          // Local edits, Drive unchanged since the last sync → push them.
          // (Pre-migration meta has no driveUpdatedAt; fall back to comparing updatedAt.)
          try {
            await this.withRefresh((dr) => dr.update(d.driveFileId, localT));
            meta[id] = { origin: 'drive', driveFileId: d.driveFileId, driveUpdatedAt: localT.updatedAt, lastSyncedAt: now, dirty: false };
            metaDelta.add(id);
            changed = true;
          } catch (e) {
            failure = e;
            failed = true;
            // keep dirty; retry next sync
          }
        } else if (!localT || d.timer.updatedAt > localT.updatedAt) {
          // Drive is newer (or new to this device) → pull into the cache.
          localById.set(id, d.timer);
          upserts.set(id, d.timer);
          basis.set(id, localT?.updatedAt);
          meta[id] = { origin: 'drive', driveFileId: d.driveFileId, driveUpdatedAt: d.timer.updatedAt, lastSyncedAt: now, dirty: false };
          metaDelta.add(id);
          changed = true;
        } else if (
          !m ||
          m.origin !== 'drive' ||
          m.driveFileId !== d.driveFileId ||
          m.driveUpdatedAt !== d.timer.updatedAt
        ) {
          // Only rewrite the meta entry when something material changed — touching
          // every entry would needlessly expose mid-sync saves to the merge below.
          meta[id] = { origin: 'drive', driveFileId: d.driveFileId, driveUpdatedAt: d.timer.updatedAt, lastSyncedAt: now, dirty: false };
          metaDelta.add(id);
        }
      }

      // Phase C — local 'drive' timers that Drive didn't return.
      for (const t of [...localById.values()]) {
        if (gen !== this.generation) return; // connection changed under us — abandon
        const m = meta[t.id];
        if (!m || m.origin !== 'drive' || m.deletedAt) continue;
        if (driveById.has(t.id)) continue;
        if (m.dirty || !m.driveFileId) {
          // Never pushed (or edited offline) → (re)create on Drive.
          try {
            const fileId = await this.withRefresh((d) => d.create(t));
            const liveAfterCreate = readMeta()[t.id];
            if (liveAfterCreate?.deletedAt || this.local.readAll().every((x) => x.id !== t.id)) {
              // Deleted while the create was in flight — tombstone the fresh file so
              // the next sync's Phase A removes it instead of Phase B pulling the
              // deleted timer back into the library.
              meta[t.id] = { origin: 'drive', driveFileId: fileId, deletedAt: liveAfterCreate?.deletedAt ?? now };
            } else {
              meta[t.id] = { origin: 'drive', driveFileId: fileId, driveUpdatedAt: t.updatedAt, lastSyncedAt: now, dirty: false };
            }
            metaDelta.add(t.id);
            changed = true;
          } catch (e) {
            failure = e;
            failed = true;
            // retry next sync
          }
        } else if (result.complete && this.accountVerified) {
          // Confirmed removed on another device — only when the list was complete AND
          // this Drive is known to be the account the library was synced with.
          localById.delete(t.id);
          removals.add(t.id);
          basis.set(t.id, t.updatedAt);
          delete meta[t.id];
          metaDelta.add(t.id);
          changed = true;
        }
        // else: partial list or unverified account — keep the timer, never delete.
      }

      // The connection changed while we awaited Drive: every decision above was made
      // against a generation (and possibly a demoted meta state) that no longer
      // exists — writing it back could re-promote timers a switch just demoted.
      if (gen !== this.generation) return;

      // Write-back as per-id deltas over the LIVE state, so a save that landed during
      // the awaits above is never clobbered. An id whose live copy moved past the
      // decision basis is skipped wholesale (timer AND meta) and re-reconciled — as
      // a conflict if needed — on the next sync.
      const skipped = new Set<string>();
      const liveById = new Map(this.local.readAll().map((t) => [t.id, t]));
      let wroteTimers = false;
      for (const [id, t] of upserts) {
        if (forkOf.has(id)) continue; // forks are decided after their originals
        if (liveById.get(id)?.updatedAt !== basis.get(id)) {
          skipped.add(id);
          continue;
        }
        liveById.set(id, t);
        wroteTimers = true;
      }
      for (const [forkId, origId] of forkOf) {
        const t = upserts.get(forkId);
        if (!t) continue;
        // A skipped original means the conflict decision is stale — committing the
        // fork anyway would mint a duplicate stale copy on every such sync.
        if (skipped.has(origId) || liveById.get(forkId)?.updatedAt !== basis.get(forkId)) {
          skipped.add(forkId);
          continue;
        }
        liveById.set(forkId, t);
        wroteTimers = true;
      }
      for (const id of removals) {
        if (liveById.get(id)?.updatedAt !== basis.get(id)) {
          skipped.add(id);
          continue;
        }
        liveById.delete(id);
        wroteTimers = true;
      }
      if (wroteTimers) this.local.writeAll([...liveById.values()]);

      if (metaDelta.size > 0) {
        const liveMeta = readMeta();
        for (const id of metaDelta) {
          if (skipped.has(id)) continue;
          const ours = id in meta ? meta[id] : undefined;
          const live = liveMeta[id];
          // A delete landed mid-sync (its tombstone is NEW relative to our snapshot)
          // — it must survive this write-back. A tombstone we flushed ourselves falls
          // through so our deletion (or replacement entry) applies.
          if (live?.deletedAt && live.deletedAt !== tombstonesBefore.get(id) && !ours?.deletedAt) {
            if (ours?.driveFileId && ours.driveFileId !== live.driveFileId) {
              // Carry the fresher file id into the tombstone so the next Phase A
              // removes the file this sync just created/relinked.
              liveMeta[id] = { origin: 'drive', driveFileId: ours.driveFileId, deletedAt: live.deletedAt };
            }
            continue;
          }
          if (ours === undefined) {
            delete liveMeta[id];
          } else if (live?.dirty && ours.dirty === false) {
            // An edit landed mid-sync after our snapshot; it still needs pushing.
            liveMeta[id] = { ...ours, dirty: true };
          } else {
            liveMeta[id] = ours;
          }
        }
        writeMeta(liveMeta);
      }

      // Honest status: 'synced' only when every per-item op succeeded on a complete
      // listing; otherwise surface why (isOffline(null) still catches navigator.onLine).
      if (!failed && result.complete) {
        this.report('synced', now);
      } else {
        this.report(this.isOffline(failure) ? 'offline' : 'error');
      }
      if (changed) this.notify();
    });
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async pushToDrive(timer: CompoundTimer, gen?: number): Promise<void> {
    if (!this.drive) return;
    // Queued under a connection that no longer exists (account switch/disconnect).
    if (gen !== undefined && gen !== this.generation) return;
    // The timer was deleted while this push waited on the chain — pushing now would
    // recreate meta (and a Drive file) for a timer that no longer exists.
    const before = readMeta()[timer.id];
    if (!before || before.deletedAt || this.local.readAll().every((t) => t.id !== timer.id)) return;
    this.report('syncing');
    try {
      const existingFileId = before.driveFileId;
      let fileId: string;
      if (existingFileId) {
        await this.withRefresh((d) => d.update(existingFileId, timer));
        fileId = existingFileId;
      } else {
        fileId = await this.withRefresh((d) => d.create(timer));
      }
      // The connection changed while the network op was in flight (account switch
      // demoted everything, or disconnect): writing meta now would re-promote a
      // demoted timer and bind it to the OLD account's file — the next sync against
      // the new account would then delete it locally. Bail; a same-account reconnect
      // re-homes the file from its own listing without duplicating.
      if (gen !== undefined && gen !== this.generation) return;
      // Re-read meta right before writing so we never overwrite a concurrent change.
      const after = readMeta();
      const m = after[timer.id];
      if (!m || m.deletedAt) {
        // Deleted mid-push. A pre-existing file is covered by its tombstone (Phase A
        // removes it); a file we just created must be undone here or the next sync
        // would pull the deleted timer back in.
        if (!existingFileId) {
          try {
            await this.withRefresh((d) => d.remove(fileId));
          } catch {
            // Unreachable Drive: the orphaned file may resurface; the user can delete it again.
          }
        }
        this.notify();
        return;
      }
      // A newer save can land while the push is in flight (saves are not serialized
      // behind Drive I/O) — keep it dirty so its own queued push isn't forgotten.
      const liveT = this.local.readAll().find((t) => t.id === timer.id);
      const superseded = liveT !== undefined && liveT.updatedAt !== timer.updatedAt;
      after[timer.id] = {
        ...m,
        origin: 'drive',
        driveFileId: fileId,
        driveUpdatedAt: timer.updatedAt,
        dirty: superseded,
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

  /** Serialize Drive I/O (pushes, removes, syncs) so concurrent ops can't race the
   *  same file. Local writes never ride this chain — they must not wait on network. */
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
    if (e instanceof TypeError) return true; // fetch network failure
    // A black-holed connection surfaces as the Drive client's 15s fetch timeout.
    return e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError');
  }

  private now(): string {
    return new Date().toISOString();
  }
}
