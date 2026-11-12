# 0040 — The APK is built in CI, signed in a protected environment, shipped by the forced command

- Status: accepted and built (owner decided the design, 2026-11-10)
- Supersedes: the "APK only from the laptop" part of ADR 0036. Views shaped: `deployment`

## Decision
- `deploy.yml` job `apk-build` runs after a successful server deploy, only when native code changed since the last
  `apk-*` release (`android/`, `capacitor.config.*`, `@capacitor` lines in `package.json`/`pnpm-lock.yaml`), when no release
  exists yet, or on `workflow_dispatch` with `force_apk`. It builds the UNSIGNED release APK (versionCode = commit count,
  server URL from the `APP_URL` secret) and uploads it as an artifact. It has no signing secret.
- Job `apk-sign` is the only job in the GitHub environment `android-release` (deployments only from `main`; secrets
  `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) and the only one with
  `contents: write`. It decodes the keystore into `$RUNNER_TEMP` (umask 077), signs with the pinned `apksigner` 35.0.0
  (passwords on stdin), deletes the keystore in an `always()` step, checks the certificate against
  `android/release-cert.sha256` (`scripts/apk-cert.sh`) and publishes `app-release.apk` + `app.json`
  (`versionCode`, `versionName`, public `certSha256`, `sha256`) as release `apk-<versionName>`.
- Job `apk-ship` (SSH key, no keystore) runs `apk apk-<x.y.z>` over the CD key. The forced command downloads only from
  `https://github.com/<owner>/<repo>/releases/download/<tag>/` (repository from `deploy.env`, tag matched strictly), checks the
  APK's sha256 and `certSha256` against `APK_CERT_SHA256` in `deploy.env` (root-owned, the key cannot write it), and copies both
  files into `/data/downloads` like `scripts/vps.sh`. The digest command is unchanged.
- `scripts/android-build.sh` and `scripts/vps.sh apk` stay as the manual path.

## Alternatives weighed
- **Keystore in the build job**: simplest, but Gradle plugins run arbitrary code; a bad dependency would get the key.
- **Build and sign on the laptop (today)**: no key in GitHub, but native fixes wait for the owner's machine.
- **Pass the APK to the VPS over SSH from the runner**: needs a second command that accepts a file; a download from a
  release keeps the forced command input-free.
- **Verify the signature with apksigner on the VPS**: the VPS has no Android SDK (1 GB, no build tools). Not done.

## Why / residual risk
Splitting build (untrusted code, no key) from signing (key, no project code besides apksigner and the cert script) keeps the
key away from dependency code. Accepted: whoever can push to `main` can get a malicious APK built and signed, hence the
branch restriction (add a required reviewer to the environment for more); the VPS pin catches a wrong key or a tampered
download but cannot tell a forged `app.json` from a real one if GitHub release write access is compromised.
Assumption: apk-sign trusts nothing from the artifact except the bytes it signs; `apksigner` 35.0.0 output is accepted by the
pin check even though the manual path uses 36.0.0.

Known limits (security review): the VPS compares values that all come from the one release, so it is a consistency check, not
a signature check; anyone with release write access could pass it. Mitigations: write access to the repository is the trust
root, an existing release is reused only when its APK is byte-identical to the one just verified, and release immutability
can be switched on in the repository settings. No downgrade guard on the VPS yet; `force_apk` builds the head of `main`
without the deploy job's "skip older commit" check.
