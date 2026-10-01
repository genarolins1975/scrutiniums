# Continuidade: estado exato para retomar o trabalho

Atualizado a cada etapa. Quem retoma lê este arquivo primeiro, depois `DECISOES_E_LIMITACOES.md` e `MATRIZ_PAINEIS.md`.

## Estado em 30/09/2026 (sessão de implementação da especificação mestre)

* Branch de trabalho: `claude/new-session-essnx9` (base `d95d8f8b4`).
* Especificação: `docs/observatorios/energia/ESPECIFICACAO.md` (71 painéis P001 a P071, achados A01 a A12).
* Contrato dos módulos: `docs/observatorios/energia/CONTRATO_MODULOS.md`.

### Infraestrutura entregue

* `pipeline/energia/modulos/` (registro por descoberta), `pipeline/energia/metricas/` (catálogo de métricas), `pipeline/energia/fontes/ckan.py` (coletor CKAN em fluxo com política de recoleta), `base.conecta_familia`, `base.grava_registros`/`registros_como_estavam_em`/`historico_registro`, `base.salva_bronze_arquivo`, `pipeline/energia/entidades.py`, `pipeline/energia/executar_modulo.py`, `pipeline/tests/test_energia_infra.py`.
* `run.py` executa os módulos depois das golds de operação e publica `metricas.json` e `arquivos.json`.
* Interface: `lerGold<T>()` em `gold.ts`, `metricas.ts`, `DATASETS_INTEGRADOS` e `COLUNAS_ARQUIVO` recebem os conjuntos dos módulos pelo catálogo, verbetes por módulo (`conceitos-<modulo>.ts`).
* Workflow `atualizar-energia.yml`: `pyarrow`, timeout de 150 min e cópia durável dos silvers das famílias. CI instala `pyarrow` antes dos testes Python.
* `scripts/energia-inspecao.mjs`: inspeção visual e de acessibilidade.

### Comandos úteis

```bash
# silver durável (repositório público)
curl -sL -o /tmp/s.gz https://github.com/genarolins1975/scrutiniums/releases/download/energia-estado/energia-silver.db.gz
mkdir -p data/energia/silver && gunzip -c /tmp/s.gz > data/energia/silver/energia.db
pip install -r pipeline/energia/requirements.txt
python3 pipeline/energia/executar_modulo.py --listar
python3 pipeline/energia/executar_modulo.py <id> [--sem-coleta]
python3 -u pipeline/energia/run.py --sem-coleta
node scripts/minify-obs.mjs && npx vitest run && python3 -m unittest discover -s pipeline/tests -t .
npx next build && npx next start -p 3100
PW_CORE=<playwright-core> node scripts/energia-inspecao.mjs --base http://localhost:3100 --saida /tmp/inspecao
```

### Em execução / próximos passos

Ver `MATRIZ_PAINEIS.md` (estado por painel) e a seção final deste arquivo, atualizada ao fim de cada onda.

## Execução em andamento (30/09/2026, após reinício do contêiner às ~22h30 UTC)

O contêiner reiniciou e interrompeu os fluxos; o disco sobreviveu (silvers, bronze e arquivos parciais). Fluxos relançados com instrução de retomada a partir dos arquivos existentes e disciplina de memória (Parquet em lotes, processo abaixo de 2 GB):

| Fluxo | Módulos | Run ID |
| --- | --- | --- |
| Biblioteca de componentes (concluída às 23h20 UTC; revisão corrigiu 8 defeitos) | 17 componentes e hooks, catálogo em docs/observatorios/COMPONENTES_ENERGIA.md | wf_4b729d6c-a2b |
| Módulos W1 | perdas, qualidade | wf_6e201925-cf8 |
| Módulos W2 | conta, inclusão | wf_1a982800-0da |
| Módulos W4 | regulação, pld, previsões | wf_a93ab047-902 |
| Módulos W3 | expansão, transição, empresas | wf_f8321428-1d4 |
| Módulos W5 | água e clima, carga | wf_091c0372-524 |
| Módulos W6 | geração, rede, mercado | wf_61f40fd7-0cf |
| Dados e metodologia (P067 a P070) | dados | wf_cd0347b1-741 |
| Benchmarks (concluído; docs/observatorios/energia/BENCHMARKS.md) | benchmarks | wf_2a3335e6-649 |

Pendentes de disparo: água e clima e carga (`scratchpad/wave2a.json`), geração, rede e mercado (`scratchpad/wave2b.json`); depois visão geral, aprenda, dados e metodologia, home, integração, auditoria e documentação final. Descoberta de fontes: inventário, ONS e ANEEL distribuição concluídos; tarifas/social, geração/expansão/empresas, outras fontes, benchmarks e crítico interrompidos (os módulos verificam as próprias fontes; benchmarks e crítico ainda precisam rodar).

## 01/10/2026: limite de sessão e segundo reinício

Entre 03h20 e 05h40 UTC os agentes falharam por limite de sessão da conta ("You've hit your session limit · resets 3:20am (UTC)") e o contêiner reiniciou de novo (disco preservado). Às 05h45 UTC os sete fluxos de módulos foram retomados com `resumeFromRunId` e os mesmos argumentos: etapas concluídas voltam do cache e só as interrompidas rodam. Estado na retomada:

| Módulo | Etapas concluídas | Pendentes |
| --- | --- | --- |
| Perdas, Qualidade | dados, verificação, correção, interface | revisão |
| Conta de luz | todas | nenhuma |
| Inclusão | dados, verificação, correção, interface | revisão |
| Regulação | dados, verificação, correção | interface, revisão |
| PLD | dados, verificação, correção | interface, revisão |
| Previsões | dados, verificação | correção, interface, revisão |
| Expansão, Empresas | dados, verificação | correção, interface, revisão |
| Transição | dados, verificação, correção | interface, revisão |
| Água e clima | dados | verificação em diante |
| Carga | dados, verificação | correção em diante |
| Geração, Rede | dados | verificação em diante |
| Mercado | nenhuma | todas |
| Dados e metodologia | nenhuma | todas |
