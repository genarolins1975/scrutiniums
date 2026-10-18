# Publicação diária da gold do Crédito por grupo

O workflow mantém o sentinela `scripts/sanidade_gold.py` antes dos gates.
O sentinela continua recuperando regressões para stub/arquivo ausente; qualquer
restauração retém **todo o grupo**, não só o arquivo restaurado.

## Inventário e dependências

`config/gold-grupos.json` atribui cada arquivo a exatamente um grupo. As quatro
famílias de entidades (`inst/*.json`, `cmp/*.json`, `pano/*.json`, `prod/*.json`)
pertencem ao mesmo grupo do seu índice. Não há curinga para arquivos da raiz.
Um padrão sem correspondência, dono duplicado, dependência desconhecida ou arquivo
novo sem dono interrompe a execução antes de qualquer publicação. O teste
`ManifestoReal` verifica a publicação versionada; o orquestrador verifica também
a gold gerada em cada execução. Mudanças no inventário exigem revisão do manifesto.

| Grupo consumidor | Dependências obrigatórias | Evidência |
|---|---|---|
| `alerts` | `regimes-series` | pipeline/gold.py: alert_list recebe as quebras de regimes[series] |
| `bndes` | `penetracao` | pipeline/bndes.py: build lê penetracao e penetracao_mun |
| `central-alertas` | `alerts`, `panorama`, `openfinance`, `leading`, `operacional` | pipeline/central_alertas.py: EXTRATORES e build leem as cinco famílias |
| `cobranca` | `panorama`, `emprego-setores-ufs` | pipeline/cobranca.py: build lê panorama.json e usa ufs.json como reserva |
| `consignado` | `juros` | pipeline/consignado.py: _instituicoes lê juros.json |
| `consorcios` | `emprego-setores-ufs` | pipeline/consorcios.py: common.populacao_uf; pipeline/common.py: reserva de população lê ufs.json quando geo_uf está incompleta |
| `desenrola` | `panorama` | pipeline/desenrola.py: build lê panorama.json para a carteira por UF |
| `instituicoes` | `openfinance` | pipeline/gold.py: inst_pages.build e inst_pages_all.build recebem inst e of |
| `method` | `pulse`, `ibcc`, `instituicoes`, `emprego-setores-ufs` | pipeline/gold.py: build_model_cards, dicionario_indicadores, score_cards |
| `moradia` | `penetracao` | pipeline/gold.py: Moradia roda depois da Penetração para usar a mesma exclusão de data-base ESTBAN subcoletada; src/tests/moradia-data.test.ts lê a malha do grupo penetracao |
| `openfinance` | `instituicoes` | pipeline/gold.py: build_openfinance_real(con, inst); pipeline/indicators.py: relacao_credito usa carteira_brl de inst_gold |
| `overview` | `ibcc`, `emprego-setores-ufs`, `pulse`, `rj`, `central-alertas`, `regimes`, `recordes`, `guidance` | pipeline/gold.py: build_diagnosis, ibcc_posicao e projecoes_resumo; pipeline/overview.py: build_novidades |
| `pgfn` | `panorama` | pipeline/pgfn.py: build lê panorama.json para a carteira por UF |
| `report` | `overview`, `pulse`, `emprego-setores-ufs`, `instituicoes`, `rj`, `alerts`, `scenario`, `quality` | pipeline/gold.py: report_mod.build recebe os oito objetos |
| `rural` | `penetracao` | pipeline/rural.py: build lê penetracao e penetracao_mun |
| `scenario` | `pulse` | pipeline/gold.py: scenario.base_forecast_inad_total e base_forecasts reutilizam forecasts já publicados em pulse.previsoes |
| `sfn` | `regimes` | pipeline/sfn.py: _regimes lê regimes.json |

`emprego.json`, `sectors.json` e `ufs.json` formam o grupo indivisível
`emprego-setores-ufs`. A prova é `src/tests/emprego-data.test.ts`: o mês do emprego
é o `emprego_ref` do setor; o mês estadual é `ufs.datas.emprego`, e os valores e
posições estaduais reconciliam com o emprego. `pipeline/gold.py` passa `r_emp`
para `build_sector_stress` antes de escrever `sectors.json`.

### Consolidação de UFs e fontes retidas

`pipeline/ufs.py::build` lê **16 arquivos**, não só emprego. Tornar todos eles
dependências rígidas impediria o aceite em que consignado é retido e emprego,
setores e UFs avançam juntos. O manifesto distingue os insumos de recomposição
das dependências obrigatórias: panorama/explorer, penetração/municipal, presença,
Pix, moradia, consignado, rural, BNDES, PGFN, emprego, consórcios, cobrança, prazo e
subnacional. Se qualquer insumo for retido e o grupo do emprego puder avançar,
`ufs.json` é reconstruído pelo **mesmo builder existente**, usando os arquivos
selecionados (novos ou anteriores). Não se altera fórmula, contrato, zero ou lacuna.
Consumidores derivados como overview, metodologia e relatório permanecem retidos quando uma dependência obrigatória reprova; os demais grupos independentes avançam. A árvore composta inteira passa novamente pelas três suítes antes de ser instalada.

Esse processo é monotônico: uma reprovação nova na composição só pode aumentar
retenções; nunca libera um grupo reprovado na candidata. Repete até estabilizar
(no máximo o número de grupos + 1 rodadas). Tudo verde usa os bytes exatos da
candidata testada, como a cópia integral anterior. A geração do envelope por grupo
acontece **antes** dos testes; esse metadado aditivo também integra a candidata.

Instituições e Open Finance têm dependência recíproca: a relação exploratória OF × crédito incorpora a carteira das instituições, e as fichas institucionais incorporam OF. O fecho de aprovação trata esse ciclo como publicação conjunta; não exige um grafo acíclico.

## Quem protege cada grupo

`scripts/mapear-testes-gold.mjs` usa a AST do TypeScript já instalado para extrair
literais, templates, imports estáticos/dinâmicos e linhas, sem tratar comentários como dados.
`scripts/mapa_testes_gold.py` resolve nomes de gold, famílias enumeradas, listas
de nomes usadas por leitores e imports dos módulos leitores, incluindo wrappers relativos transitivos (com proteção contra ciclos). Python usa AST de
imports dos builders e referências diretas à publicação. Os casos dinâmicos ou
que exigem distinguir verificação de acesso de conteúdo têm prova em
`config/gold-testes-excecoes.json`; exceção para teste inexistente é erro.

A unidade de proteção é o **arquivo de teste**: reprovar uma asserção retém todos
os grupos lidos por esse arquivo. A análise é conservadora para módulos leitores
importados: pode proteger também arquivos de outros ramos do mesmo módulo.
Enumerações de catálogo/linhagem protegem o inventário todo. Teste ausente ou
pulado não aprova um grupo que deveria proteger. Não são adicionados skips nem
alterados testes existentes. Grupos sem teste específico têm, no mínimo, o
contrato de cobertura e JSON íntegro de cada membro; isso não substitui adicionar
novos testes de domínio quando houver novos contratos.

Testes de navegador, i18n e componentes continuam na suíte completa e no relatório.
Reprovações sem leitura de gold não retêm dados, mas deixam a execução vermelha.
Uma falha de infraestrutura, mesmo em teste sem gold, impede publicar qualquer
grupo: não há evidência de execução completa. Os testes Python de outros
observatórios continuam completos e visíveis, sem decidir a publicação do Crédito.

Reprodução local do mapa (não publica nada):

```bash
node scripts/mapear-testes-gold.mjs /tmp/gold-inventario.json
python3 - <<'PYMAPA'
import json
from pathlib import Path
from scripts.mapa_testes_gold import gerar
from scripts.publicar_gold import ler_json, MANIFESTO
mapa = gerar(Path.cwd(), Path('public/obs/data/gold'), ler_json(MANIFESTO), ler_json('/tmp/gold-inventario.json'))
Path('/tmp/gold-mapa.json').write_text(json.dumps(mapa, ensure_ascii=False, indent=2))
PYMAPA
```

Na base deste PR, as 73 menções diretas em arquivos TS correspondem a 67 leitores de conteúdo e seis testes de URL/cache/acesso. Há mais dois leitores indiretos (`dados-publicos.test.ts` e `boletim.test.ts`, este por `import()`): 69 protetores TS, mais sete arquivos Python. Esses números são inventário da revisão, não limites fixos do algoritmo.

O mapa efetivo de cada run, com linhas e exceções, é `mapa-testes.json` no artefato
`gold-publicacao`. Resultado de teste não inventariado falha fechado. Cada suíte
produz JSON por arquivo e teste, inclusive skips, além do log integral.

## Infraestrutura e instalação

Falha em `npm ci`, instalação/lançamento do Chromium, ENOBUFS, falta de memória,
processo interrompido, timeout ou relatório ausente/incompleto são inconclusivos.
A suíte/comando repete **uma** vez. Cada tentativa remove seu JSON anterior antes
de executar. Falha de conteúdo não repete para tentar ficar verde. As três suítes
independentes são executadas mesmo quando uma falha. Falha no preparo impede
executá-las, o que é explicitamente registrado como infraestrutura.

O subprocesso tem teto de 20 minutos e encerra seu grupo de processos no timeout.
Se a repetição também for inconclusiva, nenhum byte da publicação muda. Os testes
usam temporariamente o caminho público que já leem, com cópia da base em diretório
temporário; `finally` restaura a base em qualquer erro. A troca definitiva usa uma
árvore completa preparada e validada, com rollback em erro de instalação. Nenhum
commit acontece enquanto as suítes executam. A atualização remota segue o commit
atômico do Git: grupos aprovados entram juntos, grupos retidos ficam iguais à base.

## Datas e auditoria de `gerado_em`

Cada `meta.grupos[id]` guarda `gerado_em`, padrões de arquivos, vintages e uma
referência por hash a `meta.snapshots`. Cada snapshot contém apenas os conceitos
numéricos compartilhados de inadimplência/carteira e contagens de IF, serializados
uma única vez por versão. Logs e cadastros de fontes não são replicados por grupo. O snapshot retido vem da publicação
anterior; na primeira execução, a publicação integral antiga usa seu carimbo
global como base comprovada. Não se infere uma data ausente. O `gerado_em` global
é o **mais antigo** dos grupos selecionados (ou nulo se faltar alguma data).
Em publicação parcial, os demais campos globais conservam a base anterior;
os painéis recebem as datas/vintages do próprio grupo. Os campos numéricos compartilhados do snapshot (conceitos de carteira/inadimplência, contagens de IF) conservam a base anterior em todos os grupos quando o lote é parcial: não podem carregar por dentro valores de uma fonte retida. Assim, nem conceitos numéricos e
contagens do meta são atualizados por dentro de um painel retido.

| Uso | Tratamento |
|---|---|
| `public/obs/app.js`: `pageHead`, `pageVintage`, fontes, mapa, citações, exportação XLSX/JSON, cabeçalhos e metadados institucionais | `metaDaPagina` seleciona os grupos dos arquivos em `VIEW_DATA`; usa o carimbo mais antigo quando a página combina grupos, com vintages/snapshot correspondente. Visão geral inclui os blocos de `OV_BLOCO_DATA`; Pulso, Alertas e Perguntas rápidas incluem seus arquivos do núcleo, além dos extras da página. |
| SPA: rodapés de IBCC e NPL na visão geral | Selecionam explicitamente o grupo de `ibcc.json` e `npl.json`. |
| SPA: datas lidas do próprio payload (leading, overview.novidades, penetração, central, bets, fraudes, juros, BNDES, SFN, rural, produtos, comparador etc.) | Mantidas: grupo retido preserva o payload e sua data; UFs recompostas mantêm datas-base por bloco. |
| SPA: `updatedAt` global no rodapé | Rotulado **publicação mais antiga**, usando o mínimo global. Campos globais de marca/disclaimer não indicam frescor. |
| `src/lib/observatorioHead.ts`: Dataset JSON-LD `dateModified` | Resolve o grupo do arquivo `meta.gold`, inclusive padrões de entidades; legado sem grupos usa o carimbo global conservador. |
| `src/lib/dadosPublicos.ts`: `resumoDiario().geradoEm` | Prefere o carimbo do próprio `overview.json`; global somente como fallback. |
| `src/lib/dadosPublicos.ts`: `geradoEmPublicado()` e consumidores de frescor | Indicador transversal conservador: mínimo global. `/dados`, `/dados/[slug]`, `/dados/ibcc`, `/dados/api`, `/resumo` e a vitrine do Crédito usam `SeloFrescor`, agora rotulado como **publicação mais antiga entre grupos**, sem afirmar que nenhuma atualização parcial ocorreu. |
| `src/lib/atualizacaoObservatorios.ts`: seletor do Crédito | Explicita **processamento mais antigo entre os grupos** quando há envelope por grupo; vintages globais ficam conservadores. |
| `src/lib/frescor.ts` | Calcula idade do carimbo recebido; não lê nem substitui datas de gold. |
| `src/lib/boletim.ts`, `src/lib/feedResumo.ts` | Boletim usa vintages globais conservadores; data editorial do envio não é geração de dado. RSS e `assinaturaResumo.ts` mantêm a edição global conservadora (contrato testado em `resumo-canal.test.ts`), sem criar nova edição a cada atualização parcial. O aviso de atraso deixa explícito que alguns grupos podem ter avançado. |
| Testes que leem `gerado_em` | Preservados; a composição inteira é retestada. Teste novo da SPA usa metadados sintéticos para grupos novos, retidos, mistos e data ausente. |
| Outros observatórios em `src/` | Leem outras pastas (`energia`, `eficiencia`, `judiciario`, `agro` etc.), sem relação com esta meta do Crédito; não alterados. |

## Visibilidade e limites da verificação local

O workflow publica grupos aprovados mesmo se houver retenções, abre/comenta a
issue existente depois da tentativa de commit/push, com grupos retidos, motivos/testes e geração anterior, e grupos
publicados com sua geração. Se o push falhar, os aprovados aparecem como publicação remota não confirmada. Depois do commit, qualquer retenção deixa o job
vermelho; falhas sem gold também deixam vermelho e são identificadas separadamente.
O artefato preserva todos os JSONs/logs, inclusive primeiras tentativas inconclusivas
e os resultados das composições retestadas. O retry de push aceita avanços de código no ramo, mas compara a árvore Git da gold remota com a base testada: se a publicação mudou durante o ciclo, aborta antes de fazer rebase/push e exige nova execução, para não trocar por dentro uma fonte retida de UFs. O diagnóstico antigo continua disponível sem atribuir
falha de infraestrutura a Python.

A execução agendada precisa confirmar coleta real do dia, restauração do silver,
regressões do sentinela, abertura/comentário de issue, upload de artefato e push
concorrente com main. Este PR não dispara coleta remota, não publica gold sintética
e não faz merge. Falhas de dado encontradas nas conferências devem constar no PR,
com teste e arquivo, sem alteração do teste para passar.
