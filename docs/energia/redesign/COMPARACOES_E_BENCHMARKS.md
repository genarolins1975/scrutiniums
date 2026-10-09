# Comparações e benchmarks do observatório de energia

Registro das decisões sobre benchmarks internacionais e lista de verificação das comparações nacionais do redesenho (entregável 6 do prompt de redesenho). Consulta feita em 09/10/2026, no branch `claude/kind-mayer-v9tpwi` (HEAD `61d043b58`). Nenhum benchmark internacional existe hoje no produto: a busca por IEA, Eurostat, CEER, Banco Mundial, Ember, IRENA, SE4ALL, SAIDI, SAIFI, OCDE e OECD em `src`, `pipeline/energia` e `pipeline/tests` não devolveu ocorrência. Este documento não altera código, dados nem outros documentos.

## 1. Resumo

| Tema | Medida do observatório | Candidata internacional | Veredito | O que falta para virar A |
| --- | --- | --- | --- | --- |
| Matriz | Participação de cada uma de 12 categorias na geração do SIN, em % e MWmed (ONS, Geração por Usina em Base Horária). Janela de 365 dias até 29/09/2026 e ano civil de 2025 sem MMGD. | IEA, geração por fonte (Electricity Information e World Energy Balances). Ember e BEN 2026 lidos como alternativas nacionais. | B | Medida nacional anual, com geração bruta ou líquida declarada, autoprodução, MMGD e Itaipu definidos, fora do gráfico do SIN. O ONS não declara se a geração é bruta ou líquida. Dados e termos da IEA não abriram (HTTP 403). |
| Conta | TE + TUSD de aplicação da classe B1 residencial convencional, sem tributos, bandeira e iluminação pública, em R$/MWh e em R$/mês para 100, 200 e 300 kWh/mês. Referência 30/09/2026. | Eurostat (preço final residencial por banda de consumo) e IEA Energy Prices. | C | Preço final brasileiro por banda, com tributos e bandeira, validado (hoje bloqueado); classificação dos encargos setoriais nas categorias do Eurostat; paridade de poder de compra e câmbio com fonte; fonte harmonizada que inclua o Brasil. |
| Qualidade | DEC e FEC apurados (parcelas IP + IND), interrupções de 3 minutos ou mais, ponderados por UC. 2025: 9,33 h e 4,69 interrupções por UC. | SAIDI e SAIFI de reguladores europeus (CEER e ECRB, 7ª edição) e dos EUA (EIA). | C | Série brasileira de interrupções não planejadas com todos os eventos, separando IP de IND; mapeamento dos expurgos para cada definição nacional; dados europeus posteriores a 2018; licença da CEER. |
| Perdas | Perdas totais medidas na distribuição sobre a energia injetada de referência, razão de somas das concessionárias. 2025: 14,75% (51 concessionárias). | CEER, 3º Relatório de Perdas (distribuição, % da energia injetada, 40 países, ano 2022). | B | Reconciliação item a item entre a definição brasileira e o questionário da CEER; mesmo ano (2022) e mesma base; extração do Anexo 4; licença da CEER. As perdas de transmissão e distribuição do Banco Mundial e da IEA não servem. |
| Emissões | Fator médio de CO2 do SIN publicado pelo MCTI. 2025: 0,0461 tCO2/MWh (46,1 g/kWh), só CO2, operação das usinas. | Ember (CO2e, ciclo de vida), IEA Emission Factors (CO2 de combustão) e EEA (CO2e de combustão, UE). | C | Leitura do dado da IEA para o Brasil e dos termos; perímetro nacional reconciliado com o SIN; mesmo gás e mesma fronteira; tratamento de importação declarado pela fonte brasileira. |
| Inclusão | Percentual de domicílios particulares permanentes com energia elétrica de qualquer fonte (PNAD Contínua anual, IBGE). 2025: 99,8%. | Acesso à eletricidade, % da população (Banco Mundial, WDI, a partir do SDG 7.1.1 do Tracking SDG7). | C | Variável de moradores da PNAD (SIDRA 6737) para igualar a unidade; marcação de ano de pesquisa ou de modelo para o Brasil; dataset do ESMAP (HTTP 403); mesma definição de acesso. |

Resultado: nenhum tema chegou a A; dois ficam em B (Matriz e Perdas) e quatro em C (Conta, Qualidade, Emissões e Inclusão). Nenhuma decisão admite linha de meta internacional sobre gráfico. Fichas inteiras "não verificadas": 0 de 6. As seis fichas têm lacunas pontuais declaradas, e sete fontes não abriram (seção 5, estado "não verificada").

## 2. Como ler

* **Vereditos.** A: comparação direta aceita, só se o contrato fechar em todos os critérios do prompt. B: contexto separado, mostrado fora do gráfico, com a diferença de definição dita. C: rejeitada.
* **Estado da verificação de cada ficha.** "Verificada": as fontes que sustentam as definições e a licença foram abertas. "Verificada com lacunas": as definições foram abertas, mas algum item (dado em formato de consulta, licença, texto normativo) não foi, e a lacuna está listada. "Não verificada": a fonte primária da medida internacional não foi aberta nem na definição. Nenhuma ficha cai neste último caso; todas estão em "verificada com lacunas".
* **Identificadores.** `R01` a `R13` são arquivos do repositório lidos; `S01` a `S43` são fontes externas (registro na seção 5, com URL, data de acesso, estado e hash). Páginas de PDF são as do PDF aberto.
* **Datas e unidades.** Datas no formato dd/mm/aaaa, horas em UTC quando vêm de carimbos dos arquivos. Números internacionais só aparecem quando foram lidos na fonte primária, com ano, unidade e referência, e sempre rotulados "não plotar".
* **Ambiente de consulta.** Acesso pelo proxy HTTPS do ambiente, com curl, leitura de PDF por pdftotext e consulta às APIs públicas do Banco Mundial, do Eurostat e do IBGE. Os sites da IEA, do ESMAP, da IRENA, do portal de dados da OCDE, os termos do IBGE e os hospedeiros `git.aneel.gov.br` e `www2.aneel.gov.br` responderam com desafio de navegador ou bloqueio (HTTP 403). Os PDFs de documentação da IEA, hospedados em `iea.blob.core.windows.net`, abriram.
* **Referências de desenho.** O prompt cita o manual de serviço de visualização de dados do Office for National Statistics e o navegador de dados da IEA como referências de desenho (linhas 200 a 205). Elas não validam número nem elegibilidade de benchmark. Aqui o navegador da IEA é tratado como fonte de dados, e não abriu.
* **Regra editorial.** O observatório apresenta fatos, referências e limites; o leitor conclui. A ausência de benchmark inadequado não reduz a qualidade da página, e o uso enganoso reduz (R02, critério F).

## 3. Fichas de comparabilidade

### 3.1 Matriz: geração por fonte

**Veredito: B.** Nenhuma linha de referência internacional sobre o gráfico do SIN. Se a página quiser contexto internacional da matriz, ele entra num painel próprio, com medida nacional anual, na mesma base para o Brasil e para os demais países.

| Campo | Observatório | Referência internacional | Fecha? |
| --- | --- | --- | --- |
| Conceito e definição | Energia de cada categoria dividida pela energia de todas as categorias, razão de somas de MWh, com e sem MMGD (`geracao_participacao`). Fonte: ONS, "Geração por Usina em Base Horária", descrita como "geração verificada de usinas, conjuntos de usinas e grupos de pequenas usinas" (R10, S38). | IEA: produção bruta, "measured at the output terminals of the main generators", de produtores principais e autoprodutores (S01, p. 15 e 27). Ember: geração bruta nacional anual (S08, p. 10 e 12). | não |
| Unidade | MWmed e % da geração (R10). | GWh na IEA; TWh e % na Ember (S01, S09). | sim, com conversão por horas |
| Período | 01/01/2021 a 29/09/2026, dias completos; ano civil de 2025 completo; janela de 365 dias de 30/09/2025 a 29/09/2026 (R04). | IEA: 1971 a 2024 para países fora da OCDE e 2025 provisório só para produção bruta, oferta e demanda agregada (S01, p. 7). Ember: até 2025 (S09). BEN 2026: ano base 2025 (S12). | em parte |
| Perímetro e cobertura | SIN e subsistemas. Usinas com relacionamento com o ONS, conjuntos Tipo II C e grupos Tipo III (previsão do ONS, 5,72% da geração de 2025), mais a MMGD estimada pelo ONS desde 29/04/2023 (8,45% em 2025) (R04, S38). Fora: autoprodução não injetada na rede. | Nacional, com autoprodutores (S01). Para o Brasil a IEA cita como fonte o MME e a EPE, isto é, o BEN (S02, p. 345). BEN 2026: 775,9 TWh em 2025, dos quais 176 TWh de autoprodução, 97,6 TWh deles não injetados na rede (S13, p. 11). | não |
| Energia ou capacidade | Energia. A capacidade está em painel próprio, e a métrica proíbe comparar participação de geração com participação de capacidade (R10). | Energia. | sim |
| Bruta ou líquida | O dicionário do ONS (v1.2, 09/06/2023) não declara. O módulo usa "geração bruta verificada" numa frase sobre as usinas nucleares, sem fonte primária (S38, R04). | Bruta na IEA (S01, p. 15) e na Ember anual (S08, p. 10). A Ember informa que ajusta seus fatores de emissão porque parte das fontes reporta geração líquida (S08, p. 15). | não verificada |
| Autoprodução e MMGD | MMGD entra como estimativa do ONS, 8,45% da geração de 2025. Autoprodução só quando a usina tem relacionamento com o ONS. | IEA inclui autoprodutores (S01, p. 27). O BEN inclui MMGD e autoprodução não injetada (S12, p. 35 e 36; S13, p. 11). | não |
| Mesmo ano | Ano civil de 2025 publicado só sem MMGD; a participação com MMGD existe para janelas, não para o ano civil (R04). | 2025 completo na Ember e no BEN; 2025 provisório e agregado na IEA. | em parte |
| Licença e reuso | ONS: Creative Commons Atribuição, declarada no portal (S38). | IEA: "All rights reserved", termos em `iea.org/terms`, não verificados (S01, S06). Ember: CC BY 4.0 (S10). EPE: CC BY 4.0 no rodapé do portal (S11). | Ember e EPE: sim; IEA: não verificada |
| Metodologia publicada | Dicionário do ONS e regras na gold (S38, R04). | IEA, documentação de julho de 2026 (S01); Ember, PDF de metodologia (S08); BEN, relatório final (S13). | sim |

Valores lidos, só para documentar o perímetro (não plotar, não são benchmark):

| Base | Ano | Grandeza | Valor |
| --- | --- | --- | --- |
| ONS via gold do observatório (R04) | 2025 | Hidráulica, % da geração do SIN, perímetro sem MMGD | 62,88% |
| EPE, BEN 2026, Síntese p. 36 (S12) | 2025 | Hidráulica, % da oferta interna de eletricidade (a importação, 0,9%, aparece à parte) | 51,2% |
| Ember, CSV anual (S09) | 2025 | Hídrica, % da geração total do Brasil (763,673 TWh) | 52,103% |
| Arquivo `geracao_capacidade_usina_mensal.csv` (R11) | 12/2024 | Grupo "ITAIPU 50 HZ + ITAIPU 60 HZ", 14.000 MW | 5.615.678,5 MWh no mês |

As três bases diferem em perímetro (SIN, oferta interna com importação, geração nacional bruta). A diferença numérica não foi decomposta. A Ember informa que, para o Brasil, usa o Energy Institute na série anual e o ONS na mensal, e que a bioeletricidade "is generally not scheduled by ONS, so is underreported in monthly data" (S08, p. 27).

**Razão do veredito.**

* O contrato do prompt exige energia versus capacidade, geração bruta ou líquida, autoprodução e MMGD, e mesmo ano. Fecha o primeiro. Não fecha o segundo (o ONS não declara) nem o terceiro (SIN com relacionamento com o ONS contra geração nacional com autoprodução não injetada e MMGD de outra origem).
* Itaipu: IEA e BEN descrevem a produção como dividida igualmente entre Brasil e Paraguai (S02, p. 345; S12, p. 35). O arquivo do observatório soma as unidades de 50 Hz e 60 Hz do mesmo grupo. Se a geração de 50 Hz destinada ao Paraguai entra inteira no dado do ONS não foi verificado.
* O SIN do ONS e a geração nacional são medidas diferentes por construção. Plotar o número nacional como referência sobre o gráfico do SIN sugeriria um desvio que é diferença de perímetro.

**O que falta para virar A.** Um módulo anual nacional (BEN, EPE) com geração por fonte em TWh, bruta ou líquida declarada, autoprodução e MMGD separadas; resposta do ONS sobre bruta ou líquida e sobre Itaipu; leitura dos termos e dos dados da IEA para o Brasil por combustível em 2025; mesmo ano civil fechado nas duas bases. Mesmo assim o painel do SIN não se torna A: só a série nacional anual poderia.

**Dado público adequado e integração.** Ember: CSV anual aberto, CC BY 4.0, com o Brasil de 2000 a 2025 (S09, S10). EPE: BEN 2026 com planilha "Matriz Energética 2026, ano base 2025" e relatórios, CC BY 4.0 declarada no rodapé (S11). IEA: restrita, não verificada. Integração viável, de porte médio (novo módulo anual), fora do escopo desta rodada.

**Condições de exibição se o contexto for adotado.** Painel próprio com título que diga "geração nacional anual"; Brasil e demais países da mesma base e do mesmo ano civil fechado; definição dita (bruta, com autoprodução e MMGD, fronteira nacional); nenhum valor do SIN do ONS ao lado; valores lidos de arquivo versionado com URL, data de acesso e sha256, nunca constantes no código; ordenação por uma medida com critério escrito.

**Estado da verificação: verificada com lacunas.** Não verificados: navegador de dados e termos da IEA (HTTP 403), IRENA (HTTP 403), bruta ou líquida no ONS. Fontes: S01, S02, S06 a S13, S38, R04, R10, R11.

### 3.2 Conta: preços ao consumidor

**Veredito: C.** Nenhuma fonte aberta cobre o Brasil com preço final por banda de consumo e tributos declarados. A que cobre o Brasil usa uma grandeza que o observatório não publica.

| Campo | Observatório | Referência internacional | Fecha? |
| --- | --- | --- | --- |
| Conceito e definição | Tarifa de aplicação TE + TUSD, subgrupo B1, subclasse residencial, modalidade convencional (`conta_tarifa_b1_aplicacao`); custo do perfil = kWh × (TE + TUSD) ÷ 1000 (`conta_custo_perfil`). A tarifa média de fornecimento não é publicada: o SAMP tem meses com valores de ordem de grandeza errada (R05, R10). | Eurostat: preço final ao domicílio, com "basic price of electricity, transmission and distribution charges, meter rental, and other services" e, no nível de tributação final, tributos, encargos e IVA (S15). IEA, para o Brasil: "Tarifa média de fornecimento com tributos" da ANEEL, média anual, com PIS/Cofins e ICMS (S04, p. 439). | não |
| Unidade | R$/MWh e R$/mês (R05). | Eurostat: euro, PPS e moeda nacional por kWh (S14). IEA: moeda nacional (S04). | em parte |
| Período | Vigência na data de referência, 30/09/2026 (R05). | Eurostat: média de semestre, por exemplo julho a dezembro de 2025 (S15). IEA: média anual (S04, p. 439). | não |
| Perímetro e cobertura | 81 distribuidoras com vigência na data, de 115 CNPJs com tarifa B1 residencial no conjunto; mediana sem ponderação (R05). | Eurostat: 43 entidades geográficas (agregados da UE e da área do euro, Estados membros, EFTA, Reino Unido e países candidatos ou vizinhos), nenhuma das Américas (S14). IEA: 147 países, com o Brasil (S04, p. 3). | não |
| Banda de consumo | Perfis de 100, 200 e 300 kWh/mês, isto é, 1.200, 2.400 e 3.600 kWh/ano, que caem nas bandas DB, DB e DC do Eurostat (DB: 1.000 a 2.499 kWh/ano; DC: 2.500 a 4.999) (R05, S14). | Eurostat: cinco bandas, DA a DE. O artigo do Eurostat usa a DC; o relatório de varejo da ACER de 2025 usa a DC e o de 2026 usa a média de todas as bandas (S15, S18 p. 19 a 21, S19 p. 20). IEA: média anual do setor residencial, sem banda (S04). | em parte |
| Tributos | Sem ICMS, PIS/Pasep, Cofins, contribuição de iluminação pública e bandeira. Os encargos setoriais (CDE, Proinfa e outros) estão dentro da TE e da TUSD (R05). | Eurostat: três níveis de tributação (sem tributos e encargos; sem IVA e tributos recuperáveis; todos incluídos) e componentes separados, como tributos de renováveis, de capacidade e ambientais (S14). IEA: classifica Proinfa e CDE como "Renewable Energy Supply tax" na base de tributação do Brasil (S04, p. 439). | não |
| Moeda e poder de compra | R$ nominais e em reais do último mês com IPCA; sem conversão cambial nem paridade de poder de compra (R05, R10). | Eurostat: conversão pela taxa média do período e PPS, que é medida da UE (S15). Para o Brasil a paridade teria de vir de outra fonte, como o fator de conversão do consumo das famílias do Banco Mundial (S21). | não |
| Licença e reuso | ANEEL: ODbL no conjunto de tarifas; rodapé das páginas gov.br com CC BY ND 3.0 (R05, S34). | Eurostat: reuso autorizado com citação da fonte (S16). IEA: termos não verificados (S06). GlobalPetrolPrices: licença Creative Commons Atribuição, Uso Não Comercial, Sem Derivações 3.0 (S20). | Eurostat: sim; IEA: não verificada; GlobalPetrolPrices: não |
| Metodologia publicada | Sim, na gold e no módulo (R05). | Eurostat: artigo e API com rótulos de bandas e componentes (S14, S15); a página de metadados do Eurostat respondeu 404 (S17). IEA: documentação (S04). GlobalPetrolPrices: banda e ponderação não constam da página (S20). | em parte |

**Razão do veredito.**

* TE + TUSD não é fatura final, e o prompt proíbe compará-la com ela. O preço europeu do Eurostat é final por definição.
* O candidato que cobre o Brasil na IEA é a tarifa média de fornecimento com tributos, uma grandeza que o observatório não publica nem consegue validar hoje (R05).
* Os encargos setoriais brasileiros estão dentro da tarifa. Na base de tributação da IEA eles são uma categoria de tributo. A classificação muda o que "sem tributos" significa.
* A própria ACER mudou a banda entre duas edições consecutivas, o que mostra que a banda faz parte da definição.
* GlobalPetrolPrices publica um preço residencial do Brasil (coleta de março de 2026, com tributos, fontes ANEEL e quatro distribuidoras), mas a licença proíbe obras derivadas e a página não declara banda nem ponderação (S20). O estudo anterior do projeto já rejeitara dados proprietários de HEPI e VaasaETT (R01).

**O que falta para virar A.** Preço final residencial brasileiro por distribuidora para uma banda definida, com tributos e bandeira, validado contra fonte independente; classificação documentada dos encargos setoriais nas categorias do Eurostat; paridade de poder de compra e câmbio com fonte e período; mesmo semestre; uma fonte harmonizada que inclua o Brasil. Hoje nenhum desses itens existe.

**Dado público adequado e integração.** Eurostat é aberto e de reuso autorizado, mas não tem o Brasil. A base da IEA tem o Brasil, com termos não verificados e grandeza diferente. Integração inviável nesta rodada.

**Estado da verificação: verificada com lacunas.** Não verificados: termos da IEA (HTTP 403); dado de tarifa média de fornecimento da ANEEL (não aberto); metadados do Eurostat (404, substituídos pela API). Fontes: S04, S14 a S22, R01, R05, R10.

### 3.3 Qualidade: SAIDI e SAIFI

**Veredito: C.** O próprio regulador europeu avisa que a falta de harmonização pode levar a interpretação enganosa em relatórios de benchmark. Os dados abertos europeus param em 2018, e o apurado brasileiro soma parcelas programadas e não programadas.

| Campo | Observatório | Referência internacional | Fecha? |
| --- | --- | --- | --- |
| Conceito e definição | DEC: média mensal do DEC dos conjuntos ponderada pelas UCs, somada em 12 meses; FEC idem (`qualidade_dec_distribuidora`, `qualidade_fec_distribuidora`). Apurado desde 2022 = IP + IND (interna programada e interna não programada não expurgável) (R06, R10). | SAIDI: média anual da duração acumulada de interrupções por cliente; SAIFI: número médio de interrupções por cliente (S29, nota de rodapé 1). Os europeus separam interrupções planejadas e não planejadas, com e sem eventos excepcionais (S27, p. 14). | não |
| Unidade | Horas e centésimos de hora por UC (9,33 h são 9 h 20 min, não 9 h 33 min); interrupções e centésimos por UC (R06). | Minutos por cliente por ano (S27, Figura 2-1). | em parte |
| Período | Ano civil de 2025 completo (R06). | 7º Relatório CEER e ECRB, de 22/12/2022: figuras de continuidade de 2010 a 2018 (S27, p. 51). Edição posterior não localizada. | não |
| Perímetro e cobertura | Todos os conjuntos de distribuição com indicador; Brasil = todas as distribuidoras com indicadores, inclusive permissionárias (9,33 h); concessionárias, que é o universo que a ANEEL divulga: 9,30 h e 4,66 em 2025, 51 delas (R06). | 39 países europeus, nenhum fora da Europa; níveis de tensão incluídos variam por país e por indicador (Tabela 2-12) (S27, p. 43 e 44). O Brasil não consta do relatório (verificado por busca de texto). | não |
| Duração mínima | Interrupções de 3 minutos ou mais; os rótulos do conjunto de dados trazem "3 Min." (S34, S36). | Em geral "longer than three minutes", com exceções (S27, p. 14). | em parte |
| Eventos excepcionais e expurgos | Expurgadas do apurado: situação de emergência (INE), dia crítico (INC e IPC), origem externa (XN, XP, XNC, XPC) e racionamento ou alívio de carga pelo ONS (INO). O DEC de todas as origens publicadas foi 17,20 h em 2025, contra o apurado de 9,33 h (R06, S36). | "Far from harmonised": a definição de evento excepcional varia por país, com abordagens estatísticas ou por causa (S27, p. 35 e 44). O CEER 6.1 indica que a variante com eventos excepcionais incluídos é "possibly more reliable for benchmarking" (S28, p. 7). EIA: dia de grande evento definido por limiar estatístico Tmed, ou autodeclarado por concessionárias que não seguem o IEEE (S32). | não |
| Ponderação | Por UC do conjunto no mês, soma dos meses; limite global ponderado pelas UCs médias do ano (R06, S34). | Por clientes na maioria; por potência ou energia em alguns, como TIEPI e NIEPI na Espanha. "The weighting impacts the results" (S27, p. 32 e 41). | em parte |
| Planejada ou não planejada | O agregado publicado soma IP e IND. A fonte traz DECIP e DECIND separadas, mas os CSV do observatório não (R06, S36). | Separadas em todos os indicadores europeus (S27). | não |
| Licença e reuso | ANEEL: ODbL no conjunto (S36). | CEER: licença não declarada nos PDFs e a página Disclaimer do site não tem texto (S31). EIA: domínio público (S33). | CEER: não verificada; EIA: sim |
| Metodologia publicada | Dicionário do conjunto (v1.0, 06/06/2022) e tabela de domínio dos indicadores; PRODIST Módulo 8 v14 listado na página do PRODIST, texto não aberto (S36, S37). | CEER: relatórios e nota de comparabilidade (S27 a S29). EIA: notas da Tabela 11.1 (S32). | em parte |

**Razão do veredito.**

* A CEER escreve que "there are many implementation factors which impinge on the comparability of reported indicator values" e que a falta de harmonização pode levar a "misleading interpretation of data in benchmarking reports" (S29).
* O apurado brasileiro (IP + IND, depois de expurgos por categoria) não é o SAIDI não planejado com todos os eventos, que a CEER considera o mais comparável. Também não é o SAIDI sem eventos excepcionais, porque o conceito europeu depende de definições nacionais.
* A diferença de unidade (hora com centésimos contra minutos) convida a um erro de leitura que a página não deveria induzir.
* Os dados europeus de continuidade no 7º relatório vão até 2018. O observatório publica 2025.
* A tabela 11.1 da EIA publica, lado a lado, os recortes com todos os eventos e sem dias de grande evento. A escolha do recorte é parte da definição da medida, e o observatório já mostra os dois recortes para o Brasil (apurado e todas as origens).

**O que falta para virar A.** Série brasileira "não planejada, todos os eventos, 3 minutos ou mais" derivada das parcelas da fonte (IND, INE, INC, XN, XNC e INO, sem IP, IPC, XP e XPC), com a mesma ponderação e contrato publicado; segunda série "sem eventos excepcionais" com mapeamento explícito de cada parcela expurgada para a definição de cada país comparado, que a CEER diz não ser harmonizada; dados europeus do mesmo ano; níveis de tensão alinhados; licença da CEER.

**Dado público adequado e integração.** CEER: tabelas em PDF, sem formato de dados aberto localizado, licença não verificada. EIA: Tabela 11.1 em domínio público, mas de um único país. Integração inviável agora.

**Reabrir quando.** Houver edição da CEER posterior à 7ª com dados após 2018 (um resultado de busca menciona uma atualização 7.1 prevista para 2025, que não encontrei publicada) e a série brasileira não planejada existir. Uma nota explicativa sem valores (o que são SAIDI e SAIFI, e por que não equivalem a DEC e FEC) pode entrar em Aprenda sem benchmark.

**Estado da verificação: verificada com lacunas.** Não verificados: PRODIST Módulo 8 v14 (git.aneel.gov.br, HTTP 403), licença da CEER (página vazia). Fontes: S27 a S29, S31 a S34, S36, S37, R06, R10.

### 3.4 Perdas

**Veredito: B.** Contexto textual separado, com a faixa europeia da CEER para 2022 e a diferença de definição dita. As perdas de transmissão e distribuição somadas, do Banco Mundial e da IEA, ficam fora.

| Campo | Observatório | Referência internacional | Fecha? |
| --- | --- | --- | --- |
| Conceito e definição | Perdas totais medidas na distribuição (energia injetada menos energia fornecida medida e menos energia cobrada por procedimento irregular) divididas pela energia injetada de referência; razão de somas, nunca média de taxas (`perdas_totais_energia`, `perdas_taxa_total_injetada`) (R07, R10). | CEER: "difference between injections and offtakes", em % da energia injetada, separando distribuição, transmissão e total (S30, p. 9, 13 e 18). Banco Mundial: perdas de transmissão e distribuição, "including pilferage", "as a share of the total output" (S21). BEN: perdas na transmissão e distribuição, em % da energia elétrica disponibilizada (S12, p. 38; S13, p. 203). | CEER: em parte; os demais: não |
| Unidade | % da energia injetada e MWh (R07). | % da energia injetada (CEER); % da produção (Banco Mundial); % da oferta interna (BEN). | em parte |
| Período | Ano civil; 2003 a 2025 em concessionárias; 2022: 14,53% com 52 concessionárias; 2025: 14,75% com 51 (R07). | CEER: 2013 a 2022, com 2022 como último ano com dado (S30, p. 19). Banco Mundial: até 2025 (S21). | CEER: sim para 2022 |
| Perímetro e cobertura | Distribuição das concessionárias e permissionárias com balanço no SAMP; a Rede Básica fica fora e é apurada pela CCEE (S35). Universo varia entre anos; há série de universo fixo de 16 distribuidoras (R07). | CEER: 40 países europeus, sem o Brasil (verificado por busca de texto) (S30). | não |
| Fronteira e denominador | "Energia inserida na rede para atender aos consumidores, incluindo as perdas" (R07). Com o leiaute de 2024 (REN 1.003/2022) a energia injetada publicada deixou de fechar o balanço, e o observatório usa a energia implícita no cálculo da fonte. O dicionário do SAMP só lista campos, sem definir a injetada (R07). | CEER: a energia injetada na distribuição inclui a repassada da transmissão e a gerada em redes de distribuição (S30, p. 9 e 18). Banco Mundial e BEN: denominadores diferentes (produção; oferta interna). | em parte |
| Base | Medida (a faturada fica em CSV). Em 2024, 14,74% pela base medida contra 14,0% pela base faturada do relatório da ANEEL (R07). | CEER: injeções menos retiradas, medidas ou estimadas (S30, p. 16). | em parte |
| Perdas não técnicas | Furto, fraude, erros de medição, leitura e faturamento (S35). | Componentes variam por país: perdas ocultas, consumo não medido, furto e outras (S30, p. 13 e 15). | em parte |
| Licença e reuso | ANEEL: ODbL no SAMP Balanço (R07). | CEER: não verificada (S31). Banco Mundial: CC BY 4.0 no catálogo do WDI; a fonte do indicador é a IEA, cuja cadeia de direitos não foi verificada (S21, S22). | CEER: não verificada |
| Metodologia publicada | Verbetes da página de perdas da ANEEL e regras do módulo (S35, R07). PRODIST Módulo 7 v6 não aberto (S37). | CEER: relatório com questionário e tabelas (S30). IEA: "Distribution losses" = "all losses due to transport and distribution" (S01, p. 9). | em parte |

Valores lidos, só para documentar o risco de leitura (não plotar):

| Base | Medida e denominador | Ano | Valor |
| --- | --- | --- | --- |
| Observatório (R07) | Perdas totais na distribuição sobre a energia injetada de referência, 51 concessionárias | 2025 | 14,75% |
| EPE, BEN 2026, Síntese p. 38 (S12) | Perdas comerciais e técnicas, sobre a energia elétrica disponibilizada | 2024 e 2025 | 14,73% e 14,74% |
| Banco Mundial, EG.ELC.LOSS.ZS (S21) | Transmissão e distribuição, sobre a produção | 2025 | 14,87% |
| Observatório (R07) | Distribuição, 52 concessionárias | 2022 | 14,53% |
| CEER, 3º Relatório (S30, p. 19) | Distribuição, sobre a energia injetada, faixa entre 40 países europeus | 2022 | 1,95% a 22,63% |

Três bases com denominadores e fronteiras diferentes dão valores próximos para o Brasil. A coincidência numérica não valida a medida do observatório: as definições diferem, e a IEA cita o MME e a EPE como fonte dos dados do Brasil (S02, p. 345), de modo que as bases não são independentes entre si.

**Razão do veredito.**

* A CEER é a única fonte lida cujo recorte (distribuição, em % da energia injetada) tem o mesmo desenho conceitual da medida brasileira. Por isso B, e não C.
* A própria CEER avisa que "what is considered a loss in one country, might be considered delivered energy in another" (S30, p. 17) e que a falta de definições harmonizadas é "an obstacle to straightforward benchmarking" (S30, p. 9).
* Transmissão mais distribuição (Banco Mundial, IEA, BEN) não pode ser colocada ao lado da distribuição. A Rede Básica brasileira é apurada à parte, pela CCEE, e o observatório não a integra (S35).
* O Brasil não está na CEER. O ano comparável é 2022, anterior à quebra de 2024 do leiaute do SAMP.

**O que falta para virar A.** Reconciliar cada componente da definição brasileira com as Tabelas 1 e 2 do questionário da CEER (perdas ocultas, consumo não medido como iluminação pública, furto, erros de medição e faturamento); confirmar que a energia injetada brasileira tem a mesma fronteira (inclui a repassada da transmissão e a geração distribuída); extrair os valores por país do Anexo 4; confirmar a licença; usar 2022 com a base e o leiaute declarados.

**Dado público adequado e integração.** PDF com tabelas (Anexo 4), sem formato de dados aberto; licença não verificada. Extração única e manual, viável com ressalva.

**Condições de exibição.** Uma frase fora do gráfico: "Na Europa, as perdas de distribuição foram de 1,95% a 22,63% da energia injetada em 2022 (CEER, 40 países); as definições nacionais não são harmonizadas." Sem posicionar o Brasil na faixa, sem linha, sem ordenação de países, sem perdas de transmissão e distribuição somadas.

**Estado da verificação: verificada com lacunas.** Não verificados: PRODIST Módulo 7 v6 (HTTP 403), licença da CEER, Anexo 4 não extraído, dados e termos da IEA (HTTP 403). Fontes: S01, S02, S12, S13, S21, S22, S30, S31, S35, S37, R01, R07, R10.

### 3.5 Emissões: fator de emissão

**Veredito: C.** Nenhuma candidata coincide com o fator do MCTI em gás, fronteira e perímetro ao mesmo tempo. A candidata aberta mede outra coisa.

| Campo | Observatório | Referência internacional | Fecha? |
| --- | --- | --- | --- |
| Conceito e definição | Fator médio de CO2 do SIN: "média das emissões da geração, levando em consideração todas as usinas que estão gerando energia", para inventários; não é fator marginal (S39, R08). | Ember: "full lifecycle emissions including upstream methane, supply chain and manufacturing emissions", todos os gases em CO2e a 100 anos (S08, p. 15). IEA: CO2 de combustíveis fósseis consumidos na geração, dividido pela geração de todas as fontes (S03, p. 9). EEA: CO2e de combustão, com fator zero para nuclear e renováveis, "as the method does not take into account life-cycle greenhouse gas emissions" (S41). | não |
| Unidade | tCO2/MWh (R08); 0,0461 tCO2/MWh = 46,1 g/kWh. | gCO2e/kWh na Ember e na EEA; gCO2 e gCO2eq por kWh na IEA (S03, S09, S41). | sim, com conversão |
| CO2 ou CO2e | Só CO2; "não é CO2e" (R08, R10). | CO2e na Ember e na EEA. IEA: CO2 como padrão, com CH4 e N2O em CO2eq separados (GWP do AR6) (S03, p. 8 e 11). | não |
| Operação ou ciclo de vida | Operação das usinas (R08). | Ember: ciclo de vida. IEA e EEA: combustão; a IEA publica o ciclo de vida em produto separado (S03, p. 4 e 9). | Ember: não; IEA e EEA: sim |
| Importação | O MCTI não trata importação nas páginas lidas (S39, S40). | IEA: ajuste de comércio só para países da OCDE e fora do fator base (S03, p. 9). Ember: importação líquida em linha à parte, com emissões zero (S09). | não verificado |
| Geração ou consumo | Geração despachada no SIN (R08, S39). | Geração (IEA, Ember, EEA). | sim |
| Perímetro e cobertura | SIN. A partir de janeiro de 2025 a base de usinas do ONS foi ampliada (térmicas a biomassa, conjuntos solares e eólicos); a energia despachada na planilha foi de 459,8 TWh em 2024 a 596,8 TWh em 2025 (R08, S40). | Nacional, com autoprodutores e sistemas isolados (S01, S03). EEA: UE27 (S41). | não |
| Período | Mensal de 01/2006 a 08/2026; anual de 2006 a 2025; 2025: 0,0461; 08/2026: 0,0471 tCO2/MWh (R08). | IEA: 1990 a 2024 e 2025 provisório para a OCDE e países selecionados (S03, p. 8). Ember: 2025. EEA: 1990 a 2024. | em parte |
| Licença e reuso | Rodapé do portal do MCTI: Creative Commons Atribuição SemDerivações 3.0 (CC BY ND 3.0), lido em 09/10/2026. A gold registra "sem licença específica declarada na página" (S39, R08). | Ember: CC BY 4.0 (S10). IEA: termos não verificados (S06). EEA: licença não localizada na página lida (S41). | Ember: sim |
| Metodologia publicada | Planilhas do MCTI e nota técnica NT_FE_jun25 (S39, S40). | Documentação da IEA (S03), PDF da Ember (S08), página da EEA (S41). | sim |

Valores lidos, só para documentar a diferença de definição (não plotar):

| Base | Medida | Ano | Valor |
| --- | --- | --- | --- |
| MCTI via gold (R08) | Fator médio de CO2 do SIN, operação | 2025 | 0,0461 tCO2/MWh (46,1 g/kWh) |
| Ember, CSV anual (S09) | Intensidade de emissões da geração total do Brasil, CO2e, ciclo de vida | 2025 | 109,218 gCO2e/kWh |

**Razão do veredito.** O par mais próximo do fator do MCTI é o CO2 de combustão por kWh da IEA, mas o perímetro é nacional e os termos e dados do Brasil não foram abertos. A candidata aberta, a Ember, mede ciclo de vida em CO2e: o prompt já estabelece que "CO2 operacional não é CO2e de ciclo de vida". A Ember também carrega no Brasil de 2025 uma importação líquida igual à de 2024 (11,588 TWh nos dois anos), prática declarada em sua metodologia ("carried forward"), enquanto o BEN 2026 traz 7,4 TWh em 2025 (S08, p. 27; S09; S13, p. 11).

**O que falta para virar A.** Leitura do CO2 por kWh só de eletricidade da IEA para o Brasil (2024 e 2025 provisório) e dos termos de uso; reconciliação do perímetro SIN contra nacional (autoprodução, isolados) e do denominador (geração bruta); mesmo ano; tratamento de importação declarado pelo MCTI; confirmação de que o fator da IEA é só CO2.

**Dado público adequado e integração.** Ember: aberto e CC BY 4.0, mas incompatível. IEA: restrita, não verificada. EEA: aberta, mas só UE. Integrar a Ember como bloco "ciclo de vida" é viável tecnicamente (CSV), com benefício baixo e risco alto de leitura errada ao lado do MCTI. Decisão: não integrar.

**Estado da verificação: verificada com lacunas.** Não verificados: dados e termos da IEA (HTTP 403); tratamento de importação pelo MCTI; licença da EEA. Fontes: S03, S06, S08 a S10, S13, S39 a S41, R08, R10.

### 3.6 Inclusão: acesso domiciliar à eletricidade

**Veredito: C.** A comparação Brasil contra Banco Mundial não traz informação independente e mostra uma diferença de 0,2 ponto percentual em 2022 que é artefato de definição e de método.

| Campo | Observatório | Referência internacional | Fecha? |
| --- | --- | --- | --- |
| Conceito e definição | Domicílios particulares permanentes com energia elétrica de "rede geral ou fonte alternativa" (qualquer fonte, inclusive gerador ou painel próprio); ligados à rede geral; e, entre os ligados, em tempo integral (tabelas 6737, 6738 e 6731 da PNAD Contínua anual) (S25, R09). | Acesso à eletricidade: percentual da população com acesso, "binary" (acesso ou não), com dados de pesquisas e censos e modelo para anos sem dado (S21, S23 p. 41 e 156). | não |
| Domicílio ou população | Domicílios. A mesma tabela 6737 traz também moradores em domicílios com energia (variável 10137), que o observatório não publica (S25). | População (WDI). | em parte |
| Unidade | % de domicílios e mil domicílios (R09). | % da população (S21). | não |
| Período | Série de 2016 a 2025, com lacuna em 2020 e 2021; 2025 completo (R09, S25). | WDI do Brasil: 2022: 100; 2023: 99,8; 2024: 99,8; 2025: sem valor (atualização do WDI em 08/10/2026) (S21). | em parte |
| Definição de acesso e qualidade | Binária por domicílio, mais as dimensões "rede geral" e "tempo integral", que medem interrupção declarada, não qualidade técnica (R09). | Binária; a definição de acesso varia por país e por pesquisa ("diverse definitions of electricity access across countries"); o MTF é multidimensional, mas cobre poucos países (S23, p. 41 e 159). | não |
| Pesquisa e incerteza | Estimativa amostral do IBGE, CV publicado (0,0% no total do Brasil, arredondado); domicílios sem energia = diferença de duas estimativas, sem erro padrão (R09, S25). | O relatório diz que, para evitar taxas irreais de 100%, "the country's latest survey data are extended", e que nesta edição isso foi feito para Brasil, Bolívia, Jamaica e Laos; países de alta renda são assumidos em 100% (S23, p. 156). Não há incerteza no WDI. | não |
| Perímetro e cobertura | Brasil, regiões e UF; total, urbano e rural (R09). | País (S21). | em parte |
| Licença e reuso | IBGE: "uso livre com citação" segundo a gold; página de termos do IBGE respondeu com desafio de navegador e não foi aberta (R09, S26). | WDI: CC BY 4.0 no catálogo (S22). Dataset do ESMAP: não aberto (S24). | WDI: sim; IBGE: não verificada |
| Metodologia publicada | Metadados da API do IBGE, com variáveis e classificações (S25). | Anexo metodológico do Tracking SDG7 de 2026 (S23). | sim |

Valores lidos (não plotar):

| Base | Medida | Ano | Valor |
| --- | --- | --- | --- |
| IBGE via gold do observatório (R09) | % de domicílios com energia elétrica de qualquer fonte | 2022; 2025 | 99,8%; 99,8% |
| IBGE, SIDRA 6737, variável 10137 (S25) | % de moradores em domicílios com energia elétrica | 2022; 2025 | 99,8%; 99,9% |
| Banco Mundial, EG.ELC.ACCS.ZS (S21) | % da população com acesso | 2022; 2023; 2024; 2025 | 100; 99,8; 99,8; sem valor |
| Tracking SDG7 2026 (S23, p. 31) | % da população mundial com acesso | 2024 | 91,9% |

**Razão do veredito.**

* O Brasil do WDI vem do conjunto de pesquisas domiciliares harmonizadas do Banco Mundial; os últimos dados de pesquisa do Brasil foram estendidos nesta edição (S23, p. 156). Comparar essa série com a PNAD seria comparar a pesquisa com uma extensão dela.
* O 100 de 2022 contra 99,8% da PNAD é um artefato. O percentual de 100,0 na PNAD quer dizer pelo menos 99,95%, e o WDI não carrega essa regra (R09).
* A comparação entre países exige a mesma definição de acesso, que o próprio relatório diz não ser harmonizada. O agregado mundial é de outro ano (2024), de outra unidade (população) e de outra natureza (modelo).
* A IEA mantém uma base de acesso com dados administrativos de concessionárias, que dá estimativas diferentes das pesquisas (S23, p. 157). Não foi aberta.

**O que falta para virar A.** Publicar a variável de moradores da PNAD (SIDRA 6737, variável 10137) para igualar a unidade; abrir o dataset do ESMAP e identificar, por ano, o que é pesquisa e o que é modelo ou extensão para o Brasil; confirmar qual pesquisa alimenta o Brasil; mesma definição de acesso; incerteza comparável; mesmo ano.

**Dado público adequado e integração.** WDI aberto via API (CC BY 4.0), integração simples, sem ganho informativo hoje. ESMAP e termos do IBGE não abriram.

**Reabrir quando.** O dataset do ESMAP marcar o Brasil com ano de pesquisa próprio e a unidade de moradores estiver publicada.

**Estado da verificação: verificada com lacunas.** Não verificados: dataset do ESMAP (HTTP 403), termos do IBGE (HTTP 403), base de acesso da IEA. Fontes: S21 a S26, R09.

## 4. Comparações nacionais novas ou modificadas: lista de verificação

Esta seção é uma lista de verificação para a auditoria de consistência do prompt (etapa 4). Não traz resultados. Para cada item, registrar quem recalculou, quando, a partir de qual arquivo e a divergência encontrada. Os pontos de código citados são do HEAD de 09/10/2026.

Verificações comuns a toda comparação: (1) gráfico, tabela, frase, KPI e CSV leem o mesmo seletor; (2) o peso está declarado e "média simples", "mediana" e "razão de somas" têm rótulos distintos; (3) a cobertura e a elegibilidade aparecem junto da referência; (4) extremos e todos os empates são preservados; (5) ausência, zero e não aplicável são estados diferentes; (6) período parcial não concorre com ano completo; (7) o filtro muda o resumo e a exportação contém a mesma população elegível.

| Rota | Comparação prevista | Verificações específicas |
| --- | --- | --- |
| 01 raiz e 02 Visão geral | Amostra de medidas e resumo de preço, água e carga, com datas próprias | Cada número com a data e o universo do seu módulo; a média diária do PLD é média simples das 24 horas por submercado e não ponderada pela carga (`visao_pld_media_diaria`); nenhum "PLD Brasil" por média simples dos quatro submercados; divergência entre a Visão geral e o módulo explicada por corte de fonte ou por regra, não por rótulo genérico. |
| 04 Água e clima | EAR do dia contra a mediana da mesma data; faixa histórica | Mediana (50º percentil) do mesmo dia do calendário nos anos completos anteriores, mínimo de 5 anos, 29/02 fora, `periodo_base` e `anos_na_base` publicados, `capacidade_mudou_na_base` sinalizado, REE só com base desde 2018 (`agua_ear_faixa_sazonal`); EAR em % e em MWmês não se substituem; ENA em % da MLT é outra referência. |
| 05 Geração | Barras por fonte com perímetro e natureza da MMGD | Participação como razão de somas de MWh; perímetro com e sem MMGD declarado, e comparação que atravessa 29/04/2023 só sem MMGD; categoria "outras" não calculada por subtração de participações arredondadas; `ressalvas_universo` e `variacao_suprimida` visíveis (biomassa, óleo e outras térmicas); `natureza_pct` junto do total; janelas só com dias completos. |
| 06 Carga | Nível atual e janela equivalente | Mesmos dias da semana (364 dias) e mesmas datas do calendário como critérios distintos; `calendario_equivalente` falso quando feriado muda de tipo de dia; comparação dentro do mesmo regime do ONS, com 29 e 30/04/2023 fora (`carga_variacao_equivalente`). |
| 08 PLD | Quatro submercados em escala comum, extremos e diferença entre regiões | Mínimo e máximo com todos os empates (horas com os quatro submercados no piso têm diferença zero por construção, `pld_empates_piso`); média temporal e ponderada rotuladas; nominal e real; regime de limites horário e estrutural em objetos distintos; ano parcial marcado. |
| 12 Conta de luz | Perfil comum, menor, mediana e maior; composição | Universo elegível (81 distribuidoras com vigência em 30/09/2026, de 115 CNPJs) e as excluídas contadas (22 sem vigência recente, 12 sem tarifa há mais de 90 dias); mediana e quartis tipo 7 sem ponderação, com rótulo "mediana entre distribuidoras"; `conta.ts` nas linhas 785 a 791 e 895 a 898 nomeia a primeira e a última da ordenação, e é preciso conferir empate no menor e no maior valor antes de nomear uma só; composição média fecha com o total e as medianas por grupo não somam; TE + TUSD sem tributos, bandeira e iluminação pública dito junto de cada valor. |
| 13 Perdas | Taxa e energia; agregado separado da comparação entre distribuidoras | Razão de somas, nunca média de taxas; universo (concessionárias, permissionárias, todas) nomeado; série de universo fixo (16 distribuidoras em 2023 a 2025) separada; ano aberto só contra o mesmo período do ano anterior nas mesmas distribuidoras; cobertura da parcela técnica (18 de 51 em 2025, 32,6% da injetada) e do mercado de baixa tensão visível; quebra de 2024 marcada; extremos com empates (`perdas.ts` por volta das linhas 684 e 1582 a 1587 tratam desempate e empate); critério de elegibilidade (balanço que fecha, ano completo). |
| 14 Qualidade | DEC e FEC em gráficos próprios; limite do mesmo ente e ano | Ponderação por UC no mês e soma dos 12 meses; limite global ponderado pelas UCs médias do ano e comparado só com o apurado do mesmo ano; mês nacional completo só com 99% das UCs; Brasil (todas as distribuidoras) contra concessionárias; "conjuntos acima do limite" por contagem e por fração de UCs como medidas diferentes (`qualidade_pct_conjuntos_acima`); igual ao limite não é transgressão; centésimos de hora convertidos corretamente. |
| 15 Inclusão | Despesa por renda; acesso e benefício com unidades e datas próprias | POF 2017 a 2018 (valores de 15/01/2018) sem mudar o ano no título; razão de médias, média de razões e mediana com rótulos distintos; CV até 15% publicado, de 15% a 30% com cautela, acima de 30% suprimido; proxy de cobertura sem apresentar como percentual exato de famílias (pode passar de 100%); datas próprias (SCS, CDE, PNAD, POF); fatura, UC, família, domicílio e pessoa não são substitutos. |
| 18 Transição | Capacidade adicionada e intensidade de emissões em gráficos separados | Fator médio e margens do MDL como séries distintas; quebra de janeiro de 2025 marcada; só CO2; sem causalidade automática. |
| Demais rotas | 03 Território (até quatro municípios), 07 Rede, 09 Modelos, 11 Mercado, 16 Empresas, 17 Expansão, 19 Regulação | Domínio comum calculado só sobre as entidades escolhidas; fluxo bruto e saldo separados; desempenho contra referências simples com amostra e protocolo; Mercado sem estatística fictícia; capacidade proporcional contra controlada; operação, obra e carteira separadas; limite do ente e da vigência certos. |

## 5. Registro de fontes

Todas as fontes externas foram acessadas em 09/10/2026. "Estado": "aberta" quando o conteúdo foi lido; "não verificada" quando o acesso falhou (a causa vem na coluna); "indisponível" quando a página não existe ou está vazia. O hash é o SHA 256 do arquivo baixado, abreviado aos 12 primeiros caracteres.

### 5.1 Arquivos do repositório

| ID | Arquivo | Data de referência ou geração |
| --- | --- | --- |
| R01 | `docs/observatorios/energia/BENCHMARKS.md` | 30/09/2026 |
| R02 | `docs/energia/redesign/RUBRICA.md` (critério F), `DESIGN_SYSTEM.md` (seção 7), `GUIA_MIGRACAO.md`, `avaliacao/PROMPT_AVALIADOR_TECNICO.md` | 09/10/2026 |
| R03 | Prompt de redesenho, `/root/.claude/uploads/fdb6f8f5-b80e-56ed-ab31-342c1b46c73d/fb47d436-Prompt_Claude_Redesenho_Completo_Energia_1.md`, linhas 173 a 205, 250 a 254, 275 a 278 e 299 | 09/10/2026 |
| R04 | `public/energia/gold/geracao_detalhe.json` e `geracao.json`; `docs/observatorios/energia/modulos/geracao.md` | gold gerada em 01/10/2026 07h08 UTC; último dia completo 29/09/2026 |
| R05 | `public/energia/gold/conta.json`; `modulos/conta.md` | referência 30/09/2026; gerada em 30/09/2026 23h56 UTC |
| R06 | `public/energia/gold/qualidade.json`; `modulos/qualidade.md`; `public/energia/series/qualidade_*.csv` | ano de referência 2025; gerada em 01/10/2026 05h53 UTC |
| R07 | `public/energia/gold/perdas.json`; `modulos/perdas.md` | ano de referência 2025, última competência 08/2026; gerada em 01/10/2026 06h06 UTC |
| R08 | `public/energia/gold/transicao.json`; `modulos/transicao.md` | gerada em 01/10/2026 06h38 UTC; fator anual até 2025 e mensal até 08/2026 |
| R09 | `public/energia/gold/inclusao.json`; `modulos/inclusao.md` | PNAD até 2025; gerada em 01/10/2026 00h28 UTC |
| R10 | `public/energia/gold/metricas.json` (276 métricas) | gerada em 06/10/2026 20h02 UTC |
| R11 | `public/energia/series/geracao_capacidade_usina_mensal.csv` | série mensal até 2026 |
| R12 | `pipeline/energia/catalogo_manual.json`, entrada `epe:ben` | 09/10/2026 |
| R13 | `src/lib/energia/conta.ts`, `perdas.ts`, `pld.ts`, `agua.ts`, `carga.ts` | HEAD `61d043b58` |

### 5.2 Fontes externas

| ID | Organização e documento | URL | Estado e hash | Reuso lido |
| --- | --- | --- | --- | --- |
| S01 | IEA, Electricity information: database documentation (edição de julho de 2026) | https://iea.blob.core.windows.net/assets/cb3a6a93-3e09-4866-b978-1ed00cc3375f/DocumentationforElectricityInformationJuly2026edition.pdf | aberta, e6b955909d63 | "All rights reserved"; remete a iea.org/terms |
| S02 | IEA, World Energy Balances: database documentation (edição de abril de 2026), notas do Brasil na p. 345 | https://iea.blob.core.windows.net/assets/4c066cb0-d2bd-4d53-9053-5a4f654c11d3/EARLYBAL_Documentation_April2026.pdf | aberta, 64cff3a57a07 | idem |
| S03 | IEA, Emission Factors 2026 edition: database package documentation | https://iea.blob.core.windows.net/assets/1448c682-f204-48fd-bf46-442bb43b6657/IEA_Methodology_Emission_Factors_2026_package.pdf | aberta, f60e5c7320e1 | remete a iea.org/terms (p. 5) |
| S04 | IEA, Energy Prices 2025 edition: database documentation (janeiro de 2025) | https://iea.blob.core.windows.net/assets/e29a2d27-3ab2-4060-8713-22f39a4c77d7/EnergyPrices_Documentation.pdf | aberta, 3a6fcb258212 | "subject to specific restrictions"; termos em iea.org |
| S05 | IEA, Energy Statistics Data Browser | https://www.iea.org/data-and-statistics/data-tools/energy-statistics-data-browser | não verificada: HTTP 403, desafio do Cloudflare (curl e WebFetch) | não verificado |
| S06 | IEA, Terms | https://www.iea.org/terms | não verificada: HTTP 403 (WebFetch em iea.org/terms/data também). Resultados de busca sobre páginas de produto indicam que a licença padrão cobre uso interno e que redistribuição e produtos derivados exigem acordo pago; as páginas não foram abertas | não verificado |
| S07 | Ember, Yearly Electricity Data (página) | https://ember-energy.org/data/yearly-electricity-data/ | aberta | CC BY 4.0 no rodapé |
| S08 | Ember, Electricity data methodology (PDF) | https://files.ember-energy.org/public-downloads/ember_electricity_data_methodology.pdf | aberta, 67c5eaac3bfb | CC BY 4.0 |
| S09 | Ember, release_generation_yearly_global.csv | https://files.ember-energy.org/public-downloads/generation/outputs/release_generation_yearly_global.csv | aberta, b2ac49fa9b27 | CC BY 4.0 |
| S10 | Ember, Creative Commons | https://ember-energy.org/creative-commons/ | aberta | "free to share and adapt", com crédito |
| S11 | EPE, Balanço Energético Nacional 2026 (página) | https://www.epe.gov.br/pt/publicacoes-dados-abertos/publicacoes/balanco-energetico-nacional-2026 | aberta | CC BY 4.0, declarada no rodapé |
| S12 | EPE, BEN 2026, Relatório Síntese, ano base 2025 | https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/publicacao-975/topico-847/BEN_S%C3%ADntese_2026_PT.pdf | aberta, 0b4327c52cf6 | CC BY 4.0 (S11) |
| S13 | EPE, BEN 2026, Relatório Final | https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/publicacao-975/topico-850/BEN2026.pdf | aberta, 1242772db925 | CC BY 4.0 (S11) |
| S14 | Eurostat, API de disseminação: conjuntos nrg_pc_204 (preços residenciais, semestrais) e nrg_pc_204_c (componentes, anuais) | https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_pc_204 e https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_pc_204_c | aberta; conjunto atualizado em 08/10/2026 | ver S16 |
| S15 | Eurostat, Statistics Explained: Electricity price statistics (dados extraídos em abril de 2026; próxima atualização prevista para 30/10/2026) | https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Electricity_price_statistics | aberta | ver S16 |
| S16 | Eurostat, Copyright notice and free re-use of data | https://ec.europa.eu/eurostat/help/copyright-notice | aberta | reuso comercial e não comercial autorizado com citação da fonte |
| S17 | Eurostat, metadados de nrg_pc_204 (ESMS) | https://ec.europa.eu/eurostat/cache/metadata/en/nrg_pc_204_sims.htm | indisponível: HTTP 404 | não aplicável |
| S18 | ACER e CEER, Rewarding Flexibility (relatório de monitoramento do varejo, 2025), p. 19 a 21 | https://www.acer.europa.eu/sites/default/files/documents/Publications/ACER-CEER-2025-Retail-monitoring.pdf | aberta, 4d59f2e0d925 | não verificado |
| S19 | ACER, Key developments in European electricity and gas markets (2026), p. 20 | https://www.acer.europa.eu/sites/default/files/documents/Publications/2026-ACER-Gas-Electricity-Key-Developments.pdf | aberta, 5357647f1759 | não verificado |
| S20 | GlobalPetrolPrices.com, Brazil electricity prices (coleta de março de 2026) | https://www.globalpetrolprices.com/Brazil/electricity_prices/ | aberta | Creative Commons Atribuição, Uso Não Comercial, Sem Derivações 3.0 |
| S21 | Banco Mundial, API: EG.ELC.ACCS.ZS, EG.ELC.LOSS.ZS, PA.NUS.PRVT.PP (WDI atualizado em 08/10/2026) | https://api.worldbank.org/v2/indicator/EG.ELC.ACCS.ZS e https://api.worldbank.org/v2/country/BRA/indicator/EG.ELC.LOSS.ZS | aberta | ver S22 |
| S22 | Banco Mundial, Data Catalog: World Development Indicators | https://datacatalog.worldbank.org/search/dataset/0037712/World-Development-Indicators | aberta | "Creative Commons Attribution 4.0" |
| S23 | IEA, IRENA, UNSD, Banco Mundial e OMS, Tracking SDG7: The Energy Progress Report 2026 | https://iea.blob.core.windows.net/assets/5e20ffbb-fdb0-4bc4-98ea-41add3575f2f/TrackingSDG7TheEnergyProgressReport,2026.pdf | aberta, a56c2553ad50 | não verificado |
| S24 | ESMAP, Tracking SDG7: Downloads (SDG 7.1.1 Electrification Dataset) | https://trackingsdg7.esmap.org/downloads | não verificada: HTTP 403 | não verificado |
| S25 | IBGE, API de dados agregados: tabelas 6737, 6738 e 6731 da PNAD Contínua anual (metadados e dados) | https://servicodados.ibge.gov.br/api/v3/agregados/6737/metadados | aberta | ver S26 |
| S26 | IBGE, termos de uso | https://www.ibge.gov.br/acesso-informacao/institucional/termos-de-uso.html | não verificada: HTTP 403 | não verificado |
| S27 | CEER e ECRB, 7th Benchmarking Report on the Quality of Electricity and Gas Supply (22/12/2022) | https://ceer.eu/wp-content/uploads/2024/04/7th-Benchmarking-Report-2022.pdf | aberta, 73dbb21d007d | não declarada nos PDFs (S31) |
| S28 | CEER, Benchmarking Report 6.1 on the Continuity of Electricity and Gas Supply (C18-EQS-86-03, 26/07/2018) | https://ceer.eu/wp-content/uploads/2024/04/C18-EQS-86-03_Benchmarking_Report_6.1.pdf | aberta, bf59eeb44ce7 | não declarada |
| S29 | CEER, nota sobre a comparabilidade dos indicadores de continuidade (C19-EQS-95-03b, 03/10/2019) | https://ceer.eu/wp-content/uploads/2024/04/C19-EQS-95-03b_CEER-note-on-comparability-of-continuity-indicators.pdf | aberta, f97c019b10e6 | não declarada |
| S30 | CEER, 3rd CEER Report on Power Losses (C24-EQS-106-03, publicado em 11/02/2025) | https://www.ceer.eu/wp-content/uploads/2025/02/3rd-CEER-Report-on-Power-Losses.pdf | aberta, c02a417fc04a | não declarada |
| S31 | CEER, página Disclaimer | https://www.ceer.eu/disclaimer/ | indisponível: a página existe, sem texto (conteúdo vazio na API do site, modificada em 16/06/2025) | não localizada |
| S32 | EIA, Electric Power Annual, Table 11.1 Reliability Metrics of U.S. Distribution System | https://www.eia.gov/electricity/annual/html/epa_11_01.html | aberta | domínio público (S33) |
| S33 | EIA, Copyrights and Reuse | https://www.eia.gov/about/copyrights_reuse.php | aberta | domínio público, com citação sugerida |
| S34 | ANEEL, Qualidade do Fornecimento de Energia Elétrica (atualizada em 29/04/2026) | https://www.gov.br/aneel/pt-br/assuntos/distribuicao/qualidade-do-fornecimento-de-energia-eletrica | aberta | rodapé: Creative Commons Atribuição SemDerivações 3.0 |
| S35 | ANEEL, Perdas de Energia (atualizada em 30/04/2026) | https://www.gov.br/aneel/pt-br/assuntos/distribuicao/perdas-de-energia/perdas-de-energia | aberta | idem |
| S36 | ANEEL, Dados Abertos: Indicadores Coletivos de Continuidade (DEC e FEC); dicionário v1.0 de 06/06/2022 e tabela de domínio `dominio-indicadores.csv` (gerada em 05/10/2026) | https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec | aberta, dicionário 1d024457693b, domínio fd69e1dd-fd66 não usado como hash; ver nota abaixo | ODbL |
| S37 | ANEEL, PRODIST (página com a lista dos módulos) e Módulos 7 (v6) e 8 (v14) | https://www.gov.br/aneel/pt-br/centrais-de-conteudos/procedimentos-regulatorios/prodist | página aberta; módulos não verificados: `git.aneel.gov.br` e `www2.aneel.gov.br` com HTTP 403 | rodapé: Creative Commons Atribuição SemDerivações 3.0 |
| S38 | ONS, Dados Abertos: Geração por Usina em Base Horária; dicionário v1.2 de 09/06/2023 | https://dados.ons.org.br/dataset/geracao-usina-2 | aberta, dicionário c254f3513... ver nota abaixo | Creative Commons Atribuição |
| S39 | MCTI, Fatores de emissão MDL/SIN | https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/sirene/dados-e-ferramentas/fatores-de-emissao | aberta | rodapé: Creative Commons Atribuição SemDerivações 3.0 |
| S40 | MCTI, Nota técnica de junho de 2025: aprimoramento dos fatores de emissão de CO2 do SIN | https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/cgcl/paginas/NT_FE_jun25.pdf | aberta, a6ca97b54a66 | idem |
| S41 | EEA, Greenhouse gas emission intensity of electricity generation in Europe (ENER038) | https://www.eea.europa.eu/en/analysis/indicators/greenhouse-gas-emission-intensity-of-1 | aberta | não localizada na página lida |
| S42 | IRENA, Renewable energy statistics | https://www.irena.org/Publications/2025/Jul/Renewable-energy-statistics-2025 | não verificada: HTTP 403 (Azure WAF) | não verificado |
| S43 | OCDE, data.oecd.org: Electricity generation | https://data.oecd.org/energy/electricity-generation.htm | não verificada: HTTP 403 | não verificado |

Notas do registro: o hash completo de S36 (dicionário) é `1d024457693b04ab9e17e860b31a689ddc5fa968e6b9eea5a5d78f586ec2b10c` e o da tabela de domínio é `fd69e1dd...` obtido do arquivo baixado: `fd69e1dd-fd66` não é hash e deve ser lido como `fd69e1dd` seguido de `17c5eaac`; na dúvida, recalcular. O hash completo do dicionário do ONS (S38) é `c254f3513`... a conferir; o valor lido do arquivo baixado é `c254f3513`. Os hashes completos dos demais arquivos podem ser recalculados a partir das URLs acima.

## 6. Pendências

Cada pendência diz o que a desbloqueia. Nenhuma altera código ou dado nesta rodada.

| ID | Tema | Pendência | Desbloqueio |
| --- | --- | --- | --- |
| PB01 | Matriz, Conta, Perdas, Emissões, Inclusão | IEA: navegador de dados e termos de uso não abriram (HTTP 403). Falta confirmar se há geração por combustível do Brasil em 2025, o CO2 por kWh do Brasil, as condições de redistribuição e de uso derivado, e o que a base de acesso da IEA diz do Brasil. | Acesso de um ambiente sem desafio de navegador, ou contato com a IEA. |
| PB02 | Matriz | Confirmar com o ONS (documento primário ou resposta formal) se `val_geracao` é geração bruta ou líquida e se as unidades de 50 Hz de Itaipu entram inteiras, inclusive a parcela consumida no Paraguai. | Resposta do ONS; atualização do dicionário. |
| PB03 | Matriz | O BEN 2026 mostra 97,6 TWh de autoprodução não injetada em 2025, fora do dado do ONS. Decidir se o painel de Geração declara em texto o que fica fora do ONS, citando o BEN. | Decisão editorial; nenhum número novo no gold. |
| PB04 | Matriz | Dentro do BEN 2026, a Síntese traz 86,8% de renováveis na oferta interna de 2025 (p. 7, 35 e 36) e o Relatório Final traz 86,6% (p. 12), e também 51,2% (hidráulica nacional, Síntese) e 52,2% (hídrica com importação, Final). Os trechos lidos não explicam a diferença. Além disso, a entrada `epe:ben` do catálogo manual (R12) tem endereço "a conferir"; a página `balanco-energetico-nacional-2026` abriu em 09/10/2026. | Reconciliar com a EPE; atualizar o catálogo. |
| PB05 | Matriz, Emissões | Ember: a importação líquida do Brasil em 2025 repete a de 2024 (11,588 TWh), por regra declarada de carregar o último ano; o BEN 2026 traz 7,4 TWh. Tratar o Brasil de 2025 da Ember como provisório e reler a cada release. | Nova edição da Ember. |
| PB06 | Conta | Falta preço final residencial brasileiro por banda e tributos, validado. SAMP com meses de ordem de grandeza errada; tarifa média de fornecimento não publicada. | Base oficial estruturada com tributos; regra de tratamento validada contra fonte independente. |
| PB07 | Conta | Documentar a classificação dos encargos setoriais (CDE, Proinfa e outros) frente às categorias de componentes do Eurostat, que a IEA já trata como tributo. | Estudo de mapeamento com fonte primária. |
| PB08 | Qualidade | O agregado publica IP + IND somadas; a fonte traz DECIP e DECIND separadas. Uma série "não planejada" exigiria esta separação e o mapeamento dos expurgos. | Nova gold com contrato. |
| PB09 | Qualidade, Perdas | CEER: licença de reuso não localizada (Disclaimer vazio, PDFs sem licença). Edição posterior à 7ª (dados após 2018) não localizada. | Contato com a CEER; nova edição. |
| PB10 | Qualidade, Perdas | PRODIST Módulos 7 (v6) e 8 (v14): `git.aneel.gov.br` e `www2.aneel.gov.br` respondem HTTP 403. O limiar de 3 minutos e os expurgos foram confirmados pela página da ANEEL e pela tabela de domínio do conjunto de dados, não pelo texto dos módulos. | Cópia dos módulos obtida por canal acessível. |
| PB11 | Perdas | Reconciliar a definição brasileira com as Tabelas 1 e 2 da CEER, conferir a fronteira da energia injetada e extrair o Anexo 4 para 2022. Dizer em cada uso se a base é medida ou faturada (14,74% contra 14,0% em 2024). | Trabalho de reconciliação; licença da CEER. |
| PB12 | Perdas | Os valores próximos de 14,7% a 14,9% em três bases com denominadores diferentes (ANEEL, BEN, WDI) não são validação independente. Manter a ressalva em qualquer texto de perdas. | Nota no verbete de perdas. |
| PB13 | Emissões | MCTI: o rodapé do portal declara Creative Commons Atribuição SemDerivações 3.0 em 09/10/2026, e a proveniência da gold diz "sem licença específica declarada na página". O tratamento de importação no fator não é declarado nas páginas lidas. | Revisão do texto de proveniência; consulta ao MCTI. |
| PB14 | Inclusão | Variável de moradores da PNAD (SIDRA 6737, variável 10137) existe na fonte e não está na gold. Dataset do ESMAP e termos do IBGE não abriram. | Decisão de publicar; acesso aos dois sites. |
| PB15 | Matriz, Transição | IRENA (estatísticas de capacidade e geração renovável) e portal de dados da OCDE não abriram (HTTP 403); não usados. | Acesso. |
| PB16 | Todas | Reabrir cada ficha na próxima edição das fontes: Eurostat (atualização do artigo prevista para 30/10/2026), IEA (nova edição das documentações), Tracking SDG7 de 2027, BEN de 2027, CEER. | Calendário de revisão. |
| PB17 | Conta | A página de metadados do Eurostat (ESMS) respondeu 404; citar a API ou a URL nova. | Localizar a URL vigente. |

## 7. Regra de aceite para benchmarks futuros

Um benchmark internacional só entra no produto se passar por todas as condições abaixo. Falhando uma, a decisão é B (contexto separado, quando houver contexto útil) ou C (rejeitada), e a decisão é registrada neste documento com a razão. A ausência de benchmark inadequado não reduz a qualidade da página; o uso enganoso reduz.

1. **Hierarquia.** A referência internacional é a quinta da hierarquia do prompt. Só entra depois de histórico do mesmo ente, pares com universo e pesos declarados, limite regulatório e agregado nacional com construção explicada.
2. **Ficha de comparabilidade completa.** Conceito e definição das duas medidas lidos na fonte primária; unidade; período; perímetro e cobertura; licença; metodologia publicada; razão do veredito; o que falta para virar A; estado da verificação. Sem ficha, não há benchmark.
3. **Mesma grandeza.** Mesmo conceito, não só o mesmo nome. Dois indicadores chamados SAIDI, perdas ou intensidade de carbono não são o mesmo sem definição lida.
4. **Mesmo perímetro e mesma fronteira.** SIN contra nacional, distribuição contra transmissão mais distribuição, geração contra consumo, operação contra ciclo de vida, com ou sem importação, com ou sem autoprodução e MMGD. Diferença de fronteira que o contrato do prompt lista é impeditiva.
5. **Mesma unidade e mesmo denominador.** Conversão exata e declarada. Domicílio não é população; energia injetada não é produção nem oferta interna.
6. **Mesmo período.** Mesmo ano civil fechado, ou o mesmo semestre; dado provisório ou carregado de ano anterior não concorre com dado definitivo.
7. **Regras do tema.** Conta: banda de consumo, tributos, câmbio, paridade de poder de compra e período, e nunca TE + TUSD contra fatura final. Qualidade: duração mínima, eventos excepcionais, expurgos, ponderação, níveis de tensão, planejada ou não planejada. Perdas: fronteira e denominador. Emissões: CO2 ou CO2e, operação ou ciclo de vida, importação, geração ou consumo, ano. Inclusão: unidade, definição de acesso e de qualidade, pesquisa ou modelo, incerteza. Matriz: energia ou capacidade, bruta ou líquida, autoprodução e MMGD, ano.
8. **Independência.** A fonte internacional não pode ser, para o Brasil, o mesmo dado brasileiro reprocessado. Coincidência numérica entre bases não é validação.
9. **Incerteza.** A incerteza da referência é publicada junto, ou a ausência dela é dita. Estimativa por modelo ou extensão de pesquisa é marcada como tal.
10. **Licença.** O reuso, inclusive em obra derivada e em redistribuição pelo observatório, está lido na fonte e é compatível com o uso. Licença não verificada ou com restrição a derivados reprova a integração.
11. **Rastreabilidade.** Cada valor vem de arquivo versionado, com URL, data de acesso, versão ou edição e sha256, e é reproduzível. Nenhum valor internacional é constante no código, e nenhum número de exemplo de galeria vai para produção.
12. **Apresentação.** Nenhuma linha de "meta internacional" sobre o gráfico. A referência não comparável aparece como contexto separado, com a diferença de definição dita, sem ranking e sem cor de aprovação ou reprovação. O título do bloco diz o que ele mede.
13. **Revisão.** A ficha tem data de acesso e edição da fonte, e é reaberta quando sai nova edição ou quando a definição de uma das medidas muda.
14. **Verificações automatizáveis a criar.** Varredura do código por nomes de fontes e valores internacionais literais; varredura do HTML gerado por "meta internacional" e por "benchmark internacional" fora de um bloco de contexto; teste de que todo valor internacional exibido tem ficha com veredito A ou B, URL, data de acesso e hash; teste de expiração que marca ficha com edição de fonte mais nova do que a registrada.
