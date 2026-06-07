import type { SyncMetaMap } from '../types/sync';

const META_KEY = 'interval-timer:sync-meta';

/**
 * Side-table of per-timer sync metadata, kept separate from the timer payloads so
 * device-local fields (origin, driveFileId, dirty, tombstones) never leak into the
 * JSON that syncs to Drive or gets exported.
 */
export function readMeta(): SyncMetaMap {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as SyncMetaMap) : {};
  } catch {
    return {};
  }
}

export function writeMeta(meta: SyncMetaMap): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}
