#!/usr/bin/env bash
# Configure git so private NeuraVoxel github: / SSH lockfile remotes resolve over HTTPS
# with a read token. Used by CI after checkout; requires NEURAVOXEL_PRIVATE_READ_TOKEN
# (or CI_PRIVATE_GIT_TOKEN) in the environment.
set -euo pipefail

TOKEN="${NEURAVOXEL_PRIVATE_READ_TOKEN:-${CI_PRIVATE_GIT_TOKEN:-}}"
if [[ -z "${TOKEN}" ]]; then
  echo "ci-configure-private-git: NEURAVOXEL_PRIVATE_READ_TOKEN is empty; private submodule/deps will fail." >&2
  exit 1
fi

git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://github.com/"
git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "ssh://git@github.com/"
git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "git@github.com:"
