# Pacote C: taxas zero e recorte do Desenrola

25/10/2026. Base: `e2487b49a565d14d334cee0fd80225c1b20b4d6d`. Escopo autorizado: somente pacote C. PR sem merge; decisão D2 pendente do dono. Não se publica nem se substitui a gold de produção neste PR.

## O que muda para o leitor

| Antes | Depois | Por quê |
|---|---|---|
| O zero da fonte entrava na posição, mediana e distribuição; um teste proibia qualquer “0,00% ao ano” na página | O valor original permanece visível, com a nota decidida no pacote C. A comparação considera somente as demais instituições | Distinguir ausência de zero informado e não induzir a interpretação de que o banco oferece o menor custo |
| O CSV do Desenrola com tipo 4 era retido inteiro | Tipos 1 a 3 podem ser publicados depois da validação, com quantidade e período das linhas não incluídas em aviso visível | Manter a parte documentada, sem atribuir significado ao tipo desconhecido |
| Uma troca de captura no mesmo segundo podia fazer o builder escolher metadados de outra captura | O builder usa o hash presente no silver vigente | A ressalva precisa corresponder aos dados publicados, inclusive ao voltar a um hash antigo |

A nota de 0,00% também acompanha o leitor no simulador, destino direto da consulta: a taxa publicada continua disponível para o cálculo e não recebe comparação com a mediana. As fórmulas do simulador e as taxas da fonte não mudam. A mediana usada como referência sem banco é a mesma das instituições elegíveis da consulta.

Nenhuma regra de acesso mudou; `src/lib/rotasPublicas.ts`, `AGENTS.md`, `CLAUDE.md` e skills não foram alterados. Os demais pacotes não foram executados.

## Linha de base e captura real

O comitê foi lido na branch `claude/comite-2026-10-25`, commit `20b9dd4f43aaf3a60cbb9a0ddfad01624690d7b2`. [Documento](https://github.com/genarolins1975/scrutiniums/blob/20b9dd4f43aaf3a60cbb9a0ddfad01624690d7b2/docs/COMITE_2026-10-25.md). Também foram lidos os contratos e a auditoria do Crédito de 24/10.

A gold de juros publicada na base, processada em 22/10/2026, não contém o zero. Os dois testes iniciais (`credito-consultas` e `desenrola-data`) passaram: 53 verificações. Isso não reproduz a coleta retida.

Para reproduzir a retenção, foi recuperada a release pública `pipeline-estado`, pacote `pipeline-estado.20261024150225.tar.zst.00`, SHA-256 `51ba1459b2bf8afd5a3919413c6c00c9c7706caad8635183f74cbc0c6542487a`, conferido com o manifesto da release. Foram extraídos o banco silver e o CSV original do Desenrola. Não houve coleta nova nem alteração do banco de produção.

O download direto do CSV do BCB recebeu HTTP 403. Os downloads do artefato e dos logs do GitHub Actions também foram recusados no ambiente. A cópia durável da release foi acessível. A reprodução é da captura datada de 24/10, não uma confirmação da disponibilidade atual do BCB.

- Juros: reconstruídos por `pipeline/juros.py` a partir do silver de 24/10. BCO RNX S.A., CNPJ-base 80271455, crédito pessoal não consignado prefixado, semana de 02 a 08/10/2026, 0,00% ao ano e ao mês.
- Na captura, a modalidade tem 78 instituições. A mediana da gold, incluindo o zero, é 97,71% ao ano. A consulta passa a comparar 77 instituições, com mediana calculada de 99,97% ao ano. A gold original não é reescrita pela consulta.
- Desenrola: CSV integral coletado pela execução de 24/10/2026 às 13:23:24 UTC (metadado do bronze), SHA-256 `14b4deec1cc239fd4e293a2b12e96190d4660ea8fa83cb31872d3b91e9a414f7`, 13.638 linhas. São publicáveis 11.242 linhas dos tipos 1 a 3; 2.396 linhas do tipo 4, de 2026-05 a 2026-08, ficam separadas e preservadas.
- A gold reconstruída declara 2.681.845 operações de pessoas físicas. O número vem da captura; não foi ajustado para coincidir com uma publicação anterior. Tipo 3 continua fora do total de pessoas físicas, e tipo 4 não é somado a nenhum universo.

Com o código e teste anteriores, substituindo temporariamente apenas `juros.json` pela reconstrução, a suíte teve exatamente uma falha e 17 aprovações: a proibição global de “0,00% ao ano”. Os arquivos foram restaurados ao fim. Depois da mudança, seis arquivos de teste que leem os dados de juros/Desenrola tiveram 103 aprovações sobre as duas golds reconstruídas. Os 18 testes de integridade da coleta também passaram.

## Bloqueio adicional encontrado, fora do pacote

O mapeamento completo do portão de publicação aborta com:

```
ValueError: Leitura dinâmica de gold sem classificação: src/tests/rankings-municipais-reflow-browser.test.ts
```

Reproduzido com `node scripts/mapear-testes-gold.mjs` e `scripts.mapa_testes_gold.gerar`, sobre a gold publicada e o inventário atual. O teste, o mapeador e a configuração de exceções são idênticos aos da `main` de partida (`git diff --quiet origin/main -- ...`, saída 0). A leitura dinâmica usa `caso.gold`, e o mapeador não a classificou. Não se alterou nenhum desses arquivos.

Portanto: a falha do zero foi reproduzida e corrigida, mas **não está comprovado que a próxima execução publicará os dez grupos**. O bloqueio de mapeamento precisa de tratamento em outro escopo. Não foi executada a publicação seletiva completa nem uma nova coleta das demais fontes. O grupo judicial e as demais falhas documentadas pelo pipeline permanecem fora deste pacote.

## Garantias e testes

- Taxa zero preservada na consulta, com nota visível sem hover ou expansão. Posição e distâncias ficam ausentes; o banco não aparece na distribuição nem na tabela comparativa.
- Mediana, quartis, extremos e quantidade derivam do mesmo conjunto elegível. Casos de empate, uma instituição elegível e nenhuma elegível são cobertos. A gold recebida não é mutada.
- Ausência de banco continua sendo ausência; não recebe taxa zero. URLs preservam segmento, modalidade e banco.
- CSV validado antes da troca. Linhas desconhecidas também passam por validação de mês, UF, identificação, quantidade, volume e duplicatas. Outra falha retém tudo; mês desaparecido continua reprovando.
- Bronze integral preservado. Linhas desconhecidas armazenadas separadamente por hash e linha; resumo persistido no silver e transportado à gold. Reexecução idempotente, retorno a hash anterior e desaparecimento do tipo desconhecido cobertos.
- Os testes anteriores que rejeitavam tipo desconhecido mudaram de contrato por autorização do pacote C em 25/10/2026, com D2 e a pendência de merge citadas nos comentários. As garantias de preservação e retenção por outras falhas foram mantidas e ampliadas. Nenhum teste foi apagado, pulado ou marcado como `skip`, `todo` ou `only` nesta alteração.

## Verificações automatizadas

| Comando | Resultado |
|---|---|
| `bash scripts/preparar-sessao.sh` com Chromium do sistema | Aprovado; dependências e derivados disponíveis |
| `python3 -m unittest pipeline.tests.test_coleta_credito_integridade` | 18 testes aprovados, incluindo o CSV real com tipos 1 a 4 |
| Seis suítes de conteúdo sobre as golds reconstruídas | 103 testes aprovados; [log](logs/depois-candidata-final.txt) |
| `npm run verificar:rapido` | Aprovado em 3min09s: 253 arquivos, 6.876 testes aprovados |
| `npm run verificar:pr` | Aprovado em 20min33s: 402 arquivos Vitest, 9.609 testes aprovados; build, lint, tipos, Python e verificações OBEE aprovados |
| `npm run evidencias` | 12 cenários antes e 18 depois, a 390, 768 e 1440 px, com e sem sessão; sem violações axe, erro de console ou overflow nesses cenários |
| `node verificar-jornadas.mjs …` | **Reprovado** somente no critério de rolagem do Desenrola a 320 px: documento de 323 px. As quatro jornadas funcionais e o formulário sem JavaScript chegaram ao fim |
| Mapeamento completo do portão seletivo | **Reprovado** na leitura dinâmica de `rankings-municipais-reflow-browser.test.ts`, preexistente e fora do escopo |

O Vitest reportou 12 `skipped` e 1 `todo` já existentes; a suíte Python principal reportou 2.450 testes e 10 `skipped` existentes. Nenhum foi introduzido aqui. O Judiciário executou 68 telas e 224 checks sem erros. [Log completo](logs/completo.txt), [log rápido](logs/rapido.txt). Chromium: `/usr/bin/chromium`; Node: heap de 4 GB; dependências Python em ambiente isolado.


A primeira tentativa de `verificar:pr` parou ao instalar `pyarrow` em `/home/agent/.local/lib`, somente para leitura. A dependência foi instalada em um ambiente Python isolado em `/workspace`; o comando completo foi repetido. A tentativa interrompida está preservada no log e não é contada como aprovação.

## Evidências de interface e acessibilidade

Código das capturas finais: [2e1a5e2e4](https://github.com/genarolins1975/scrutiniums/commit/2e1a5e2e489dd48105eac065236f58ae8f522329), build `UnLnWHF3bX_3IM7IY411k`. Build da linha de base: `VD-uX5OYW_29xpwKa1e0b`, no commit de partida. Os commits seguintes acrescentam somente documentação.

- [Antes, gold publicada](antes/evidencias.md): duas rotas, três larguras, com e sem sessão. A gold ainda não contém os dois casos do pacote.
- [Depois, mesma gold publicada](depois/evidencias.md): acrescenta o simulador à regressão. Sem sessão, a evidência é do redirecionamento ao login; não é abertura de rota fechada.
- [Depois, captura real reconstruída](jornadas/jornadas.json): quatro larguras (320, 390, 768 e 1440 px), com sessão local e preferência por movimento reduzido. Duas golds substituídas temporariamente e restauradas no `finally`. `meta.json` permanece o publicado; por isso a faixa antiga de coleta retida ainda pode aparecer neste cenário isolado.

| Evidência do caso real | 320 px | 390 px | 768 px | 1440 px |
|---|---|---|---|---|
| Nota do RNX | [nota](jornadas/nota-zero-320.png) | [nota](jornadas/nota-zero-390.png) | [nota](jornadas/nota-zero-768.png) | [nota](jornadas/nota-zero-1440.png) |
| Consulta inteira | [página](jornadas/juros-zero-320.jpg) | [página](jornadas/juros-zero-390.jpg) | [página](jornadas/juros-zero-768.jpg) | [página](jornadas/juros-zero-1440.jpg) |
| Simulador | [página](jornadas/simulador-zero-320.jpg) | [página](jornadas/simulador-zero-390.jpg) | [página](jornadas/simulador-zero-768.jpg) | [página](jornadas/simulador-zero-1440.jpg) |
| Ressalva do Desenrola | [nota](jornadas/nota-desenrola-320.png) | [nota](jornadas/nota-desenrola-390.png) | [nota](jornadas/nota-desenrola-768.png) | [nota](jornadas/nota-desenrola-1440.png) |
| Desenrola inteiro | [página](jornadas/desenrola-320.jpg) | [página](jornadas/desenrola-390.jpg) | [página](jornadas/desenrola-768.jpg) | [página](jornadas/desenrola-1440.jpg) |

As notas foram inspecionadas visualmente a 320 e 1440 px: texto legível, dentro do bloco, sem depender de hover ou expansão. Na apresentação do Desenrola, o formatador existente converte `2026-05 a 2026-08` em `mai/2026 a ago/2026`. A contagem e o período são os da gold.

| Verificação | Resultado e limite |
|---|---|
| Axe WCAG 2/2.1/2.2 A/AA | Sem violações nas três rotas e quatro larguras do cenário reconstruído; não substitui leitura assistiva |
| Teclado | Tab/Shift+Tab nos seletores; Enter/Espaço para abrir/fechar tabela; executados por Playwright |
| Valores comparados | 77 linhas da tabela, taxas anuais e mensais e mediana conferidos contra o conjunto elegível da gold; RNX ausente da figura/tabela |
| Navegação | Filtros, voltar/avançar, recarga e URL compartilhável preservam o recorte; passagem ao simulador com clique ou toque emulado mantém RNX e a nota |
| Sem JavaScript | Formulário GET e seleção de instituição funcionam a 390 px |
| Avisos | Visíveis fora de `details` fechados, com contagem/período e texto; não dependem de cor |
| Responsividade | Consulta sem overflow nas quatro larguras; Desenrola sem overflow a 390/768/1440, **com overflow preexistente a 320** |
| Leitura humana/assistiva | Inspeção assistida das capturas e DOM; sem revisor humano independente, NVDA ou VoiceOver |
| Zoom/texto a 200%, Escape, dispositivos físicos e exportações | Não verificados nesta jornada específica; não se criou exportação nova |

### Problema preexistente de largura

O critério adicional de rolagem continua reprovado no script, com saída 1; sua asserção não foi retirada. A execução coleta todas as larguras antes de emitir a reprovação. A gold publicada reproduz a mesma largura de 323 px em viewport de 320 px: [diagnóstico DOM](diagnostico-320-publicada.json) e [captura](desenrola-publicada-320.jpg). Há rótulos das barras em `#des-alcance` e `#des-regional` terminando em x=323; a nova ressalva permanece dentro do viewport. A faixa de navegação e a tabela têm rolagem interna própria e também aparecem no inventário de elementos, o que isoladamente não é erro. Nenhum CSS de layout foi alterado neste pacote.


A aplicação das skills foi proporcional à alteração de ressalvas: foram preservados os componentes, fontes e tokens da plataforma. As quatro `SKILL.md` exigidas pelo repositório estavam presentes. O executável `.claude/skills/impeccable/scripts/impeccable` não está presente, portanto o carregador de contexto não rodou; o contexto foi lido diretamente. Não se criou identidade visual nem composição paralela.

Acessibilidade automática e inspeção das ressalvas não constituem homologação WCAG integral nem revisão humana independente. NVDA, VoiceOver, celulares físicos e produção autenticada não foram verificados. Não foi reavaliada a excelência visual geral das páginas: direção de arte, hierarquia, tipografia, densidade, didática, comparabilidade, interação/acessibilidade e responsividade não receberam notas de homologação neste pacote funcional.

## Reprodução e decisões pendentes

1. Recuperar a release `pipeline-estado.20261024150225`, conferir o manifesto SHA-256 e extrair `data/silver/observatorio.db` em pasta isolada.
2. Executar `reproduzir-captura.py BANCO_SILVER PASTA_SAIDA`. O relógio do coletor reproduz o instante documentado no bronze (13:23:24 UTC); `gerado_em` dos builders registra o reprocessamento local. A fixture CSV integral está em `pipeline/tests/fixtures/desenrola/` com proveniência e hash.
3. Rodar os testes de conteúdo com as duas golds reconstruídas em substituição temporária; restaurar os bytes ao fim. Não publicar essa substituição de teste.
4. Para jornadas, usar `verificar-jornadas.mjs RAIZ PASTA_SAIDA EVIDENCIAS`, sobre o build local e sem outra suíte em curso; o script restaura as golds no `finally`.

D2 continua pendente: aprovação pelo dono do tratamento proposto e decisão de merge. As consultas ao BCB sobre o zero e o tipo 4 estão preparadas em `OPERACOES.md`, sem envio, protocolo ou resposta inventados. Nenhuma mudança foi enviada à produção.
