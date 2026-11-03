# Setor Elétrico: porta de publicação por gold

03/11/2026. Frente técnica 1 da auditoria. Decisão do dono: por gold, e teste de interface não retém.

## O problema

Desde 30/09/2026 a gold de energia não era publicada: qualquer teste reprovado (eram 44 em 20 arquivos na execução de
03/11) retinha as 26 golds. A retenção por módulo do PR #401 age só nas validações do próprio pipeline; com a gold de
03/11 e o código atual ainda sobravam 10 reprovações em 6 arquivos (previsões do PLD sem a CCEE, geração com 48 em vez
de 72 horas, carga, curtailment, duas páginas em inglês), e a publicação inteira continuaria retida.

## A regra nova

`pipeline/energia/testes_golds.json` classifica cada arquivo de teste que lê a gold de energia (131 arquivos do vitest
e 22 módulos da suíte Python):

| Classe | Reprovou | Efeito |
|---|---|---|
| dado (39 arquivos) | compara página ou gold com o dado | retém só as golds que lê, mais Listadas e Leilões quando Empresas cai e a síntese quando uma gold da operação cai; a asserção que cita uma rota (`/mercado`) ou uma gold no nome restringe a retenção a elas |
| interface (90) | inglês, data crua, componente, layout, busca | não retém; a lista vai para a issue |
| tudo (2) | envelope (`energia-gold-contrato`, `energia-retencao`) | retém a publicação inteira |
| Python, classe com "Gold" no nome | lê a gold publicada do módulo | retém as golds do módulo |
| Python, qualquer outra | código do pipeline | retém tudo |

Arquivo de teste sem classificação, build reprovado ou vitest abortado: tudo retido, como antes.
`pipeline/tests/test_energia_reter_por_gold.py` exige a classificação de todo arquivo que leia a gold.

`scripts/energia_reter_por_gold.py --aplicar` devolve cada gold retida à versão publicada: a gold, os arquivos que
ela publica (`arquivos.json`), as séries da operação, a entrada em `meta.golds`, e recalcula o manifesto
(bytes, sha256 e id da publicação). A faixa "Atualização retida" das páginas lê `meta.regressoes`.

No workflow, a rodada 0 (`scripts/energia_testar.sh`) continua igual; reprovando, a retenção por gold recompõe a
publicação e a rodada 1 roda os mesmos testes sobre ela. Só então há commit. Rodada 1 reprovada: tudo retido, como
antes. O artefato `energia-retida` guarda a gold candidata e os relatórios das duas rodadas.

## Simulação com a gold de 03/11/2026 e o código atual

Decisão do script sobre os resultados reais (vitest da simulação local sem os artefatos dela; suíte Python da execução
de 03/11): 12 golds retidas (previsões, modelos, desempenho das previsões, água em detalhe, geração, geração em
detalhe, carga, carga em detalhe, listadas, território, síntese derivada; Empresas já retida pelo pipeline) e 14
publicadas (PLD até 24/10, PLD em detalhe, CMO, reservatórios, rede, mercado, perdas, qualidade, conta de luz,
inclusão, expansão, transição, regulação, publicação). Teste de interface reprovado: `energia-i18n-html` (2 páginas).

Resultado da rodada 1 local (build, vitest completo e suíte Python sobre a publicação recomposta): ver a seção
Verificações do PR.

## Limites

- O mapa é por arquivo de teste; uma asserção sem rota nem gold no nome retém todas as golds do arquivo. Os arquivos
  `energia-conteudo-r8-*` leem muitas golds; a restrição pela rota citada no nome da asserção reduz o alcance na
  maioria dos casos.
- A causa das previsões do PLD é a CCEE responder 403 ao servidor do GitHub desde 24/10: previsões, modelos e desempenho
  ficam na edição anterior até a coleta voltar.
- A geração com 48 horas em vez de 72 e o arquivo horário com 8.736 linhas são defeitos de dado a investigar à parte.
