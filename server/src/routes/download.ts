import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { Hono } from 'hono';

/** The Android app, built by `scripts/android-build.sh` and put into `DATA_DIR/downloads/` by hand (never part of the image). */
export const APK_FILE = 'app.apk';

/**
 * Serves the Android app at `/app.apk` from `DATA_DIR/downloads/app.apk`.
 *
 * @param dataDir The server's `DATA_DIR`.
 * @returns A router answering `GET /app.apk`: the file as an APK download, or the JSON 404 while there is none.
 */
export function downloadRoutes(dataDir: string) {
  const file = path.join(dataDir, 'downloads', APK_FILE);
  return new Hono().get(`/${APK_FILE}`, (c) => {
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
