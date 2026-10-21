#!/usr/bin/env bash
# Poda os caches do Actions de um prefixo de chave, no ramo da execução, mantendo os N
# mais recentes. Usado pelos três workflows que gravam estado no cache.
#
# Por quê: o cache do repositório tem limite de 10 GB e o GitHub despeja primeiro o que
# foi acessado há mais tempo. Uma cópia do estado da energia tem ~7,2 GB (15/10/2026):
# gravar a nova com a anterior ainda lá passa do limite, e o despejo levou o estado do
# crédito em 03/10 e 15/10/2026.
#
# A poda é por ramo (--ref): uma execução manual num ramo de PR nunca apaga o cache do
# main, e o main não restaura cache de outro ramo.
#
# Uso: scripts/podar_cache.sh <prefixo> <quantos manter>
#   scripts/podar_cache.sh energia-estado- 0    # antes de gravar a cópia nova
#   scripts/podar_cache.sh pipeline-estado- 1   # depois de gravar
set -euo pipefail

PREFIXO="${1:?uso: $0 <prefixo> <quantos manter>}"
MANTER="${2:?uso: $0 <prefixo> <quantos manter>}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY ausente}"
REF="${GITHUB_REF:?GITHUB_REF ausente}"

gh cache list --repo "$REPO" --ref "$REF" --key "$PREFIXO" \
    --sort created_at --order desc --limit 100 --json id,key,sizeInBytes \
  | jq -r --argjson n "$MANTER" '.[$n:][] | "\(.id) \(.key) \(.sizeInBytes)"' \
  | while read -r id chave bytes; do
      echo "Apagando cache $chave ($((bytes / 1048576)) MB)"
      gh cache delete "$id" --repo "$REPO"
    done
