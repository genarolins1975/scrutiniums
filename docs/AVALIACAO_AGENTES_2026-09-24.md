# Avaliação: o Observatório como centro de pesquisa operado por agentes

**Data:** 24/09/2026. **Base:** ramo `main` no commit `fe048da` (23/09/2026, 15:37 UTC); gold publicada gerada em 23/09/2026, 15:36 UTC. **Para:** editor chefe. **Convenção:** **E** evidência, **I** inferência, **R** recomendação. Todo número traz fonte e data; o que não foi medido está na seção 6.

---

## Sumário executivo

**Tese (I).** Quando a análise escrita fica barata, o que diferencia um centro de pesquisa é o que continua escasso: dado limpo, verificação, credibilidade e julgamento editorial. O Observatório já tem dado limpo em grau raro. Ainda não tem as camadas que tornam seguro multiplicar a produção de texto: constituição única, camada adversarial, validador independente, degraus de autonomia e medição de erro. Pôr agentes antes dessas camadas aumenta o risco de erro público na mesma proporção em que aumenta a produção.

**Diagnóstico (E).** Das dez peças da visão, 2 existem (dados e vigilância), 5 são parciais (constituição, análise por recorte, camada editorial, avaliação contínua, reprodutibilidade) e 3 estão ausentes (camada adversarial, validador independente, degraus de autonomia). Uma premissa precisa de ajuste. Não há modelo de linguagem no pipeline de produção. Há, porém, uso fora dele: os valores da Fase 2 são extraídos de documentos em sessão Claude Code e aprovados pelo proprietário (`pipeline/curated/fase2_observacoes.json:4`; 24 de 24 observações aprovadas). Conferi as 24: todo valor aparece no trecho literal citado.

**Três achados que pedem decisão (E).**

1. **Faixa verbal de risco sem calibração em páginas nominais.** Dos 100 maiores conglomerados, 30 aparecem como "risco elevado" ou "risco muito elevado" (`institutions.json`, gold de 23/09/2026, IF.data data base jun/2026). Entre eles: Banco do Brasil (83,9, muito elevado), PagBank (88,5, muito elevado), Stone (83,3, muito elevado) e Caixa (72,7, elevado). O próprio código registra "faixas não calibradas empiricamente" (`pipeline/inst_pages_all.py:406`). A ficha exibe a faixa (`public/obs/app.js:7013`) e a aba Instituições publica a contagem agregada (`public/obs/app.js:6747`). Com o editor chefe no conselho do FGC, este é hoje o maior risco reputacional do projeto.
2. **A gold vai ao ar antes dos testes de conteúdo.** O CI roda depois da publicação (`.github/workflows/ci.yml:19-21`; a publicação está em `.github/workflows/atualizar-dados.yml:129-153`): erro de conteúdo é detectado, não impedido. Além disso, 126 testes de conteúdo (moradia e consignado) nunca rodam no CI, porque leem `data/gold` e esse diretório não existe no clone limpo (`src/tests/moradia-data.test.ts:22`, `src/tests/consignado-data.test.ts:25`). Rodados contra a gold publicada, um deles falha.
3. **Revisão da fonte é regra, não exceção.** Montei o pacote de fatos da data base jun/2026 com a gold de 27/08/2026 e o conferi contra a gold de hoje: 52 dos 57 fatos mudaram no texto exibido. A inadimplência total de junho passou de 4,68% para 4,58% (SGS 21082; valor atual conferido na API do BCB em 24/09/2026). Sem vintage congelado, a nota vira erro retroativo.

**Recomendação (R).**

- **Páginas nominais: restringir já.** Retirar a faixa verbal e o score ordinal das fichas nominais e da frase agregada; manter as métricas observadas, com pares, data base e fonte. O score volta por instituição só depois de calibrado contra desfechos conhecidos e publicado com o teste. É um PR separado, fora do piloto e sujeito à sua decisão (seção 3b).
- **Não começar pelos agentes.** Começar pelo que continua escasso: pacote de fatos com vintage, validador mecânico, casos sentinela e registro de erros. Só depois vêm os dois analistas, o replicador e o crítico.
- **Piloto único.** Nota mensal de conjuntura, ancorada na divulgação das estatísticas de crédito do BCB, com três ciclos no degrau 1 e sete PRs. Nada além disso antes de medir erro factual e minutos de editor.
- **PR 1 aberto.** Traz esta avaliação, a constituição (`docs/CONSTITUICAO.md`) e o pacote de fatos (`pesquisa/fatos_conjuntura.py`: 57 fatos, data base jul/2026, zero lacunas, 24 testes).

**Decisões pedidas ao editor.**

1. Regra das páginas nominais (seção 3b).
2. Revisor substituto para os temas do art. 6 da constituição.
3. Uso de um segundo fornecedor de modelo no replicador e no validador constitucional.
4. Número mínimo de ciclos para o degrau 2 (proposta: 6).
5. Aprovação do PR 1.

---

## 1. Método e base

**Leitura (E).**

- **Documentos:** `README.md`, `ARCHITECTURE.md`, `OPERACOES.md`, `AUDITORIA_PROJETO.md`, os 9 documentos `docs/AUDITORIA_*.md` e os 2 `docs/AVALIACAO_*.md`.
- **Código:** `pipeline/run.py`, `gold.py`, `common.py`, `report.py`, `central_alertas.py`, `inst_pages_all.py`, `inst_pages.py`, `leading.py`, `lineage_map.py`, `indicators.py` (score por instituição) e `models/forecast.py`; `scripts/sanidade_gold.py` e `scripts/vigilancia.py`; os 4 workflows.
- **Apoio:** dois levantamentos de leitura (auditorias; inventário de testes), com citações conferidas por amostragem.

**Execuções em 24/09/2026 (E).**

| # | O que rodei | Resultado |
|---|---|---|
| 1 | `npx vitest run` (clone limpo) | 91 arquivos; 950 testes aprovados, 126 pulados, 0 falhas |
| 2 | Os 126 pulados, contra cópia da gold publicada | 125 aprovados, 1 falha: `consignado-data.test.ts:618` fixa 1,95 e a gold traz 2,14 |
| 3 | `python3 pipeline/run.py --skip-fetch` a partir de `pipeline/seed/silver-seed.db.gz` | 12 builders caíram por tabela ausente e a execução abortou em `pipeline/epae.py:204` (`no such table: epae_coleta`). A última execução registrada na semente é de 28/07/2026 |
| 4 | Semente × gold publicada, 4 séries do pulso | Entre 3 e 7 valores revisados em 173 meses comuns por série; ex.: spread total de nov/2025, 21,37 na semente contra 21,23 na gold |
| 5 | Gold publicada × API SGS, últimos 13 meses | 208 de 208 pontos iguais em 16 séries. Crédito/PIB (HTTP 502) e endividamento (resposta vazia) não responderam |
| 6 | Pacote de fatos das datas base mai/2026, jun/2026 e jul/2026, a partir do histórico git da gold | Seção 3d |
| 7 | `python3 -m unittest discover -s pesquisa/tests -t .` | 24 testes aprovados |

---

## 2. Diagnóstico por peça

| Peça | Estado | Evidência principal |
|---|---|---|
| a) Constituição editorial escrita | Parcial | Princípios fortes, porém dispersos em docstrings, testes e runbook; nenhum documento único. `report.py:182` remete a `docs/LIMITACOES.md`, que não existe |
| b) Camada de dados | Existente | Bronze com sha256, silver com revisões, 72 JSON gold e 1.457 fichas, linhagem gerada do código e travada por teste |
| c) Análise por recorte | Parcial | 30 abas determinísticas e relatório por regras; nenhuma análise interpretativa escrita por recorte |
| d) Vigilância | Existente | Sentinela, vigílias de frescor, pane e fontes, job de alerta, CI encadeado. Porém o CI roda depois de publicar |
| e) Camada adversarial | Ausente | Nenhuma replicação independente, crítica ou revisão por pares nos 11 documentos de auditoria |
| f) Camada editorial | Parcial | Portão humano só na Fase 2; relatório, boletim e fichas nominais publicam sem editor |
| g) Validador independente | Ausente | O CI valida contratos da gold, não afirmações; `report.py` sem teste |
| h) Degraus de autonomia | Ausente | Regime binário: tudo automático ou tudo manual |
| i) Avaliação contínua | Parcial | Backtest de projeções publicado; sem registro de erros, casos sentinela ou calibração do score |
| j) Reprodutibilidade pública | Parcial | Gold versionada em git; bronze e silver só no cache do Actions; semente não reconstrói a gold |

### a) Constituição editorial: parcial

**E.** Os princípios existem, mas espalhados:

- **Relatório:** "não é redação livre de modelo de linguagem" (`pipeline/report.py:58-60`).
- **Aviso de plataforma:** "não constituem rating" (`config/config.json`, `platform.disclaimer`).
- **Manual por desenho:** `OPERACOES.md:44-60`.
- **Travas em teste:** "sem ranking" (`src/tests/conduta-data.test.ts:62-69`), "nunca juízo de mérito" (`src/tests/recordes-data.test.ts:56`), vocabulário proibido (`src/tests/moradia-data.test.ts:154-174`).
- **Referência quebrada:** `report.py:182` remete a `docs/LIMITACOES.md`, arquivo inexistente. A frase está no `report.html` publicado em 23/09/2026.

**I.** A ética editorial é forte e implícita, codificada painel a painel. Um validador não aplica o que não está escrito num só lugar.

**R.** `docs/CONSTITUICAO.md`, neste PR.

### b) Camada de dados: existente

**E.**

- **Bronze:** imutável, com sha256 (`pipeline/common.py:174-187`).
- **Silver:** registra revisões (`common.py:236-260`).
- **Gold:** 72 arquivos JSON no topo de `public/obs/data/gold` e 1.457 fichas em `inst/` (contagem de 24/09/2026).
- **Linhagem:** gerada do próprio código (`pipeline/lineage_map.py:1-24`) e travada em zero objetos sem produtor (`src/tests/linhagem-mapa.test.ts:26-39`).
- **Escrita da gold:** atômica (`common.py:318-327`).

**Limites (E).**

- A silver sobrescreve o valor e guarda o antigo em `revisions` (`common.py:250-258`), embora a docstring prometa "novo vintage" (`common.py:5`). Não há consulta "como estava em tal data".
- `lineage.json` publica só as 200 linhas de linhagem mais recentes e 50 das 4.950 revisões (`pipeline/gold.py:1122,1126`; contagem da gold de 23/09/2026).

**I.** O ativo mais escasso, dado limpo, o projeto tem. O ponto fraco é o vintage: para pesquisa publicada, importa o que se sabia na data da nota.

### c) Análise por recorte: parcial

**E.** O projeto tem 30 abas com sínteses determinísticas (`src/tests/p1-didatico.test.ts:21-22`) e um relatório por regras com parágrafos classificados (`pipeline/report.py:1-5`, `:29-30`). O relatório tem três defeitos:

- nenhum teste o cobre (inventário de 24/09/2026);
- escreve número em notação inglesa na prosa (`report.py:119`; publicado `"30.2, -11.4"` no `report.html` de 23/09/2026);
- fixa o ano 2025 na soma anual de RJ (`report.py:131`).

**I.** Análise quantitativa por recorte existe. Análise interpretativa escrita, com autoria e revisão, não existe.

**R.** Não expandir `report.py`. A nota do piloto o substitui no tema crédito.

### d) Vigilância: existente

**E.** Estão em operação:

- sentinela de regressão (`scripts/sanidade_gold.py`);
- vigílias de frescor, pane e fontes (`.github/workflows/vigilancia.yml`, `scripts/vigilancia.py`);
- job `alertar`;
- CI encadeado por `workflow_run`.

**Limites (E).**

- **Os vigias não bloqueiam.** A sentinela sempre termina com código 0 (`scripts/sanidade_gold.py:130`) e a vigília nunca falha o job (`vigilancia.yml:81`); ambos acusam por issue.
- **Número errado com cara de número só é pego por teste de conteúdo** (lição registrada em `OPERACOES.md:117-122`), e esse teste roda depois da publicação.
- **Defeito que nenhum vigia acusou.** Encontrado nesta avaliação: as fichas nominais exibem a data base "202606" crua, e não `2026-T2`, porque o rótulo sai de um dicionário fixo que termina em 202603 (`pipeline/inst_pages_all.py:61`, `pipeline/inst_pages.py:16`). A ficha `inst/C0010045.json` de 23/09/2026 traz `"data_base": "202606"`.

### e) Camada adversarial: ausente

**E.** Nenhum dos 11 documentos de auditoria menciona replicação independente ou revisão por pares. As auditorias são feitas pelo mesmo processo que construiu; `docs/AUDITORIA_CONSIGNADO.md:348-349` registra que uma correlação espúria "passou pela primeira revisão". Diagnósticos iniciais errados só foram corrigidos por nova medição (`docs/AVALIACAO_PAINEIS_2026-09-06.md:362-367`, `:448`).

Existem elementos de verificação: reconciliações entre painéis (`docs/AUDITORIA_GERAL_OBSERVATORIO.md:124-144`) e testes que recalculam o score setorial com tolerância de 0,11 (`src/tests/score-observado.test.ts:17-45`).

**I.** Há verificação; não há adversário.

### f) Camada editorial: parcial

**E.**

- **Onde há portão humano:** só na Fase 2 (`OPERACOES.md:46-51`), com builders que publicam apenas o que foi aprovado (`pipeline/operacional.py:220-257`, `pipeline/guidance_bancos.py:29-64`, `pipeline/folha_bancos.py:32-43`).
- **Quem aprova:** o registro diz "proprietário (revisão em sessão Claude Code)" em 24 observações, e há aprovações em lote, como "aprovação integral das 8 observações" em `pipeline/curated/folha_balanco.json`.
- **O que publica sem editor:** `report.html`, o boletim mensal (`.github/workflows/boletim-mensal.yml`) e as 1.457 fichas nominais.
- **Reparos à mão em produção:** registrados em `docs/AVALIACAO_PAINEIS_2026-09-06.md:902-908`.

**I.** Hoje o editor é portão de extração, não de publicação.

### g) Validador independente: ausente

**E.** 62 arquivos de teste leem a gold publicada e validam contratos de dados. Nenhum teste lê o texto de `report.py`, e nenhum mecanismo avalia afirmação em contexto separado do autor.

### h) Degraus de autonomia: ausente

**E.** O regime é binário. Relatório, boletim e fichas são automáticos. A Fase 2 é manual por desenho. Não há critério de promoção nem de rebaixamento.

### i) Avaliação contínua: parcial

**E.**

- **Projeções:** backtest publicado em janela expansiva (`pipeline/models/forecast.py:89-130`, `src/tests/backtest-publicado.test.ts`). O código declara que os pesos do conjunto vêm do backtest inteiro, o que o torna um pseudo backtest (`forecast.py:129-130`).
- **Antecedentes:** a promoção exige ganho fora da amostra (`pipeline/models/antecedentes.py:7`).
- **Subíndices:** os escores padronizados usam média e desvio da história inteira (`pipeline/leading.py:22-31`). Isso serve para a leitura corrente, mas enviesa qualquer teste retrospectivo do sinal, porque cada ponto antigo usa dados do seu futuro.
- **O que falta:** registro de erros publicados, casos sentinela, taxa de acerto dos alertas e calibração do score por instituição.
- **Testes que envelhecem:** testes com valor fixo ficam desatualizados em silêncio (execução 2 da seção 1).

### j) Reprodutibilidade pública: parcial

**E.**

- **O que está versionado:** a gold, desde 30/07/2026, com 51 versões de `pulse.json` e três datas base de crédito (mai/2026, jun/2026 e jul/2026). A linhagem publica o sha256 do bronze.
- **O que não é público:** bronze e silver vivem no cache do Actions (`.github/workflows/atualizar-dados.yml:56-65`).
- **A semente não reconstrói a gold:** ela é de 28/07/2026 e a execução local a partir dela abortou (execução 3).

**I.** Um leitor externo consegue verificar que um número está na gold. Não consegue refazer a gold.

---

## 3. Riscos e lacunas

### a) Erro público

**E: canais de detecção hoje.**

| Canal | Latência | O que pega |
|---|---|---|
| Sentinela de gold | na mesma execução | stub e queda de cobertura; restaura a publicação anterior |
| CI após publicação | horas | contratos e invariantes de 62 arquivos de teste |
| Vigília | diária | frescor, pane e builder falho |
| Auditoria manual | semanas | `compare.json` ficou parado desde 16/08 e `consignado.json` desde 04/08 até a auditoria de 06/09 (`docs/AVALIACAO_PAINEIS_2026-09-06.md:245-250`) |

**E: erros que chegaram ao ar (documentos de auditoria).**

- A inadimplência dos FIDCs saiu publicada como 2,1%; o valor correto é 5,6% (`docs/AVALIACAO_PAINEIS_2026-09-06.md:625-631`).
- Fichas fictícias de RJ foram ao ar (`docs/AVALIACAO_PAINEIS_2026-09.md:18`).
- O texto de método dizia "dois componentes demonstrativos" quando havia um (`docs/AVALIACAO_PAINEIS_2026-09-06.md:264-270`).
- O conceito de carteira estava errado em `juros.json` (`docs/AUDITORIA_GERAL_OBSERVATORIO.md:146-149`).

**E: como se corrige.** Por republicação. Não existe errata nem registro público de erros; a busca por "errata" no repositório não retorna nada, exceto a constituição proposta.

**I.** A taxa de erro publicado é desconhecida porque não é contada. Sem essa contagem, nenhum degrau de autonomia pode ser liberado com base em evidência.

**R.**

- Criar um registro de erros com data de publicação, data de detecção, canal, gravidade e correção (PR 2 do piloto).
- Em paralelo e fora do piloto: rodar os testes de conteúdo antes do `rsync` de publicação, e apontar os testes de moradia e consignado para a gold publicada.

### b) Conflito de interesse nas páginas nominais e no score

**E.**

- **Faixa verbal:** 1.457 fichas por instituição; as 100 maiores trazem score e faixa verbal (`institutions.json`, 23/09/2026). A distribuição das faixas é: 41 "atenção", 24 "risco elevado", 24 "risco baixo", 6 "risco muito elevado" e 5 "risco muito baixo".
- **Escala sem calibração:** as faixas são cortes fixos a cada 20 pontos (`pipeline/indicators.py:649-650`), sem calibração (`pipeline/inst_pages_all.py:406`).
- **Relatório automático:** publica nome, score e variação no trimestre (`report.html` de 23/09/2026; `pipeline/report.py:117-119`).
- **Open Finance:** as fichas cruzam o ranking do Open Finance por semelhança de nome (`pipeline/inst_pages_all.py:322`).

**E: posição do editor.** É conselheiro do FGC, que garante depósitos nessas instituições, e diretor da Associação Open Finance Brasil, cujas associadas são participantes do Open Finance.

**I.**

- Ao lado de um nome, "risco muito elevado" é lido como juízo, qualquer que seja o aviso de rodapé.
- Vindo de um projeto cujo editor está no conselho do FGC, o rótulo pode ser lido como sinal institucional ou informação privilegiada. Nesse terreno, uma leitura errada tem custo assimétrico: pode mover depósitos.
- O valor informativo do rótulo é baixo, porque as métricas observadas que o compõem já estão na ficha.
- O casamento por nome com o ranking do Open Finance pode atribuir dado à instituição errada.

**R. Regra objetiva proposta.**

1. **Retirar.** Nenhuma página, texto, relatório ou boletim associa instituição nomeada a faixa verbal, score ordinal, posição em ranking de risco ou variação de score.
2. **Manter.** Métrica observada nominal (Basileia, ativo, carteira, índices do IF.data, reclamações) segue publicada com grupo de pares, data base e fonte, sem adjetivo.
3. **Restringir.** O score segue como ferramenta metodológica: distribuição por grupo de pares sem nomes. Volta por instituição só depois de calibrado contra desfechos conhecidos, com o teste publicado. Os regimes de resolução já coletados (`regimes.json`) são o candidato natural. Mesmo calibrado, volta sem faixa verbal.
4. **Declarar.** Nota que trate de instituição nomeada, do FGC ou do Open Finance fica no degrau 3, leva declaração de interesse e admite impedimento do editor (constituição, arts. 5 e 6).
5. **Casar por código.** Dado nominal entra só por código ou CNPJ, nunca por semelhança de nome.

Os itens 1 e 5 mudam produção (SPA e gold). Por isso não entram neste PR: proponho um PR separado, sujeito à sua decisão, como única exceção ao "nada além do piloto", por se tratar de mitigação de risco e não de funcionalidade.

### c) Homogeneidade de erro se todos os agentes usarem o mesmo modelo

**E.** O problema já existe em pequena escala: na Fase 2, a extração e a aprovação acontecem em sessão do mesmo modelo (`revisado_por`, `pipeline/curated/*.json`).

**I.**

- Agentes do mesmo modelo compartilham pontos cegos: a mesma leitura errada de unidade, o mesmo salto causal, a mesma tendência a aceitar texto plausível.
- Votação entre cópias do mesmo modelo não reduz erro correlacionado.
- Um validador do mesmo modelo tende a concordar com os autores.

**R.**

1. Toda checagem de número é mecânica e independe de modelo (constituição, art. 8.3).
2. O replicador e o validador constitucional usam fornecedor diferente do dos analistas, ou no mínimo outro modelo, sempre em contexto separado e sem acesso ao raciocínio dos autores.
3. Medir a homogeneidade em vez de presumir: casos sentinela cegos por papel. Se analista, crítico e validador falham juntos no mesmo erro plantado, o erro é correlacionado.
4. No degrau 1, o editor é o componente independente.

O efeito da diversidade de modelos não foi medido (seção 6).

### d) Fonte única e quebras metodológicas

**E.**

- **Fonte única no piloto:** as 18 séries do escopo vêm todas do BCB/SGS.
- **Instabilidade em 24/09/2026:** 2 das 18 não responderam à API (HTTP 502 e resposta vazia).
- **Outras dependências críticas:** CSV do Desenrola, ranking do TST, Sadipem, ESTBAN (`docs/AUDITORIA_DESENROLA.md:15-16`, `docs/AUDITORIA_JUDICIAL.md:11`, `docs/AVALIACAO_PAINEIS_2026-09-06.md:757-758`, `docs/AUDITORIA_PENETRACAO.md:20-21`).
- **Quebras já documentadas:** o verbete 171 quebra 84% com a Res. CMN 4.966 (`docs/AUDITORIA_MORADIA.md:71-88`); a CVM renomeou 670 FIDCs (`docs/AVALIACAO_PAINEIS_2026-09-06.md:634-638`).

**E: revisões entre vintages da gold publicada** (pacotes montados com a gold de cada data e conferidos contra a gold de 23/09/2026).

| Data base | Gold de origem | Fatos | Valor bruto mudou | Texto exibido mudou | Sinal inverteu |
|---|---|---|---|---|---|
| mai/2026 | commit `1fd6731`, 01/08/2026 | 57 | 52 | 47 | 4 |
| jun/2026 | commit `238e5f9`, 27/08/2026 | 57 | 55 | 52 | 0 |

- **Inversões de sinal na data base mai/2026:** spread PJ em 12 meses, de +0,30 p.p. para −0,06 p.p.; comprometimento de renda no mês, de −0,05 p.p. para +0,14 p.p.; endividamento no mês; crédito/PIB no mês.
- **Maior revisão de nível na data base jun/2026:** inadimplência total de junho, de 4,68% para 4,58%.

**I.** Uma nota que diga "a inadimplência caiu no mês" pode ficar errada um mês depois sem que ninguém tenha errado. A verdade de uma nota é relativa ao vintage que a gerou.

**R.**

- Pacote com vintage congelado e hash (feito no PR 1).
- Frase obrigatória de sujeição a revisão.
- Conferência da fonte primária no dia da nota (PR 4).
- Registro de quebras metodológicas das séries do escopo antes do ciclo 1.

### e) Custo operacional

**E: o que foi medido.**

- O pacote de fatos da data base jul/2026 tem 29.720 bytes e 57 fatos.
- A constituição tem 4.636 bytes.
- A coleta diária tem orçamento de 150 minutos (`pipeline/run.py:29-33`); a camada de agentes roda por mês, fora do job diário, e não o afeta.

**E: o que não foi medido e não é estimado aqui.**

- Tokens por papel.
- Preço vigente por modelo.
- Rodadas de devolução por nota.
- Minutos de editor.
- Custo de um segundo fornecedor.

**I (a confirmar no piloto).** O custo dominante por nota será o tempo do editor, não os tokens. Por isso o piloto mede os dois.

**R.** Registro por ciclo com:

- tokens de entrada e saída por papel, lidos do uso informado pela API;
- tabela de preços com data;
- tempo de parede;
- minutos de editor, com início e fim anotados;
- número de devoluções.

---

## 4. Desenho alvo

### a) Constituição

`docs/CONSTITUICAO.md`, com 11 artigos:

1. Números só da gold ou de fórmula declarada.
2. Três classes de afirmação.
3. Ausência declarada.
4. Pacote de reprodutibilidade.
5. Instituições nomeadas.
6. Conflito de interesse.
7. Linguagem.
8. Validador.
9. Degraus.
10. Erro.
11. Fronteira.

É o critério único de agentes, validador e editor.

### b) Arquitetura de agentes

Os agentes operam sobre a gold publicada num commit identificado e fora do pipeline de números. Nenhum escreve em `pipeline/`, `data/`, `public/` ou no `main`. A saída é sempre um PR em `notas/AAAA-MM/`.

```
gold publicada (commit X)
  └→ [0] montador do pacote (determinístico) → pacote.json (fatos, hashes, lacunas)
        ├→ [5] verificador de fonte (determinístico) → conferência na API SGS do dia
        ├→ [1] analista A: crédito às famílias ─┐
        ├→ [2] analista B: empresas e condições ├→ [6] consolidador → nota com {{id}}
        ├→ [3] replicador (outro modelo, só o pacote)   ↑
        └→ [4] crítico ───────────────────────────────────┘
  [7] renderizador (determinístico) → nota final + pacote de reprodutibilidade
  [8] validador (contexto separado) → aprovar | devolver | bloquear
  [9] editor chefe → publica | edita | rejeita (minutos registrados)
```

| # | Papel | Natureza | Entrada | Saída | Não pode |
|---|---|---|---|---|---|
| 0 | Montador do pacote | determinístico | gold num commit | `pacote.json` | nada além de diferença e variação percentual |
| 1 | Analista A (famílias) | agente | pacote, constituição, modelo da nota | rascunho com `{{id}}` e classe por parágrafo | digitar número |
| 2 | Analista B (empresas, taxa e spread) | agente | idem | idem | digitar número |
| 3 | Replicador | agente, outro modelo | só o pacote e a pergunta da nota | 5 fatos mais relevantes e direção de leitura, por recorte | ver os rascunhos |
| 4 | Crítico | agente | rascunho consolidado e pacote | objeções classificadas | reescrever a nota |
| 5 | Verificador de fonte | determinístico | pacote | conferência de cada série na fonte primária no dia | aprovar o que não conseguiu conferir |
| 6 | Consolidador | agente | rascunhos, objeções, divergências do replicador | nota única com `{{id}}` | apagar divergência sem registro |
| 7 | Renderizador | determinístico | nota e pacote | texto final com fonte e data de cada fato | alterar texto |
| 8 | Validador | mecânico, mais modelo em contexto separado | nota renderizada, pacote, constituição | decisão por item | ver o raciocínio dos autores; aprovar número por modelo |
| 9 | Editor chefe | humano | tudo, mais o relatório do validador | publicação | ser dispensado nos temas do degrau 3 |

### c) Validador

**Checagens mecânicas (código, sem modelo).**

| Código | Checagem | Falha leva a |
|---|---|---|
| M1 | Pacote íntegro: `sha256_fatos` confere e `verificar(pacote, gold do commit)` não aponta divergência | bloquear |
| M2 | Todo `{{id}}` existe no pacote | bloquear |
| M3 | Nenhum dígito na prosa fora de placeholder; inclusive datas, que também vêm do pacote | bloquear |
| M4 | Fato citado carrega sua data de referência; fato defasado é citado com a própria data | devolver |
| M5 | Todo parágrafo declara classe; parágrafo de Evidência cita ao menos um fato; nota rotineira sem Recomendação | devolver |
| M6 | Palavra de direção ("alta", "subiu", "queda", "recuou", "estável") coerente com o sinal do fato na mesma frase | bloquear |
| M7 | Léxico proibido: faixa verbal de score perto de nome de instituição, vocabulário de rating e recomendação, adjetivo valorativo sem régua | devolver |
| M8 | Hífen ou travessão na prosa | devolver |
| M9 | Lacunas e defasagens do pacote declaradas quando o tema é tratado | devolver |
| M10 | Tema sensível (nome do cadastro de instituições, FGC, Open Finance, resolução): força degrau 3 e exige declaração de interesse | devolver |

**Checagens constitucionais (modelo, preferencialmente de outro fornecedor).**

- C1: toda inferência declara a base e o que a refutaria.
- C2: causalidade indevida.
- C3: seleção enviesada, isto é, fato adverso de mesma relevância omitido.
- C4: tom.

Essas checagens só devolvem, com motivo. Não aprovam número e não revertem bloqueio mecânico.

**Regra de decisão.**

- Falha em M1, M2, M3 ou M6: **bloquear**.
- Outra falha: **devolver**.
- Sem falha: **aprovar**. No degrau 1, aprovar significa encaminhar ao editor.

### d) Degraus de autonomia

| Degrau | Tipos de nota | Quem publica | Condição de entrada |
|---|---|---|---|
| 1 | todos | editor chefe | padrão |
| 2 | nota rotineira de dados (conjuntura descritiva) | publica após o validador; o editor recebe cópia e pode retirar | N ciclos consecutivos limpos (proposta: 6), recall do validador de 100% nos sentinelas numéricos (M1 a M3, M6) e de pelo menos 95% nos demais, medido em pelo menos 50 casos |
| 3 | interpretação, tese nova, temas dos arts. 5 e 6 | sempre o editor | permanente |

- **Ciclo limpo:** nenhum erro factual publicado e nenhum erro factual que o validador deixou passar e o editor encontrou.
- **Rebaixamento automático:** erro relevante publicado devolve o tipo de nota ao degrau 1, zera a contagem e abre análise de causa.

### e) Avaliação contínua

1. **Teste retrospectivo.**
   - A gold histórica em git já permite rodar a esteira sobre três vintages reais: mai/2026 (`1fd6731`), jun/2026 (`238e5f9`) e jul/2026 (`fe048da`).
   - Desfecho conhecido de dois tipos. Revisão: quantas afirmações da nota continuam verdadeiras com a gold seguinte; na data base mai/2026, já medido, 4 inversões de sinal em 57 fatos. Inferência: afirmações de tendência conferidas contra os meses seguintes.
   - Janelas longas exigem reconstruir vintages. O SGS não publica versões (seção 6).
2. **Casos sentinela.**
   - Notas com erro plantado, uma categoria por caso: número trocado, número fora do pacote, dígito digitado, sinal invertido com palavra de direção, data de referência errada, fonte errada, faixa verbal junto de nome, adjetivo sem régua, causalidade, lacuna omitida, hífen.
   - Um caso cego por ciclo entra no fluxo real.
   - Métricas: recall por categoria e falso bloqueio em notas limpas.
3. **Concordância replicador × analista.**
   - Jaccard dos 5 fatos mais relevantes por recorte.
   - Concordância de direção de leitura.
   - Divergência vai ao editor como seção própria.
4. **Minutos de editor por nota, rodadas de devolução e custo por papel.**
5. **Registro de erros**, que alimenta os degraus.

### f) Pacote de reprodutibilidade (publicado com cada nota)

```
notas/AAAA-MM/
  nota.md               fonte da nota, com {{id}}
  nota_final.md         texto renderizado
  pacote.json           fatos, hashes da gold, lacunas, defasagens
  validador.json        decisão por item, com motivo
  verificacao.txt       saída de --verificar contra a gold do commit
  manifesto.json        commit da gold, sha256 dos arquivos gold, sha256_fatos,
                        sha256 da constituição, modelo e versão por papel, datas
```

Qualquer leitor refaz cada número com:

```
git checkout <commit da gold>
python3 -m pesquisa.fatos_conjuntura --verificar notas/AAAA-MM/pacote.json
```

---

## 5. Plano do piloto

**Escopo.** Nota mensal de conjuntura do crédito com as 18 séries da divulgação de estatísticas monetárias e de crédito do BCB que já estão em `pulse.json`: saldo, concessões, taxa, spread e inadimplência, cada uma no total, PF e PJ; mais crédito/PIB, endividamento e comprometimento de renda.

**Gatilho.** Avanço da data base de `saldo_total` na gold publicada. O calendário do BCB não está no repositório nem foi consultado.

**Formato.** Dois analistas, replicador, crítico, validador e editor. Três ciclos no degrau 1.

**Regra de parada.** Nenhuma publicação fora do repositório durante o piloto sem decisão expressa do editor.

| PR | Escopo | Testes | Critério de aceite |
|---|---|---|---|
| **1** (aberto) | Esta avaliação, `docs/CONSTITUICAO.md` e o pacote de fatos (`pesquisa/fatos_conjuntura.py`, somente leitura); passo de testes Python no CI | 24 testes `unittest`: contrato, lacunas, defasagens, determinismo, verificação contra gold adulterada e revisada, gold publicada | Testes verdes; o editor aprova a constituição; o pacote reproduz os 57 fatos da gold publicada |
| 2 | Validador mecânico (M1 a M10) e primeira bateria de casos sentinela, pelo menos 30 cobrindo todas as categorias; formato do registro de erros | Um teste por checagem; toda a bateria de sentinelas; notas limpas não bloqueadas | Recall de 100% em M1 a M3 e M6; zero falso bloqueio nas notas limpas da bateria |
| 3 | Modelo da nota (seções e placeholders de data e fonte), renderizador e manifesto de reprodutibilidade | Renderização determinística; nota de exemplo escrita à mão passa no validador; manifesto confere hashes | O editor aprova o modelo da nota |
| 4 | Verificador de fonte: confere cada série do pacote na API SGS; falha de rede vira "não verificado", nunca aprovado | Com fixture, sem rede; divergência simulada acusada | Relatório legível pelo editor em uma tela |
| 5 | Papéis de agentes: instruções versionadas por papel, com o hash da constituição embutido; orquestração local que só escreve em `notas/` | Recusa escrita fora de `notas/`; execução a seco com agentes simulados produz a estrutura completa | O editor aprova as instruções; decisão sobre o segundo fornecedor registrada |
| 6 | Métricas por ciclo (tokens, minutos, devoluções, recall sentinela, concordância) e rodada retrospectiva sobre mai/2026 e jun/2026 | Esquema das métricas; a rodada retrospectiva produz os dois pacotes completos | Métricas preenchidas nas duas rodadas retrospectivas |
| 7 | Ciclos 1, 2 e 3: um PR por data base nova, com a nota em `notas/AAAA-MM/` | Validador e verificação da gold no PR | Decisão do editor por ciclo; relatório final do piloto com erro factual por etapa, recall, concordância, minutos e custo |

**Critério de saída do piloto (R).** Três ciclos sem erro factual publicado e minutos de editor medidos nos três. Promoção ao degrau 2 não se decide no piloto: exige os N ciclos da seção 4d.

**Fora do piloto, para decisão separada (R).**

1. PR de mitigação das páginas nominais (seção 3b).
2. Testes de conteúdo antes da publicação e testes de moradia e consignado contra a gold publicada (seção 3a).
3. Correção do rótulo de data base das fichas (seção 2d).

---

## 6. O que não foi possível verificar

- **Calendário de divulgação do BCB** para as estatísticas de crédito: não consultado e inexistente no repositório.
- **Causa da revisão da inadimplência de junho** (4,68% para 4,58%): não se sabe se foi revisão ordinária do BCB, mudança metodológica ou defeito de coleta. O SGS não publica versões, e o bronze de 27/08/2026 está no cache do Actions, que não acessei.
- **Crédito/PIB e endividamento** não foram conferidos contra a API em 24/09/2026: HTTP 502 e resposta vazia.
- **Quebras metodológicas** nas 18 séries do escopo, por exemplo efeitos da Res. CMN 4.966 nas estatísticas de crédito: não verificadas.
- **Logs das execuções do Actions** e estado do cache: não acessados.
- **Site em produção:** não acessado. O que digo sobre exibição vem do código da SPA e da gold publicada.
- **Leitura integral de `public/obs/app.js`** (mais de 13 mil linhas): não feita; só trechos citados.
- **Valor contra trecho literal nas curadorias** `custos_ti.json`, `folha_balanco.json` e `guidance.json`: não conferido. Só `fase2_observacoes.json` foi conferida.
- **Pipeline completo com coleta:** não executado; depende de horas de rede ampla.
- **Custos do piloto:** tokens, preço, minutos de editor e devoluções não existem antes dele.
- **Calibração do score por instituição** contra desfechos: não testada.
- **Efeito da diversidade de modelos sobre erro correlacionado:** não medido.
- **Afirmações dos levantamentos de apoio:** foram conferidas por amostragem. As que cito com linha foram conferidas diretamente, exceto as referências a `docs/AUDITORIA_*` e `docs/AVALIACAO_*` marcadas na seção 3, que vêm do levantamento.
