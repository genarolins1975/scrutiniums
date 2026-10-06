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

Conta de luz e Inclusão concluíram o ciclo (revisões às 06h UTC). Visão geral disparada: wf_5a1e8713-058.
| Dados e metodologia | nenhuma | todas |

## 01/10/2026: corte da Fase 1 e publicação

Por decisão do responsável ("defina uma fase e coloque em produção"), o trabalho foi recortado na Fase 1 (`FASE_1.md`) e levado à `main` pelo PR #115. Os fluxos de módulos foram encerrados pela interrupção da sessão; nenhum agente fica rodando.

Trabalho parcial dos agentes interrompidos (Visão geral nova, Território, Dados, correções de Expansão, Empresas, Geração e Transição) ficou fora do corte. Depois da integração da Fase 1, ele volta ao branch `claude/new-session-essnx9` num commit próprio ("Fase 2: trabalho parcial dos agentes"), a partir do stash `fase2-wip-agentes`.

Para retomar a Fase 2:

1. Ler `FASE_1.md` (o que ficou de fora e as duas decisões pendentes com o responsável: coleta da CCEE e revisão das interfaces de PLD e Previsões).
2. Fluxos de módulos: o script está em `~/.claude/projects/.../workflows/scripts/modulos-energia-wf_d8ec3241-4c4.js` da sessão original; numa sessão nova, refazer a partir dos documentos de cada módulo em `modulos/*.md`, que registram fontes, método, estado e pedidos ao integrador.
3. Pendências conhecidas: P023 e P024 (Geração), Mercado (P032 a P035), Visão geral (P004 a P007), Aprenda (P065, P066), interface nova de Dados e Metodologia (P067 a P070), avaliação (P071), 120 datas cruas em textos de módulos, páginas acima de 600 KB sem compressão (Geração, Território, Qualidade).

## 06/10/2026: Fase 2, Visão geral nova em produção

* Branch de trabalho: `claude/kind-mayer-v9tpwi`, reiniciado a partir da `main` (`2065ba07f`, Fase 1 em produção). O conteúdo anterior desse branch (redesenho visual de setembro sobre a base pré Fase 1, último commit `1592f9efe`, tag local `redesenho-visual-2026-09` na sessão) ficou fora: conflitava em 13 arquivos com a Fase 1 e foi superado por ela. Porte pendente do que não existe na `main`: home e seletor de observatórios com painéis vivos de dado real (`PainelObservatorio`, `MiniaturaEnergia`, `MiniaturaCredito`, `src/lib/amostras.ts`), `docs/observatorios/DESIGN_VISUAL_GRAMMAR_ENERGIA.md` e os testes compatíveis.
* Decisões do responsável nesta data: base da Fase 2 é a `main`; prioridade inicial é a Visão geral (P004 a P007); coleta da CCEE autorizada com o cliente do pipeline (ver `FASE_1.md`, "Decisões tomadas em 06/10/2026").

### Entregue: Visão geral (P004 a P007)

* `src/app/setor-eletrico/visao-geral/page.tsx` reescrita sobre `sintese.json` (`SinteseVisaoGold`) com os componentes já existentes (`VisaoPagina`, `VisaoFrases`, `VisaoDeterminantes`, `VisaoSociedade`, `VisaoObservar`, `VisaoRegras`, `VisaoFaixaEstados`, `VisaoLinkPainel`). Quatro painéis numa página, cada um com a anatomia da seção 7.2; modos Entender, Analisar e Auditar; âncoras antigas da página inicial preservadas (`ANCORAS_DETERMINANTES` em `src/lib/energia/visao.ts`).
* Peso (seção 5.1 do contrato): 964 KB na primeira versão, 530 KB publicados. O que mudou: `ComproveNumero` ganhou `sobDemanda` (URL de JSON publicado e caminho da evidência; a ficha é lida na primeira abertura, uma leitura por URL compartilhada); `VisaoTabelasSobDemanda` lê da gold as tabelas de auditoria do P004 e de análise do P007 quando o bloco aparece; `VisaoObservar` lê o detalhe de cada regra ao abrir. Leitura compartilhada em `src/lib/energia/carregaJson.ts` (`carregaJson`, `lerCaminho`).
* Datas do pipeline em texto (controles, evidência das regras, componentes das frases) passam por `datasLegiveis`; a página não tem data crua.
* Verificação: `next build` sem erro; vitest 2.470 aprovados com a única falha pré-existente e documentada (datas cruas em 22 páginas de outros módulos); testes Python aprovados; inspeção em 360, 390, 768 e 1440 px sem violação axe e sem rolagem horizontal; ficha de prova, detalhe de regra, tabelas sob demanda e estado na URL conferidos em navegador.
* Testes: `src/tests/energia-visao.test.ts` (contrato da gold, equivalência célula a célula com as golds de origem por outro caminho, textos derivados dos números, âncoras, renderização, peso, datas); `energia-mapa` e `energia-reauditoria` ajustados à nova ligação (as âncoras dos cartões vêm de `visao.ts`; a proveniência de cada número está na gold da síntese).
* Documentação: `FASE_1.md` (estado dos painéis e decisões), `status_paineis.json` e `MATRIZ_PAINEIS.md` (P004 e P005 concluídos; P006 e P007 concluídos com limitação declarada), `modulos/visao.md` (estado da interface).

### Entregue: Mercado (P032 a P035)

* Autorização da coleta da CCEE registrada no código (`ccee_mercado.DECISAO_ACESSO`, situação `autorizada`, decidida em 06/10/2026), no workflow (`ENERGIA_CCEE_COLETA: "1"` no passo do pipeline) e nos testes (`AcessoCcee` em Python; bloco de acesso em `energia-mercado.test.ts`). A trava pela variável continua: sem ela, nenhuma requisição à CCEE.
* Coleta de 06/10/2026 (16h58 a 17h01 de Brasília) com o cliente do pipeline: 17 conjuntos e InfoMercado Nº 206, 208 e 229, todos HTTP 200. Consumo, agentes, GSF e encargos da CCEE passaram de julho para agosto de 2026. Os KPIs mudaram com a janela (ACL de 12 meses: 42,51% até jul/2026, 42,43% até ago/2026; GSF do mês: 76,8% em jul, 78,9% em ago); os testes TS com números fixos passaram a conferir a janela de julho pela série mensal e a janela vigente pela razão de somas.
* Falha encontrada e corrigida na reconstrução: o silver restaurado da cópia durável aponta para arquivos do bronze que não estão na máquina; a página da pasta de 2023 do boletim do MME, recapturada igual, ficou com outro nome. `base.abre_bronze` passou a abrir a cópia de mesmo sha256 da mesma pasta (teste em `test_energia.py`). O mesmo cenário acontece no Actions quando o cache falta.
* Interface: quatro páginas (`/setor-eletrico/mercado`, `/agentes`, `/mre-e-gsf`, `/encargos`) com `MercadoPainel.tsx`, `MercadoTabelasSobDemanda.tsx` e `src/lib/energia/mercado.ts`; navegação, mapa e cartões da home marcam o Mercado como integrado; verbete MRE conferido com o glossário do InfoMercado Nº 229; ACL, ACR, GSF, ESS e garantia física seguem pendentes de fonte primária.
* Verificação: `next build` sem erro; HTML pré-renderizado de 456, 400, 308 e 427 KB; inspeção em 360, 390, 768 e 1440 px, nos modos Entender e Auditar, sem violação axe, sem rolagem horizontal e sem link quebrado (único erro de console: `favicon.ico` do site, 404, anterior); tabelas sob demanda conferidas no navegador; testes em `energia-mercado-pagina.test.ts` (15) e `energia-mercado.test.ts` (14).
* Estado: P032, P033 e P035 concluídos com limitação; P034 parcial (o "ajuste médio do MRE nos últimos doze meses" do InfoMercado não é reproduzido por nenhuma definição testada). Revisão adversarial da interface pendente.

### Entregue: Geração P023 e P024

* `/setor-eletrico/geracao/restricoes` (P023) e `/setor-eletrico/geracao/capacidade` (P024) sobre `geracao_detalhe.json` (gold de 01/10/2026: meses até 08/2026, dias até 29/09/2026; coleta da Geração não refeita nesta etapa). Componentes cliente `GeracaoRestricoes.tsx` (painel e análise da fonte escolhida, mapa das usinas com a malha lida sob demanda, histórico da usina lido do CSV ao pedir) e `GeracaoCapacidade.tsx` (distribuição por usina e ANEEL × ONS); o resto é servidor. Navegação da Geração sem "em preparação"; cartão da home com os quatro painéis.
* Peso: 502 KB (P023, depois de passar a análise para a fonte escolhida e enxugar as props; a primeira versão tinha 388 KB só de marcação) e 409 KB (P024).
* Achados: 2 de 100 marcas do mapa com a subestação coletora em UF vizinha à informada pelo ONS (declarado na nota do mapa); maior corte simultâneo das eólicas de 28.196,7 MW, 83% da potência eólica despachada, conferido pelo pipeline contra a soma das referências e sem conferência independente nesta etapa (bronze ausente); ordenação de meses por alfabeto corrigida na tabela interativa para todos os módulos; concordância "de a" no aviso de defasagem corrigida.
* Verificação: build sem erro; vitest 2.532 aprovados com a única falha pré-existente (datas cruas em páginas de outros módulos); inspeção em 360, 390, 768 e 1440 px nos modos Entender e Auditar sem violação axe e sem rolagem horizontal; testes em `src/tests/energia-geracao.test.ts` (13).
* Estado: P023 e P024 concluídos com limitação declarada; revisão adversarial da interface pendente.

### Próximos passos da Fase 2

1. Aprenda (P065, P066), Dados e metodologia (P067 a P070), avaliação (P071).
2. Revisão adversarial das interfaces publicadas sem revisão (inclui a Visão geral, o Mercado e a Geração P023 e P024), quando autorizada.
3. Porte da home e do seletor com painéis vivos e da gramática visual (ver acima).
4. Datas cruas nos textos dos módulos (22 páginas) e páginas acima de 600 KB (Geração P021 com 1 MB e P022 com 623 KB, Território, Qualidade).
5. Mercado: verbetes ACL, ACR, GSF, ESS e garantia física com as Regras de Comercialização da CCEE; planilhas "InfoMercado Dados Gerais" para estender as séries da CCEE antes de 2023.

