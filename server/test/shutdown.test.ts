import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { drain } from '../src/lib/shutdown.js';

/** Starts a server whose `/slow` answers after `ms`; resolves with the server and its port. */
async function start(ms: number) {
  const server = http.createServer((_req, res) => { setTimeout(() => res.end('done'), ms); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, port: (server.address() as AddressInfo).port };
}

/** Sends one GET and resolves with the status and body, or the error code. */
const get = (port: number) => new Promise<string>((resolve) => {
  http.get({ port, host: '127.0.0.1', agent: false }, (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve(`${res.statusCode} ${b}`)); })
    .on('error', (e) => resolve((e as NodeJS.ErrnoException).code ?? 'error'));
});

describe('drain', () => {
  it('does not wait for a keep-alive socket that goes idle during the drain', async () => {
    const { server, port } = await start(200);
    const agent = new http.Agent({ keepAlive: true });
    const inflight = new Promise<void>((r) => http.get({ port, host: '127.0.0.1', agent }, (res) => { res.resume(); res.on('end', () => r()); }));
    await new Promise((r) => setTimeout(r, 50));
    const t0 = Date.now();
    const exited = new Promise<void>((r) => drain(server, () => {}, 5000, () => r()));
    await inflight;
    await exited;
    agent.destroy();
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('lets a request in flight finish, refuses new ones, then exits 0', async () => {
    const { server, port } = await start(300);
    const inflight = get(port);
    await new Promise((r) => setTimeout(r, 50));
    const exits: number[] = [];
    const exited = new Promise<void>((r) => drain(server, () => exits.push(-1), 5000, (c) => { exits.push(c); r(); }));
    await new Promise((r) => setTimeout(r, 50));
    expect(await get(port)).toBe('ECONNREFUSED');
    expect(await inflight).toBe('200 done');
    await exited;
    expect(exits).toEqual([-1, 0]);
  });

  it('exits after the drain limit when a request never ends', async () => {
    const { server, port } = await start(10_000);
    void get(port);
    await new Promise((r) => setTimeout(r, 50));
    const t0 = Date.now();
    const code = await new Promise<number>((r) => drain(server, () => {}, 200, r));
    expect(code).toBe(0);
    expect(Date.now() - t0).toBeLessThan(2000);
    server.closeAllConnections();
  });
});
