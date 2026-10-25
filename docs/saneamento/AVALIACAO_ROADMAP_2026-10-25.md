# Saneamento: avaliação e roadmap de melhoria e expansão

Data: 25/10/2026 · Base: `main` em `e2487b49` · Critérios: `.claude/skills/observatorio-layout/SKILL.md` (núcleo e anexos de arquiteturas, acesso, componentes e gráficos, navegação, tema e acessibilidade), com as skills `impeccable`, `emil-design-eng` e `design-taste-frontend` · Antecedentes: `REVISAO_2026-10-16.md`, `ARQUITETURA_2026-10-17.md`, `PLANO_CONTRATADO_2026-10-20.md` e `docs/COMITE_2026-10-25.md`

## 1. Método e limites

**Evidência coletada nesta sessão**

| Item | O que foi feito |
|---|---|
| Build | `npm run build` do `main` em `e2487b49` (1.216 páginas estáticas, saída 0) |
| Medição | 28 rotas do Saneamento com sessão real (`scripts/servidor-local.mjs`) e 5 sem sessão, a 1440 e 390 px: status, altura, HTML, posição do H1, SVG, figuras, tabelas, recolhidos, campos, fatias do molde, títulos das seções e erros de console |
| Telas | Primeira tela de todas as rotas a 390 px; quatro rotas a 1440 px; rolagem em cinco páginas (ficha de Recife, Acesso, Continuidade, Contratado, Simulador, ficha da SABESP) |
| Produção | `scrutiniums.com/saneamento/municipio` e `?ibge=2611606` (Recife) sem sessão, 25/10/2026 |
| Código e dados | `src/app/saneamento` (28 páginas), `src/components/saneamento` (17 componentes), `src/lib/saneamento`; cerca de 18,5 mil linhas; `public/saneamento` (59 MB); `meta.json`; `capitulos.ts`; `viabilidade.ts` |
| Fonte | Página de resultados do SINISA no gov.br, consultada em 25/10/2026 |
| GitHub | Execuções de `atualizar-saneamento.yml`, `atualizar-saneamento-contratos.yml` e `atualizar-saneamento-divida.yml` |

**Limites.** Área logada de produção não acessada (medição sobre o build local, mesmo commit do `main`). Leitor de tela, zoom de 200% e 768 px não verificados. O detector da skill `impeccable` não roda neste repositório (a pasta `scripts/` não foi copiada, conforme `ORIGEM.md`) e o inspetor da `design-taste-frontend` não foi executado: a leitura de design é de um só contexto, sem revisão independente. Os 16 erros de console "429 Too Many Requests" da medição a 390 px vêm do limite de taxa local diante de 28 páginas abertas em sequência; não foram atribuídos ao produto.

## 2. Veredito em uma página

**Evidência.** O Saneamento é o observatório mais rigoroso da plataforma. A revisão de 16/10 reproduziu 100% das medidas municipais do SINISA, 11.140 respostas da Gestão Municipal e a gold byte a byte; 15 capítulos, 4 ferramentas, ficha de 5.571 municípios e 1.797 prestadores; 19 arquivos de teste dedicados. Todas as 28 rotas respondem sem rolagem horizontal a 1440 e 390 px, e a entrada segue o molde único (sete fatias, 5.099 px a 1440 e 9.160 a 390, dentro do orçamento de 6.500 e 11.000).

**Inferência.** O rigor está pronto; a experiência do leigo e a operação, não. Cinco problemas pesam mais:

1. **A edição da fonte está nomeada errado.** O painel chama de "SINISA 2024" (114 ocorrências) o que é o SINISA 2025, ano de referência 2024. O gov.br chama de "SINISA 2024" a edição com ano de referência 2023. É data atribuída à fonte errada, motivo de reprovação pela skill.
2. **O painel completo responde mais devagar que o aperitivo.** Sem conta, a consulta de Recife mostra 78,93% de água e 40,28% de esgoto na primeira tela. Com conta, a ficha de Recife abre com população e "Participou do módulo", e o primeiro número da resposta aparece cerca de 1.000 px abaixo. O princípio do aperitivo pede o contrário.
3. **Páginas pesadas e longas no celular.** Oito capítulos com atlas entregam de 1,5 a 2,6 MB de HTML. Continuidade e Contratado passam de 35 mil px a 390, ou 42 e 46 telas.
4. **Bastidor de pesquisa na interface.** A tabela de leilões mostra notas de curadoria ("Linha extra (pedido: Goiás)", "DIVERGÊNCIA: ...", "(provavelmente valor do contrato)"). A Continuidade soma 81.042.764 economias atingidas num município de 111 mil moradores.
5. **Atualização agendada nunca executada.** Os três workflows do domínio têm 0 execuções; a primeira está marcada para 06/11/2026.

**Recomendação.** Quatro ondas até 31/03/2027, alinhadas ao roadmap do comitê: corrigir rótulos e provar a agenda (S1); abrir cada página pela resposta e tirar peso (S2); série histórica e ampliação das tarifas (S3); componentes que faltam e conclusão (S4). Seis decisões do dono na seção 8.

## 3. Medições por rota (com sessão)

HTML em KB do documento renderizado; telas a 390 px divididas por 844.

| Rota | Altura 1440 | Altura 390 | Telas 390 | HTML KB | SVG | Figuras | Tabelas | Modelo didático |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Entrada | 5.099 | 9.160 | 10,9 | 351 | 5 | 1 | 0 | sim, recolhido |
| 1 Acesso | 11.846 | 19.593 | 23,2 | 1.850 | 33 | 2 | 9 | não |
| 2 Desigualdades | 10.173 | 17.024 | 20,2 | 1.779 | 18 | 1 | 9 | não |
| 3 Continuidade e qualidade | 23.143 | 35.795 | 42,4 | 2.476 | 25 | 2 | 15 | não |
| 4 Esgoto | 11.493 | 18.364 | 21,8 | 1.767 | 29 | 3 | 7 | não |
| 5 Preço regulado | 5.259 | 9.409 | 11,1 | 182 | 0 | 1 | 1 | sim |
| 5.1 Simulador | 5.183 | 8.749 | 10,4 | 492 | 13 | 0 | 3 | não (o simulador é o artefato) |
| 5.2 Formação | 10.324 | 14.880 | 17,6 | 307 | 6 | 0 | 13 | não |
| 5.3 Reajustes | 8.010 | 15.454 | 18,3 | 272 | 0 | 0 | 0 | não |
| 5.4 Contrapartidas | 4.361 | 6.927 | 8,2 | 184 | 0 | 0 | 3 | não |
| 5.5 Riscos | 3.322 | 5.359 | 6,3 | 159 | 0 | 0 | 2 | não |
| 6 Tarifa social | 12.333 | 21.991 | 26,1 | 2.636 | 14 | 0 | 7 | não |
| 7 Prestadores | 6.790 | 11.416 | 13,5 | 734 | 3 | 0 | 4 | não |
| Ficha da SABESP | 6.321 | 12.420 | 14,7 | 460 | 0 | 0 | 3 | não |
| 8 Comparar prestadores | 3.509 | 6.121 | 7,3 | 152 | 0 | 1 | 0 | não |
| 7.1 Dívida | 8.961 | 13.051 | 15,5 | 549 | 2 | 3 | 2 | sim |
| 9 Investimento | 7.649 | 11.677 | 13,8 | 1.576 | 11 | 0 | 4 | não |
| 10 Financiamento | 6.759 | 11.146 | 13,2 | 244 | 10 | 2 | 3 | não |
| 11 Planejamento | 10.452 | 16.077 | 19,0 | 1.651 | 18 | 2 | 5 | sim |
| 12 Responsáveis | 6.184 | 10.623 | 12,6 | 214 | 0 | 0 | 2 | não |
| 13 Saúde e ambiente | 11.176 | 17.631 | 20,9 | 1.667 | 12 | 3 | 6 | não |
| 14 Resiliência | 6.940 | 11.116 | 13,2 | 410 | 7 | 1 | 4 | não |
| 15 Contratado | 23.541 | 38.739 | 45,9 | 516 | 21 | 0 | 10 | sim |
| Brasil no mundo | 9.436 | 15.109 | 17,9 | 382 | 13 | 1 | 8 | não |
| Meu município (busca) | 2.181 | 4.624 | 5,5 | 162 | 0 | 0 | 0 | não |
| Ficha de Recife | 7.887 | 13.314 | 15,8 | 269 | 0 | 1 | 4 | não |
| Comparar municípios | 3.392 | 5.232 | 6,2 | 146 | 0 | 0 | 1 | não |
| Método e fontes | 15.327 | 21.272 | 25,2 | 350 | 0 | 0 | 9 | não |

Sem sessão: `/saneamento` e o simulador levam ao login com destino preservado; `/saneamento/municipio` abre a busca; a ficha `/saneamento/municipio/2611606` volta para `/saneamento/municipio?ibge=2611606`, como manda `src/lib/rotasPublicas.ts`; o método é aberto. A contagem de SVG conta só `main svg`; os gráficos de posição da ficha municipal são desenhados sem SVG.

## 4. O que já está no padrão

1. **Rigor reproduzível.** Conferência integral contra o SINISA e o Censo, gold reconstruída byte a byte, blocos "permite observar / não permite concluir" em todo capítulo analítico, universos que não se somam ditos na tela (revisão de 16/10/2026).
2. **Molde e navegação da plataforma.** Entrada com as sete fatias na ordem, navegação única da coleção com "Meu município" em segundo lugar, faixa de frescor, "Nesta página" nos capítulos longos.
3. **Ficha municipal com posição visual.** Gráfico de pontos com município, UF, Brasil e mediana dos pares, tabela equivalente com o N efetivo de cada linha e nota de universo (ficha de Recife, 25/10/2026). O achado 6 de 17/10 foi resolvido na ficha municipal.
4. **Atlas municipal completo.** Medida, proporção ou pessoas, território, busca, zoom, classes fixas declaradas, contagem de sem dado e "não se aplica", tabela dos 5.571 municípios e CSV.
5. **Capítulo 15 sem paralelo.** Leilões desde 2020 com grau de conferência por linha, metas transcritas de contratos com sha256, e totais que só somam o que foi conferido.

## 5. Avaliação pela rubrica da skill (seção 10)

Notas de 1 a 10 do avaliador, sem revisão independente. "nv" é não verificado.

| Critério | Entrada | Cap. 1 Acesso | Ficha de Recife | Cap. 15 Contratado |
|---|---:|---:|---:|---:|
| Direção de arte | 8 | 8 | 8 | 7 |
| Hierarquia | 7 | 6 | 5 | 7 |
| Tipografia e acabamento | 8 | 8 | 8 | 6 |
| Densidade e profundidade | 8 | 7 | 8 | 5 |
| Didática visual | 7 | 7 | 8 | 5 |
| Comparabilidade | 8 | 9 | 9 | 8 |
| Interação e acessibilidade | nv | nv | nv | nv |
| Responsividade | 8 | 6 | 7 | 5 |

Nenhuma página chega a 9 em todos os critérios. O que mais derruba: primeira tela sem a resposta (hierarquia), peso e comprimento no celular (responsividade e densidade) e texto de bastidor nas tabelas (tipografia e didática).

## 6. Achados

E é evidência, I é inferência, R é recomendação. Gravidade: P1 corrige já; P2 na onda seguinte; P3 planejado.

| Nº | Gravidade | Achado | Evidência | Recomendação |
|---|---|---|---|---|
| S1 | P1 | Edição da fonte nomeada errado | E: 114 ocorrências de "SINISA 2024" em `src/app`, `src/components` e `src/lib/saneamento`, contra 48 de "SINISA 2025"; `meta.json` registra edição "SINISA 2025", ano de referência 2024; a página de resultados do gov.br descreve "SINISA 2024, com ano de referência 2023" (consulta de 25/10/2026). Exemplos: escala da entrada ("Ministério das Cidades, SINISA 2024"), ficha municipal (`municipio/[id]/page.tsx:134`) | R: um rótulo único lido de `meta.json` ("SINISA 2025, referência 2024") em todo texto; teste que reprova "SINISA 2024" como nome de edição enquanto a gold for a de 2025 |
| S2 | P1 | Notas de curadoria expostas ao leitor | E: tabela de leilões do capítulo 15 com "Linha extra (pedido: Goiás)", "Linha extra, exemplo de PPP/concessão municipal relevante em 2026", "DIVERGÊNCIA: ...", "(provavelmente valor do contrato)" e graus "(S)" e "(V)" dentro das células | R: na célula, só o fato e o grau em palavras ("conferido na fonte oficial", "só em fonte secundária"); divergências e notas num detalhe por linha; "linha extra" e "pedido" saem do texto público (seção 12 da skill) |
| S3 | P1 | Ficha e capítulos sem a resposta na primeira tela | E: ficha de Recife a 1440 px: primeira tela com moradores, população estimada e "Participou do módulo"; 78,93% e 40,28% só depois do "Nesta página" de 8 botões. Sem conta, a consulta aberta mostra os dois números na primeira tela (produção, 25/10/2026). Capítulo 1: H1 a 294 px e nenhum número antes da dobra | R: abertura da ficha e de cada capítulo com `NumeroEscala` (dois a quatro números do caso, com fonte e período) antes do "Nesta página"; o painel completo nunca responde depois do aperitivo |
| S4 | P1 | Atualização agendada nunca executada | E: `atualizar-saneamento.yml`, `atualizar-saneamento-contratos.yml` e `atualizar-saneamento-divida.yml` com 0 execuções no GitHub em 25/10/2026; primeiras agendas em 06/11, 15/11 e 22/11/2026. A banca de 19/10 já pedia comprovar o tempo do SISAGUA e o acesso às fontes | R: uma execução manual de cada um antes de 06/11 (Run workflow, entradas padrão; o workflow não tem modo sem publicação e publica só o grupo aprovado pelos testes, como faria a agenda), com tempo e resultado por grupo registrados em `OPERACOES.md` |
| S5 | P2 | HTML de 1,5 a 2,6 MB nos capítulos com atlas | E: Acesso 1.850 KB, Desigualdades 1.779, Continuidade 2.476, Esgoto 1.767, Tarifa social 2.636, Investimento 1.576, Planejamento 1.651, Saúde 1.667. I: a malha de 5.571 municípios e os valores vão no HTML de cada capítulo, e o celular paga de novo a cada um | R: malha e valores do atlas como arquivo estático com cache, baixado uma vez para todos os capítulos; resumo, tabela de UFs e texto continuam no servidor. Meta: até 600 KB de HTML por capítulo |
| S6 | P2 | Páginas longas demais no celular | E: Contratado 38.739 px (46 telas), Continuidade 35.795 (42), Tarifa social 21.991 (26), Acesso 19.593 (23). O orçamento de comprimento da skill só vale para entradas | R: dividir a Continuidade em "Regularidade" e "Qualidade da água" (a navegação já usa esse nome); no Contratado, tabela de leilões compacta com detalhe por linha; propor ao dono orçamento de 15.000 px a 390 para panorama |
| S7 | P2 | Medida que o leigo não consegue ler | E: Continuidade lista "Economias atingidas (soma por evento)" de 81.042.764 em São Lourenço da Mata (PE, 111.034 moradores) e motivos crus da fonte ("Consultar dado por prestador de serviço", "Outro (especificar)") | R: medida legível ao lado da soma (economias atingidas por evento, ou horas sem água por economia), com a soma no detalhe; motivos da fonte com rótulo em português comum e o código original entre parênteses |
| S8 | P2 | Título promete custo, escala não traz custo | E: H1 da entrada "Quem ainda está sem água e esgoto, e quanto custa?"; os três números são acesso, esgoto e tratamento | R: quarto número com a conta de 10 m³ na amostra verificada (faixa ou mediana das 12 tabelas, rotulada amostra de 8 prestadores), ou título sem "quanto custa". Decisão D-S1 |
| S9 | P2 | Ficha do prestador sem logo e sem posição | E: `public/saneamento/logos/` tem 19 logos oficiais com manifesto por CNPJ (inclusive o da SABESP, `43776517000180`), usados no capítulo 7.1, mas a ficha `/saneamento/prestadores/[id]` não os usa; a ficha da SABESP é só tabela (0 SVG) | R: logo pelo contrato da skill (CNPJ, placa no tom do arquivo); gráfico de pontos como o da ficha municipal (prestador, mediana dos prestadores de mesma abrangência, Brasil) para perdas, atendimento, receita e despesa por m³ |
| S10 | P3 | Artefato didático só em 5 de 28 rotas | E: "Modelo didático" na entrada (recolhido), Preço regulado, Dívida, Planejamento e Contratado; nenhum em Acesso, Esgoto, Continuidade, Tarifa social, Saúde | R: um laboratório por eixo, com o rótulo "Modelo didático" e "O que este modelo deixa de fora": "Do manancial à torneira" (perdas e continuidade), "Do vaso à estação" (coleta e tratamento), "Quem paga a tarifa social" (subsídio cruzado) |
| S11 | P3 | Frase do bloco de ressalva | E: "Não permite concluir. Água: Somar com o Censo, ... nem concluir que ..." na ficha e na consulta aberta | R: "Não permite: somar com o Censo ...; nem concluir que ..." |
| S12 | P3 | Saneamento básico pela metade | E: a Lei 11.445/2007 define quatro componentes; o SINISA publica módulos de águas pluviais e de resíduos sólidos (página de resultados, 25/10/2026); o modelo didático da entrada declara que drenagem e resíduos ficam fora; o SINISA de drenagem e resíduos aparece em Meio ambiente e clima (painel principal declarado) | R: decidir se o observatório cobre os quatro componentes (D-S2) |

## 7. Roadmap

As ondas acompanham as fases do comitê de 25/10/2026. Cada item tem critério de aceite.

### Onda S1. Rótulos certos e agenda provada (26/10 a 08/11/2026)

| Item | Critério de aceite |
|---|---|
| S1: edição do SINISA por um rótulo único lido de `meta.json` | Zero "SINISA 2024" como nome de edição; teste novo; capturas da entrada e da ficha |
| S2: notas de curadoria fora das células do capítulo 15 | Nenhuma ocorrência de "linha extra", "pedido" ou "provavelmente" no HTML público; graus em palavras; detalhe por linha preservado |
| S4: execução manual dos três workflows, com o mesmo comportamento da agenda | Tempo e resultado por grupo em `OPERACOES.md`; SISAGUA dentro do tempo do job, ou ajuste registrado |
| S11: frase do bloco de ressalva | Texto novo na ficha e na consulta aberta |
| D-S1 decidida e aplicada | Entrada com número de custo ou título ajustado |

### Onda S2. Resposta primeiro, peso menor (09/11 a 06/12/2026)

| Item | Critério de aceite |
|---|---|
| S3: abertura com números na ficha municipal, na ficha do prestador e nos 15 capítulos | Primeiro número acima de 900 px a 1440 e da segunda tela a 390, em todas as rotas; teste de molde estendido aos capítulos |
| S5: atlas com malha e valores em arquivo com cache | HTML de cada capítulo até 600 KB; mesma interação, mesma tabela e mesmo CSV; arquivo do atlas fechado (com conta), sem cair no login para quem tem sessão |
| S6: Continuidade em duas páginas e Contratado compacto | Nenhuma página do Saneamento acima de 25.000 px a 390 nesta onda; orçamento definitivo pela D-S6 |
| S7: medidas legíveis e rótulos de motivo | Revisão de todas as tabelas com soma de eventos; glossário atualizado |
| S9: ficha do prestador com logo e gráfico de posição | 19 prestadores com logo; posição frente aos pares em quatro medidas |
| Acessibilidade das 28 rotas | axe sem violação, teclado, zoom de 200% e leitor de tela em ficha, atlas e simulador, registrados em `docs/observatorios/AVALIACAO_PAGINAS.md` |

### Onda S3. Série histórica e preço (07/12/2026 a 31/01/2027)

| Item | Critério de aceite |
|---|---|
| X1. SINISA 2024 (referência 2023) integrado: variação de 2023 para 2024 por município, UF e prestador. E: `SINISA_Resultados_Ref2023.zip` publicado no gov.br (25/10/2026) | Série de dois anos nos capítulos 1, 3, 4, 8 e 9, com quebras declaradas; vigia do link |
| X2. SINISA 2026 (referência 2025), no dia em que for publicado. I: a edição anterior saiu em 18/12/2025, então a próxima é provável em dezembro de 2026 | Gold nova pela agenda mensal; três anos de série; frescor atualizado |
| X3. Ampliar as tabelas tarifárias pelos maiores prestadores ainda fora (I: Águas do Rio e CEDAE, EMBASA, CAGECE, COPASA completa com as tarifas sociais, CASAN completa) | Cobertura declarada em população atendida; meta de 60% da população atendida pelos prestadores com tabela verificada (hoje 1.754 municípios) |
| X4. Fichas municipais indexáveis na versão aperitivo (item 3.1 do comitê) | Endereço próprio por município no sitemap; nada além do aperitivo |
| S10. Três laboratórios didáticos | "Modelo didático" com "O que deixa de fora" em Continuidade, Esgoto e Tarifa social |
| D-S4: conta de 10 m³ na consulta aberta onde há tabela verificada | Se aprovada: número com fonte, data do ato e aviso de amostra |

### Onda S4. Lacunas declaradas e conclusão (01/02 a 31/03/2027)

| Item | Critério de aceite |
|---|---|
| X5. Obras e financiamento federal (Transferegov, BNDES, FGTS e CAIXA) nos capítulos 9 e 10 | Operações conciliadas sem dupla contagem; "Fonte identificada, não integrada" sai da matriz |
| X6. Aferição das metas contratuais do capítulo 15, quando os reguladores publicarem (a ANA suspendeu o sistema de monitoramento em 2026) | Metas de 2025 e 2026 comparadas com o SINISA, por contrato, com ausência declarada |
| X7. Fiscalizações e sanções dos reguladores (capítulo 12) | Pelo menos as dez maiores agências, com data e ato |
| X8. Mananciais e eventos extremos (ANA, Cemaden) ligados à Resiliência; desastres já integrados em `/territorio/desastres` | Capítulo 14 com exposição e impacto separados |
| X9. Drenagem e resíduos sólidos, se D-S2 aprovar | Eixo F com os módulos do SINISA; a cópia em Meio ambiente e clima passa a apontar para cá |
| Revisão humana independente (item 4.2 do comitê) | Amostra de 30 números e 10 páginas revista por pessoa externa; achados em `/sobre/erros` |
| Critério de conclusão da banca de 19/10 | Hoje 2 capítulos publicados e 13 parciais: meta de 8 publicados, com a pendência dos demais escrita |

## 8. Decisões do dono

| Nº | Decisão | Recomendação |
|---|---|---|
| D-S1 | Título da entrada promete custo | Manter o título e acrescentar a conta de 10 m³ como quarto número, rotulada amostra |
| D-S2 | Cobrir os quatro componentes do saneamento básico | Sim, como eixo F na Onda S4, depois da série histórica; até lá, o modelo didático continua dizendo que ficam fora |
| D-S3 | Série longa com o SNIS de 2010 a 2022 | Não na 1.0: o SINISA mudou conceitos e universos; começar pela série SINISA de 2023 em diante e estudar o SNIS depois |
| D-S4 | Conta de 10 m³ na consulta aberta | Sim, só onde há tabela verificada e com aviso de amostra; o simulador continua com conta |
| D-S5 | Ordem da ampliação das tarifas | Pela população atendida: Águas do Rio e CEDAE, EMBASA, CAGECE, depois COPASA e CASAN completas |
| D-S6 | Orçamento de comprimento para panorama | 15.000 px a 390 e 9.000 a 1440, com recolhimento, nunca apagando análise |

## 9. Indicadores de acompanhamento

| Indicador | 25/10/2026 | Meta em 06/12/2026 | Meta em 31/03/2027 |
|---|---|---|---|
| Ocorrências de "SINISA 2024" como edição | 114 | 0 | 0 |
| Execuções comprovadas dos workflows do domínio | 0 de 3 | 3 de 3 | agenda mensal verde por 3 meses |
| Rotas com número antes da dobra a 1440 | entrada e consultas | 28 de 28 | 28 de 28 |
| Maior HTML de capítulo | 2.636 KB | até 600 KB | até 600 KB |
| Maior página a 390 px | 38.739 px | até 25.000 | dentro do orçamento da D-S6 |
| Anos de SINISA na série | 1 (2024) | 1 | 3 (2023 a 2025) |
| Municípios com tabela tarifária verificada | 1.754 | 1.754 | 60% da população atendida |
| Capítulos publicados | 2 de 15 | 2 | 8 |
