# Módulo Regulação (P044 a P046)

Documento de método do módulo `regulacao` (rota `/setor-eletrico/regulacao`, família de silver `regulacao`, ordem 10). Estado em 30/09/2026, fim da fase de dados: coleta, silver, gold, métricas, tipos TypeScript e testes prontos; a página ainda não foi escrita (fase de interface). O módulo também fecha, junto com o módulo PLD, o achado histórico A04 (limites regulatórios do PLD): o arquivo `pipeline/energia/regulatorio/limites_pld.json` é consumido pelo módulo PLD pela função `limites_pld()`.

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Curadoria dos atos (dono: este módulo) | `pipeline/energia/regulatorio/` (`limites_pld.json`, `limites_pld_conferencia.json`, `linha_do_tempo.json`, `documentos.json`, `__init__.py` com `limites_pld()`, `limites_em()`, `vigentes_por_ano()`, `linha_do_tempo()`) |
| Coleta, silver e gold | `pipeline/energia/modulos/regulacao.py` |
| Leitores das fontes | `pipeline/energia/fontes/aneel_regulacao.py` |
| Métricas (8 medidas) | `pipeline/energia/metricas/regulacao.py` |
| Testes Python (39, sem rede) | `pipeline/tests/test_energia_regulacao.py`, amostras reais em `pipeline/tests/dados/energia_regulacao/` (82 KB) |
| Teste TypeScript (5) | `src/tests/energia-regulacao.test.ts` |
| Gold | `public/energia/gold/regulacao.json` (cerca de 283 KB) |
| Downloads | `public/energia/series/regulacao_*.csv` (8 arquivos) |
| Tipos | `src/lib/energia/tipos-regulacao.ts` (inclui `situacaoConsulta`, a mesma regra do pipeline, para a página recalcular a situação na data do build) |

Execução: `python3 pipeline/energia/executar_modulo.py regulacao` (coleta e gold) ou `--sem-coleta` (só gold, a partir do silver). A primeira coleta levou 397 s em 30/09/2026, quase todo o tempo em downloads do Internet Archive (dois falharam por conexão encerrada e entraram na execução seguinte); a leitura do CSV de 19 MB das atas é em fluxo (25 MB de memória residente) e a gold sai em 3,5 s com 77 MB de pico. O texto dos PDFs é extraído com `pdftotext` (poppler) a cada construção; sem a ferramenta, as conferências de texto ficam registradas como não executadas e a agenda fica indisponível (pedido ao integrador na seção 6).

Retomada após o reinício de 30/09/2026 (22h30 UTC): a curadoria dos atos (limites 2021 a 2026, conferência, linha do tempo com 11 atos e o registro de documentos) já estava pronta e foi reconferida integralmente contra os PDFs; nada foi refeito. Foram acrescentados dois atos à linha do tempo (REN nº 1.114/2025 e nº 1.137/2025), o módulo de coleta e gold, as consultas e a agenda.

## 1. Painéis e estado

| Painel | Dados entregues | Estado |
| --- | --- | --- |
| P044 Limites e regras de preço | Oito atos que fixaram piso, teto horário e teto estrutural do PLD de 2021 a 2026 (campos separados), com publicação no DOU separada da vigência, dispositivo, trecho literal, página do PDF, sha256 e as conferências (trecho no PDF, data no extrato, deliberação na ata da Diretoria, valor na ata, piso igual ao maior entre TEO e TEO de Itaipu, tetos refeitos pelo IPCA); limites efetivos por trecho de vigência, campo a campo; regras de aplicação da REN nº 1.032/2022; atividades da Agenda que podem mudar os limites (AR24-05 e AR24-18, previstas para 2026); adicionais das bandeiras por resolução e vigência (2015 a 2024); versão vigente dos 11 módulos do PRODIST e de 71 submódulos do PRORET com o ato que a aprovou; evidências "Comprove este número" dos três limites vigentes | Dados concluídos com limitação declarada: 2021 e 2023 lidos em documento oficial do processo (voto e nota técnica) porque o texto do ato não é acessível; data de publicação de 2021 vazia; conteúdo dos módulos PRODIST/PRORET não lido (servidor bloqueado). Página pendente |
| P045 Linha do tempo | 23 eventos: 13 atos (a Portaria MME nº 301/2019, do PLD horário, citada por documento da ANEEL; os demais lidos no texto: REN nº 1.032/2022, avaliação dos limites de 2023, REN nº 1.000/2021, Lei nº 14.203/2021 e REN nº 953/2021 da Tarifa Social, Lei nº 14.300/2022, MP nº 1.300/2025, Lei nº 15.235/2025, REN nº 1.147/2025, Lei nº 15.269/2025, REN nº 1.114/2025 das perdas, REN nº 1.137/2025 do DISE) com dispositivo, publicação, vigência (calculada pela LC nº 95/1998 quando a lei fixa vacância), resumo editorial, efeito declarado literal e painéis afetados; 10 mudanças de adicionais de bandeira vindas do conjunto de dados | Dados concluídos com limitação declarada: `impacto_estimado` é sempre vazio (a especificação separa efeito declarado de impacto estimado e este módulo não estima); eventos de bandeira sem leitura do ato; seleção editorial, não repositório completo. Página pendente |
| P046 Consultas e agenda | 542 consultas e audiências públicas desde set/2017 reconstituídas das atas da Diretoria (43 na janela da gold, 8 recebendo contribuições em 30/09/2026), com número, tema, processo, relator, fases, período lido da decisão, resultado e ato, e situação derivada da data de hoje; cobertura anual frente ao total publicado pela ANEEL; 59 atividades da Agenda Regulatória 2026-2027 com ano previsto, painéis relacionados e consultas que citam o código | Dados concluídos com limitação declarada: só entram consultas deliberadas em reunião pública (cobertura de 71% a 92% por ano entre 2020 e 2025); a revisão da Agenda de 08/09/2026 não pôde ser lida; a lista oficial de consultas (antigo.aneel.gov.br) está bloqueada. Página pendente |

Nenhum painel está declarado como entrega integral: a interface ainda não existe, e parte dos documentos primários só é acessível por cópia pública (seção 5).

## 2. Fontes verificadas (consulta em 30/09/2026)

| Fonte | Recurso usado | URL | Licença | Período e grão | Publicação pela fonte |
| --- | --- | --- | --- | --- | --- |
| ANEEL, atos (REH, REN, despachos, portarias, votos e notas técnicas) | 22 PDFs listados em `regulatorio/documentos.json`, obtidos da cópia pública do Internet Archive no modo `id_` (bytes originais capturados na origem) e aceitos só se o sha256 for o registrado; bronze em `data/energia/bronze/aneel/regulacao_documentos/` | https://www2.aneel.gov.br/cedoc/ (origem, bloqueada) | ato oficial, domínio público (Lei nº 9.610/1998, art. 8º, IV) | por ato | data do DOU impressa no próprio ato ("publicado no D.O. de ...") |
| Senado Federal, Legislação Federal | página da publicação original de 5 leis, da MP nº 1.300/2025 e da LC nº 95/1998 (texto compilado), e metadados abertos (`/dadosabertos/legislacao/<id>`) | https://legis.senado.leg.br/norma/... | domínio público | por lei | metadados do Senado |
| ANEEL, Pautas e Atas das Reuniões Públicas da Diretoria | `pautas-atas-reunioes-publicas-diretoria.csv` (18.974.886 bytes, 16.190 linhas, sha256 `693a03a1...`), dicionário `dm-pautas-e-atas-das-reunioes-publicas-da-diretoria.pdf` (versão 1.0 de 01/02/2023); 2.212 linhas relevantes vão para o silver como registros | https://dadosabertos.aneel.gov.br/dataset/pautas-e-atas-das-reunioes-publicas-da-diretoria | ODbL | set/2017 a 22/09/2026; item de pauta (reunião × ordem × processo) | 25/09/2026 03:04 (declarada semanal; o dicionário diz mensal) |
| ANEEL, Audiências e Consultas Públicas | `audiencias-consultas-publicas-aneel.csv` (contagens anuais) e dicionário | https://dadosabertos.aneel.gov.br/dataset/audiencias-e-consultas-publicas | ODbL | 2013 a 2026, anual; arquivo gerado em 22/07/2026 | 22/07/2026 (declarada trimestral) |
| ANEEL, Bandeiras Tarifárias | `Bandeira Tarifária - Adicional` (27 linhas, 10 resoluções) e dicionário | https://dadosabertos.aneel.gov.br/dataset/bandeiras-tarifarias | ODbL | mar/2015 a abr/2024, por vigência | 15/07/2026 |
| ANEEL, páginas gov.br | Agenda Regulatória, PRODIST, PRORET e Consultas Públicas (HTML guardado no bronze; itens e revisão da agenda como registros no silver) | https://www.gov.br/aneel/pt-br/assuntos/governanca-regulatoria/agenda-regulatoria e `.../procedimentos-regulatorios/prodist`, `.../proret` | conteúdo gov.br | situação no dia da captura | a página informa "Atualizado em" (PRODIST: 21/05/2026) |
| IBGE, IPCA número-índice (SIDRA 1737, variável 2266) | resposta JSON da API, 561 meses | https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2266/p/all | dados públicos do IBGE | dez/1979 a ago/2026, mensal | IBGE |

Verificado e não usado: `reunioes-publicas-diretoria` (só contagem de reuniões); InfoPLD da CCEE (S20), domínio bloqueado e não é fonte de ato.

## 3. Método

**Limites do PLD (P044).** Cada ato está em `limites_pld.json` com o esquema combinado com o módulo PLD: `ano, ato, data_publicacao, vigencia_inicio, vigencia_fim, pld_min, pld_max_horario, pld_max_estrutural, unidade, dispositivo, url, trecho, altera_ou_revoga`. A validação (`regulatorio.validar_limites`) é estrita: chave a mais ou a menos é erro, cada valor tem de aparecer, escrito como no ato ("1.611,04"), dentro do trecho literal, a vigência fica dentro do ano, a publicação não passa do fim da vigência, e em cada ano vale piso < teto estrutural < teto horário. A vigência é campo a campo: num dia, cada limite vale pelo ato em vigor que informa aquele campo e tem a publicação mais recente (em 2022 o despacho que atualizou os tetos saiu três dias antes da resolução que o autorizou; a resolução registra só o piso). O menor PLD observado nunca substitui o piso: sem ato, o campo fica vazio.

A cada construção da gold, o módulo:
1. extrai o texto do PDF guardado no bronze (pdftotext, com e sem leiaute) e confere cada passagem do trecho, com espaços e quebras de linha normalizados e sem espaço antes de pontuação;
2. confere a data do DOU na linha que a ANEEL imprime no extrato ("publicado no D.O. de 23.12.2025");
3. localiza nas atas da Diretoria a deliberação da resolução homologatória (tipo, número e ano) e procura cada valor escrito na decisão;
4. confere o piso como o maior entre TEO e TEO de Itaipu fixados no mesmo ato (REN nº 1.032/2022, art. 24);
5. refaz cada teto a partir do teto do ano anterior: esperado = teto(ano−1) × IPCA(nov/ano−1) ÷ IPCA(nov/ano−2). Tolerância de R$ 0,011/MWh: o valor anterior publicado tem até R$ 0,005 de arredondamento, multiplicado pelo fator anual (no máximo 1,11 no período), mais R$ 0,005 do arredondamento do valor atual. A mesma conta mostra por que 2023 foi retificado: o valor original (R$ 1.391,56/MWh) é o teto a preços de novembro de 2021 da REH nº 2.994/2021 atualizado; o retificado (R$ 1.404,77/MWh) parte do Despacho nº 4.046/2021.

Conferência reprovada de trecho, piso ou IPCA vira stub com motivo (a sentinela mantém a última gold válida). Conferência não executada (sem pdftotext) fica registrada como tal.

**Bandeiras e procedimentos.** Adicional por patamar com a vigência da fonte; o fim de cada valor é a véspera do valor seguinte do mesmo patamar; o último fica sem fim (a fonte não informa término). PRODIST e PRORET: versão e ato lidos do nome do arquivo que a página oficial publica como "versão vigente" (`aren20251137_Prodist_modulo_8_v14.pdf` = REN nº 1.137/2025, versão 14), com as notas da página (ex.: versão 5.0 do Submódulo 2.5 vigente a partir de 01/01/2027 pela REN nº 1.148/2026). Cada captura vira registro no silver, então mudança de versão fica no histórico.

**Linha do tempo (P045).** Curadoria em `linha_do_tempo.json`, validada por `regulatorio.validar_linha_do_tempo`: dispositivo, data do ato, publicação, vigência (literal do ato; calculada pela LC nº 95/1998, art. 8º, § 1º, só quando a lei fixa vacância em dias, marcada como calculada), resumo editorial conferido no texto, efeito declarado literal, `impacto_estimado` obrigatoriamente vazio, painéis afetados e nível de conferência. A gold confere de novo trecho, efeito declarado e regra de vigência no documento guardado e acrescenta a data da deliberação quando a ata a registra. Eventos de bandeira são derivados do conjunto de dados, rotulados `registro_em_conjunto_de_dados_oficial`, sem data de publicação (a fonte não informa). Coincidência entre a data de uma norma e um movimento de gráfico não é tratada como evidência de causa.

**Consultas (P046).** Das atas, entram as linhas de aviso de abertura de consulta ou audiência pública deliberadas. Identidade: (modalidade do aviso, número, ano da reunião); o número é o `NumAtoAdministrativo` da linha de abertura, conferido pelas outras linhas que citam "Consulta Pública nº N/AAAA" (das 386 linhas de resultado que citam o número e têm abertura no mesmo processo, 370 batem com o número e o ano da abertura; as 16 restantes são processos com mais de uma consulta). Mesmo número e ano em processos diferentes ficam separados e marcados (`numero_em_conflito`). Fases, reaberturas e prorrogações ligam pela citação "nº N/AAAA" ou, na falta dela, pelo número do processo; resultado liga pela citação explícita ou, para resultados sem número (revisões tarifárias), pelo processo, quando uma única consulta do processo está sem resultado. Linha de aviso nunca é resultado, mesmo quando a fonte repete "Resultado da Consulta Pública" no assunto.

Período: expressões "de D [de MÊS] [de AAAA] a|até D de MÊS [de AAAA]" e "entre ... e ...", com mês e ano herdados do fim e ano da reunião quando omitidos; janela aceita só se termina no máximo 7 dias antes da reunião, começa no máximo 60 dias antes dela (prorrogação repete o início) e dura até 400 dias, o que descarta períodos de referência citados na decisão. Decisão que só informa duração ("pelo período de 45 dias") fica sem data.

Situação na data de referência (horário de Brasília), regra única repetida em `src/lib/energia/tipos-regulacao.ts`: resultado deliberado = decidida; fase deliberada por último sem datas = prazo não datado (nunca aberta); antes do início = a abrir; entre início e fim, inclusive = aberta; depois do fim = encerrada aguardando resultado, ou resultado em pauta quando levado à reunião sem decisão. A validação da gold recusa consulta marcada como aberta fora da janela ou vencida marcada como aberta. A gold traz as consultas com janela terminada, resultado ou abertura nos últimos 200 dias; o CSV traz o histórico inteiro.

**Agenda.** O Anexo I da Portaria nº 7.030/2025 é lido do PDF com leiaute: código e ano ficam na mesma linha; a atividade ocupa uma ou mais linhas da coluna central e termina em ponto; a n-ésima atividade pertence ao n-ésimo código, e contagens diferentes levantam erro. Painéis relacionados por palavra-chave do texto da atividade (regras em `REGRAS_PAINEL`), rotulados como tal. Consultas ligadas à atividade só pela citação do código exato nas atas (hoje, P&E22-02 e a Consulta Pública nº 18/2026).

## 4. Evidências de aceite (conferidas em 30/09/2026)

| Item | Valor na gold | Fonte e caminho independente | Diferença | Tolerância |
| --- | --- | --- | --- | --- |
| Piso 2026 | R$ 57,31/MWh | Despacho nº 3.850/2025, item (ii), p. 1; TEO R$ 18,27 e TEO de Itaipu R$ 57,31 no mesmo ato | 0 | R$ 0,00 |
| Teto estrutural 2026 | R$ 785,27/MWh | mesmo despacho; IPCA: 751,73 × 7.378,94 ÷ 7.063,77 = 785,2706 | −0,0006 | R$ 0,011 |
| Teto horário 2026 | R$ 1.611,04/MWh | mesmo despacho; IPCA: 1.542,23 × 7.378,94 ÷ 7.063,77 = 1.611,0409 | −0,0009 | R$ 0,011 |
| Limites 2024 | R$ 61,07 / 716,80 / 1.470,57 | REH nº 3.304/2023, art. 2º, e decisão da ata de 19/12/2023 (4/2023 RPE), que escreve os três valores | 0 | a centavos |
| Teto horário 2024 pelo IPCA | R$ 1.470,57/MWh | 1.404,77 × 6.735,55 ÷ 6.434,20 = 1.470,5633 (maior resíduo da série) | 0,0067 | R$ 0,011 |
| Limites 2021 | R$ 49,77 / 583,88 / 1.197,87 | tabela do voto da REH nº 2.994/2021, p. 10; deliberação da REH nº 2.828 em 15/12/2020 (47/2020 RPO) na ata | 0 | a centavos |
| Tetos 2022 | R$ 646,58 / 1.326,50 | Despacho nº 4.046/2021; IPCA: 583,88 × 6.075,69 ÷ 5.486,52 = 646,5800 | 0 e −0,0033 | R$ 0,011 |
| Retificação 2023 | R$ 684,73 / 1.404,77 | Nota Técnica nº 01/2023-SGT, item 14; data 06/01/2023 no extrato da REH nº 3.167/2022; IPCA a partir do Despacho nº 4.046 | −0,0029 e −0,0032 | R$ 0,011 |
| Datas no DOU | 7 de 8 atos | linha "publicado no D.O. de" do extrato de cada ato | iguais | data |
| Consulta Pública nº 30/2026 | aberta, 03/09 a 02/10/2026 | ata de 01/09/2026 (15/2026 RPC): "no período de 3 de setembro a 2 de outubro de 2026" | igual | data |
| Consulta Pública nº 28/2025 | fim 24/09/2025 | prorrogação deliberada em 16/09/2025 e ratificada em 23/09/2025 | igual | data |
| Consulta Pública nº 21/2025 | decidida, REN nº 1.167/2026 | ata de 22/09/2026: "Resultado da Consulta Pública nº 21/2025" | igual | exata |
| Cobertura 2025 | 41 de 47 consultas | contagem anual do conjunto "Audiências e Consultas Públicas" | 6 fora das atas | declarada |
| Agenda 2026-2027 | 59 atividades (32 em 2026, 27 em 2027) | Anexo I da Portaria nº 7.030/2025 (DOU de 05/12/2025) | contagem de códigos = de atividades | exata |
| PRODIST Módulo 8 | versão 14, REN nº 1.137/2025 | página oficial do PRODIST; a REN nº 1.137/2025 (lida) altera o Anexo VIII da REN nº 956/2021 | igual | exata |

Resultado das conferências na gold: trecho no PDF 8 de 8 aprovados; data no extrato 7 aprovadas e 1 ressalva (2021, extrato inacessível); deliberação na ata 4 de 4; valor na ata 3 de 3; piso = TEO 5 aprovados e 1 ressalva (2023, TEO das demais usinas não lida); regra do IPCA 12 de 12. Testes: `python3 -m unittest pipeline.tests.test_energia_regulacao` (39 aprovados) e `npx vitest run src/tests/energia-regulacao.test.ts` (5 aprovados); o teste do módulo PLD (41) continua aprovado com o pacote.

## 5. Limitações materiais e o que não se pode concluir

1. **Origem dos atos bloqueada.** `www2.aneel.gov.br/cedoc`, `biblioteca.aneel.gov.br`, `git.aneel.gov.br` e `antigo.aneel.gov.br` responderam HTTP 403 com desafio de navegador do Cloudflare ("Just a moment...") em 30/09/2026; `www.in.gov.br` e `www.planalto.gov.br` encerraram a conexão sem resposta; `portalrelatorios.aneel.gov.br` (cronograma da agenda) respondeu com conexão reiniciada. Nada disso foi contornado. Os PDFs vêm da cópia pública do Internet Archive (bytes originais), aceita só com o sha256 registrado; os endereços oficiais continuam na gold.
2. **2021.** Texto e extrato da REH nº 2.828/2020 sem cópia pública; valores lidos no voto do processo da REH nº 2.994/2021; data de publicação vazia; a ata confirma número e deliberação (15/12/2020).
3. **2023.** Texto da REH nº 3.167/2022 e da retificação sem cópia pública (a única captura é um redirecionamento); valores do voto e da Nota Técnica nº 01/2023-SGT. Entre 01 e 05/01/2023 estava publicada a versão com erro; a gold aplica o valor retificado ao ano inteiro, como erro material corrigido.
4. **Consultas.** Só as deliberadas em reunião pública registrada (cobertura anual publicada; 2018 tem 0 de 21 porque as consultas daquele ano não aparecem como aviso de consulta nas atas). Prorrogação decidida fora da reunião não aparece; o aviso publicado pode ter datas diferentes das da decisão; 21 consultas têm a fase atual sem data (em geral a ata informa só a duração) e nunca aparecem como abertas. A situação depende das atas publicadas até a reunião de 22/09/2026 (arquivo de 25/09/2026). Tomadas de subsídios ficam de fora. A lista oficial de consultas (antigo.aneel.gov.br/consultas-publicas) está bloqueada, e o conferimento contra o aviso de cada consulta não foi possível.
5. **Agenda.** A primeira revisão (Portaria nº 7.157, de 08/09/2026) está citada na página oficial e deliberada na ata de 08/09/2026, mas o texto não é acessível (origem bloqueada, sem cópia pública); os anos previstos podem ter mudado. O eixo temático é célula mesclada no PDF e não é extraído. Ano previsto é previsão reprogramável, não data de decisão.
6. **PRODIST e PRORET.** Os PDFs dos módulos estão em git.aneel.gov.br (bloqueado): publica-se a versão vigente e o ato segundo a página oficial, não o conteúdo nem a data de início de vigência de cada versão.
7. **Bandeiras.** O recurso da ANEEL vai até a REH nº 3.306/2024 (vigência 01/04/2024), gerado em 15/07/2026; resolução posterior só aparece quando a ANEEL atualizar o recurso. Publicação das resoluções não informada.
8. **O que não se pode concluir.** A linha do tempo não estima efeito de norma: uma data de norma perto de um movimento em gráfico não é evidência de causa. Os limites são nominais: comparar anos exige deflator. A contagem de consultas abertas não mede a atividade regulatória total.

## 6. Pedidos ao integrador

1. **pdftotext no workflow** (`.github/workflows/atualizar-energia.yml`, arquivo compartilhado): acrescentar `sudo apt-get install -y poppler-utils` antes de "Executar pipeline de energia". Sem ele, as conferências de texto ficam "não executadas" e a agenda fica indisponível na gold (a gold continua publicada, com ressalva). Alternativa: `pypdf` em `pipeline/energia/requirements.txt`, com adaptação de `fontes/aneel_regulacao.texto_pdf`.
2. **Navegação** (`src/lib/energia/navegacao.ts`): entrada "Regulação" apontando para `/setor-eletrico/regulacao` na fase de interface.
3. **Matriz de painéis** (`docs/observatorios/energia/status_paineis.json` e `MATRIZ_PAINEIS.md`): P044, P045 e P046 passam a "dados concluídos com limitação declarada, página pendente".
4. **Achado A04**: registrar como fechado em conjunto com o módulo PLD, com esta evidência: limites 2021 a 2026 integrados por ato e vigência (`limites_pld()`), piso, teto horário e teto estrutural em campos separados, conferidos no ato e reconciliados pelo IPCA.
5. **Silver da família `regulacao`**: `data/energia/silver/regulacao.db` entra no pacote `energia-silver-familias.tar.gz` sem mudança (o workflow já inclui todo `*.db` de família).
