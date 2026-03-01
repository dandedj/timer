import type { IStorageProvider } from '../types/storage';
import type { CompoundTimer } from '../types/timer';
import { AuthExpiredError } from '../auth/GoogleAuthProvider';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const APP_NAME = 'interval-timer';
const MIME_TYPE = 'application/json';

export class GoogleDriveStorageProvider implements IStorageProvider {
  private getToken: () => string | null;
  private fileMap = new Map<string, string>(); // timerId → driveFileId

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
      headers: {
        Authorization: `Bearer ${this.token()}`,
        ...init?.headers,
      },
    });
    if (res.status === 401) throw new AuthExpiredError();
    return res;
  }

  async listTimers(): Promise<CompoundTimer[]> {
    const q = `properties has { key='appName' and value='${APP_NAME}' } and trashed=false`;
    const fields = 'files(id,name,properties)';
    const res = await this.request(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=1000`
    );
    if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
    const data = await res.json();
    const files: { id: string; properties?: Record<string, string> }[] = data.files || [];

    this.fileMap.clear();
    const timers: CompoundTimer[] = [];

    for (const file of files) {
      const timerId = file.properties?.timerId;
      if (!timerId) continue;
      this.fileMap.set(timerId, file.id);
      const timer = await this.downloadFile(file.id);
      if (timer) timers.push(timer);
    }

    return timers.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getTimer(id: string): Promise<CompoundTimer | null> {
    let driveId = this.fileMap.get(id);
    if (!driveId) {
      await this.listTimers();
      driveId = this.fileMap.get(id);
    }
    if (!driveId) return null;
    return this.downloadFile(driveId);
  }

  async saveTimer(timer: CompoundTimer): Promise<void> {
    const driveId = this.fileMap.get(timer.id);
    if (driveId) {
      await this.updateFile(driveId, timer);
    } else {
      await this.createFile(timer);
    }
  }

  async deleteTimer(id: string): Promise<void> {
    let driveId = this.fileMap.get(id);
    if (!driveId) {
      await this.listTimers();
      driveId = this.fileMap.get(id);
    }
    if (!driveId) return;
    await this.request(`${DRIVE_API}/files/${driveId}`, { method: 'DELETE' });
    this.fileMap.delete(id);
  }

  private async downloadFile(driveFileId: string): Promise<CompoundTimer | null> {
    const res = await this.request(`${DRIVE_API}/files/${driveFileId}?alt=media`);
    if (!res.ok) return null;
    try {
      return (await res.json()) as CompoundTimer;
    } catch {
      return null;
    }
  }

  private async createFile(timer: CompoundTimer): Promise<void> {
    const metadata = {
      name: `${timer.name}.timer.json`,
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
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!res.ok) throw new Error(`Drive create failed: ${res.status}`);
    const created = await res.json();
    this.fileMap.set(timer.id, created.id);
  }

  private async updateFile(driveFileId: string, timer: CompoundTimer): Promise<void> {
    // Update metadata (file name)
    await this.request(`${DRIVE_API}/files/${driveFileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${timer.name}.timer.json` }),
    });

    // Update content
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
}
