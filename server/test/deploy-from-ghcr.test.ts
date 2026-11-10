import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../../deploy/deploy-from-ghcr.sh', import.meta.url));
const PIN = 'a'.repeat(64);
const APK = 'not really an apk';
const sha = createHash('sha256').update(APK).digest('hex');

/** Builds a fake VPS directory plus `curl` and `docker` shims on PATH; both log their arguments to `calls.log`. */
function fake(opts: { deployEnv?: string; appJson?: string; curlFails?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'dfg-'));
  const dir = join(root, 'opt');
  const bin = join(root, 'bin');
  mkdirSync(dir);
  mkdirSync(bin);
  writeFileSync(join(dir, 'deploy.env'), opts.deployEnv ?? `IMAGE_REPO=ghcr.io/owner/repo\nAPK_CERT_SHA256=${PIN}\n`);
  const json = opts.appJson ?? `{"versionCode":7,"versionName":"1.1.7","certSha256":"${PIN}","sha256":"${sha}"}\n`;
  writeFileSync(join(root, 'app-release.apk'), APK);
  writeFileSync(join(root, 'app.json'), json);
  const log = join(root, 'calls.log');
  const shim = (name: string, body: string) => {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  };
  // curl: record the url, copy the fixture named by the url's last segment to the -o target
  shim('curl', `echo "curl $*" >> "${log}"\n${opts.curlFails ? 'exit 22' : 'while [[ $# -gt 1 ]]; do if [[ $1 == -o ]]; then out=$2; fi; shift; done\ncp "' + root + '/$(basename "${@: -1}")" "$out"'}`);
  // docker: log the call; answer the version lookup; /api/health is ok unless HEALTH=bad, and ok again once `calendar:previous` is retagged as latest
  shim('docker', `echo "docker $*" >> "${log}"
case "$*" in
  "image inspect --format"*) echo "APP_VERSION=1.2.3+abc" ;;
  "tag calendar:previous calendar:latest") touch "${root}/rolledback" ;;
  "compose exec -T app sh -c"*) if [[ "\${HEALTH:-ok}" == ok || -f "${root}/rolledback" ]]; then echo '{"status":"ok"}'; fi ;;
esac`);
  const run = (cmd: string, env: Record<string, string> = {}) =>
    spawnSync('bash', [script], { encoding: 'utf8', env: { PATH: `${bin}:${process.env.PATH}`, DEPLOY_DIR: dir, SSH_ORIGINAL_COMMAND: cmd, ...env } });
  const calls = () => { try { return readFileSync(log, 'utf8'); } catch { return ''; } };
  return { run, calls };
}

describe('deploy/deploy-from-ghcr.sh', () => {
  it('is valid bash', () => {
    expect(spawnSync('bash', ['-n', script]).status).toBe(0);
  });

  it.each([
    '', 'apk', 'apk ', 'apk apk-1.1', 'apk apk-1.1.7 extra', 'apk apk-1.1.7; id', 'apk ../apk-1.1.7', 'apk v1.1.7', 'apk apk-1.1.7\nid',
    'apk 0123456789012345678901234567890123456789', 'APK apk-1.1.7', 'apk  apk-1.1.7', 'sha256:abc', 'apk apk-1.1.7/../../x',
  ])('refuses %j before touching anything', (cmd) => {
    const f = fake();
    expect(f.run(cmd).status).toBe(2);
    expect(f.calls()).toBe('');
  });

  it('downloads only from the repository in deploy.env and installs both files', () => {
    const f = fake();
    const r = f.run('apk apk-1.1.7');
    expect(r.status).toBe(0);
    const c = f.calls();
    expect(c).toContain('https://github.com/owner/repo/releases/download/apk-1.1.7/app-release.apk');
    expect(c).toContain('https://github.com/owner/repo/releases/download/apk-1.1.7/app.json');
    expect(c).toContain('--proto =https');
    expect(c).toMatch(/docker compose cp \S+app-release\.apk app:\/data\/downloads\/app\.apk\.part/);
    expect(c).toContain('mv /data/downloads/app.json.part /data/downloads/app.json');
  });

  it('refuses a missing or malformed certificate pin', () => {
    expect(fake({ deployEnv: 'IMAGE_REPO=ghcr.io/owner/repo\n' }).run('apk apk-1.1.7').status).toBe(2);
    expect(fake({ deployEnv: 'IMAGE_REPO=ghcr.io/owner/repo\nAPK_CERT_SHA256=zz\n' }).run('apk apk-1.1.7').status).toBe(2);
  });

  it('refuses a release signed with another certificate and installs nothing', () => {
    const f = fake({ appJson: `{"versionCode":7,"versionName":"1.1.7","certSha256":"${'b'.repeat(64)}","sha256":"${sha}"}\n` });
    expect(f.run('apk apk-1.1.7').status).toBe(1);
    expect(f.calls()).not.toContain('docker');
  });

  it('refuses an APK whose sha256 differs from app.json', () => {
    const f = fake({ appJson: `{"versionCode":7,"versionName":"1.1.7","certSha256":"${PIN}","sha256":"${'c'.repeat(64)}"}\n` });
    expect(f.run('apk apk-1.1.7').status).toBe(1);
    expect(f.calls()).not.toContain('docker');
  });

  it('refuses an app.json whose version is not the requested tag', () => {
    expect(fake().run('apk apk-1.1.8').status).toBe(1);
  });

  it('fails when the download fails', () => {
    const f = fake({ curlFails: true });
    expect(f.run('apk apk-1.1.7').status).toBe(1);
    expect(f.calls()).not.toContain('docker');
  });

  describe('image deploy', () => {
    const digest = `sha256:${'d'.repeat(64)}`;
    /** The docker calls that matter for the sequence, in order. */
    const steps = (calls: string) => calls.split('\n').filter((l) => /docker (pull|tag|compose up|compose exec -T app sh)/.test(l)).map((l) => l.replace(/^docker /, ''));

    it('recreates only the app container and leaves Caddy running', () => {
      const f = fake();
      const r = f.run(digest);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('deployed calendar:1.2.3-abc');
      const s = steps(f.calls());
      expect(s[0]).toContain(`pull -q ghcr.io/owner/repo@${digest}`);
      expect(s).toContain('compose up -d --no-deps --remove-orphans app');
      expect(f.calls()).not.toMatch(/compose (down|stop|restart)/);
      // the previous image is kept before latest moves, and the new one is started after the retag
      const iPrev = s.indexOf('tag calendar:latest calendar:previous');
      const iNew = s.indexOf(`tag ghcr.io/owner/repo@${digest} calendar:latest`);
      expect(iPrev).toBeGreaterThanOrEqual(0);
      expect(iNew).toBeGreaterThan(iPrev);
      expect(s.indexOf('compose up -d --no-deps --remove-orphans app')).toBeGreaterThan(iNew);
    });

    it('rolls back to calendar:previous and exits 1 when the new version is not healthy', () => {
      const f = fake();
      const r = f.run(digest, { HEALTH: 'bad', HEALTH_TIMEOUT: '1', HEALTH_INTERVAL: '1' });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('rolling back to calendar:previous');
      expect(r.stderr).toContain('rolled back: the previous version is running again');
      const s = steps(f.calls());
      const ups = s.filter((x) => x.startsWith('compose up'));
      expect(ups).toEqual(Array(2).fill('compose up -d --no-deps --remove-orphans app'));
      expect(s.indexOf('tag calendar:previous calendar:latest')).toBeGreaterThan(s.indexOf(ups[0]));
      expect(f.calls()).not.toContain('docker rmi');
    });
  });
});
