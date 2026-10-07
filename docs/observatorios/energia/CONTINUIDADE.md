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
3. Pendências conhecidas: P023 e P024 (Geração), Mercado (P032 a P035), Visão geral (P004 a P007), Aprenda (P065, P066), interface nova de Dados e Metodologia (P067 a P070; entregue em 07/10/2026), avaliação (P071; entregue em 07/10/2026), 120 datas cruas em textos de módulos, páginas acima de 600 KB sem compressão (Geração, Território, Qualidade).

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

### Entregue: Aprenda (P065, P066)

* Glossário: 48 verbetes, todos conferidos (45 em 06/10/2026; GSF, REE e constrained-off em 07/10/2026). Das oito pendências do inventário, MRE (InfoMercado Nº 229, no Mercado) e ACR, ACL, garantia física e ESS (Decreto nº 5.163/2004, texto compilado do Planalto acessado em 06/10/2026) foram conferidos, com captura versionada em `pipeline/energia/seed/documentos_aprenda/v20261006T212851Z/` (sha256 no manifesto e trechos literais conferidos em teste). GSF (boletim de monitoramento e relatório do GT do MRE, do MME), REE (EPE, MME e ONS) e constrained-off (nota técnica da EPE que cita a REN ANEEL nº 1.030/2022) foram conferidos em 07/10/2026, com captura em `pipeline/energia/seed/documentos_aprenda/v20261007T211054Z/` (sha256 no manifesto) e o que não foi lido declarado no verbete: Regras de Comercialização da CCEE, original da REN e Procedimentos de Rede. MCP e CVU revisados (integração do Mercado e do CVU da Geração).
* Cada verbete conferido ganhou unidade (quando é grandeza), exemplo real ligado ao painel (24 com a ficha de prova do painel, 20 lidos da gold, 1 sintético rotulado), "não confundir com" (34 pares, só entre conferidos), "nas trilhas" e as datas de conferência e revisão. Arquivos: `complementos.ts`, `evidencias-verbetes.ts`, `provas.ts`, `exemplos.ts` em `src/lib/energia/conteudo/`; cartão `AprendaProva.tsx`.
* Trilhas: `/setor-eletrico/aprenda/trilhas`, `/agua-operacao-preco` (seis passos) e `/custo-tarifa-orcamento` (cinco passos), com `trilhas.ts`, ligações tipificadas pelo traço do mapa do setor e `AprendaSimulacao.tsx` (liquidação ao preço da hora e conta com peso no orçamento, valores hipotéticos com rótulo permanente, sem URL, gold ou telemetria).
* Volta ao contexto: links do Aprenda levam `?volta=`; `RetornoContexto.tsx`, no cabeçalho de todas as páginas do observatório, mostra o botão de volta ao passo ou ao verbete e limpa a URL (`src/lib/energia/retorno.ts`, rótulos em `rotulos-retorno.ts`). Telemetria `energia:aprenda:trilhas`.
* Achado e corrigido: a âncora `#ena` da Água e clima não existe mais; seis links (exemplo e verbetes ENA e MLT, página e conteúdo do PLD, catálogo) passam a `/agua-e-clima/afluencia#p018`.
* Verificação: build sem erro; HTML de 174 KB (Aprenda), 107 KB (índice das trilhas), 183 e 176 KB (trilhas) e até 133 KB por verbete; 72 combinações de página, largura (360, 390, 768, 1440 px) e modo sem violação axe e sem rolagem horizontal; simulador e volta conferidos em navegador; `src/tests/energia-aprenda.test.ts` (20 testes, inclusive rota e âncora de todo link do Aprenda no build). Vitest com a única falha pré-existente (datas cruas em Água e clima, chuva e temperatura); testes Python com a única falha pré-existente do bronze parcial local da Carga.
* Estado: P065 e P066 concluídos com limitação declarada; revisão adversarial da interface pendente. Método em `modulos/aprenda.md`.

### Entregue: Dados e metodologia (P067 a P070)

* Quatro páginas sobre as golds de 01/10/2026 (`catalogo.json`, `publicacao.json`, `manifesto.json`, `metricas.json`, `arquivos.json`): `/setor-eletrico/dados` (catálogo com a escada do catalogado ao publicado, os 6 conjuntos em uso abaixo de publicado com a ressalva, 12 descontinuados e o recurso a recurso da CCEE), `/dados/saude` (SLA por cadência, calendário de 120 dias, revisões com as duas capturas, falhas), `/dados/reproducao` (manifesto com sha256, ficha do arquivo, Parquet, conferência de um arquivo baixado no navegador) e `/metodologia` (276 regras por indicador, 8 afirmações de fonte integrada conferidas, matriz natureza e validação). Fichas e regras lidas das golds só ao escolher a linha; estado na URL (`?c=`, `?a=`, `?m=`, `?med=`, filtros das tabelas).
* **Defeito encontrado e corrigido**: o manifesto de 01/10/2026 era parcial (`completo = false`, quatro arquivos fora) e 9 arquivos publicados (Mercado, Empresas e Visão geral) tinham outro sha256, porque módulos rodados depois reescreveram as golds. O pedido 1 do documento do módulo (manifesto final no fim da execução) foi aplicado em `run.py` e `executar_modulo.py`, e o manifesto foi regravado em 07/10/2026: 269 arquivos, todos conferidos, `completo = true`. **Regra para quem reconstruir uma gold à mão**: `executar_modulo.py` regrava o manifesto sozinho; qualquer outro caminho precisa chamar `dados.escreve_manifesto(final=True)` antes do commit, e o teste `energia-dados-interface.test.ts` reprova um manifesto que não bate com os arquivos.
* **Golds de Dados não reconstruídas nesta etapa**: este ambiente só tem 3 dos 19 silvers (`energia`, `mercado`, `publicacao`), e reconstruir o módulo aqui degradaria o catálogo e a saúde. As páginas dizem a data de referência (01/10/2026) e não falam em "hoje". Mercado de 06/10, Geração P023 e P024 e Aprenda só entram no catálogo, na saúde e nas métricas na próxima execução completa (GitHub Actions).
* Limitações de texto corrigidas na Metodologia: acesso à CCEE (autorização de 06/10/2026), limites do PLD (painel P044 da Regulação) e verbetes em preparação (lidos do Aprenda).
* Peso: 564 KB (catálogo), 471 KB (saúde), 385 KB (reprodução) e 413 KB (metodologia). O catálogo é o mais próximo da meta de 600 KB.
* Verificação: build sem erro; 32 combinações de página, largura (360, 390, 768, 1440 px) e modo (Entender e Auditar) sem violação axe e sem rolagem horizontal; ficha do catálogo, tabela da CCEE sob demanda, filtros na URL, calendário, conferência de arquivo (arquivo publicado, o mesmo alterado em um byte e um arquivo qualquer) e ficha de regra conferidos em navegador; `src/tests/energia-dados-interface.test.ts` (35). Vitest com a única falha pré-existente (datas cruas em Água e clima, chuva e temperatura); testes Python com a única falha pré-existente do bronze parcial da Carga.
* Estado: P067 a P070 concluídos com limitação declarada; revisão adversarial da interface pendente. Método e interface em `modulos/dados.md`, seção 7.

### Entregue: Avaliação dos painéis (P071)

* **Instrumento** (`scripts/energia-avaliacao.mjs`): abre cada rota em Chromium nas larguras de 360, 390, 768 e 1440 px, nos modos Entender (todas as larguras) e Auditar (390 e 1440 px), e mede resposta, console, rede, axe-core (WCAG 2.0, 2.1 e 2.2, A e AA), rolagem horizontal (por `clientWidth`, porque a emulação de celular esconde o estouro em `innerWidth`), teclado, alvos de toque, controles exercitados (rádios, abas, ordenação, filtros), ficha de prova, link copiável, links e âncoras, peso e anatomia do painel. Capturas de tela com hash; 188 capturas da primeira dobra (WebP, 3,9 MB) versionadas.
* **Dez jornadas** da seção 15.2 (`scripts/energia-jornadas.mjs`, `scripts/jornadas/j01.mjs` a `j10.mjs`): roteiro por script, cada passo verifica um fato observável. É execução de roteiro, não teste com pessoas.
* **Revisão de didatismo e qualidade visual**: nove revisores em contexto limpo (agentes de IA, sem acesso ao código) sobre as 94 páginas, com texto e capturas. Também não é teste com pessoas.
* **Rubrica e gold** (`scripts/energia_avaliacao.py` e `energia_avaliacao_testes.py`): nota da dimensão = menor teto menos deduções, truncada em uma casa; "não avaliada" não satisfaz o aceite e "não aplicável" sai da média. A gold `avaliacao.json` entra em `publicacao.json` e no manifesto (270 arquivos). Documentos `AVALIACAO_PAGINAS.md` e `EVIDENCIAS_ACEITE.md` são gerados, nunca editados à mão.
* **Página** `/setor-eletrico/metodologia/avaliacao` (Entender, Analisar e Auditar): nota de cada página com a evidência, defeitos agrupados, jornadas (passos lidos sob demanda), revisão, evolução entre rodadas, rubrica e método. HTML de 579 KB; axe sem violação e sem rolagem horizontal em 12 combinações (360, 390, 768 e 1440 px; os três modos).
* **Resultado** (rodada `2026-10-07-r3`, inspeção de 07/10/2026, dados de referência de 01/10/2026): 94 páginas, nota ponderada média 8,2, **nenhuma página na meta de produto**, nenhum defeito crítico (4 altos, 34 médios, 12 baixos), dez jornadas cumpridas. Didatismo 7,0 e qualidade visual 7,2, contra metas de 9,5. A r2 (primeira com as dez dimensões, recalculada) fechou em 8,0 com 94 defeitos abertos; a r1 (base, sem revisão visual e didática, recalculada) em 8,4. Ver o quadro das três rodadas em `modulos/dados.md`, seção 8.2.
* **Defeitos encontrados e corrigidos durante a avaliação**: coluna fixa das tabelas interativas cobrindo o cabeçalho das demais colunas em 390 px (corrigida depois da medição, ver `posteriores.json`), sinal de percentual repetido nos cartões de perdas (`unidadeDestaque`), faixa do Território que estourava a largura no celular, ficha completa de conjunto atrasado sem a atualidade, favicon ausente, link de Perdas, Qualidade e Conta de luz da ficha da distribuidora só em Auditar, texto espremido em Minha região no celular e datas ISO na ficha de prova (`PainelEvidencia`).
* **Verificação**: `next build` sem erro; tsc e `next lint` sem aviso; Vitest com 2.645 testes (138 arquivos) e uma falha pré-existente (`energia-reauditoria`, datas ISO no HTML estático de 12 páginas, quase todas em blocos de Auditar); Python com 1.359 testes e uma falha pré-existente (`test_energia_carga`, bronze parcial local).
* Estado: P071 concluído com limitação declarada. Método e comandos em `modulos/dados.md`, seção 8.

### Entregue: Rodada de correção da avaliação (P071, r3)

* **Corrigido e medido na r3**: rolagem horizontal da página em 23 páginas (causas: barra de profundidade com margem negativa, campos de seleção mais largos que o celular, grades sem coluna mínima zero em Conta de luz e Perdas, rótulo de marco do gráfico fora do desenho); alvos de toque abaixo de 24 px em 67 páginas (caixas e opções de 13 a 16 px, termo do glossário de 23 px, links externos de Regulação); rodapé do observatório (citava só CCEE e ONS e a data de um processamento de 29/09/2026; agora lê os órgãos e a data de `publicacao.json`); eixo de data sem mês repetido; rótulos de barras sem corte desnecessário; aviso de rolagem lateral nas tabelas e de quantas categorias aparecem nos gráficos de barras e de pontos; ficha de conjunto sem tabela vazia de capturas e com data de referência; nove títulos de subpainel em forma de pergunta; datas ISO, identificadores de snapshot e leis de feriado em forma legível.
* **Erro da r2 corrigido**: a r2 contou como ausente o título em forma de pergunta porque o campo não era copiado do instrumento para o relatório. r1 e r2 foram recalculadas com a regra "item não medido sai do cálculo" e aparecem marcadas como recalculadas (decisão D16).
* **Sem efeito grande, e dito**: didatismo 6,8 para 7,0 e qualidade visual 6,9 para 7,2, com revisores que são outras instâncias de agente; a diferença não prova evolução.
* **Corrigido depois da medição da r3, sem medir** (`avaliacao/posteriores.json`): largura mínima da primeira coluna das tabelas interativas (queixa mais repetida dos nove revisores) e alinhamento da aba atual no celular.
* Estado: rodada de correção concluída com limitação; a r4 mede o que veio depois.

### Entregue: Segunda rodada de correção da avaliação (P071, r4)

* **Corrigido no código**: tabelas com mais de 12 linhas fecham em Entender com o botão Ver a tabela completa (abrem sozinhas com busca, filtro, página ou linha escolhida; em Analisar e Auditar ficam abertas); gráficos de barras e de pontos com botão Mostrar todas as categorias; ficha do conjunto de dados em duas camadas (leitor e técnica), com título como a fonte o publica, abertura com órgão e frequência, descrição sem frase cortada, situação dos dados, licença curta com a observação à parte; sigla e nome iguais não se repetem nos verbetes; alerta de perda total negativa na ficha da distribuidora (CERTHIL); "gold de X" virou "base publicada de X" nos textos do leitor.
* **Medido na r4** (`2026-10-07-r4`, 94 páginas, nove revisores em contexto limpo): nota ponderada média 8,3 (r3: 8,2), nenhuma página na meta, 49 defeitos abertos (r3: 50), dez jornadas cumpridas, 94 rotas sem violação axe e sem rolagem horizontal. **Didatismo 6,9 (r3: 7,0) e qualidade visual 7,4 (r3: 7,2): a r4 não moveu o didatismo.** O que os revisores mais repetiram não foi atacado: texto de bastidor da coleta na tela do leitor em Entender (HTTP 403, caminhos de arquivo, "achado A05", gold, pipeline, sha256), siglas sem expansão no primeiro uso, resposta enterrada depois de contagens, barra de abas cortada em 390 px.
* **Método**: três ajustes, ver `avaliacao/ajustes_do_metodo.json`. O principal: a captura dos revisores passou a ser feita sem teste de teclado antes, porque este deixava tabelas largas roladas até o fim nas capturas das rodadas 1 a 3. A mesma versão foi revisada duas vezes (captura antiga e limpa) e a diferença ficou abaixo de 0,1 ponto (D19). As jornadas J3, J4 e J7 passaram a abrir a tabela recolhida, o que soma um clique a cada uma.
* **Corrigido depois da medição, sem medir** (`avaliacao/posteriores.json`): citação da ficha sem campo vazio e com a data de captura em Brasília; "pelo" ou "pela" conforme o órgão; frequência pelas cadências normalizadas; arquivos e páginas em listas separadas; esmaecimento da borda da barra de abas; Saúde com integrações em vez de conjuntos integrados (D21); resposta do catálogo sem gold e pipeline.
* **Erro meu, corrigido antes de publicar**: a primeira versão da ficha reescrevia o título da CCEE em caixa baixa e perdia acento e sigla ("Pld final medio"); foi removida e o título voltou como a fonte o publica (D20).
* **Verificação**: `next build` sem erro; tsc e `next lint` sem aviso; Vitest com 2.664 testes (139 arquivos) e uma falha pré-existente (`energia-reauditoria`, datas ISO no HTML estático de páginas de Auditar); Python com 1.359 testes e uma falha pré-existente (`test_energia_carga`, bronze parcial local).
* Estado: rodada de correção concluída com limitação; a meta de 9,5 em didatismo e qualidade visual segue a 2,6 e 2,1 pontos.

### Entregue: Terceira rodada de correção da avaliação (P071, r5)

* **Corrigido no código e medido na r5**: o bastidor da coleta (HTTP, Cloudflare, curl, sha256, silver, vintage, pipeline, caminhos de arquivo) sai do texto de Entender e fica em Analisar e Auditar, por uma regra que separa as frases de bastidor das que o leitor lê (`src/lib/energia/bastidor.ts`, `TextoDoLeitor`); vocabulário de leitor para gold, pipeline e "ficha de prova"; escada do catálogo de dados em palavras do leitor; ficha de modelo do PLD que abre com o resumo e deixa a fórmula para Analisar; título e unidade visíveis em todo gráfico; legenda com o nome por extenso das siglas de cada página (`src/lib/energia/siglas.ts`); frase de leitor antes dos números no balanço da rede e no Território; verbete em preparação com a nota de pesquisa recolhida.
* **Medido na r5** (`2026-10-07-r5`, 94 páginas, nove revisores, capturas limpas): nota ponderada média 8,3, nenhuma página na meta, 51 defeitos abertos (r4: 49), dez jornadas cumpridas, 94 rotas sem violação axe e sem rolagem horizontal. **Didatismo 7,06 (r4: 6,90) e qualidade visual 7,45 (r4: 7,44).** Os marcadores de bastidor no texto de Entender caíram de 175 para 79.
* **Leitura honesta do resultado**: o bastidor caiu à metade e o didatismo subiu 0,16, dentro da variação entre revisores. Três rodadas seguidas de correção deixaram o didatismo perto de 7,0 contra a meta de 9,5; o que os revisores ainda apontam é estrutural (resposta curta tarde, parágrafos de resposta com muitos números, páginas longas, rótulos de gráfico truncados no celular), não vocabulário.
* **Erros meus acusados pela medição**: legenda de siglas lida do menu e do rodapé (listava siglas que a página não usa), "hoje" ao lado de números sem data no Território, unidade repetida no título de um gráfico. Corrigidos depois da medição e registrados em `posteriores.json`.
* **Verificação**: `next build` sem erro; tsc e `next lint` sem aviso; Vitest com 2.682 testes (141 arquivos) e uma falha pré-existente (`energia-reauditoria`, datas ISO no HTML estático de páginas de Auditar); Python com 1.359 testes e uma falha pré-existente (`test_energia_carga`, bronze parcial local). A página do Território segue no limite de 600 KB (cada acréscimo de texto nela exige corte em outro ponto).
* Estado: rodada concluída com limitação; a meta de 9,5 em didatismo e qualidade visual segue a 2,5 e 2,1 pontos.

### Próximos passos da Fase 2

1. **Quarta rodada (r6), só se a meta de 9,5 continuar valendo para revisores agentes.** O que sobra, em ordem de repetição entre os nove revisores da r5: (a) rótulos de categoria truncados e eixos que se tocam nos gráficos em 390 px (Orçamento, Emissões, MMGD, Carteira, Geração); (b) tabelas largas cortadas à direita em 1440 e em 390, com número cortado no meio; (c) resposta curta fora da primeira tela no celular, porque cabeçalho, siglas e abas empilhadas ocupam 800 a 1.450 px; (d) barra de abas do módulo cortada na borda, mesmo com esmaecimento; (e) fichas C2-H e C2-P do PLD com códigos internos (LAT1D, G23-R1, SEM_PLD_CAPTURADO), identificadores de previsão e abas P013 a P016 em Entender; (f) Balanço e exterior, Programado, Restrições e Território com título que promete uma explicação que a página não dá; (g) verbete GSF (5,0), que depende de coleta da fonte primária fora do escopo autorizado. Medir antes as correções posteriores da r5.
1a. **Decisão pendente do responsável**: a meta de 9,5 em didatismo e qualidade visual com revisores agentes não se moveu em três rodadas (7,0 e 7,4). Sem leitores reais para calibrar a escala, uma quarta rodada de texto tende a render décimos.
2. **Defeitos altos que sobram**: SCS da ANEEL 367 dias atrasado (dado da fonte); ficha de evidência com teste nas páginas do PLD; Comprove este número nas fichas de modelos e na linha do tempo da Regulação; uma página sem fonte declarada.
3. **Revisão com pessoas**: a revisão atual é de agentes e as jornadas são roteiro; sem teste com pessoas e sem leitor de tela real, acessibilidade e desempenho têm teto de 9,0.
4. Revisão adversarial das interfaces publicadas sem revisão (inclui a Visão geral, o Mercado, a Geração P023 e P024, o Aprenda e Dados e metodologia), quando autorizada.
5. Porte da home e do seletor com painéis vivos e da gramática visual (ver acima).
6. Datas ISO ainda no HTML de 12 páginas (texto de gold em Auditar, rótulos de série e dois ids) e páginas acima de 600 KB (Geração P021 com 1 MB, Território, Qualidade).
7. Colocar a própria página de avaliação entre as páginas medidas na r4.
8. Mercado: Regras de Comercialização da CCEE como fonte regulatória do GSF (fora do escopo autorizado de coleta; o verbete já está conferido nos documentos do MME); planilhas "InfoMercado Dados Gerais" para estender as séries da CCEE antes de 2023. Aprenda: Procedimentos de Rede do ONS (REE) e texto original da REN ANEEL nº 1.030/2022 (constrained-off), hoje lidos pela citação de documentos do MME e da EPE.
