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
# arquivo de release).
#
# Cada cópia é uma GERAÇÃO com nomes próprios (pipeline-estado.<AAAAMMDDhhmmss>.*):
# nada da cópia anterior é sobrescrito. O manifesto da geração sobe depois de todas
# as partes, e só então as gerações antigas são apagadas. Falha no meio do envio
# deixa a cópia anterior intacta; a restauração tenta da geração mais nova para a
# mais antiga e só extrai uma cópia inteira, com sha256 conferido.
set -euo pipefail

TAG="${ESTADO_TAG:-pipeline-estado}"
BASE="pipeline-estado"
TAMANHO_PARTE="${ESTADO_TAMANHO_PARTE:-1900m}"
TMP="${ESTADO_TMP:-${RUNNER_TEMP:-/tmp}/estado-duravel}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY ausente}"

ativos() {
  gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[].name' 2>/dev/null || true
}

salvar() {
  local ger="${ESTADO_GERACAO:-$(date -u +%Y%m%d%H%M%S)}"
  local pref="$BASE.$ger.tar.zst" man="$BASE.$ger.manifesto"
  rm -rf "$TMP" && mkdir -p "$TMP"
  tar -cf - data/silver data/bronze | zstd -q -T0 -10 -o "$TMP/$pref"
  (cd "$TMP" && split -b "$TAMANHO_PARTE" -d -a 2 "$pref" "$pref." && rm "$pref")
  (cd "$TMP" && sha256sum "$pref".* > "$man")
  gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1 || \
    gh release create "$TAG" --repo "$REPO" --prerelease --title "Estado do pipeline do crédito" \
      --notes "Cópia durável de data/silver e data/bronze (uso interno do pipeline). Não é dado publicado."
  for p in "$TMP/$pref".*; do
    gh release upload "$TAG" "$p" --repo "$REPO"
  done
  gh release upload "$TAG" "$TMP/$man" --repo "$REPO"
  # só agora a geração nova está inteira: as anteriores saem
  { ativos | grep "^$BASE\." | grep -v "^$BASE\.$ger\." || true; } \
    | xargs -r -I{} gh release delete-asset "$TAG" {} --repo "$REPO" --yes
  echo "Cópia durável $ger salva: $(cd "$TMP" && du -ch "$pref".* | tail -1 | cut -f1) em $(wc -l < "$TMP/$man") parte(s)."
}

restaurar_geracao() {
  local man="$1" nome
  rm -rf "$TMP" && mkdir -p "$TMP"
  gh release download "$TAG" --repo "$REPO" --pattern "$man" --dir "$TMP" || return 1
  while read -r _ nome; do
    gh release download "$TAG" --repo "$REPO" --pattern "$nome" --dir "$TMP" || return 1
  done < "$TMP/$man"
  (cd "$TMP" && sha256sum -c --quiet "$man") || return 1
  mkdir -p data
  awk -v d="$TMP" '{print d "/" $2}' "$TMP/$man" | sort | xargs cat | zstd -q -d | tar -xf - -C . || return 1
  echo "Estado restaurado da cópia durável ${man#"$BASE".} ($(wc -l < "$TMP/$man") parte(s))."
}

restaurar() {
  local manifestos m
  manifestos=$(ativos | grep "^$BASE\.[0-9]*\.manifesto$" | sort -r || true)
  [ -n "$manifestos" ] || { echo "Nenhuma cópia durável na release $TAG." >&2; return 1; }
  for m in $manifestos; do
    if restaurar_geracao "$m"; then return 0; fi
    echo "Cópia $m incompleta ou corrompida; tentando a anterior." >&2
    rm -rf data/silver data/bronze
  done
  return 1
}

case "${1:-}" in
  salvar) salvar ;;
  restaurar) restaurar ;;
  *) echo "uso: $0 salvar|restaurar" >&2; exit 2 ;;
esac
