# Evidências da composição das quatro correções — 24/10/2026

Esta branch serve à reprodução e rastreabilidade; não é proposta de merge. As correções permanecem nos PRs #375, #376, #377 e #378. Nenhum desses PRs foi integrado à main, nenhum dado foi publicado e nenhum envio real foi realizado.

## Última composição validada

- Integração: `3c8f594cc0efbf5f78319cf62a7fab81f8e42147`.
- Crédito: `ca5880e991bca67a766a377eb22be96b772f90cd` (#375).
- Energia: `aaadffd4aa979e08faeefd757582a80633b626ac` (#376).
- RTN: `401f4a0dc01288e8785357a79b287b8976c25fce` (#377).
- Operações: `643a6e3240d82ddf24e42e2b5c275e3ba22727c0` (#378).
- Base: `7d4c2ee77282c0d6c22fd3902869b9d2ac82cd7f`.

## Execuções efetivas e seus limites

| Código testado | Comando | Resultado | Evidência |
|---|---|---|---|
| Integração inicial `c161dfd2fde6866e165098e4c118c2064f1e3a72` | `npm run verificar:pr` | Aprovado: lint, tipos, build, 68 telas/224 verificações do Judiciário, 385 arquivos Vitest (9.515 aprovados, 12 skipped preexistentes e 1 todo), suíte Python de 2.423 testes e complementares; 18 min 41 s | [Log completo](../operacoes/integracao-completo.txt) |
| Integração `d651c73954307e45b6b2693256f3a244626c4db1` | `npm run verificar:pr -- --etapas compileall,python` e `npm run verificar:rapido` | Aprovados após DataJud, título RTN e fontes auxiliares: 2.431 testes Python principais + 73 + 66; 1.627 Vitest afetados | [Python](python-final.txt), [rápido](rapido-final.txt) |
| Integração `a9ea2fcb0b6b419b5a07b0907b36ec8854d0a586` | Mesmos comandos da linha anterior | Aprovados após continuação do resumo, proteção do diagnóstico e prazo Judicial: suíte Python com 2.439 testes principais e complementares; verificador rápido aprovado | [Python](python-apos-revisao.txt), [rápido](rapido-apos-revisao.txt) |
| Última integração `3c8f594cc0efbf5f78319cf62a7fab81f8e42147` | `npm run verificar:pr -- --etapas compileall,python` | Aprovado após impedir redirects: **2.440 testes principais (11 skipped preexistentes), 73 de pesquisa e 66 complementares** | [Log final](python-ultima-versao.txt) |
| Operações `643a6e324` | `npm run verificar:rapido` + suítes focadas | Aprovados: 50 Vitest e 14 Python focados; nenhuma rede, credencial ou notificação real nos testes | [Rápido](../operacoes/rapido.txt), [Vitest](../operacoes/notificacoes-testes.txt), [Python](../operacoes/revisao-python.txt) |

As suítes Python principais acima têm os mesmos 11 casos preexistentes ignorados; não são apresentados como testes efetivamente executados. Nenhum teste foi removido ou enfraquecido. Os logs preservam falhas sintéticas esperadas nas provas de retenção e distinguem cada commit; uma execução anterior não é atribuída a um código posterior.

Preparação: `bash scripts/preparar-sessao.sh` em cada checkout. Node 22.23.3, Python 3.12, pyarrow e Chromium conforme o repositório. Os cinco workflows alterados foram interpretados com `js-yaml`; estrutura válida, simulação padrão nos envios. Nenhum workflow que coleta, publica ou envia foi disparado.

O CI independente de cada PR verifica seu próprio SHA; as descrições apontam para as execuções correspondentes. Os dois achados da revisão automática do PR #378 foram tratados com regressões: continuação dentro da janela diária e prazo `datajud` de 75 dias para Judicial. O disparador falha explicitamente se exceder oito lotes, mudar de dia com pendências ou receber erro; não oculta entregas pendentes, não segue redirects nem expõe o segredo.

A coleta oficial atual e a disponibilidade autenticada em produção permanecem **não homologadas**. [Relatório executivo e dependências externas](../operacoes/RELATORIO.md). CI verde não comprova atualização de dados. Este commit posterior apenas anexa evidências aos commits testados.
