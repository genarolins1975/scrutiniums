#!/usr/bin/env bash
# Abre a issue com o título dado ou, se já houver uma aberta, comenta nela. Usado pelos workflows
# de atualização agendada (atualizar-saneamento, atualizar-contas-publicas, atualizar-contas-estaduais,
# atualizar-eficiencia). A issue nasce atribuída ao dono do repositório: alerta sem responsável
# virou 33 comentários sem ação na retenção do Crédito (OPERACOES.md, terceira memória).
#
#   scripts/issue_dedup.sh "<título>" <arquivo com o corpo>
#
# Se o corpo tiver uma linha "Assinatura: ...", e a issue aberta (corpo ou último comentário) já
# tiver a mesma linha, não comenta de novo: o vigia semanal não repete o mesmo aviso.
# Requer GH_TOKEN e GITHUB_REPOSITORY (o Actions define o segundo).
set -euo pipefail
TITULO="$1"
CORPO="$2"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY ausente}"
ASSINATURA=$(grep -m1 '^Assinatura: ' "$CORPO" || true)
EXISTENTE=$(gh issue list --repo "$REPO" --state open --search "\"$TITULO\" in:title" \
  --json number,title --jq "map(select(.title == \"$TITULO\")) | .[0].number // empty")
if [ -z "$EXISTENTE" ]; then
  gh issue create --repo "$REPO" --title "$TITULO" --body-file "$CORPO" --assignee "${GITHUB_REPOSITORY_OWNER:-}" \
    || gh issue create --repo "$REPO" --title "$TITULO" --body-file "$CORPO"
  exit 0
fi
if [ -n "$ASSINATURA" ]; then
  ULTIMO=$(gh issue view "$EXISTENTE" --repo "$REPO" --json body,comments --jq '[.body] + [.comments[].body] | last')
  if printf '%s\n' "$ULTIMO" | grep -qxF "$ASSINATURA"; then
    echo "Issue #$EXISTENTE já registra '$ASSINATURA': sem comentário novo."
    exit 0
  fi
fi
gh issue comment "$EXISTENTE" --repo "$REPO" --body-file "$CORPO"
