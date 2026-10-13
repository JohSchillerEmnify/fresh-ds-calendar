// Writes `<file>.br` (Brotli 11) and `<file>.gz` (gzip 9) next to every text asset in dist/, for the server to serve as is
// (`serveStatic({ precompressed: true })`): browsers on HTTPS/localhost get Brotli (~15 % smaller than gzip), others gzip.
// Runs after `vite build` (the PWA plugin has written sw.js by then, so every file is final).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url).pathname;
const TEXT = /\.(?:js|css|html|svg|json|webmanifest|txt|xml)$/;
const MIN_BYTES = 512;

let files = 0;
let raw = 0;
let br = 0;
for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !TEXT.test(entry.name)) continue;
  const file = join(entry.parentPath, entry.name);
  if (statSync(file).size < MIN_BYTES) continue;
  const data = readFileSync(file);
  const b = brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: data.length } });
  writeFileSync(`${file}.br`, b);
  writeFileSync(`${file}.gz`, gzipSync(data, { level: 9 }));
  files++; raw += data.length; br += b.length;
}
console.log(`precompress: ${files} files, ${(raw / 1024).toFixed(0)} KB -> ${(br / 1024).toFixed(0)} KB brotli`);
