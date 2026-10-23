#!/usr/bin/env bash
# Deixa uma sessão nova (de agente ou de pessoa) pronta para testar. Idempotente.
#
#   bash scripts/preparar-sessao.sh
#
# Chamado pelo hook SessionStart de .claude/settings.json nas sessões do Claude Code; outros
# agentes rodam à mão antes de qualquer teste (CLAUDE.md e AGENTS.md).
#
# Por que existe: até 22/10/2026 cada sessão em nuvem clonava, instalava e precisava lembrar de
# materializar os derivados e minificar a SPA; o histórico tem falhas por ENOENT exatamente por
# esquecer isso (scripts/vitest-worktree-setup.mjs, ci.yml). Na sessão de 22/10/2026 havia ainda
# um Chromium de revisão diferente da que o Playwright do lockfile procura, e três arquivos de
# teste de navegador caíram por isso, e o tsc e o build abortaram pelo limite padrão de 2 GB de
# heap do Node num contêiner de 15 GB.
#
# O que faz:
#  1. dependências: npm ci só se node_modules faltar ou o lockfile tiver mudado desde a última
#     instalação (hash em node_modules/.lockfile-hash). Na máquina de uma pessoa, com node_modules
#     presente e lockfile diferente, só avisa: apagar node_modules sem pedir seria surpresa;
#  2. derivados: npm run preparar (materializadores e app.min.js);
#  3. Chromium: se a revisão esperada pelo Playwright não existe, usa um Chromium instalado que
#     abra pelo Playwright do projeto (I18N_CHROMIUM_EXECUTABLE, lido pelos testes e scripts) ou,
#     onde baixar é permitido, instala a revisão certa;
#  4. heap do Node em 4 GB quando a máquina tem até 16 GB e NODE_OPTIONS não define outro.
# As variáveis vão para $CLAUDE_ENV_FILE quando o hook o oferece; fora do hook, o script imprime
# a linha de export para a shell atual.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"
LOG="$(mktemp -t preparar-sessao.XXXXXX.log)"
INICIO=$(date +%s)
EXPORTS=()
MANTER_LOG=0
remota() { [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || [ -n "${CI:-}" ]; }
passo() { printf '  %-12s %s\n' "$1" "$2"; }

echo "Preparando a sessão em $RAIZ"

# 1. Dependências
hash_lock="$(sha256sum package-lock.json | cut -d' ' -f1)"
hash_inst="$(cat node_modules/.lockfile-hash 2>/dev/null || true)"
if [ ! -d node_modules ] || { [ "$hash_lock" != "$hash_inst" ] && remota; }; then
  npm ci --prefer-offline --no-audit --no-fund >>"$LOG" 2>&1 || { echo "npm ci falhou; log em $LOG"; tail -20 "$LOG"; exit 1; }
  echo "$hash_lock" > node_modules/.lockfile-hash
  passo "dependências" "instaladas (npm ci)"
elif [ "$hash_lock" != "$hash_inst" ] && [ -n "$hash_inst" ]; then
  passo "dependências" "AVISO: package-lock.json mudou desde a última instalação; rode npm ci"
elif [ -z "$hash_inst" ]; then
  passo "dependências" "presentes (instaladas fora deste script; não conferidas contra o lockfile)"
else
  passo "dependências" "em dia com o lockfile"
fi

# 2. Derivados gitignorados (o script preparar entra com o pacote "Ciclo: um comando antes do
# push"; antes dele, o predev faz o mesmo: materializadores e minificador)
alvo_preparar="preparar"
node -e 'process.exit(require("./package.json").scripts?.preparar ? 0 : 1)' || alvo_preparar="predev"
npm run --silent "$alvo_preparar" >>"$LOG" 2>&1 || { echo "npm run $alvo_preparar falhou; log em $LOG"; tail -20 "$LOG"; exit 1; }
passo "derivados" "materializados e app.min.js gerado (npm run $alvo_preparar)"

# 3. Chromium do Playwright
# o pacote não exporta browsers.json para require: lê o arquivo
revisao="$(node -p 'JSON.parse(require("fs").readFileSync("node_modules/playwright-core/browsers.json", "utf8")).browsers.find(b => b.name === "chromium-headless-shell").revision')"
pasta_nav="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
abre() { node -e 'require("playwright").chromium.launch({ executablePath: process.argv[1] }).then(b => b.close()).then(() => process.exit(0), () => process.exit(1))' "$1" >/dev/null 2>&1; }
if [ -d "$pasta_nav/chromium_headless_shell-$revisao" ]; then
  passo "chromium" "revisão $revisao presente"
elif [ -n "${I18N_CHROMIUM_EXECUTABLE:-}" ] && abre "$I18N_CHROMIUM_EXECUTABLE"; then
  passo "chromium" "revisão $revisao ausente; I18N_CHROMIUM_EXECUTABLE já aponta para um que abre"
elif [ -n "${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-}" ]; then
  achado=""
  for cand in "$pasta_nav/chromium" "$pasta_nav"/chromium-*/chrome-linux/chrome "$pasta_nav"/chromium-*/chrome-linux64/chrome /usr/bin/chromium /usr/bin/chromium-browser; do
    [ -x "$cand" ] && abre "$cand" && { achado="$(readlink -f "$cand")"; break; }
  done
  if [ -n "$achado" ]; then
    EXPORTS+=("I18N_CHROMIUM_EXECUTABLE=$achado" "CHROMIUM_PATH=$achado" "CHROMIUM=$achado")
    passo "chromium" "revisão $revisao ausente e download desligado; usando $achado"
  else
    passo "chromium" "AVISO: revisão $revisao ausente, download desligado e nenhum Chromium instalado abre; testes de navegador vão falhar"
  fi
else
  if npx --no-install playwright install chromium >>"$LOG" 2>&1; then passo "chromium" "revisão $revisao instalada"
  else MANTER_LOG=1; passo "chromium" "AVISO: não foi possível instalar a revisão $revisao (log em $LOG)"; fi
fi

# 4. Heap do Node
mem_gb=$(( $(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0) / 1048576 ))
if [ "$mem_gb" -le 16 ] && [[ "${NODE_OPTIONS:-}" != *max-old-space-size* ]]; then
  EXPORTS+=("NODE_OPTIONS=${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=4096")
  passo "heap" "4 GB para o Node (máquina com ${mem_gb} GB; o padrão de 2 GB derruba tsc e build)"
fi

if [ "${#EXPORTS[@]}" -gt 0 ]; then
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    for e in "${EXPORTS[@]}"; do printf 'export %q\n' "$e" >> "$CLAUDE_ENV_FILE"; done
    passo "ambiente" "variáveis gravadas para a sessão"
  else
    echo "Para esta shell:"
    printf '  export'; for e in "${EXPORTS[@]}"; do printf ' %q' "$e"; done; printf '\n'
  fi
fi

echo "Pronto em $(( $(date +%s) - INICIO )) s. Antes de empurrar:"
if node -e 'process.exit(require("./package.json").scripts?.["verificar:rapido"] ? 0 : 1)'; then
  echo "  npm run verificar:rapido   lint, tipos, cobertura e testes afetados"
  echo "  npm run verificar:pr       o que o CI roda, na mesma ordem"
  echo "  npm run preparar           derivados de novo, se mudar semente ou app.js"
else
  echo "  npm run lint && npx tsc --noEmit && node scripts/cobertura-i18n.mjs --check && npx vitest run <arquivos>"
fi
[ "$MANTER_LOG" = 1 ] || rm -f "$LOG"
