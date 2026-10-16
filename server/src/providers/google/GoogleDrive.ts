import type { OAuth2Client } from 'google-auth-library';
import { GOOGLE_TIMEOUT_MS } from './auth.js';
import { DriveError, type DriveClient, type DriveFile } from '../DriveClient.js';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime';
/** Multipart upload carries at most 5 MB (Drive API v3, "Upload file data"); resumable upload is not needed for text bundles. */
export const MULTIPART_LIMIT = 5 * 1024 * 1024;

/** Drive API v3 over `fetch`, on one person's OAuth client, limited to the hidden `appDataFolder` (scope `drive.appdata`). */
export class GoogleDrive implements DriveClient {
  constructor(private readonly auth: Pick<OAuth2Client, 'getAccessToken'>, private readonly fetchFn: typeof fetch = fetch) {}

  /** One authorised request; any non-2xx answer becomes a {@link DriveError} with Google's reason. */
  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const { token } = await this.auth.getAccessToken();
    if (!token) throw new DriveError('No Google access token');
    const res = await this.fetchFn(url, { ...init, signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS), headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const reason = ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message;
      throw new DriveError(`Google Drive answered ${res.status}${reason ? `: ${reason.slice(0, 200)}` : ''}`, res.status);
    }
    return res;
  }

  async list(namePrefix: string): Promise<DriveFile[]> {
    const out: DriveFile[] = [];
    let page: string | undefined;
    // the folder holds only our own files, so a name filter in the query is not needed
    do {
      const q = new URLSearchParams({ spaces: 'appDataFolder', q: 'trashed = false', pageSize: '1000', fields: 'nextPageToken,files(id,name,createdTime)' });
      if (page) q.set('pageToken', page);
      const body = (await (await this.request(`${API}?${q}`)).json()) as { nextPageToken?: string; files?: DriveFile[] };
      for (const f of body.files ?? []) if (f.name.startsWith(namePrefix)) out.push({ id: f.id, name: f.name, createdTime: f.createdTime });
      page = body.nextPageToken;
    } while (page);
    return out;
  }

  async create(name: string, content: string): Promise<DriveFile> {
    const boundary = `bk${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: ['appDataFolder'], mimeType: 'application/json' })}\r\n`
      + `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    if (Buffer.byteLength(body) > MULTIPART_LIMIT) throw new DriveError('The backup is larger than the 5 MB Google Drive upload limit');
    const res = await this.request(UPLOAD, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
    return (await res.json()) as DriveFile;
  }

  async get(id: string): Promise<string> {
    return (await this.request(`${API}/${encodeURIComponent(id)}?alt=media`)).text();
  }

  async delete(id: string): Promise<void> {
    try {
      await this.request(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (e) {
      if (!(e instanceof DriveError && e.status === 404)) throw e;
    }
  }
}
