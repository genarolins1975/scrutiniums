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
- **Pendência de configuração dos dois envios** (não resolvível no código):
  1. segredo `BOLETIM_SECRET` (16 caracteres ou mais) no GitHub Actions;
  2. variável `BOLETIM_SECRET` com o mesmo valor na Vercel;
  3. `RESEND_API_KEY` e `MAIL_FROM` na Vercel, com o domínio do remetente
     verificado no Resend;
  4. `COOKIE_SECRET` na Vercel (assina os links de confirmação e de saída; sem
     ele, em produção nenhum link é emitido nem aceito).
  Sem o item 1, os workflows falham com mensagem explícita; sem o item 2, a
  rota responde 403.

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

**Produção e main.** Em 13/10/2026 às 10:43 UTC a produção servia o mesmo
`gerado_em` do main (2026-09-24T15:25), em `/resumo` e em
`/obs/data/gold/meta.json`. A leitura "Processado em 2026-08-12" relatada nesse dia
não se reproduziu; `/resumo` responde com `cache-control: max-age=0,
must-revalidate`, então a hipótese mais provável é aba antiga ou URL de deploy de
prévia, não deploy defasado.
