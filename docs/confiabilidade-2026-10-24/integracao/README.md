# Evidências da composição final — 24/10/2026

Esta branch serve exclusivamente à reprodução e à rastreabilidade dos testes. Não é proposta de merge; as correções permanecem nos PRs #375, #376, #377 e #378. Nada foi integrado à main ou publicado em produção.

## Código testado

- Integração final local: `d651c73954307e45b6b2693256f3a244626c4db1`.
- Crédito: `ca5880e991bca67a766a377eb22be96b772f90cd` (#375).
- Energia: `aaadffd4aa979e08faeefd757582a80633b626ac` (#376).
- RTN: `401f4a0dc01288e8785357a79b287b8976c25fce` (#377).
- Operações: `f10c412d904e0d37d33cb5bb507500cd88738600` (#378).
- Base: `7d4c2ee77282c0d6c22fd3902869b9d2ac82cd7f`.

## Comandos efetivamente executados

1. `bash scripts/preparar-sessao.sh` em cada checkout antes dos testes.
2. `npm run verificar:pr` na composição inicial `c161dfd2fde6866e165098e4c118c2064f1e3a72`: **aprovado**, 18 min 41 s; 2.423 testes Python principais e suítes complementares, lint, tipos, build de produção, 68 telas/224 verificações do Judiciário, 385 arquivos Vitest (9.515 aprovados, 12 skipped preexistentes, 1 todo). [Log integral](../operacoes/integracao-completo.txt).
3. Depois dos ajustes exclusivamente Python e evidências (DataJud, título RTN, monitoramento), `npm run verificar:pr -- --etapas compileall,python` na composição final: **aprovado**, 3 min 01 s; **2.431 testes Python principais, 73 de pesquisa e 66 complementares**. [Log integral](python-final.txt).
4. `npm run verificar:rapido` na mesma composição final: **aprovado**, 55 s; lint, tipos, cobertura e **1.627 testes afetados em 46 arquivos**, dois ignorados pelo filtro. [Log integral](rapido-final.txt).
5. Parse com `js-yaml` dos cinco workflows alterados: estrutura válida; `simular.default === true` nos dois envios. Nenhum workflow de coleta/publicação/envio foi disparado.

Nenhum teste foi removido ou enfraquecido. Logs com falhas sintéticas esperadas fazem parte dos testes de retenção; o resultado das suítes é aprovado. Este commit posterior apenas anexa os registros aos commits testados.

O CI de cada PR é independente e está ligado ao seu SHA nas descrições. As coletas oficiais novas e a disponibilidade autenticada em produção permanecem **não homologadas**, conforme [relatório executivo](../operacoes/RELATORIO.md). CI verde não comprova atualização de dados.
