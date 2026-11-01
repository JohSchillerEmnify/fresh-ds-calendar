import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { Hono } from 'hono';

/** The Android app, built by `scripts/android-build.sh` and put into `DATA_DIR/downloads/` by hand (never part of the image). */
const APK_FILE = 'app.apk';

/**
 * Sidecar of the APK, written next to it by `scripts/android-build.sh` after it checked the signer:
 * `{ "versionCode": 7, "versionName": "1.1.7", "certSha256": "<64 hex>" }`.
 */
const APK_INFO_FILE = 'app.json';

/** Version of the published APK, as the app compares it with the installed one, and the pinned fingerprint of its signing certificate. */
export interface ApkInfo { versionCode: number; versionName: string; certSha256?: string }

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Reads the published APK's version from `DATA_DIR/downloads/app.json`.
 *
 * @param dataDir The server's `DATA_DIR`.
 * @returns The version (and `certSha256` when the sidecar has a well-formed one), or null while there is no valid sidecar
 *   (then the app offers no download hint).
 */
export function readApkInfo(dataDir: string): ApkInfo | null {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dataDir, 'downloads', APK_INFO_FILE), 'utf8')) as Partial<ApkInfo>;
    if (!Number.isInteger(j.versionCode) || (j.versionCode as number) < 1 || typeof j.versionName !== 'string') return null;
    const cert = typeof j.certSha256 === 'string' ? j.certSha256.toLowerCase() : '';
    return { versionCode: j.versionCode as number, versionName: j.versionName, ...(SHA256_HEX.test(cert) ? { certSha256: cert } : {}) };
  } catch {
    return null;
  }
}

/**
 * Serves the Android app at `/app.apk` from `DATA_DIR/downloads/app.apk`, and `/app.json` next to it.
 *
 * @param dataDir The server's `DATA_DIR`.
 * @returns A router answering `GET /app.apk` (the file as an APK download) and `GET /app.json` (version, sha256 of the
 *   served file and pinned signer fingerprint), both with the JSON 404 while there is no APK.
 */
export function downloadRoutes(dataDir: string) {
  const file = path.join(dataDir, 'downloads', APK_FILE);
  let hashed: { key: string; sha256: string } | undefined;
  const notFound = () => Response.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
  return new Hono().get(`/${APK_INFO_FILE}`, (c) => {
    // hashed from the file itself, so it always describes the bytes served as /app.apk (re-hashed only when the file changed)
    let sha256: string;
    try {
      const st = fs.statSync(file);
      const key = `${st.size}:${st.mtimeMs}`;
      if (hashed?.key !== key) hashed = { key, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
      sha256 = hashed.sha256;
    } catch { return notFound(); }
    return c.json({ ...readApkInfo(dataDir), sha256 }, 200, { 'Cache-Control': 'no-cache' });
  }).get(`/${APK_FILE}`, (c) => {
    let size: number;
    try {
      const st = fs.statSync(file);
      if (!st.isFile()) throw new Error('not a file');
      size = st.size;
    } catch {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
    }
    return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': String(size),
        'Content-Disposition': 'attachment; filename="calendar.apk"',
        'Cache-Control': 'no-cache',
      },
    });
  });
}
