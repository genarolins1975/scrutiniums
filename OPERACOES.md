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
| `vigilancia.yml frescor` | diário 15:00 UTC | execução que "conclui" sem publicar | issue "gold publicado está defasado" |
| `vigilancia.yml fontes` | segunda 9:30 UTC | documento novo nas fontes manuais (SPA/MF) | issue "documento novo em fonte manual" |
| CI (`ci.yml`) | todo PR/push | regressão de código, dado ou invariante editorial | check vermelho no PR |

As três primeiras deduplicam: enquanto a issue estiver aberta, ocorrências
novas viram comentários nela. Um cheque de vigília que quebre (código ≠ 0 e
≠ 3) também vira issue — vigia cego é pior que alerta falso.

## Mensal

- `boletim-mensal.yml` (dia 1º): envia o boletim da central de alertas.
  **Pendência de configuração:** exige o segredo `BOLETIM_SECRET` no GitHub
  Actions e a variável homônima na Vercel; sem eles a rota devolve 403.

## O que permanece manual — e por quê

1. **Aprovação das extrações da Fase 2** (clientes, quadro de pessoal por
   divulgação própria). Manual **por desenho**: valor extraído de documento por
   LLM só é publicado com status `aprovado`, evidência completa (documento,
   página, trecho literal) e revisor registrado. Automatizar este portão
   contrariaria a metodologia — a reconciliação curadoria↔gold é testada, e o
   que não foi aprovado simplesmente não existe para o leitor.
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
- **Vercel** faz o deploy por push; não há verificação automatizada de que o
  deploy concluiu. O cheque de frescor cobre o conteúdo (o que está no main é
  o que a Vercel serve), não a saúde do site em si.

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
