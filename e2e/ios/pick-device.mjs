/** Picks the newest iOS runtime and a plain iPhone from the installed simulators and prints `UDID=`, `PLATFORM_VERSION=` and `DEVICE_NAME=` lines for $GITHUB_ENV. */
import { execFileSync } from 'node:child_process';

const sim = (...args) => JSON.parse(execFileSync('xcrun', ['simctl', 'list', '--json', ...args], { encoding: 'utf8' }));
const versionOf = (id) => id.match(/iOS-(\d+(?:-\d+)*)$/)?.[1].replaceAll('-', '.') ?? '';
const newest = (a, b) => a.localeCompare(b, undefined, { numeric: true });

// the newest installed iOS runtime that has at least one iPhone
const runtimes = sim('runtimes', 'available').runtimes.filter((r) => /\.iOS-/.test(r.identifier)).sort((a, b) => newest(versionOf(a.identifier), versionOf(b.identifier)));
const devices = sim('devices', 'available').devices;
for (const rt of runtimes.reverse()) {
  const phones = (devices[rt.identifier] ?? []).filter((d) => d.name.startsWith('iPhone'));
  // a regular phone first (not SE, Plus, Max, Air): the narrowest screen is the closest to the bug report
  const pick = phones.find((d) => !/SE|Plus|Max|Air|e$/.test(d.name)) ?? phones[0];
  if (pick) {
    console.log(`UDID=${pick.udid}`);
    console.log(`PLATFORM_VERSION=${versionOf(rt.identifier)}`);
    console.log(`DEVICE_NAME=${pick.name}`);
    process.exit(0);
  }
}
console.error('no iPhone simulator found');
process.exit(1);
