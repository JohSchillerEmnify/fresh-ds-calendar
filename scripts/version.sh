#!/usr/bin/env bash
# Computes the app's semantic version from the git history (docs/DEPLOYMENT.md "Versioning and release notes").
#   scripts/version.sh             next version X.Y.Z: the last tag vX.Y.Z plus one bump for the commits since it
# Bump: a commit subject starting `feat` raises the minor version, anything else the patch version; a BREAKING marker
# (`type!:` subject or a `BREAKING` body line) raises the major version, but the minor one while the major is 0.
# No commits since the tag: the tag's own version. No tag yet: 0.1.0 (the first tag).
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# VERSION_REPO: compute for another checkout instead of this one.
cd "${VERSION_REPO:-$REPO}"

tag="$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null || true)"
last="${tag#v}"

if [[ -z "$tag" ]]; then echo "0.1.0"; exit 0; fi

IFS=. read -r major minor patch <<<"$last"
bump=""   # "", patch, minor, major (highest wins)
# One record per commit (NUL-separated): subject, then body.
while IFS= read -r -d '' msg; do
  msg="${msg#"${msg%%[!$'\n']*}"}"   # git puts a newline between records
  subject="${msg%%$'\n'*}"
  if [[ "$subject" =~ ^[a-zA-Z]+(\(.*\))?!: ]] || grep -q '^BREAKING' <<<"$msg"; then bump=major
  elif [[ "$subject" == feat* && "$bump" != major ]]; then bump=minor
  elif [[ -z "$bump" ]]; then bump=patch
  fi
done < <(git log "$tag..HEAD" --format='%B%x00')

# Before 1.0.0 a breaking change only raises the minor version.
if [[ "$bump" == major && "$major" == 0 ]]; then bump=minor; fi
case "$bump" in
  major) echo "$((major + 1)).0.0" ;;
  minor) echo "$major.$((minor + 1)).0" ;;
  patch) echo "$major.$minor.$((patch + 1))" ;;
  *) echo "$last" ;;
esac
