import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../../scripts/vps.sh', import.meta.url));

/** Runs `scripts/vps.sh` in dry-run mode: SSH commands are printed to stderr, nothing is built or sent. */
const run = (args: string[], dryRun = '1', env: Record<string, string> = {}) =>
  spawnSync('bash', [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, VPS_HOST: '192.0.2.1', CAL_DOMAIN: 'cal.example.org', DRY_RUN: dryRun, HEALTH_TIMEOUT: '3', HEALTH_INTERVAL: '1', ...env },
  });

describe('scripts/vps.sh rollback', () => {
  it('is valid bash', () => {
    expect(spawnSync('bash', ['-n', script]).status).toBe(0);
  });

  it('deploy keeps the old image as calendar:previous, waits for health and keeps the last three versions', () => {
    const r = run(['deploy']);
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/docker tag calendar:latest calendar:previous/);
    expect(r.stderr).toMatch(/api\/health/);
    expect(r.stderr).toMatch(/tail -n \+4/);
    expect(r.stderr).not.toMatch(/docker image prune -a/);
  });

  it('an unhealthy new version is rolled back to calendar:previous and the script exits non-zero', () => {
    const r = run(['deploy'], 'unhealthy');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/docker tag calendar:previous calendar:latest/);
    expect(r.stderr).toMatch(/rolling back/i);
  });

  it('rollback with no argument goes to calendar:previous, with a version to that version', () => {
    expect(run(['rollback']).stderr).toMatch(/docker tag calendar:previous calendar:latest/);
    const r = run(['rollback', '0.18.0+94da588']);
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/docker tag calendar:0\.18\.0-94da588 calendar:latest/);
  });

  it('rollback exits non-zero when the old version never becomes healthy', () => {
    expect(run(['rollback'], 'unhealthy').status).not.toBe(0);
  });

  it('rollback refuses a version that is not a plain tag', () => {
    expect(run(['rollback', 'x; rm -rf /']).status).toBe(2);
  });
});
