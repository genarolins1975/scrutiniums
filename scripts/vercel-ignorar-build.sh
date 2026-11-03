#!/usr/bin/env bash
set -u
[ "${VERCEL_ENV:-}" != "production" ] && { echo "Preview desligado"; exit 0; }
[ "$(git log -1 --format=%ae)" = "pipeline@scrutiniums.com" ] && { echo "Commit do coletor: aguarda publicação semanal"; exit 0; }
exit 1
