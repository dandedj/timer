import type { CompoundTimer } from '../types/timer';
import { AuthExpiredError } from '../auth/GoogleAuthProvider';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const APP_NAME = 'interval-timer';
const MIME_TYPE = 'application/json';
const DOWNLOAD_CONCURRENCY = 8;
// Fail fast on a black-holed connection (e.g. captive-portal gym wifi) so callers can
// drop into the offline path instead of hanging a fetch indefinitely.
const REQUEST_TIMEOUT_MS = 15000;

/** A timer fetched from Drive, paired with its (device-local) Drive file id. */
export interface DriveTimer {
  timer: CompoundTimer;
  driveFileId: string;
}

export interface DriveListResult {
  timers: DriveTimer[];
  /** True only if every matching file downloaded successfully. When false, callers must
   *  NOT treat a locally-known timer's absence as a remote deletion (it may be a transient
   *  download failure), to avoid silent data loss. */
  complete: boolean;
}

/**
 * Low-level Google Drive client (drive.file scope, one JSON file per timer). The
 * sync engine in UnifiedStorageProvider drives this; it is never the UI's storage
 * provider directly, so a flaky network can never blank the rendered library.
 */
export class GoogleDriveStorageProvider {
  private getToken: () => string | null;

  constructor(getToken: () => string | null) {
    this.getToken = getToken;
  }

  private token(): string {
    const t = this.getToken();
    if (!t) throw new AuthExpiredError();
    return t;
  }

  private async request(url: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${this.token()}`,
        ...init?.headers,
      },
    });
    if (res.status === 401) throw new AuthExpiredError();
    return res;
  }

  /** List all app timers from Drive, downloading their contents in parallel (capped). */
  async listDetailed(): Promise<DriveListResult> {
    const q = `properties has { key='appName' and value='${APP_NAME}' } and trashed=false`;
    const fields = 'files(id,properties)';
    const res = await this.request(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=1000`
    );
    if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
    const data = await res.json();
    const files: { id: string; properties?: Record<string, string> }[] = data.files || [];
    const targets = files.filter((f) => f.properties?.timerId);

    const timers: DriveTimer[] = [];
    // If the listing was paginated/truncated we have NOT seen every file, so callers must
    // not treat a known timer's absence as a deletion.
    let complete = !data.nextPageToken;

    // Download in bounded-concurrency batches so a large library doesn't hammer the API.
    for (let i = 0; i < targets.length; i += DOWNLOAD_CONCURRENCY) {
      const batch = targets.slice(i, i + DOWNLOAD_CONCURRENCY);
      const results = await Promise.allSettled(batch.map((f) => this.download(f.id)));
      let authExpired = false;
      results.forEach((r, j) => {
        if (r.status === 'fulfilled' && r.value) {
          timers.push({ timer: r.value, driveFileId: batch[j].id });
        } else {
          // A failed/empty download means we can't see this file this pass.
          if (r.status === 'rejected' && r.reason instanceof AuthExpiredError) authExpired = true;
          complete = false;
        }
      });
      // Surface a mid-batch token expiry so the caller can refresh and retry the whole list.
      if (authExpired) throw new AuthExpiredError();
    }

    return { timers, complete };
  }

  async download(driveFileId: string): Promise<CompoundTimer | null> {
    const res = await this.request(`${DRIVE_API}/files/${driveFileId}?alt=media`);
    if (!res.ok) {
      if (res.status === 401) throw new AuthExpiredError();
      throw new Error(`Drive download failed: ${res.status}`);
    }
    try {
      return (await res.json()) as CompoundTimer;
    } catch {
      return null;
    }
  }

  /** Create a new Drive file for a timer; returns its Drive file id. */
  async create(timer: CompoundTimer): Promise<string> {
    const metadata = {
      name: `${timer.name || 'timer'}.timer.json`,
      mimeType: MIME_TYPE,
      properties: {
        appName: APP_NAME,
        timerId: timer.id,
      },
    };

    const boundary = '---interval-timer-boundary';
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${MIME_TYPE}\r\n\r\n` +
      `${JSON.stringify(timer)}\r\n` +
      `--${boundary}--`;

    const res = await this.request(`${UPLOAD_API}/files?uploadType=multipart`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });

    if (!res.ok) throw new Error(`Drive create failed: ${res.status}`);
    const created = await res.json();
    return created.id as string;
  }

  /** Overwrite an existing Drive file's name + content. */
  async update(driveFileId: string, timer: CompoundTimer): Promise<void> {
    const renameRes = await this.request(`${DRIVE_API}/files/${driveFileId}?fields=trashed`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${timer.name || 'timer'}.timer.json` }),
    });
    if (!renameRes.ok) throw new Error(`Drive rename failed: ${renameRes.status}`);
    // Drive happily updates a trashed file (it is only hidden from listings). Treat
    // that like a 404 so the push fails, the edit stays dirty, and the next sync
    // recreates the timer as a fresh file instead of writing it into the trash.
    const renamed = (await renameRes.json()) as { trashed?: boolean };
    if (renamed.trashed) throw new Error('Drive update failed: file is trashed');

    const res = await this.request(
      `${UPLOAD_API}/files/${driveFileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': MIME_TYPE },
        body: JSON.stringify(timer),
      }
    );

    if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
  }

  /** Move a timer's file to Drive's trash (recoverable for ~30 days) rather than
   *  deleting it permanently, so an accidental delete is never irreversible. */
  async remove(driveFileId: string): Promise<void> {
    const res = await this.request(`${DRIVE_API}/files/${driveFileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    });
    // 404 is fine — already gone.
    if (!res.ok && res.status !== 404) {
      throw new Error(`Drive delete failed: ${res.status}`);
    }
  }
}
