import { runningVersion } from './update';

/** Splits a build version `X.Y.Z+<sha>` (or `X.Y.Z-preview+<sha>`) into the number to show and the git sha ('' if none). */
export function splitVersion(full: string): { version: string; sha: string } {
  const i = full.indexOf('+');
  return i < 0 ? { version: full, sha: '' } : { version: full.slice(0, i), sha: full.slice(i + 1) };
}

/** The version this page was built with, split for display. */
export function shownVersion(): { version: string; sha: string } {
  return splitVersion(runningVersion());
}
