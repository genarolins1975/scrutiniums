#!/usr/bin/env bash
# Testes de conteúdo da gold de energia antes de publicar (uma rodada): build de produção, vitest e a suíte Python.
# Escreve build-testes.log, vitest-resultado.json, pipeline-testes.log e testes-codigos.txt ("vitest=V pipeline=P build=B").
# Sai com 0 só quando as três passam. Chamado pelo workflow atualizar-energia.yml na rodada 0 e, depois da retenção por
# gold (scripts/energia_reter_por_gold.py), na rodada 1 sobre a publicação recomposta.
set +e
export NODE_OPTIONS=--max-old-space-size=4096
export EXIGIR_BUILD_HTML=1
# 27/10/2026: HTML precisa corresponder à gold candidata. Falha de build retém a publicação e não impede o diagnóstico da suíte Python.
npm run build > build-testes.log 2>&1
B=$?
cat build-testes.log
V=1
if [ "$B" = "0" ]; then
  npx vitest run --reporter=default --reporter=json --outputFile.json=vitest-resultado.json
  V=$?
fi
python3 -m unittest discover -s pipeline/tests -t . 2>&1 | tee pipeline-testes.log
P=${PIPESTATUS[0]}
echo "vitest=$V pipeline=$P build=$B" | tee testes-codigos.txt
[ "$B$V$P" = "000" ]
