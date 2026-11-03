# Crédito: testes de coerência entre grupos não derrubam mais a publicação em cascata

03/11/2026. Frente técnica 2 da auditoria de painéis.

## Evidência

Execução de 02/11/2026 (comentário da issue 291): 33 grupos publicados, 28 retidos. Um só por falha de coleta
(judicial, stub desde 24/09). Os outros 27 caíram em cascata por quatro testes que comparam golds de grupos
diferentes, sempre reprovando numa rodada posterior à rodada 0:

| Rodada | Teste | O que comparou | Efeito |
|---|---|---|---|
| 0 | só testes do Setor Elétrico (sem gold do Crédito) | | juros retido por `busca-controle` "skipped" (todo, corrigido no PR #401); consignado por dependência |
| 1 | `credito-leitura-browser` | `consignado.sgs.data_base` (edição retida, 2026-08) com `quality.consig_inss_taxa.ultima_ref` (candidata, 2026-09) | reteve consignado, pix e quality |
| 2 | `golds-contrato` | `quality.*.ultima_ref` (candidata) com `meta.gerado_em` (agora o mínimo das edições, 18/10) | reteve comparador, exposures, market, npl, rj, trends |
| 2 | `resumo-canal` | `ibcc` (candidata) com `overview.ibcc_posicao` (retida) | reteve ibcc, pulse, overview |
| 3 | `central-alertas` | `alertas_central` (candidata, 36) com a soma das fontes (misto, 34) | reteve alerts, central-alertas, leading, openfinance, operacional, panorama; method, report, scenario, cobranca, pgfn, instituicoes, desenrola por dependência |

Mecânica (`scripts/validar_publicar_gold.py` e `scripts/publicar_gold.py`): a rodada 0 testa o conjunto candidato
completo; grupos retidos voltam à edição publicada (`compor`) e a composição mista é testada de novo; um teste que lê
vários grupos, reprovado, retinha todos eles. Na composição mista, um teste que confere que dois grupos batem entre si
passa a comparar duas edições e reprova sem que o dado de nenhum dos dois esteja errado.

## Regra nova

Duas classes de teste, decididas pelo mapa de proteção (`pg.classe`): **contrato**, lê um só grupo além do envelope
`meta`; **coerência**, lê mais de um. Em `selecionar`:

- contrato reprovado: retém o grupo (como antes);
- coerência reprovada na rodada 0 (conjunto candidato completo): falha real, retém os grupos lidos (como antes);
- coerência que passou na rodada 0 e reprova numa rodada posterior: não retém nada; entra em `avisos` da decisão e
  na issue da execução, seção "Coerência entre edições", com os grupos e as datas de cada um.

Os quatro testes também deixam de fixar a comparação entre edições: `golds-contrato` confere `ultima_ref` contra a
geração do próprio grupo quality (`meta.grupos.quality.gerado_em`); `credito-leitura-browser` só confronta a
data-base do consignado com a referência do quality quando os dois grupos têm a mesma geração. `central-alertas` e
`resumo-canal` não mudam: comparam golds lidas do mesmo diretório, sem número literal; ficam cobertos pela regra.

## O que a execução de 02/11 teria publicado

Com a regra nova e o código de 02/11: rodada 0 retém juros e consignado; rodada 1 acusa `credito-leitura-browser`
como coerência entre edições (aviso), a seleção estabiliza e 57 grupos são publicados; retidos judicial, juros e
consignado. Com o PR #401 (o todo de `busca-controle` não retém mais juros): 59 publicados, só judicial retido.

## Testes

`pipeline/tests/test_publicar_gold.py`: coerência que passa no candidato completo e reprova na composição mista não
retém e aparece nos avisos; coerência reprovada na rodada 0 retém os grupos lidos; contrato reprovado na composição
mista continua retendo; teste sem classificação continua erro. 33 testes verdes. Vitest: `golds-contrato`,
`central-alertas` e `resumo-canal` rodados sobre a gold publicada (57 testes verdes); `credito-leitura-browser` exige
build e não foi rodado localmente.

## Limites

- A composição mista publicada pode conter uma incoerência real entre edições (a central de alertas com 36 alertas
  e as fontes somando 34): o aviso na issue é a única sinalização. O passo seguinte é recompor os consolidadores
  (central de alertas, overview) a partir dos grupos publicados, como já se faz com `ufs.json` (`recompor` no
  manifesto).
- A classe vem do número de grupos lidos pelo arquivo de teste, não da intenção da asserção.
