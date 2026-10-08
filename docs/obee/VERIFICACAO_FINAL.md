# Verificação final: data, gate de HTML no CI e passagem pelo painel

Rodada de 08/10/2026 sobre o PR genarolins1975/scrutiniums#117, executada no ambiente de nuvem do Claude Code. Segue a rodada 2 ([RODADA_2_CORRECOES.md](./RODADA_2_CORRECOES.md)).

**Estado de encerramento: correções e verificação local concluídas; validação remota pendente de acesso; gate obrigatório de HTML reprovado por problema independente, no domínio Energia (21 páginas). Não está pronto para decisão de publicação.** Os motivos estão nas seções 3, 4 e 8.

## 1. Escopo e commits

* **SHA inicial**: `aa659f1a75f717843c30e152058e47315daa1dc7` (HEAD da branch `claude/new-session-h7p70p`, PR limpo e sem conflito). CI e deploy desse commit estavam verdes.
* **Commits de código desta rodada**: `77ded6400` (data legível, teste de HTML obrigatório, workflow) e `b054b0ada` (ajustes de interface do painel). O commit seguinte só acrescenta esta documentação; o SHA final e os checks dele estão na descrição do PR.
* **Verificado em checkout limpo**: `b054b0ada`, com a sequência do `ci.yml` (seção 5).
* **Fora do escopo, mantido**: novos indicadores e entes, home, seletor e rodapé, MSC para todas as capitais, mudança de arquitetura, redesign, correção das 21 páginas de Energia da seção 4. Nenhuma decisão metodológica da rodada 2 foi reaberta.

Arquivos alterados em relação ao SHA inicial (sem as capturas):

| Arquivo | Mudança |
| --- | --- |
| `.github/workflows/ci.yml` | Etapa de build antes do Vitest; `EXIGIR_BUILD_HTML=1` |
| `src/tests/html-gerado.test.ts` (novo) | Verificação do HTML gerado, obrigatória no CI |
| `src/tests/energia-reauditoria.test.ts` | O teste de HTML saiu daqui (movido, regex preservado); import reduzido |
| `src/lib/texto-datas.ts`, `src/components/TextoComDatas.tsx` (novos) | Formatador de datas ISO embutidas em texto e componente com `<time datetime>` |
| `src/tests/texto-datas.test.ts` (novo) | 7 testes do formatador |
| `src/components/evidencia/SobreEsteDado.tsx` | Limitações passam por `TextoComDatas` |
| `src/app/eficiencia-estatal/educacao-municipal-capitais/page.tsx`, `src/lib/eficiencia/formato.ts`, `src/tests/obee-educacao.test.ts` | Trilha e versão do catálogo sem data crua; links e resumos com área de toque; 1 teste novo |
| `src/components/eficiencia/graficos.tsx`, `PainelEducacao.tsx`, `FichaConteudo.tsx` | Valor exato por toque, atalho para a tabela, link isolado com área de toque |
| `scripts/obee/interacoes.mjs` | `VIEWPORT` para repetir no celular; 3 checagens novas |

## 2. A data

* **Rota e componente**: `/setor-eletrico/agua-e-clima/chuva-e-temperatura`, gaveta "Sobre este dado" (`src/components/evidencia/SobreEsteDado.tsx`), linha "Limitações".
* **Origem do texto**: `public/energia/gold/agua_detalhe.json`, `proveniencia.previsao.limitacoes[0]`, gerado em `pipeline/energia/modulos/agua_detalhe.py` (linha 3262) com `pv['emitida_em']` sem formatar.
* **Significado**: instante de inicialização do modelo de previsão (a "rodada"), em UTC, não data civil nem instante de atualização do site. A mesma página já exibe esse valor em outro ponto, como "30/09/2026 00h UTC" (`rotuloRodada`).
* **Reprodução no HEAD inicial**: build de 13:09 UTC, posterior ao último commit de código; `src/tests/energia-reauditoria.test.ts` falhava com o trecho abaixo.

| | Texto visível ao leitor |
| --- | --- |
| Antes | `PREVISÃO emitida em 2026-09-30T00:00Z (inicialização do modelo): não é observação e é substituída a cada rodada.` |
| Depois | `PREVISÃO emitida em 30/09/2026 às 00h00 UTC (inicialização do modelo): não é observação e é substituída a cada rodada.` com `<time dateTime="2026-09-30T00:00Z">` |

Regras do formatador (`src/lib/texto-datas.ts`):

* Instante com `Z` fica em UTC. Converter para Brasília deslocaria a data (29/09, 21h) e contradiria a linha "Rodada de 30/09/2026 00h UTC" da própria página.
* Instante sem fuso segue a convenção do domínio Energia (Brasília), como em `dataHora`.
* Data civil (`AAAA-MM-DD`) não ganha horário nem fuso.
* Identificadores (`_`, `@`, `/`, `:`, `.` coladas) e datas inválidas (mês 13, hora 25) não são tocados; testado.
* O valor original fica no atributo `datetime`, na gold e nos CSVs. Nada foi removido, escondido nem afrouxado no teste.

Efeito colateral verificado: o mesmo formatador na gaveta resolveu também `/setor-eletrico/pld/diferencas-regionais` ("publicado até 2026-09-28T23:00"), que estava no mesmo defeito. No painel OBEE, a trilha de reprodução trazia `capturada em 2026-10-08T11:07:25Z` e o rodapé de métodos trazia `catálogo 2026-10-08.2`; passaram a "08/10/2026 às 11h07 UTC" e "catálogo de 08/10/2026, revisão 2" (o identificador continua em `<data value>` e na gold). Captura: `capturas/rodada-3/04-energia-limitacao-com-data-legivel.png`.

## 3. CI: o que passou a ser verificado

**Situação anterior (confirmada no HEAD inicial)**: `ci.yml` rodava `npx vitest run` sem `npm run build`. O teste de HTML retornava cedo quando `.next/server/app/setor-eletrico` não existia e passava sem verificar nada.

**Mudança**:

* Etapa `Build de produção` (`npm run build`) no mesmo job e no mesmo checkout, depois dos testes Python e antes do Vitest. Sem credenciais de produção; as páginas são estáticas e o build roda sem variáveis.
* Etapa `Testes` com `EXIGIR_BUILD_HTML: "1"`. Nesse modo, `src/tests/html-gerado.test.ts` reprova se faltarem o build, qualquer rota de `ROTAS_OBRIGATORIAS` (`setor-eletrico`, `agua-e-clima/chuva-e-temperatura`, `eficiencia-estatal/educacao-municipal-capitais`) ou páginas (mínimo de 100 no setor elétrico; o build tem 359).
* Sem a variável e sem build (uso local), os três testes ficam **ignorados**, com o motivo na mensagem. Não aparecem como aprovados.
* O teste agora acumula todas as violações com trecho de contexto, em vez de parar na primeira página. Os padrões de `undefined`/`NaN` e de data crua são os mesmos de antes.
* Cada execução registra `HTML verificado (setor elétrico): 359 páginas` e `HTML verificado (OBEE): 1 página`.

**Caso negativo** (diretório temporário isolado, com `vitest.config.ts` e o teste copiados; nada do repositório foi apagado):

| Situação | Resultado |
| --- | --- |
| `EXIGIR_BUILD_HTML=1`, sem `.next` | 3 reprovados: `EXIGIR_BUILD_HTML=1, mas .../.next/server/app não existe: o CI precisa gerar o build (npm run build) antes dos testes` |
| `EXIGIR_BUILD_HTML=1`, `.next` com uma página só | 3 reprovados: `rotas esperadas ausentes do build: ...`; `poucas páginas do setor elétrico no build (1); mínimo 100` |
| Sem a variável, sem `.next` | 3 ignorados, com `sem build local ... defina EXIGIR_BUILD_HTML=1` |

**Positivo, com o build correto**: a verificação executa e as duas partes que dependem só do que este PR trata passam (rotas esperadas; página do OBEE sem `undefined`, `NaN` nem data crua). A varredura do setor elétrico executa sobre 359 páginas e reprova pelo problema da seção 4.

**No runner**: run do commit `77ded6400` (https://github.com/genarolins1975/scrutiniums/actions/runs/37790289979): o build concluiu no runner, o Vitest executou 135 arquivos (2.522 testes aprovados, 1 ignorado) e reprovou na varredura do setor elétrico, com a mesma lista de 21 páginas do build local. Duração total do job: cerca de 4 minutos (antes, 2,5).

## 4. Problema independente revelado pelo gate: Energia, 21 páginas, 113 ocorrências

Com o gate efetivo, o varredor de data crua encontra, além das 2 páginas tratadas na seção 2, **21 páginas do setor elétrico** (113 ocorrências: 5 instantes, 66 dias, 51 meses `AAAA-MM`). Antes desta rodada ninguém via isso: o teste não rodava no CI.

Não corrigi, por três razões: (a) a origem está em pelo menos 10 módulos do pipeline de Energia que escrevem datas ISO em prosa (`pipeline/energia/modulos/*.py`, `metricas/*.py`, `fontes/aneel_qualidade.py`) e em alguns componentes; (b) parte das ocorrências cita de propósito dado bruto da fonte, e decidir o que fica cru é decisão editorial do domínio; (c) corrigir tudo mexeria em dezenas de painéis que esta rodada pediu para preservar. Relaxar o regex ou listar páginas como exceção esconderia o problema e foi descartado.

Classificação provisória (minha leitura do texto, não validada pelo domínio): **P** = prosa ou rótulo gerado pelo pipeline, candidata a formatação; **B** = citação de dado bruto ou identificador de documento, candidata a marcação como literal.

| Página | Ocorrências | Primeira ocorrência (contexto) | Natureza |
| --- | --- | --- | --- |
| `/setor-eletrico/territorio` | 20 | …última competência publicada: 2005-10 (distribuidora encerrada ou a… | P |
| `/setor-eletrico/empresas/financas` | 17 | …convertidos para a escala da DFP de 2025-12-31 (MIL); 03076274000152 individ… | P/B |
| `/setor-eletrico/regulacao/linha-do-tempo` | 16 | …Vermelha P2 acionada a R$ 50,00/MWh em 2017-11 (1 mês) segundo o recurso Aci… (e `Trecho: 2017-11;Vermelha P2;50,00`) | P/B |
| `/setor-eletrico/transicao/emissoes` | 15 | …fator médio mensal 2021-11 0,1474 0,1484; `Data na planilha 2021-02-29` (data inexistente, citada de propósito) | P/B |
| `/setor-eletrico/empresas/equatorial-go` | 13 | …natureza estimada): DFP 2019-12-31 individual: x1000; … | B |
| `/setor-eletrico/regulacao` | 6 | …Vermelha P1 R$ 30,00/MWh de 2015-01 a 2015-02; … | P |
| `/setor-eletrico/carga/perfil-horario` | 4 | …período: 2000-01-01 a 2026-09-29 ; última captura: 30/09/2026… | P |
| `/setor-eletrico/pld/historico` | 4 | …revista entre capturas em SE 2026-09 (256 horas, … | P |
| `/setor-eletrico/pld` | 3 | …DECOMP: busca de 2026-10-01T06:40:21Z, 0 PDFs… | P |
| `/setor-eletrico/carga` | 2 | …período: 2000-01-01 a 2026-09-28 ; última captura: 29/09/2026… | P |
| `/setor-eletrico/carga/clima-e-calendario` | 2 | …período: 2019-01-01 a 2026-09-27 ; última captura: 30/09/2026… | P |
| `/setor-eletrico/pld/previsoes` | 2 | …Arquivo de emissões de 2026-09 (JSON)… | P |
| `/setor-eletrico/dados/cvm-dfp` | 1 | …('DFP 2021-12-31 individual: x1000'). | B |
| `/setor-eletrico/dados/cvm-itr` | 1 | …('DFP 2021-12-31 individual: x1000'). | B |
| `/setor-eletrico/empresas/chesp` | 1 | …22/11/2016 31/03/2017 DSP-RET 2016-11-24… | B |
| `/setor-eletrico/empresas/neoenergia-pe` | 1 | …DFP 2019-12-31 individual: x1000 … | B |
| `/setor-eletrico/expansao` | 1 | …Reconciliação com o agregado oficial por UF (2026-06)… | P |
| `/setor-eletrico/expansao/carteira` | 1 | …Reconciliação com o agregado oficial por UF (2026-06)… | P |
| `/setor-eletrico/expansao/geracao-e-transmissao` | 1 | …último leilão do arquivo aberto (2024-09-27)… | P |
| `/setor-eletrico/qualidade` | 1 | …fim (3036-03-13) posterior à geração do arquivo (2026-08-12)… (valor inválido citado de propósito) | B |
| `/setor-eletrico/visao-geral` | 1 | …último período 2025-06, 367 dias além do prazo… | P |

Caminhos para quem decidir (não implementados): (1) formatar a prosa no ponto de exibição, estendendo `segmentosComDatas` a `AAAA-MM` e aplicando-o aos componentes de cada página; (2) marcar as citações brutas como literal (`<code>` ou atributo dedicado) e fazer o teste ignorar esses nós por regra explícita e documentada; (3) apenas depois, manter o gate obrigatório sem exceção. Enquanto isso o gate permanece reprovado: o PR não deve ser tratado como pronto.

## 5. Resultados dos testes

Sequência do `ci.yml` executada em checkout limpo de `b054b0ada` (`npm ci`, minify, lint, tipos, `compileall`, testes Python de `pipeline` e `pesquisa`, `npm run build`, Vitest com `EXIGIR_BUILD_HTML=1`):

| Verificação | Resultado |
| --- | --- |
| Lint | Sem avisos nem erros |
| Tipos (`tsc --noEmit`) | Sem erros |
| `compileall` | OK |
| Python `pipeline` | OK (6 ignorados, como no CI) |
| Python `pesquisa` | 69 aprovados |
| Build | Concluído, 415 páginas estáticas |
| Vitest, 135 arquivos, 2.524 testes | 2.522 aprovados, 1 ignorado, **1 reprovado**: varredura de data crua do setor elétrico (seção 4) |
| `test_eficiencia` (OBEE, Python) | 41 aprovados |
| `obee-educacao.test.ts` + `texto-datas.test.ts` | 57 aprovados |

Checks do PR por commit: `aa659f1a7` (SHA inicial), run 266, aprovado: https://github.com/genarolins1975/scrutiniums/actions/runs/37782648332. `77ded6400`, run 267, reprovado na seção 4: https://github.com/genarolins1975/scrutiniums/actions/runs/37790289979. `b054b0ada`, run 268: https://github.com/genarolins1975/scrutiniums/actions/runs/37792523207. O SHA final tem o check listado na descrição do PR.

## 6. Prévia da Vercel e passagem pelo painel

* **Prévia**: https://scrutiniums-git-claude-new-sess-8de85f-genarolins1975s-projects.vercel.app/eficiencia-estatal/educacao-municipal-capitais. O deploy do commit `aa659f1a7` concluiu com sucesso (status "Vercel: Deployment has completed"). Os deploys dos commits desta rodada aparecem no status do PR.
* **Acesso**: a prévia responde 302 para `vercel.com/sso-api`, isto é, exige login na conta Vercel. Não havia credencial autorizada na sessão e não tentei contornar a proteção. **A prévia não foi validada**: um deploy concluído não comprova os fluxos no ambiente remoto.
* **Evidência local**: build de produção do mesmo código (`next start`), Chromium headless via Playwright.

| Fluxo | Evidência local |
| --- | --- |
| Abrir o painel | Período, cobertura, universo e fontes carregam; sem erro de console |
| Alterar capital, ano, etapa e indicador | `interacoes.mjs`: 39 de 39 em 1280 px, 390 px (toque) e 320 px |
| Compartilhar e reabrir o link | Link reabre capital, ano, etapa e medida; parâmetros inválidos voltam ao padrão |
| Passaporte e ressalvas | Abrem por teclado; Esc fecha o passaporte e não altera a URL |
| Boa Vista 2024 | Incluída com ressalva; descrição da divergência do RREO na seção de conferência; variação 2023→2024 calculada; CSV da comparação com a nota |
| Campo Grande 2021 | Valor oficial visível; "fora da comparação" com motivo; contagens 26 no grupo, 26 com valor, 25 na comparação; variação 2021→2022 bloqueada |
| Comparar capitais | Contagens e mediana pelo conjunto elegível; excluídas listadas com motivo |
| Baixar tabela e comparação | CSV da tabela com as mesmas linhas exibidas; CSV da comparação com 26 linhas e as colunas do contrato |
| Ausência, zero real, ano par do Ideb | Rio Branco "não aplicável" sem zero; zero real preservado; edição 2023 declarada em 2024 |

Matriz de casos (`casos.mjs`): 7 casos × 1440, 768, 390 e 320 px, sem rolagem horizontal, sem erro de console e sem violação no axe-core (WCAG 2.0 a 2.2, A e AA) em 1440 e 390 px.

**Roteiro curto para a validação remota** (a fazer por quem tem acesso à Vercel, na prévia do SHA final):

1. Abrir o painel, conferir o rodapé de métodos ("Processamento obee-0.2.0, catálogo de 08/10/2026, revisão 2") e que as fontes carregam.
2. `?cap=boa-vista&ano=2024`: ressalva aberta por teclado; comparação com Boa Vista marcada com asterisco; baixar a comparação e conferir a nota da MSC.
3. `?cap=campo-grande&ano=2021`: valor oficial, "fora da comparação", contagens 26/26/25; `?cap=campo-grande&ano=2022`: variação com 2021 não calculada.
4. `?med=despesa&cap=sao-paulo`, no celular: tocar numa linha mostra o valor; "Ver todos os valores na tabela" abre a tabela com 26 linhas.
5. `?cap=rio-branco&etapa=anos_finais&med=aprovacao`: "não aplicável", sem zero; copiar o link do recorte e reabri-lo.
6. `/setor-eletrico/agua-e-clima/chuva-e-temperatura`: abrir "Sobre este dado" da previsão e conferir "30/09/2026 às 00h00 UTC".

## 7. Acabamento da interface (somente o constatado)

| Constatação | Ajuste |
| --- | --- |
| No celular, tocar numa linha do gráfico monetário não mostrava o valor (o tooltip reagia só ao mouse) | O toque fixa o valor da linha até o próximo toque; o mouse segue como antes |
| O acesso à tabela com todos os valores ficava longe do gráfico | Botão "Ver todos os valores na tabela" junto ao gráfico: abre a tabela e leva o foco ao resumo; teste de 26 linhas |
| Concentração de pontos na despesa (São Paulo R$ 23,58 bilhões contra mediana de R$ 1,01 bilhão) | Mantida a escala linear e todas as capitais; valor exato por toque e pela tabela. Sem escala logarítmica nem normalização |
| Links isolados da seção de fontes e resumos das trilhas com 17 a 20 px de altura | Área de toque de 44 px (links) e 44 px (resumos) |

Medição de alvos de toque a 390 px depois do ajuste: restam 8 links "Série completa em CSV", todos inline numa frase (exceção do WCAG 2.5.8 para links em texto). Foco visível medido (contorno de 2 px) no resumo da tabela. Capturas em `capturas/rodada-3/`: valor exato por toque (390 px), tabela aberta (390 px), atalho (320 px), data legível na gaveta de Energia, ano par do Ideb (320 px), Boa Vista 2024 (390 px), Campo Grande 2021 (390 px).

Desempenho, mesmo protocolo da rodada anterior (`desempenho.mjs`, 390 px, CPU 4× mais lenta, rede emulada), três execuções por build e as duas versões lado a lado:

| Mediana de 3 | `aa659f1a7` | `b054b0ada` |
| --- | --- | --- |
| TBT | 1.646 ms | 1.523 ms |
| LCP | 1.272 ms | 1.336 ms |
| CLS | 0,027 | 0,030 |
| HTML transferido | 142.647 B | 142.932 B |

Dispersão entre execuções do mesmo build (TBT de 1.263 a 1.719 ms em `aa659f1a7`) maior que a diferença entre as medianas; não há regressão material. O TBT acima de 1 s continua sendo limitação conhecida (tarefa T3).

## 8. Preservação dos dados e das regras

Reconstrução da gold a partir do seed (`python3 -m pipeline.eficiencia.run`) comparada com a gold do commit inicial:

| Item | Resultado |
| --- | --- |
| Observações | 6.667 nos dois; mesmas chaves |
| Valores, estados, elegibilidade, `nota_material`, notas, conferência | 0 diferenças |
| `hash_dados` | `2c1ae8573966662e…` nos dois |
| Seções fora de `meta` e `observacoes` | Idênticas |
| Diferenças | Só metadados voláteis: `meta.gerado_em` e `meta.versao_codigo`, e a coluna `dados_gerados_em` nos 8 CSVs |
| Validações reprovadas | Nenhuma |

Os arquivos regenerados foram descartados (`git checkout`); a gold commitada não mudou nesta rodada. Boa Vista 2024 (reconciliada pela MSC, com ressalva), Campo Grande 2021 (fora das comparações, com quebra de série), ausência sem zero e despesa por matrícula sem publicação permanecem como na rodada 2. Nenhuma evidência nova de erro apareceu.

## 9. Limitações conhecidas (não são verificações concluídas)

* Prévia da Vercel não validada (login exigido); roteiro na seção 6.
* Gate obrigatório de HTML reprovado por 21 páginas de Energia (seção 4); decisão e correção pertencem ao domínio Energia.
* Revisão metodológica por terceiro independente: não realizada. A conferência com a Sinopse cruza publicações do próprio INEP.
* Leitor de tela real (NVDA, VoiceOver): não testado; acessibilidade verificada por axe-core e teclado, que não comprovam conformidade integral.
* Desempenho medido em laboratório; TBT acima de 1 s sob CPU 4× mais lenta.
* MSC coletada só para os casos com diferença material (tarefa T10); inclusão do OBEE em home, seletor e rodapé permanece decisão P2.
* Os trechos de Energia fora da gaveta de proveniência continuam como estavam (seção 4).
