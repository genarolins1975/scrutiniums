# Módulo PLD: conceito, formação, CMO, limites, histórico e diferenças regionais

Módulo `pld` (ordem 12, família de silver `ons_cmo`). Código: `pipeline/energia/modulos/pld_detalhe.py`, leitores em `pipeline/energia/fontes/ons_pld.py`, `fontes/ibge_pld.py` e `fontes/normas_pld.py`, métricas em `pipeline/energia/metricas/pld.py`, testes em `pipeline/tests/test_energia_pld.py` (amostras reais em `pipeline/tests/dados/energia_pld/`), tipos em `src/lib/energia/tipos-pld.ts`. Gold: `public/energia/gold/pld_detalhe.json` (cerca de 394 KB). Downloads: `public/energia/series/pld_cmo_horario.csv`, `pld_cmo_semanal.csv`, `pld_limites_diario.csv`, `pld_mensal.csv`, `pld_sazonal.csv`, `pld_separacao_diaria.csv`, `pld_amplitude_diaria.csv`.

A gold complementa, sem substituir, as golds de operação `pld.json` (PLD realizado, `pipeline/energia/gold/pld.py`) e `cmo.json` (CMO semanal, `gold/cmo.py`), que continuam com o mesmo dono. Estado registrado em 30/09/2026, com referência no dia 30/09/2026 (última hora do PLD: 30/09/2026 23h).

Execução: `python3 pipeline/energia/executar_modulo.py pld` (coleta e gold) ou `--sem-coleta` (só gold, cerca de 20 s e 260 MB de memória residente). Testes: `python3 -m unittest pipeline.tests.test_energia_pld` (41 testes, sem rede).

## 1. Painéis e estado

Esta etapa entregou a camada de dados (coleta, silver, gold, métricas, tipos, testes). A página `/setor-eletrico/pld` ainda não lê `pld_detalhe.json`: nenhum painel está concluído na interface.

| Painel | Dados na gold | Estado honesto |
| --- | --- | --- |
| P008 Entenda o preço | `conceito`: passagens literais do Decreto nº 5.163/2004 (arts. 57 e 58) e da REN ANEEL nº 957/2021 (arts. 2º, XIII; 5º, § 4º; 76; 78; 82), cada uma conferida no documento baixado; descrições oficiais da CCEE (captura versionada) e do ONS; exemplo de liquidação rotulado `EXEMPLO_SINTETICO`; bloqueios documentados | Dados concluídos com limitação declarada (regras algébricas da CCEE inacessíveis); interface pendente |
| P009 CMO e formação de preço | `cmo_pld`: três produtos separados (DECOMP semanal, DESSEM semi-horário, PLD horário), alinhamento por hora e por semana operativa, relação por ano e situação frente aos limites, semana de referência; `horario_recente` (168 h alinhadas) | Dados concluídos com limitação declarada (deck, versão e configuração não identificados por valor nas fontes); interface pendente |
| P010 Limites, piso e tetos | `limites`: atos anuais (via módulo Regulação), regimes, permanência por submercado e ano, empates no piso, calendário de 366 dias, conferência do menor e do maior valor observado contra os atos | Dados concluídos; interface pendente |
| P011 Histórico e distribuição | `historico`: médias mensais temporal e ponderada pela carga (com `mesmas_horas`), moeda constante pelo IPCA, percentis sazonais (mesmo mês e mesma semana ISO, com n), distribuição por regime, perfil hora × mês, meses parciais sinalizados | Dados concluídos com limitação declarada (carga do subsistema do ONS como peso); interface pendente |
| P012 Diferenças regionais | `regional`: amplitude horária, separação por par, matriz 12 meses, perfil horário da separação, sentido do fluxo verificado na mesma hora, sem diagnóstico causal | Dados concluídos com limitação declarada (limites de intercâmbio não integrados); interface pendente |

Achados do Anexo C:

| Achado | Estado | Evidência na gold |
| --- | --- | --- |
| A01 CMO do Norte versus PLD | Corrigido | `achados.A01`: toda comparação é entre o mesmo intervalo (mesma hora ou mesma semana operativa de sábado a sexta), em diferença absoluta; nenhuma razão ou multiplicador é calculado (teste `test_semana_alinhada_contra_awk` proíbe o vocabulário). Na semana de 19 a 25/09/2026, Norte: DECOMP R$ 1.866,74/MWh, DESSEM R$ 86,54/MWh, PLD R$ 124,09/MWh; o texto declara que são produtos diferentes e que a diferença não é explicada por estes dados |
| A02 CMO semanal zero | Confirmado no arquivo original | 61 semanas operativas (datas do ONS de 30/12/2022 a 23/02/2024, período de 24/12/2022 a 23/02/2024) com zero nos quatro subsistemas, na média e nos três patamares, em CSV e Parquet oficiais (célula a célula iguais). Vizinhança conferida: 0,01 em 23/12/2022 e 0,06 em 01/03/2024. O dicionário em PDF (versão 1.1, 02/05/2023) declara que os campos admitem valor zerado e negativo. No mesmo período, o CMO do DESSEM foi zero em 91,2% das meias horas do Sudeste/Centro-Oeste e o PLD ficou no piso em 98,5% das horas. Nenhuma causa é atribuída |
| A03 Unidade do CMO | Documentado, sem correção silenciosa | Dicionário (JSON e PDF): média semanal "R$/MW", patamares e semi-horário "R$/MWh". Em 4.540 semanas-subsistema a média semanal fica entre o menor e o maior patamar; a exibição em R$/MWh é inferência declarada ao lado da divergência. A limitação do `cmo.json` passou a sair dessa mesma conferência |
| A04 Limites regulatórios | Integrado | 8 atos (2021 a 2026) lidos por `pipeline.energia.regulatorio.limites_pld()`; vigência campo a campo; 0 horas abaixo do piso ou acima do teto horário; 2.099 dias com limites iguais aos de `regulatorio.limites_em` (outro código). O menor valor observado aparece só como conferência |
| A09 Publicação histórica | Distinção mantida; hipótese documentada | `publicado_pela_fonte_em` nulo; o `last_modified` do recurso de 2026 ficou em 09/06/2026 com três conteúdos diferentes entre capturas; 3 dias com captura direta, folga mínima de 24,27 h sob LAT1D; backtest segue como reconstrução por hipótese |

## 2. Fontes verificadas (consulta em 30/09/2026)

| Órgão | Conjunto e recurso | URL | Licença | Período e grão | Observações |
| --- | --- | --- | --- | --- | --- |
| ONS | CMO Semi-Horário (DESSEM), `CMO_SEMIHORARIO_<ano>.csv` (2020 a 2026) | https://dados.ons.org.br/dataset/cmo-semi-horario; arquivos em https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/cmo_tm/ | Creative Commons Atribuição (cc-by), `package_show` | 01/01/2020 00h00 a 01/10/2026 23h30; meia hora; colunas `id_subsistema;nom_subsistema;din_instante;val_cmo` | Descrição oficial: CMO do DESSEM por barra; o do subsistema é a média das barras ponderada pelas cargas. Parquet e XLSX equivalentes existem; o CSV é o formato lido. O `last_modified` do arquivo de 2026 no portal era 2026-09-30T22:01:09 e o arquivo já trazia 01/10/2026. Aviso de "consistência recorrente". 43 dias sem nenhuma meia hora publicada (2020: 1; 2021: 2; 2022: 16; 2023: 14; 2024: 4; 2025: 1; 2026: 5, entre eles 05/09/2026) |
| ONS | Dicionários `DicionarioDados_Cmo_Semi_Horario.json/.pdf` | https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/cmo_tm/DicionarioDados_Cmo_Semi_Horario.pdf | cc-by | versão 1.2, 02/05/2023 | `val_cmo`: "Valor do CMO em R$/MWh"; não admite nulo; admite zero e negativo |
| ONS | CMO Semanal (DECOMP), `CMO_SEMANAL_<ano>.csv` e `.parquet` (2005 a 2026) | https://dados.ons.org.br/dataset/cmo-semanal; https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/cmo_se/ | cc-by | 07/01/2005 a 02/10/2026; semana operativa, por patamar e média | Relido do original por leitor próprio para A02; a data publicada é a sexta que encerra a semana (conferido por correlação: 0,994 contra 0,912 da semana seguinte no SE, 300 semanas). Zero escrito "0E-8" em 2022 e "0.0" em 2023 e 2024 |
| ONS | Dicionários `DicionarioDados_Cmo_Semanal.json/.pdf` | https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/cmo_se/DicionarioDados_Cmo_Semanal.pdf | cc-by | versão 1.1, 02/05/2023 | `val_cmomediasemanal`: "CMO Médio Semanal, em R$/MW"; patamares em R$/MWh (A03) |
| CCEE | PLD_HORARIO, `pld_horario_<ano>` | https://dadosabertos.ccee.org.br/dataset/pld_horario | CC-BY-4.0 (portal da CCEE) | 01/01/2021 a 30/09/2026; hora; submercado | Lido do silver principal (só leitura): captura versionada de 27/09/2026 e capturas diretas do pipeline de operação em 29 e 30/09/2026. Deste ambiente a CCEE responde HTTP 403 "Acesso bloqueado" (conferido às 22h59 UTC de 30/09/2026 no `package_show` e no painel de preços); não contornado |
| ONS | Balanço de Energia nos Subsistemas (carga horária) | https://dados.ons.org.br/dataset/balanco-energia-subsistema | cc-by | 01/01/2021 a 28/09/2026; hora | Silver principal; peso da média ponderada; 2.620 observações revisadas entre capturas |
| ONS | Intercâmbios entre Subsistemas (fluxo horário) | https://dados.ons.org.br/dataset/intercambio-nacional | cc-by | 01/01/2021 a 28/09/2026; hora | Silver principal; mesmo dado de `rede.json` |
| IBGE | IPCA, número-índice (tabela 1737, variável 2266) | https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2266/p/all?formato=json | Uso livre com citação da fonte (termos do IBGE não relidos: desafio de navegador) | até 08/2026 (índice 7.633,23) | Deflator opcional |
| ANEEL | Atos anuais de limites do PLD (8 atos, 2021 a 2026) | via `pipeline/energia/regulatorio/limites_pld.json` (módulo Regulação) | atos públicos | 2021 a 2026 | Trecho literal de cada ato conferido pelo módulo Regulação; este módulo reconcilia a vigência diária com `limites_em` |
| Presidência da República (texto da Câmara dos Deputados) | Decreto nº 5.163/2004, norma atualizada | https://www2.camara.leg.br/legin/fed/decret/2004/decreto-5163-30-julho-2004-533148-normaatualizada-pe.html | texto oficial de domínio público (Lei nº 9.610/1998, art. 8º, IV) | vigente | sha256 0557d7f5...; caput e § 6º do art. 57 com redação do Decreto nº 9.143/2017. O Planalto não respondeu (resposta vazia); a API do Senado lista a norma (id 407687) mas devolveu PDF vazio |
| ANEEL | REN nº 957/2021 (Convenção de Comercialização), texto compilado | oficial: https://www2.aneel.gov.br/cedoc/ren2021957.pdf; lida da cópia https://web.archive.org/web/20250601132442id_/https://www2.aneel.gov.br/cedoc/ren2021957.pdf | texto oficial de domínio público | cópia de 01/06/2025 (PDF gerado em 11/03/2025) | O endereço oficial respondeu HTTP 403 com desafio de navegador (Cloudflare). sha256 472d18da...; alterações posteriores à cópia não estão cobertas |

## 3. Método

Convenções: horário de Brasília (UTC−3, sem horário de verão no período); PLD em R$/MWh nominais; hora h = intervalo [h:00, h+1:00). Ausência é `null` na gold e vazio nos CSV; zero publicado é zero.

* **CMO do DESSEM na hora**: o instante do ONS marca o início da meia hora (conferido contra o PLD: erro absoluto médio de R$ 28,86/MWh com a convenção de início contra R$ 31,45/MWh com a de fim, SE, 23.009 horas entre os limites). CMO_h = (CMO_{h:00} + CMO_{h:30}) ÷ 2, média por duração; hora com meia hora ausente fica sem valor.
* **Semana operativa**: sábado a sexta. DECOMP como publicado; DESSEM = Σ 336 meias horas ÷ 336; PLD = Σ 168 horas ÷ 168; semana incompleta sem média. Gold com as últimas 156 semanas; CSV com as 300 desde 2021, relido depois de escrito e conferido célula a célula (1.872 células, 0 divergências).
* **Relação por ano**: PLD − CMO_DESSEM na mesma hora, separado por situação do PLD (piso, teto horário, dia com média no teto estrutural, entre os limites). Mesmo com o PLD entre os limites, a mediana de |PLD − CMO| ficou entre R$ 1,47/MWh (2022, Norte) e R$ 46,18/MWh (2023, SE): o CMO do ONS não é a base de cálculo da CCEE sem mais.
* **Limites**: vigência campo a campo (em cada dia, cada limite vem do ato vigente mais recente que informa aquele campo; empate com valores diferentes vira conflito declarado). Hora no piso: |PLD − mínimo| ≤ R$ 0,01/MWh; no teto horário: |PLD − máximo horário| ≤ R$ 0,01/MWh; dia no teto estrutural: |média das 24 horas − máximo estrutural| ≤ R$ 0,01/MWh. Justificativa: PLD e limites são publicados em centavos; a média de 24 valores arredondados erra no máximo meio centavo. A contagem com R$ 0,005/MWh é publicada como sensibilidade. Empates: nº de submercados no piso na mesma hora.
* **Mensal**: temporal = Σ PLD_h ÷ n; ponderada = Σ PLD_h × carga_h ÷ Σ carga_h com a carga verificada do subsistema na mesma hora (MWmed numa hora = MWh); `mesmas_horas` indica se as duas usam as mesmas horas; real = temporal × IPCA(base) ÷ IPCA(mês), base = último mês do IPCA (08/2026); mês parcial marcado.
* **Sazonal**: médias diárias dos dias completos de anos anteriores ao de referência, mesmo mês e mesma semana ISO; quantis tipo 7; percentil por rank médio (empates contam meio); n e anos publicados.
* **Regional**: só horas com os quatro submercados; separação quando |PLD_A − PLD_B| > R$ 0,01/MWh (diferenças de exatamente um centavo contadas à parte); amplitude = maior − menor na hora; matriz 12 meses; sentido do fluxo na fronteira (orientação canônica do ONS, nulo até 1 MWmed). Descritivo: limites de intercâmbio não integrados.
* **P008**: cada passagem normativa fica escrita em `fontes/normas_pld.py` e só é publicada se aparecer, com espaços normalizados, no texto extraído do documento da vintage vigente (HTML da Câmara; PDF pelo `pdftotext`). A publicação original do decreto não confere o caput e o § 6º do art. 57 (teste), o que prova que a conferência distingue versões. Exemplo de liquidação: quantidades hipotéticas (consumidor com 100 MWh contratados e 120 MWh consumidos; gerador com 100 MWh vendidos e 120 MWh gerados), PLD real da hora de maior preço do SE no dia de referência; diferença = geração + compras − consumo − vendas; valor = diferença × PLD; simplificações listadas na gold.
* **Evidências**: 23 fichas pelo construtor compartilhado `pipeline/energia/evidencia.py` (PLD e DESSEM da semana de referência por submercado, piso do ano por submercado, ponderada do último mês completo por submercado, separação 12 meses por par, sequência A02), cada uma com teste executado e reconciliação por outro caminho quando há um.

## 4. Evidências de aceite (conferidas contra a fonte em 30/09/2026)

Valores da fonte recalculados por outro código (awk sobre o arquivo original ou SQL direto no silver), sem as funções do módulo.

| Entidade e período | Gold | Fonte (outro caminho) | Diferença | Tolerância |
| --- | --- | --- | --- | --- |
| PLD médio, semana 19 a 25/09/2026, Norte | 124,09 | 124,093393 (awk em `pld_horario_2026`) | 0 após arredondamento | R$ 0,005/MWh |
| PLD médio, mesma semana, Sul / SE / NE | 120,86 / 124,09 / 124,09 | 120,863571 / 124,091131 / 124,088571 | 0 | R$ 0,005/MWh |
| DESSEM médio, mesma semana, SE / S / NE / N | 63,31 / 58,29 / 59,67 / 86,54 | 63,313363 / 58,294494 / 59,671012 / 86,541399 (awk, 336 meias horas) | 0 | R$ 0,005/MWh |
| DECOMP, semana de 25/09/2026, N / SE | 1.866,74 / 97,89 | 1866.74 / 97.89 (linha do CSV original) | 0 | exato |
| Horas no piso, 2023, SE | 8.611 de 8.760 | 8.611 (awk, PLD = 69,04) | 0 | exato |
| Horas no teto horário, 2026, cada submercado | 4 | 4 até 27/09 (awk, PLD = 1.611,04) | 0 | exato |
| Horas no piso, 2026, SE | 1.570 de 6.552 | 1.570 (SQL no silver, \|PLD − 57,31\| ≤ 0,01) | 0 | exato |
| Separação SE e Sul, 2025 | 1.493 horas; 3.728 de um centavo | 1.493; 3.728 (awk) | 0 | exato |
| Separação SE e NE, 2025 | 2.756 | 2.756 (awk) | 0 | exato |
| Amplitude, 2025 | 3.861 horas com separação; média 49,70 | 3.861; 49,7014 (awk) | 0 | R$ 0,005/MWh |
| PLD ponderado pela carga, 08/2026, SE / N | 131,73 / 127,09 (temporal 128,12 / 126,70) | 131,7331 / 127,0851 (SQL, 744 horas) | 0 | R$ 0,005/MWh |
| A02, fronteiras da sequência | 30/12/2022 a 23/02/2024, 61 semanas | 0,01 em 23/12/2022; 0E-8 em 30/12/2022; 0.0 até 23/02/2024; 0,06 em 01/03/2024 (awk nos três CSV) | 0 | exato |
| A02, CSV contra Parquet 2022 a 2024 | 832 de 832 células iguais por arquivo | leitura pyarrow do Parquet oficial | 0 | 1e−8 |
| Limites vigentes, 2021 a 2026 | 2.099 dias | `regulatorio.limites_em` | 0 divergentes | exato |

Controles automáticos publicados em `controles` (resultado desta construção): esquema do CMO semi-horário aprovado (0 inválidos, 0 duplicados); registros esperados com ressalva (43 dias sem publicação); convenções de semana e de meia hora aprovadas; silver principal contra releitura do CMO semanal aprovado (4.540 iguais, 0 diferentes); PLD dentro dos limites aprovado (0 horas abaixo do piso, 0 acima do teto horário, 0 dias acima do teto estrutural); limites iguais aos do módulo Regulação aprovado; equivalência gold e CSV semanal aprovada.

## 5. Limitações e o que não se pode concluir

* CMO e PLD não são automaticamente equivalentes. Os conjuntos do ONS não identificam deck, versão ou revisão do modelo de cada valor; a descrição pública da CCEE não detalha as diferenças de configuração entre a sua execução e a do ONS. As diferenças publicadas não têm explicação causal.
* O CMO semanal do DECOMP é um valor da semana operativa inteira, por patamar e em média semanal; os conjuntos não informam quando cada valor foi calculado. Comparar com a média do DESSEM ou do PLD da mesma semana mostra a distância entre produtos, não erro de nenhum deles.
* A regra algébrica de aplicação do teto estrutural não está nos trechos dos atos integrados: a leitura sobre a média diária é conferência empírica (370 dias-submercado com a média no teto, 196 com horas acima dele no mesmo dia, 0 com a média acima), não citação da regra.
* A média ponderada usa a carga do subsistema do ONS (carga do sistema), não o consumo contabilizado pela CCEE; subsistema e submercado se correspondem pelo nome, sem conferência de perímetro. A carga e o fluxo vão até 28/09/2026; as horas seguintes ficam fora da ponderada e do sentido do fluxo.
* Moeda constante é perspectiva adicional; o IPCA mede preços ao consumidor. Os termos de uso do IBGE não foram relidos (desafio de navegador).
* A data de publicação de cada hora do PLD não é conhecida; a primeira captura observada não é publicação. Sob LAT1D, os 3 dias com captura direta mostram folga mínima de 24,27 h; a amostra é curta.
* O exemplo de liquidação é sintético; a convenção de crédito para diferença positiva é do exemplo. Encargos, perdas, sazonalização, modulação, MRE, garantias e diferenças entre submercados não entram.
* A REN nº 957/2021 vem de cópia de 01/06/2025 do Internet Archive: alterações posteriores não estão cobertas.
* Série horária do PLD desde 2021: os percentis sazonais têm no máximo cinco anos anteriores, com regimes de limites diferentes em cada ano.
* O sentido do fluxo nas horas separadas (nos últimos 12 meses, do submercado de menor para o de maior preço em 99% a 100% das horas separadas em cada fronteira) é associação descritiva; sem os limites de intercâmbio não se diz que a fronteira estava congestionada.

## 6. Pedidos ao integrador

1. **Tamanho da gold**: `pld_detalhe.json` tem cerca de 394 KB com `base.escreve_gold` em `indent=1` (cerca de 30% do arquivo é indentação). O crescimento esperado é de 15 a 25 KB por ano (relação anual, permanência, meses). Propostas: gravar as golds sem indentação (mudança em `base.py`, compartilhado) ou aceitar que as fichas de evidência (79 KB) passem a um arquivo próprio lido sob demanda.
2. **CSV horário**: `pld_cmo_horario.csv` tem 3,3 MB e cresce cerca de 0,6 MB por ano; chegará ao teto de 5 MB por volta de 2029. Quando chegar, dividir por ano.
3. **Catálogo**: o REGISTRO declara dois documentos normativos com estado `INTEGRADO` e `tema: "normas"` (órgão "Câmara dos Deputados" e ANEEL). Conferir se a página Dados e metodologia aceita esse órgão e esse tema.
4. **Dependência do módulo Regulação**: este módulo consome `pipeline.energia.regulatorio.limites_pld()` e reconcilia com `limites_em`; o esquema de `limites_pld.json` não pode mudar sem acordo. No `run.py`, a ordem 12 basta (o arquivo é estático no repositório).
5. **Previsões**: o backtest do PLD pode ler `achados.A09.folga_minima_lat1d_h` e `dias_com_captura_direta` para a sensibilidade a atrasos exigida na seção 12.3.
6. **CCEE**: o PLD só atualiza pelo pipeline de operação (fora deste contêiner). Nenhum contorno foi tentado.
