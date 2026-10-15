#!/usr/bin/env bash
# Cópia durável do estado do pipeline do crédito (data/silver e data/bronze) numa
# release do próprio repositório, fora do cache do Actions.
#
# Por quê: o cache do repositório tem limite de 10 GB e despeja primeiro o que foi
# acessado há mais tempo. O estado do Setor Elétrico ocupa ~7,2 GB por cópia (medido em
# 15/10/2026); quando o job de energia grava a cópia nova antes de a antiga sair, o
# total passa do limite e o estado do crédito, acessado só uma vez por dia, é o
# primeiro a ser despejado. Foi o que zerou o silver do crédito em 03/10 e em
# 15/10/2026. A release não conta para esse limite.
#
# Uso:
#   scripts/estado_duravel.sh salvar      # empacota, divide em partes e sobe
#   scripts/estado_duravel.sh restaurar   # baixa, confere sha256 e extrai
# Requer GH_TOKEN e GITHUB_REPOSITORY. Partes de até 1900 MB (limite de 2 GB por
# arquivo de release). O manifesto sobe por último: uma cópia só vale inteira.
set -euo pipefail

TAG="${ESTADO_TAG:-pipeline-estado}"
PREFIXO="pipeline-estado.tar.zst"
MANIFESTO="pipeline-estado.manifesto"
TAMANHO_PARTE="${ESTADO_TAMANHO_PARTE:-1900m}"
TMP="${ESTADO_TMP:-${RUNNER_TEMP:-/tmp}/estado-duravel}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY ausente}"

salvar() {
  rm -rf "$TMP" && mkdir -p "$TMP"
  tar -cf - data/silver data/bronze | zstd -q -T0 -10 -o "$TMP/$PREFIXO"
  (cd "$TMP" && split -b "$TAMANHO_PARTE" -d -a 2 "$PREFIXO" "$PREFIXO." && rm "$PREFIXO")
  (cd "$TMP" && sha256sum "$PREFIXO".* > "$MANIFESTO")
  gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1 || \
    gh release create "$TAG" --repo "$REPO" --prerelease --title "Estado do pipeline do crédito" \
      --notes "Cópia durável de data/silver e data/bronze (uso interno do pipeline). Não é dado publicado."
  # partes primeiro, manifesto por último
  for p in "$TMP/$PREFIXO".*; do
    gh release upload "$TAG" "$p" --repo "$REPO" --clobber
  done
  gh release upload "$TAG" "$TMP/$MANIFESTO" --repo "$REPO" --clobber
  # partes que sobraram de uma cópia maior
  local novas
  novas=$(cd "$TMP" && ls "$PREFIXO".*)
  { gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[].name' \
      | grep "^$PREFIXO\." | grep -vxF "$novas" || true; } \
    | xargs -r -I{} gh release delete-asset "$TAG" {} --repo "$REPO" --yes
  echo "Cópia durável salva: $(cd "$TMP" && du -ch "$PREFIXO".* | tail -1 | cut -f1) em $(echo "$novas" | wc -l) parte(s)."
}

restaurar() {
  rm -rf "$TMP" && mkdir -p "$TMP"
  gh release download "$TAG" --repo "$REPO" --pattern "$MANIFESTO" --dir "$TMP"
  while read -r _ nome; do
    gh release download "$TAG" --repo "$REPO" --pattern "$nome" --dir "$TMP"
  done < "$TMP/$MANIFESTO"
  (cd "$TMP" && sha256sum -c --quiet "$MANIFESTO")
  mkdir -p data
  cat $(awk '{print "'"$TMP"'/" $2}' "$TMP/$MANIFESTO" | sort) | zstd -q -d | tar -xf - -C .
  echo "Estado restaurado da cópia durável ($(wc -l < "$TMP/$MANIFESTO") parte(s))."
}

case "${1:-}" in
  salvar) salvar ;;
  restaurar) restaurar ;;
  *) echo "uso: $0 salvar|restaurar" >&2; exit 2 ;;
esac
