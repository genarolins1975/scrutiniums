# OPERACOES.md — o arcabouço operacional do Observatório

Runbook único: o que roda sozinho, em que ordem, quem vigia o quê, e o que
permanece manual **por decisão** (não por falta de automação). Revisado em
06/08/2026, após a pane de 03–06/08 (detalhada ao fim).

## O ciclo diário

```
06:00 BRT  atualizar-dados.yml      coleta ~30 fontes → gold → push no main
   └─ push no main dispara o deploy da Vercel (site + /obs/data/gold servidos)
   └─ job `alertar`: falha/cancelamento vira issue no repositório
12:00 BRT  vigilancia.yml (frescor) gold publicado com >2 dias → issue
contínuo   ci.yml                   todo PR e todo push no main: lint, tipos,
                                    compileall do pipeline, vitest completo
```

Cadências internas do pipeline: fontes com API são coletadas todo dia com
idempotência por hash/período; os cadastros pesados do BCB (EPAE, dependências,
correspondentes — ~45 MB somados) respeitam periodicidade semanal via
`coletado_recentemente`, porque a fonte é posição corrente que muda devagar.
A data da posição é publicada no gold: pular dias não esconde nada do leitor.

## As vigílias (o pipeline não se vê por inteiro)

| Vigia | Quando | O que cobre | Onde acusa |
|---|---|---|---|
| job `alertar` (no diário) | a cada execução | término anormal do pipeline | issue "Pipeline diário interrompido" |
| sentinela de gold (no diário) | a cada execução | build que regride para stub de erro ou some — o workflow termina verde nesses casos | issue "Gold regrediu para stub de erro"; a última publicação íntegra fica no ar |
| portão de testes (no diário) | a cada execução | gold do dia reprovada pelas suítes vitest, pipeline e pesquisa | issue "Testes de conteúdo reprovaram a gold do dia", com a lista dos testes reprovados; execução **vermelha** |
| `vigilancia.yml frescor` | após cada execução do diário | gold do main com 2 dias ou mais; produção servindo gold mais antigo que o main | issue "gold publicado está defasado", atribuída ao mantenedor |
| selo de frescor (no site) | a cada leitura | publicação com 2 dias ou mais, calculada no navegador | aviso "Atualização atrasada" em /resumo, /dados, /dados/[slug] e /observatorio-do-credito |
| `vigilancia.yml dominios` | diário, 20:00 UTC | cada observatório (Crédito, Setor Elétrico, Gás, Saneamento, Agro, Território, Contas federais e estaduais, Eficiência) além do limiar da sua cadência em `src/lib/frescor/limiares.json` (diária 2 dias, quinzenal 20, mensal 45, anual 400), publicação retida em parte ou sem data | uma issue por domínio, "Vigília de frescor: <nome>", atribuída ao mantenedor; comenta a aberta e a fecha quando o domínio volta a ficar em dia |
| faixa de frescor (no site) | a cada leitura | os mesmos limiares, calculados no navegador | linha "Atualização dos dados" no topo e lista por fonte no método das entradas com conta (/setor-eletrico, /gas-natural, /saneamento, /eficiencia-estatal, /contas-publicas, /agronegocio e /observatorios/*) |
| `vigilancia.yml fontes` | segunda 9:30 UTC | documento novo nas fontes manuais (SPA/MF) | issue "documento novo em fonte manual" |
| CI (`ci.yml`) | todo PR/push | regressão de código, dado ou invariante editorial | check vermelho no PR |

As três primeiras deduplicam: enquanto a issue estiver aberta, ocorrências
novas viram comentários nela. Um cheque de vigília que quebre (código ≠ 0 e
≠ 3) também vira issue — vigia cego é pior que alerta falso.

## Mensal

- `auditoria-notas.yml` (dia 5, 12:00 UTC): roda `pesquisa.auditor` sobre as
  notas aprovadas (integridade, reprodução na gold de origem, validador
  atual, fonte primária no SGS). Erro factual vira errata no ciclo, entrada no
  registro público de erros e issue "Auditoria achou erro factual em nota
  aprovada"; o tipo de nota volta ao degrau 1.
- `boletim-mensal.yml` (dia 1º): envia o boletim da central de alertas.
- `resumo-email.yml` (depois de cada execução do diário, com reserva às 21:47
  UTC): envia o resumo do crédito às assinaturas confirmadas em /resumo, sem
  conta. Idempotente: a diária só recebe edição nova; a semanal, às segundas.
- `zenodo-mensal.yml` (dia 6): prepara o pacote mensal das séries para o Zenodo
  (`scripts/zenodo_deposito.py`) e o guarda como artefato. Rascunho no Zenodo só
  com `ZENODO_RASCUNHO=1` e o segredo `ZENODO_TOKEN`; a publicação é sempre
  manual. Pendências: conta no Zenodo, criadores e licença dos dados derivados em
  `config/institucional.json`, e a primeira publicação.
- `alertas-atualizacao.yml` (todo dia, 11:37 UTC): verifica os alertas que as
  contas assinam em "Avisar quando atualizar" e envia e-mail só a quem assinou
  uma fonte cuja data de referência avançou (`src/lib/conta/alertas.ts`).
  Idempotente. Cada execução autorizada grava o evento `alertas_verificacao`;
  sem ele nos últimos três dias (ou sem `RESEND_API_KEY`), a conta e a barra
  dos painéis dizem que o envio por e-mail ainda não está ligado.
- **Pendência de configuração dos três envios** (não resolvível no código; em
  19/10/2026 o segredo do item 1 faltava e o `resumo-email.yml` falhava):
  1. segredo `BOLETIM_SECRET` (16 caracteres ou mais) no GitHub Actions;
  2. variável `BOLETIM_SECRET` com o mesmo valor na Vercel;
  3. `RESEND_API_KEY` e `MAIL_FROM` na Vercel, com o domínio do remetente
     verificado no Resend;
  4. `COOKIE_SECRET` na Vercel (assina os links de confirmação e de saída; sem
     ele, em produção nenhum link é emitido nem aceito).
  Sem o item 1, os workflows falham com mensagem explícita; sem o item 2, a
  rota responde 403.

## Atualização agendada por domínio

Cada domínio tem workflow próprio: falha de um não atrasa o outro. Horários em UTC
(São Paulo = UTC−3).

| Workflow | Domínio | Agenda (UTC) | O que coleta | O que bloqueia a publicação |
|---|---|---|---|---|
| `atualizar-dados.yml` | Crédito | todo dia, 09:00 | ~30 fontes (BCB, IBGE, Ipeadata, CNJ...) | três suítes, por grupo da gold (`docs/PUBLICACAO_GOLD_POR_GRUPO.md`) |
| `atualizar-energia.yml` | Setor Elétrico | todo dia, 23:40 | ONS, CCEE, ANEEL | testes da energia |
| `previsao-pld.yml` | Setor Elétrico, previsão do PLD | todo dia, cinco horários entre 08:47 e 10:37 | rodada da previsão | testes da rodada |
| `atualizar-gas.yml` | Gás Natural | dias 3 e 18, 12:17 | ANP, IBGE, BCB, Comex Stat, Banco Mundial | `pipeline.tests.test_gas` (tudo ou nada) |
| `atualizar-territorio.yml` | Território e Clima | dias 2 e 16, 11:41 | INPE, Atlas de Desastres, SIRENE | `pipeline.tests.test_territorio` (tudo ou nada) |
| `atualizar-agro.yml` | Agronegócio | dias 9 e 24, 11:41 | IBGE, Comex Stat, BCB, Tesouro, INPE, SEEG, MapBiomas | `pipeline.tests.test_agro` (tudo ou nada) |
| `atualizar-saneamento.yml` | Saneamento | dia 6, 11:23 | SINISA, CadÚnico, SISAGUA, DATASUS, CVM, JMP, ODS | por grupo de fonte: testes Python do saneamento e contratos vitest da gold |
| `atualizar-contas-publicas.yml` | Contas Públicas Federais | terças, 10:19 | SIOP (execução orçamentária por esfera e grupo de despesa; por função e subfunção do ano corrente e do anterior, `importar-funcoes.py --recentes`), Banco Central (dívida bruta do governo geral, SGS 13761 e 13762, `importar-divida.py`) e vigia de edição do RTN | por grupo: testes dos importadores e contratos vitest do painel |
| `atualizar-contas-estaduais.yml` | Contas Públicas Estaduais | dia 5, 11:29 | conferência das 81 respostas do Siconfi e sondagem de período novo | não publica (promoção revisada); contratos e `consolidar --check` deixam a execução vermelha |
| `atualizar-eficiencia.yml` | Eficiência Estatal (Educação e Saúde nas capitais) | dia 12, 10:53 | Siconfi (DCA, RREO, MSC), IPCA e SIOPS | por grupo: testes Python do OBEE, conferências derivadas do `ci.yml` e contratos vitest |
| `atualizar-inflacao.yml` | Famílias, Inflação por cidade (IPCA) | dias 10 e 14, 13:47 | IBGE, SIDRA tabela 7060 (índice geral, grupos e subitens nas 16 áreas e no Brasil) e calendário de divulgação | por grupo: `pipeline.tests.test_inflacao` (pesos somam 100 por área e mês, mês faltando, faixa plausível, encadeamento e contribuições) e contratos vitest do painel |
| `atualizar-seguranca.yml` | Eficiência Estatal, Segurança pública por UF | dia 21, 12:37 | MJSP (Sinesp VDE, planilhas anuais desde 2015), DATASUS (SIM pelo TabNet: agressões, intenção indeterminada e causas externas por UF), Siconfi (DCA Anexo I-E dos 27 governos estaduais, função 06) e IBGE (Projeções da População, Revisão 2024) | por grupo: `pipeline.tests.test_seguranca` (27 UFs e anos completos, eventos com o nome esperado, faixas plausíveis, revisão de ano fechado até 10%, total do TabNet igual à soma das UFs, população que soma o Brasil, regra de ausência) e contratos vitest do painel |

**Motor comum dos novos que publicam (Saneamento, Contas Federais, Eficiência Estatal e, desde 20/10/2026, Inflação por cidade e Segurança pública por UF)** (`scripts/atualizacao_por_grupo.py`,
configuração em `config/atualizacao/<domínio>.json`). Cada grupo de fontes é coletado à
parte; coleta que falha, ou que troca dado íntegro por erro (guarda
`manifesto_sem_erro_novo` do OBEE), devolve o seed do grupo ao commit e não para os
outros. A gold é reconstruída do seed publicado: se não se reproduz com o código atual,
a reprodução é testada como grupo próprio. Depois cada grupo coletado é aplicado sobre os
já aprovados, reconstruído e testado; reprovado, volta ao estado anterior. Dado igual não
publica (o sinal de mudança ignora a data de captura e, no OBEE, olha só o `hash_dados`).
No saneamento, arquivo reescrito pela fonte com os mesmos números publica só a
proveniência nova, para a vigília semanal não acusar de novo. Mudanças são comparadas
por conteúdo, nunca pelo cache de stat do Git: no mesmo segundo e com o mesmo tamanho, o
Git dá o arquivo por inalterado e o commit sairia sem ele (medido no teste do motor).

**As correções permanentes dos incidentes, aplicadas aos novos workflows.** Push com
rebase e quatro tentativas, sem publicar se os dados do domínio mudaram no `main`
durante a execução e retestando se o código mudou (pane de 03/08); concorrência por
domínio sem cancelamento e teto de tempo por job e por comando; retenção deixa a
execução **vermelha** e abre ou comenta a issue do domínio, atribuída ao mantenedor, com
a lista dos testes reprovados e a saída de cada um (correção 4 de 13/10); o job `alertar`
cobre tempo esgotado e cancelamento, que não chegam ao passo da issue; todas as suítes do
domínio rodam até o fim, sem `bash -e` interrompendo a seguinte (correção 4); o vitest
roda com `--testTimeout=60000`, porque três testes do OBEE estouraram o limite padrão de
5 s sob carga em 19/10/2026 sem nenhuma asserção reprovada. Esses domínios não têm
silver em cache: o estado é o seed versionado, e as correções de cache (5, 10 e 11) não
se aplicam.

**O que só a primeira execução real comprova.** Alcance das fontes a partir dos runners
do GitHub (o firewall do gov.br já recusou o `urllib` no Território), o tempo da coleta do
SISAGUA (cerca de 40 arquivos de 100 a 200 MB, não rodada nesta sessão), a criação das
issues pelo `GITHUB_TOKEN` e o push no `main`. O ciclo rodou de ponta a ponta nesta sessão
em 19/10/2026, sem publicar (o commit ficou fora do `main`):
- Contas Federais: o SIOP respondeu, a base de 17/10/2026 passou nos testes e o grupo seria
  publicado;
- Saneamento: SINISA (86 s), CadÚnico, JMP e ODS sem número novo; a CVM trouxe a versão 7
  do Formulário de Referência da COPASA (BlackRock com 5,005%) e o grupo seria publicado com
  os testes verdes; o DATASUS revisou contagens do SIH fora da janela publicada e só a
  proveniência seria publicada;
- Eficiência Estatal: Siconfi da Educação (452 s) e Siconfi e SIOPS da Saúde (491 s) sem
  nenhum `hash_dados` novo: nada a publicar, árvore limpa;
- Contas Estaduais: 81 de 81 respostas conferidas, uma divergente (SC, RGF do 1º
  quadrimestre de 2026: 60 linhas arquivadas, 0 servidas hoje) e o RGF do 2º quadrimestre
  de 2026 disponível para as 27 UFs;
- o vigia do RTN acusou o boletim de agosto de 2026, ainda não integrado.

### O que permanece manual nesses quatro domínios, com fonte e motivo

| Domínio | O que | Fonte | Por que é manual |
|---|---|---|---|
| Saneamento | Edição nova do SINISA | Ministério das Cidades, página de resultados do SINISA | URLs e nomes de planilha mudam a cada edição (`pipeline/observatorio_saneamento/fontes.py`) e a edição muda o ano de referência de todo o painel; a vigília semanal acusa a página nova |
| Saneamento | Mês novo do CadÚnico e ano novo do SISAGUA | MDS (API MI Social); Ministério da Saúde (S3 do SISAGUA) | Meses e anos são fixados no código (`fontes.CADUNICO`, `sisagua.ANOS_SERIE`) e mudam o período do painel; a vigília acusa |
| Saneamento | Censo 2022 e 2010, estimativa de população e desigualdades | IBGE, SIDRA | Edições fechadas (decenal); recoletar não traz dado novo |
| Saneamento | Tabelas tarifárias e atos dos reguladores | ARSESP, ARSAE-MG, AGEPAR, ARPE, ADASA e outros (PDFs) | Curadoria de documentos com localizador por página (`curadoria/`, `tarifas.py`); não há API |
| Contas Federais | Edição nova do RTN | Tesouro Transparente (boletim e CKAN) | Muda a base de preços do IPCA, o aviso de atualidade e os testes da edição; o vigia do workflow abre a issue "edição nova do RTN aguardando integração" |
| Contas Federais | IPCA, denominadores do IBGE, restos a pagar, metas físicas (AFFO), custos (RFC), gastos tributários (DGT Bases Efetivas) | IBGE (SIDRA); Tesouro (relatório de RAP, RFC); SIOP (AFFO); Receita Federal (DGT, planilha anual) | Integração por edição com hash fixado (`importar-ipca.py`, `importar-escala.py`, `importar-etapa3.py`, `importar-custos.py`, `importar-beneficios.py`; este guarda os quadros usados em `data/contas-publicas/beneficios-dgt-2023` e recusa planilha de edição nova até a revisão) |
| Contas Federais | Exercício novo do SIOP | SIOP | `ANOS_SIOP` em `importar.py` e a leitura do painel mudam junto |
| Contas Federais | Exercícios antigos por função (2000 até o ano retrasado) | SIOP | Ficam no snapshot `funcoes.json` com as respostas guardadas em `data/contas-publicas/fontes/funcoes`; a coleta agendada refaz só o ano corrente e o anterior. Para reconferir a série inteira: `python3 scripts/contas-publicas/importar-funcoes.py --todos`. Em janeiro, se o grafo do ano novo ainda não existir no endpoint, a coleta retém a publicação e abre a issue |
| Contas Estaduais | Promoção de captura nova (retificação ou período novo) | Siconfi (API pública) | A base publicada reproduz só bytes arquivados e a promoção é alteração revisada (`docs/contas-publicas-estaduais/FASE_1.md`, passo 3); o workflow acusa e guarda a evidência |
| Contas Estaduais | Dívida consolidada (CE-11, `snapshot.json`) | gold do Crédito em commit fixado | Snapshot herdado por decisão, fixado por blob Git |
| Eficiência Estatal | Exercício novo (2026 em diante) | Siconfi, SIOPS | `ANOS_FINANCEIROS` e fichas de indicador mudam junto (CONTINUIDADE.md, T1) |
| Eficiência Estatal | Pacotes do INEP (Censo Escolar, ATU, rendimento, Ideb, Sinopse) | INEP | Até 540 MB cada, baixados à mão; o coletor só extrai (`run.py --inep`) |
| Eficiência Estatal | CNES, Relatório APS, RIPSA, OCDE, SIOPE e os demais capítulos (assistência, alimentar, trabalho, mobilidade, cultura, habitação, justiça, judiciário, segurança, saneamento, resultados, escores) | Ministério da Saúde, OCDE, FNDE, MDS, IBGE, CNJ, Ipea | Fixados por edição, com transcrição conferida ou referência congelada que exige revisão antes de regenerar |
| Eficiência Estatal | Derivados que fixam a gold da Saúde por hash | `src/lib/eficiencia/panorama-atlas.json`, `docs/obee/resultados/piloto-2022.json` | Mudança real na gold da Saúde é retida pelos testes até a regeneração revisada desses derivados |

## O que permanece manual, o que deixou de ser, e por quê

1. **Portão da Fase 2** (clientes, quadro de pessoal, custos de TI, folha e
   guidance por divulgação própria). Desde a constituição v2 (24/09/2026) **não há
   revisão humana**: valor extraído de documento só é publicado se o código
   encontrar o próprio valor no trecho literal citado (`pipeline/curadoria.py`,
   travado por teste antes de cada publicação). Os 22 valores de guidance aprovados
   antes da regra, com trecho resumido, ficam listados como legado e não servem de
   precedente.
2. **Curadoria de bets e fraudes** (`pipeline/curated/*.json`). As fontes
   centrais (Panoramas SPA) são PDFs semestrais sem API; a atualização segue o
   processo do FONTES_BETS.md §7. O que foi automatizado é a **detecção**: a
   vigília de fontes acusa o documento novo em até uma semana. Ao incorporar,
   o curador acrescenta os hrefs novos a `pipeline/watch/spa_apresentacoes.txt`
   no mesmo commit — é isso que silencia a vigília.
3. **Decisões de fronteira** (incluir instituição, aceitar domínio novo de
   documento, criar métrica). São escolhas editoriais; os testes forçam que
   cada uma seja consciente (allowlists, cadastros explícitos com assinatura).

## Pontos únicos de falha conhecidos

- **Cache do Actions** guarda o estado silver/bronze entre execuções. Se
  expirar (~7 dias sem uso), a execução seguinte reconstrói do seed versionado
  (`pipeline/seed/silver-seed.db.gz`) e re-coleta o incremental — lenta, mas
  auto-suficiente. O seed não é atualizado automaticamente; se a reconstrução
  começar a estourar o tempo, gerar seed novo é a manutenção indicada.
- **Vercel** faz o deploy por push. Desde 13/10/2026 o cheque de frescor compara
  o `gerado_em` da produção com o do main e acusa diferença que dure mais de 3 h
  depois do push; a saúde do site além disso não é vigiada.
- **Portão de testes do diário** é tudo ou nada: um único teste reprovado em
  qualquer domínio retém a gold inteira, inclusive os domínios íntegros. É a
  escolha conservadora (nada errado vai ao ar), e o custo dela apareceu em
  24/09-13/10/2026. Publicação parcial por domínio fica como decisão pendente.

## A pane de 03–06/08/2026, como memória institucional

Encadeamento: (1) em 03/08 a coleta terminou mas o push foi rejeitado — main
tinha andado durante a execução e não havia rebase; (2) com o job falho, o
post-step do actions/cache não salvou o estado; (3) cada execução seguinte
restaurou cache mais velho, teve mais a refazer e estourou os 90 minutos —
que por sua vez impediu salvar o cache. Quatro dias de gold parado, descobertos
por checagem manual.

Correções permanentes: push com `pull --rebase` e retry; cache separado em
restore/save com `if: always()`; timeout 90→150 min; e as duas vigílias acima,
para que "parado há dias" nunca mais dependa de alguém olhar por acaso.

## A pane dupla de 07-08/08/2026 — a segunda memória

O cache perdido na pane anterior obrigou a reconstrução do silver a partir do
seed — que não tinha as tabelas mais novas (Pix, judicial/TST, Desenrola,
correspondentes). A recoleta caiu numa janela de degradação do próprio BCB:
MPV trimestral e IF.data com HTTP 500, MED devolvendo zero linhas, o CSV do
Desenrola malformado e o cadastro de correspondentes servido TRUNCADO (70
contratantes onde há ~280). Resultado: o build do Pix estourou e publicou stub
de erro, o `pix_mun.json` foi apagado pelo `rsync --delete`, o mapa municipal
inventou um município "sem nenhum ponto", e o TST sumiu do judicial — tudo com
o workflow terminando VERDE, porque nenhum vigia olhava o conteúdo do gold.

Correções permanentes: **sentinela de regressão do gold** (tabela acima);
**carry-forward declarado** nos builders de Pix (trimestral e MED) e judicial
(TST) — fonte em pane carrega a última publicação íntegra, com cautela no
próprio payload, e volta ao vivo na primeira coleta que funcionar; **piso de
completude** nos coletores de correspondentes e dependências — arquivo
truncado é falha de coleta, nunca posição nova, e silver parcial se recoleta
todo dia até a fonte sarar. O id dos alertas operacionais ganhou regra e
referência (as flags da família, ativadas nesta janela, colidiam ids).

## Recaída dos correspondentes (09-10/08) — o remendo que faltava

O piso de completude impediu dados truncados NOVOS, mas a posição parcial de
07/08 já estava no cache do CI — e o BCB seguiu truncando o arquivo para os
runners do GitHub (58 e 70 contratantes em dias distintos; da sessão local o
mesmo arquivo desce íntegro com 279). Os builders republicaram o dado
degradado por dois ciclos, e o sentinela não acusa porque não é stub: é
número errado com cara de número.

Correções permanentes: **seed versionado da última posição íntegra**
(`pipeline/seed/corresp-pontos-seed.csv.gz`, com posição declarada no próprio
dado) que o coletor restaura sozinho ao detectar silver parcial; **retry** do
download (a truncagem é não determinística); e a recoleta diária continua até
a fonte servir o arquivo completo. Lição registrada: regressão degradada-mas-
não-stub só é pega por teste de conteúdo no CI — por isso os testes de dados
leem o gold PUBLICADO.

## A retenção silenciosa de 24/09 a 13/10/2026 — a terceira memória

**Sintoma.** O `meta.json` do main ficou parado em 2026-09-24T15:25 UTC. As 19
execuções diárias seguintes terminaram **verdes** na aba Actions, e as páginas
seguiram prometendo "atualizado diariamente".

**Mecanismo.** Desde 24/09 o passo de testes de conteúdo roda antes do commit, com
`continue-on-error`; reprovada a gold, o passo "Reter publicação" desfaz a cópia,
comenta a issue de retenção e o job termina com sucesso. Houve ao menos um teste
reprovado em todas as execuções examinadas (25, 26, 28 e 30/09; 02, 03, 04, 05, 08,
10, 11 e 12/10; em 03 e 04/10 só a retenção foi confirmada, sem a lista de testes; as
demais não foram lidas), com a causa mudando de domínio:

| Execuções | Teste reprovado | Causa |
|---|---|---|
| 25, 26, 28 e 30/09; 08/10 | `cobranca-data`: bancário maior que o total | DataJud devolve HTTP 200 com shards recusados e contagem parcial (PR #110 tratou parte; recaiu em 08/10) |
| 30/09, 02/10, 05/10 e 08/10 | `emprego-data`: reconciliação nula | `reconciliacao` nula no emprego.json (admissões e desligamentos do Ipeadata contra o estoque do SGS); em 08/10 o builder de emprego quebrou e a sentinela manteve a versão anterior |
| 05/10 (só) | `funding-data`, `judicial-data` | fontes degradadas no dia |
| 05/10 a 12/10 (gold rural já sem municípios em 04/10) | `rural-data`: zero UFs e zero municípios | perda do cache em 03/10 (`Cache not found`, silver semeado de novo, sem tabelas do Sicor); a recarga da cauda histórica dos recursos leves consumiu os 25 min do orçamento único todos os dias e os recursos pesados (município, instituição, produto) nunca rodaram |
| 10, 11 e 12/10 | `obee-assistencia`, `obee-alimentar`: ENOENT | os artefatos OBEE passaram a ser gitignorados e materializados no `pretest`; o diário chama `npx vitest run` direto e não os materializava |

As suítes Python do portão **não rodaram** em nenhuma dessas execuções: o `bash -e`
parava no primeiro erro do vitest.

**Por que ninguém agiu.** A vigília de frescor funcionou: abriu a issue "gold
publicado está defasado" em 26/09 e comentou 33 vezes. A issue de retenção recebeu
17 comentários. Nenhuma tinha responsável; cada comentário dizia só "Nova
ocorrência" com um link; e a retenção de 25/09 foi respondida com "corrigido no PR
#110, fechar quando a próxima execução publicar". Depois disso a causa trocou de
domínio três vezes sem que nenhum texto mostrasse a troca, e a aba Actions, verde,
desmentia o alerta.

**Correções permanentes (13/10/2026).**
1. O setup global do vitest materializa os três artefatos OBEE: a suíte é
   autossuficiente em qualquer invocação.
2. Coleta do Sicor com orçamentos separados, recursos pesados primeiro e o municipal
   antes de todos; meses móveis ampliados em dois para cobrir o atraso do municipal.
3. A janela do crédito rural termina no último mês fechado presente no nacional e no
   municipal, com o recuo declarado (`janela_recuada` e cautela). Em 13/10/2026 a
   Olinda servia o municipal de 2026-07 e devolvia HTTP 500 para 2026-08 e 2026-09.
4. Portão: as três suítes rodam sempre (e o `pyarrow` é instalado, sem o qual 69
   testes Python quebram); a issue de retenção lista os testes reprovados e nasce
   atribuída ao mantenedor; a execução retida termina **vermelha**.
5. Poda dos caches do estado do pipeline: ficam os três mais recentes. A causa exata
   do `Cache not found` de 03/10 não foi confirmada (os logs não a registram); cada
   execução grava cerca de 0,8 GB com chave nova, perto do limite de 10 GB do
   repositório somado aos caches de energia.
6. Vigília de frescor atribuída ao mantenedor, com a causa provável no corpo, e
   comparando produção com main.
7. Selo de frescor nas páginas públicas, calculado no navegador; a promessa
   "atualizado diariamente" virou "coleta diária, publicação depois dos testes".

**Primeira execução depois das correções (13/10/2026, run 38432361094).** Retida de
novo, agora só pelo `rural-data` (4 testes: zero UFs, zero municípios). Os OBEE, o
emprego e a cobrança passaram. O município rodou primeiro, como previsto, mas os 16
meses falharam com HTTP 500 "Erro desconhecido" da Olinda em cerca de 1 s cada. O
log não mostrava a causa: a mensagem era cortada em 300 caracteres e a URL ocupava
todos. Medido no mesmo dia, fora do runner: o 500 é intermitente, no mesmo mês alterna
com 200 em 35 a 90 s, e depois do primeiro sucesso o servidor responde do cache. Com
2 tentativas e 6 s de espera o coletor desistia de todos os meses.
8. O 500 rápido da Olinda é retentado por até 30 vezes, cerca de 6 s cada (até 3 min
   por mês); os demais erros seguem com 2 tentativas. Na medição, quatro meses
   que tinham falhado passaram entre a 1ª e a 11ª tentativa (até 132 s). O orçamento
   dos pesados subiu para 25 min, o bastante para recarregar os 16 meses do municipal
   (de 35 a 90 s cada) num só dia; o mês que não couber volta no dia seguinte. Não
   subiu mais porque a coleta inteira levou 131 min contra o teto de 150 min do
   `run.py`, e os coletores depois do Sicor (DataJud, judicial, CVM) seriam pulados.
   A mensagem de falha guarda o começo e o fim, com a causa.

**Segunda execução depois das correções (14/10/2026, run 38578966646).** O Sicor veio
inteiro (66 ok, 0 falhas, 1.987 s) e o municipal cobriu 5.490 municípios. Retida por um
único teste: a soma das UFs (municipal) ficou R$ 731,8 mi acima do total de 12 meses
(FonteRecursos, nacional), contra tolerância de R$ 1. O municipal foi recoletado inteiro
nesse dia; o nacional dos meses já "fechados" vinha de coletas anteriores, e o BCB
continua registrando contratos em meses com mais de dois meses de idade. O total
nacional do log foi R$ 336,9 bi em 13/10 e em 14/10. Coletados na mesma hora, os dois
recortes fecham ao centavo (2026-08: R$ 34.405.907.666,05 nos dois, 14/10/2026).
9. O nacional (FonteRecursos) de cada mês da janela do municipal é recoletado sempre
   que for de fotografia anterior à do municipal do mesmo mês, antes de qualquer outro
   recurso leve (`ALINHADOS_AO_MUN` em `pipeline/sources/sicor.py`). A Faixa ficou de
   fora: entra numa reconciliação com tolerância de 0,5%, e o realinhamento inicial
   dos 16 meses precisa caber no orçamento dos leves.

**Terceira execução depois das correções (15/10/2026, run 38746240160).** O cache do
estado não foi encontrado (`Cache not found for input keys: pipeline-estado-...`) e o
silver foi semeado de novo; 20 testes reprovaram em rural, ampliado, BNDES, estados,
linhagem, operacional e subnacional. A cópia salva na véspera (run 38578966646, 16:23
UTC de 14/10) existia e não foi podada por este workflow. A causa provável, com
evidência nos logs: o job de energia restaurou às 01:46 de 15/10 uma cópia de 7.152 MB
(`energia-estado-37719964861`) e gravou outra às 04:16 (`energia-estado-38667375474`);
as duas passam do limite de 10 GB do repositório, e o GitHub despeja primeiro o cache
acessado há mais tempo, que era o do crédito. Às 13:43 a previsão do PLD também já não
achou cache de energia e restaurou da sua cópia durável. A mesma causa explica, por
inferência, a perda de 03/10, que não tinha explicação registrada.
10. O estado do crédito (`data/silver` e `data/bronze`) ganhou cópia durável na release
    `pipeline-estado`, fora do limite do cache, no mesmo padrão da energia
    (`scripts/estado_duravel.sh`): salva depois de todo pipeline concluído, restaurada
    quando o cache falta, em partes de até 1,9 GB com manifesto sha256; cópia
    incompleta ou corrompida não é extraída e o pipeline semeia como antes.
11. A energia e a previsão do PLD apagam a cópia anterior do estado (`energia-estado-*`,
    inclusive as da previsão) antes de gravar a nova, e só quando o estado completo foi
    restaurado (`scripts/podar_cache.sh`), e podam de novo logo depois de gravar,
    mantendo só a mais recente: as duas têm filas próprias (a previsão não pode esperar
    a energia e perder o corte das 07h), e numa execução simultânea a sobreposição de
    duas cópias de ~7,2 GB fica limitada a minutos.
    Se a gravação falhar depois da poda, o silver da energia volta da release
    `energia-estado` e o bronze é recoletado. O crédito guarda só a cópia mais recente
    do cache (~0,9 GB), já que tem a cópia durável. A energia avisa no log quando o
    estado passa de 8 GB: a 10 GB uma cópia sozinha não cabe mais no cache, e reduzir o
    bronze vira decisão do domínio.

**Quarta execução depois das correções (16/10/2026, run 38909799073).** O cache foi
encontrado, o Sicor e o resto da coleta rodaram, a primeira cópia durável do estado foi
salva (23 s) e, nos testes de conteúdo, o vitest **não chegou a rodar nenhum teste**:
o setup global falhou com `spawnSync git ENOBUFS` em `scripts/git-worktree-guard.mjs`
(linha do `git diff --binary HEAD`), e o processo do vitest foi abortado com código 134
(`FATAL ERROR: Reached heap limit`, 4,1 GB, na pilha do V8 em `Object.keys`).
As duas suítes Python passaram (1.687 e 69 testes). A issue de retenção, porém,
dizia "a reprovação veio das suítes Python", porque o texto presumia isso sempre que o
vitest não listava teste reprovado: a causa certa só aparecia no resumo
`vitest=134 pipeline=0 pesquisa=0` do log.

Causa. O guarda de worktree (13/10) compara a árvore Git antes e depois da suíte e
guardava o patch inteiro (`git diff --binary HEAD`) em memória, com teto de 64 MB. A
gold regenerada pelo ciclo soma 96,6 MB em 3.894 arquivos de JSON indentado. Uma
publicação diária típica muda 441.792 linhas (208.953 acréscimos e 232.839 remoções, no
commit acc5c6e5f de 24/09/2026, fonte: estatísticas do commit no GitHub), o que dá
cerca de 10 MB de patch a 22 bytes por linha (estimativa minha). Sem publicação havia 22
dias, a diferença para a gold publicada passou de 64 MB: o ENOBUFS prova o limite, e o
tamanho exato do patch não foi registrado. Nas execuções de 13, 14 e 15/10 o setup
global rodou e o patch coube. Inferência: o patch tende a crescer a cada dia sem
publicar, e a gold completa de 16/10 (cache restaurado) difere mais da publicada do que
a de 15/10 (silver semeado do zero, mais pobre). O estouro de memória do vitest em
seguida é provavelmente consequência do tratamento do erro, que carrega 64 MB de
buffer; não foi isolado. Reproduzido localmente com um arquivo de 36 MB reescrito
(patch de 72.000.113 bytes): mesma mensagem de erro do log.
12. O guarda calcula o hash do patch em fluxo, por arquivo temporário, em blocos de 1
    MB: o tamanho do patch deixou de ser limite (o mesmo patch de 72 MB passa em cerca
    de 1 s, com 49 MB de memória). O texto da issue passa a receber os códigos de saída
    das três suítes e a saída do unittest: aponta o processo abortado, lista os testes
    Python reprovados e não atribui a causa quando não há como saber.

**Quinta execução depois das correções (17/10/2026, run 39033304284).** O guarda
corrigido funcionou: o vitest rodou os 299 arquivos (293 passaram, 5 reprovaram com 9
testes), as suítes Python passaram (1.884 e 69 testes) e a cópia durável foi salva (482
MB). Cinco causas, quatro delas herdadas do silver semeado de novo em 15/10:
- **Consignado** (6 testes): o bloco de reclamações saiu vazio. Em 15/10 o estban não
  carregou o índice de municípios do IBGE (tempo esgotado) e o `reclamacoes_consig`
  gravou as 12 competências com zero municípios, dando-as por absorvidas; o estado
  contaminado seguiu no cache e na cópia durável.
- **Judicial** (1 teste): o silver semeado não tinha as tabelas `jud_*`, e o orçamento
  de 600 s do coletor acabou no TJSP. O builder publicou 1 tribunal e 2 categorias,
  com total trabalhista 0, contra 15 tribunais e 7 categorias em 24/09.
- **Rural** (1 teste): UFs R$ 60.975.420,30 acima do total, soma exata de 2026-08,
  2026-06 e 2026-02. Em 15/10 a Olinda serviu a um dos recortes, na mesma execução, a
  fotografia de 14/10; a regra do #198 comparava só a hora da coleta.
- **Inventário de tradução** (1 teste): `cmp/00058338.json` saiu da base, o `rsync
  --delete` o apagou e a descoberta de fontes, que usa `git ls-files --cached`, falhou
  com ENOENT.
- **Conta e CPF** (arquivo não carregou): `conta-cpf-browser.test.ts` (15/10) exige
  Chromium, que o `ci.yml` instala e este workflow não instalava.
13. O `reclamacoes_consig` não coleta sem índice de ao menos 5.500 municípios, trata
    competência sem município casado como falha e recoleta a herdada com reclamações e
    zero municípios (autocura, sem limpar cache).
14. O builder judicial grava stub declarado, com a lista de lacunas, quando falta
    qualquer par tribunal e categoria da taxonomia; a sentinela mantém a última
    publicação íntegra. Com o silver real de 17/10: 48 lacunas e a gold de 24/09 no ar.
    Custo declarado: tribunal fora do ar de forma permanente congela a camada nacional.
15. O Sicor recoleta o municipal do mês em que municipal e FonteRecursos diferem em
    mais de R$ 0,05, e o FonteRecursos é refeito na mesma execução.
16. A descoberta de fontes de tradução ignora arquivo rastreado e apagado da pasta de
    trabalho; o workflow instala o Chromium antes do vitest, como o `ci.yml`.
Pendências fora desta correção: ordem fixa dos tribunais no coletor judicial (todo dia
lento gasta o orçamento no TJSP), `ok=True` com tribunais pulados, o ZIP de 2026-05 do
consumidor.gov.br que traz `.7z` em vez de CSV, e a gold de energia, retida em 17/10 por
outros testes com o workflow verde.

**Produção e main.** Em 13/10/2026 às 10:43 UTC a produção servia o mesmo
`gerado_em` do main (2026-09-24T15:25), em `/resumo` e em
`/obs/data/gold/meta.json`. A leitura "Processado em 2026-08-12" relatada nesse dia
não se reproduziu; `/resumo` responde com `cache-control: max-age=0,
must-revalidate`, então a hipótese mais provável é aba antiga ou URL de deploy de
prévia, não deploy defasado.
