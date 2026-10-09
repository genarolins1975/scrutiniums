# Comparações e benchmarks do observatório de energia

## 1. Resumo

| Tema | Medida do observatório | Candidata internacional | Veredito | O que falta para virar A |
| --- | --- | --- | --- | --- |
| Matriz | Participação de cada uma de 12 categorias na geração do Sistema Interligado Nacional (SIN), em % e em MWmed (ONS, Geração por Usina em Base Horária). Ano civil de 2025 sem micro e minigeração distribuída (MMGD) e janela de 365 dias até 29/09/2026. | IEA, geração por fonte (Electricity Information e World Energy Balances). Alternativas abertas lidas: Ember e Balanço Energético Nacional (BEN) 2026 da EPE, ambas CC BY 4.0. | B | Painel anual nacional próprio, nunca sobre o gráfico do SIN, com geração bruta, autoprodução, MMGD e Itaipu definidas. O ONS não declara se a geração é bruta ou líquida. Dados e termos da IEA não abriram (HTTP 403). |
| Conta | TE + TUSD de aplicação da classe B1 residencial convencional, sem tributos, bandeira e iluminação pública, em R$/MWh e em R$/mês para 100, 200 e 300 kWh/mês. Referência 30/09/2026. | Eurostat (preço final residencial, semestral, por banda de consumo) e IEA Energy Prices (média anual com tributos). | C | Preço final brasileiro por banda, com tributos e bandeira, validado (o observatório não publica a tarifa média de fornecimento); classificação dos encargos setoriais nas categorias do Eurostat; paridade de poder de compra e câmbio com fonte; fonte harmonizada que inclua o Brasil (o Eurostat não inclui). |
| Qualidade | DEC e FEC apurados (parcelas IP + IND), interrupções de 3 minutos ou mais, ponderados por unidade consumidora (UC). 2025: 9,33 h e 4,69 interrupções por UC. | SAIDI e SAIFI de reguladores: CEER e ECRB (7º Relatório, 39 países, dados de 2010 a 2018) e EIA (Estados Unidos). | C | Série brasileira de interrupções não planejadas com todos os eventos (separar IP de IND); mapeamento dos expurgos para a definição de cada país; dados europeus posteriores a 2018; licença da CEER. |
| Perdas | Perdas totais medidas na distribuição sobre a energia injetada de referência, razão de somas das concessionárias. 2025: 14,75% (51 concessionárias). | CEER, 3º Relatório de Perdas (distribuição, % da energia injetada, 40 países, ano 2022). | B, condicionado à licença da CEER | Reconciliar a definição brasileira com as Tabelas 1 e 2 e com a energia injetada da CEER, extrair a Tabela 22 (2022) e confirmar a licença. Perdas de transmissão e distribuição somadas (Banco Mundial, IEA, BEN) não servem. |
| Emissões | Fator médio de CO2 do SIN publicado pelo MCTI. 2025: 0,0461 tCO2/MWh (46,1 g/kWh), só CO2, operação das usinas. | Ember (CO2e, ciclo de vida), IEA Emission Factors (CO2 de combustão) e EEA (CO2e de combustão, União Europeia). | C | Dado da IEA para o Brasil e termos de uso; perímetro nacional reconciliado com o SIN; mesmo gás e mesma fronteira; tratamento de importação declarado pelo MCTI. |
| Inclusão | Percentual de domicílios particulares permanentes com energia elétrica de qualquer fonte (PNAD Contínua anual, IBGE). 2025: 99,8%. | Acesso à eletricidade, % da população (Banco Mundial, WDI, que vem do Tracking SDG7). | C | Variável de moradores da PNAD (SIDRA 6737, variável 10137) para igualar a unidade; ano de pesquisa ou de modelo para o Brasil no dataset do ESMAP (HTTP 403); mesma definição de acesso. |

Resultado: nenhum tema chegou a A. Matriz e Perdas ficam em B (contexto separado, fora do gráfico, com a diferença de definição dita) e Conta, Qualidade, Emissões e Inclusão em C (rejeitadas). Nenhuma decisão admite linha de meta internacional sobre gráfico. Fichas inteiras "não verificadas": 0 de 6; as seis são "verificada com lacunas", e sete fontes ou documentos não abriram (estado "não verificada" na seção 5).

## 2. Como ler

* **Vereditos.** A: comparação direta, só se o contrato do prompt fechar em todos os critérios do tema. B: contexto separado, fora do gráfico, com a diferença de definição dita. C: rejeitada. A referência internacional é a quinta da hierarquia do prompt, depois de histórico do mesmo ente, pares com universo e pesos declarados, limite regulatório do próprio ente e agregado nacional explicitado. Por isso cada ficha diz qual referência nacional sustenta a leitura.
* **Estado da verificação.** "Verificada": as fontes que sustentam definições e licença foram abertas. "Verificada com lacunas": as definições foram abertas, mas algum item (dado em formato de consulta, licença, texto normativo) não foi, e a lacuna está listada. "Não verificada": a fonte primária da medida internacional não foi aberta nem na definição. Nenhuma ficha cai neste último caso.
* **Base de leitura.** Repositório `scrutiniums`, branch `claude/kind-mayer-v9tpwi`, lido no commit `61d043b58`. Em 09/10/2026 o HEAD é `f6a747f5b` e a árvore de trabalho tem edições de `src` de outras frentes, não lidas aqui. Entre os dois commits nenhum arquivo de `public/energia`, `pipeline/energia` ou `docs/observatorios/energia` mudou (conferido com `git diff`). Os golds citados foram gerados entre 30/09/2026 e 06/10/2026 (seção 5.1). Em 09/10/2026 a busca por IEA, Eurostat, CEER, Banco Mundial, World Bank, Ember, IRENA, SE4ALL, SEforALL, SAIDI, SAIFI, OCDE e OECD (palavra inteira, com distinção de maiúsculas) em `src`, `pipeline/energia`, `pipeline/tests` e `public/energia/gold` não devolveu ocorrência: nenhum benchmark internacional existe no produto. Este documento não altera código, dados nem outros documentos.
* **Identificadores.** `R01` a `R13` são arquivos do repositório lidos; `S01` a `S47` são fontes externas, com URL, estado e reuso na seção 5. Todas as fontes externas foram acessadas em 09/10/2026. "p. N" é a página do arquivo PDF aberto, que pode diferir do número impresso (a p. 156 do Tracking SDG7 traz o número impresso 146).
* **Datas e números.** Datas no formato dd/mm/aaaa. Número internacional só aparece quando foi lido na fonte primária, com ano, unidade e referência, e vem sempre marcado "não plotar". Valor lido de gráfico em PDF foi conferido na imagem da página (BEN 2026, Síntese, p. 35, 36 e 38), porque a extração de texto pode trocar a ordem dos rótulos.
* **Ambiente de consulta.** Acesso pelo proxy HTTPS do ambiente, com curl, pdftotext e as APIs públicas do Banco Mundial, do Eurostat e do IBGE. Responderam HTTP 403 em 09/10/2026: iea.org, dados e termos (S05, S06); trackingsdg7.esmap.org (S24); termos de uso do IBGE (S26); git.aneel.gov.br e www2.aneel.gov.br (S37); irena.org (S42); data.oecd.org (S43). ben.epe.gov.br respondeu HTTP 500 (S47). Os PDFs de documentação da IEA, hospedados em `iea.blob.core.windows.net`, abriram.
* **Cadeias de origem lidas (para a regra de independência).** O BEN recebe do ONS e da CCEE o arquivo de geração e intercâmbio verificados do SIN, soma a coleta direta dos autoprodutores e estima a geração das usinas sem dado (S45, p. 33 a 35, edição 2022 do manual). O balanço do Brasil na IEA cita o MME e a EPE como fonte e reconhece diferenças em relação ao balanço nacional (S02, p. 343 e 345). A geração anual do Brasil na Ember vem do Energy Institute, e a importação líquida, da EIA (S08, p. 27); em 2024, total, hidráulica, eólica, solar, nuclear e gás natural da Ember coincidem com os do BEN 2026 (S09, S12, p. 41). As perdas de transmissão e distribuição do Banco Mundial vêm da IEA (S21, metadados). O acesso do Banco Mundial vem da Global Electrification Database, de pesquisas domiciliares e modelo (S21, S23, p. 156).
* **Siglas.** ACER: Agência da União Europeia para a Cooperação dos Reguladores de Energia. ANEEL: Agência Nacional de Energia Elétrica. BEN: Balanço Energético Nacional. CC BY: Creative Commons Atribuição. CCEE: Câmara de Comercialização de Energia Elétrica. CDE: Conta de Desenvolvimento Energético. CEER: Council of European Energy Regulators. CEG: Código Único do Empreendimento de Geração, da ANEEL. CV: coeficiente de variação. DEC e FEC: Duração e Frequência Equivalentes de Interrupção por Unidade Consumidora. EAR: energia armazenada nos reservatórios. ECRB: Energy Community Regulatory Board. EEA: Agência Europeia do Ambiente. EIA: U.S. Energy Information Administration. EPE: Empresa de Pesquisa Energética. ESMAP: Energy Sector Management Assistance Program. IBGE: Instituto Brasileiro de Geografia e Estatística. IEA: Agência Internacional de Energia. IPCA: Índice Nacional de Preços ao Consumidor Amplo. IVA: imposto sobre valor agregado. MCTI: Ministério da Ciência, Tecnologia e Inovação. MDL: Mecanismo de Desenvolvimento Limpo. MME: Ministério de Minas e Energia. MMGD: micro e minigeração distribuída. OCDE: Organização para a Cooperação e Desenvolvimento Econômico. ODbL: Open Database License. ODS 7: Objetivo de Desenvolvimento Sustentável 7. OMS: Organização Mundial da Saúde. ONS: Operador Nacional do Sistema Elétrico. PLD: Preço de Liquidação das Diferenças. PNAD: Pesquisa Nacional por Amostra de Domicílios. POF: Pesquisa de Orçamentos Familiares. PPS: padrão de poder de compra da União Europeia. PRODIST: Procedimentos de Distribuição. Proinfa: Programa de Incentivo às Fontes Alternativas de Energia Elétrica. REN: Resolução Normativa da ANEEL. SAIDI e SAIFI: duração e frequência médias de interrupção por cliente. SAMP: Sistema de Acompanhamento de Informações de Mercado para Regulação Econômica. SIDRA: Sistema IBGE de Recuperação Automática. SIN: Sistema Interligado Nacional. TE e TUSD: Tarifa de Energia e Tarifa de Uso do Sistema de Distribuição. TIEPI e NIEPI: tempo e número de interrupções equivalentes relacionados à potência instalada, usados na Espanha. UC: unidade consumidora. UNSD: Divisão de Estatística das Nações Unidas. WDI: World Development Indicators.
* **Referências de desenho.** O prompt cita o manual de visualização de dados do Office for National Statistics e o navegador de dados da IEA como referências de desenho. Elas não validam número nem elegibilidade de benchmark; aqui o navegador da IEA é tratado como fonte de dados e não abriu.
* **Regra editorial.** O observatório apresenta fatos, referências e limites; o leitor conclui. A ausência de benchmark inadequado não reduz a nota, e o uso enganoso reduz (R02, critério F).

## 3. Fichas de comparabilidade

### 3.1 Matriz: geração por fonte

**Veredito: B.** Nenhuma linha de referência internacional sobre o gráfico do SIN. Se a página quiser contexto internacional da matriz, ele entra em painel próprio, com medida nacional anual, na mesma base para o Brasil e para os demais países.

| Campo | Observatório | Referência internacional | Fecha? |
| --- | --- | --- | --- |
| Conceito e definição | Energia da categoria dividida pela energia de todas as categorias no mesmo período e região, em razão de somas, com e sem MMGD (`geracao_participacao`). Fonte: ONS, Geração por Usina em Base Horária, descrita como "Geração verificada de usinas, conjuntos de usinas e grupos de pequenas usinas em base horária" (R10, S38). | IEA: produção bruta é a energia produzida por todos os geradores, "measured at the output terminals of the main generators", de produtores de atividade principal e autoprodutores (S01, p. 15, 26 e 27). Ember: busca reportar toda a geração anual como bruta (S08, p. 10). BEN: energia hidráulica é a produção bruta medida nas centrais hidrelétricas (S45, p. 33). | não |
| Unidade | MWmed e % da geração (R10). | GWh na IEA (S01, p. 7); TWh e % na Ember (S09); TWh no BEN (S13). | sim, com conversão por horas |
| Período | Dias completos de 01/01/2021 a 29/09/2026; ano civil de 2025 completo; janela de 365 dias de 30/09/2025 a 29/09/2026 (R04). | IEA: de 1971 a 2024, mais 2025 provisório para produção bruta, oferta e demanda agregada (S01, p. 7). Ember: Brasil de 1985 a 2025 (S09). BEN 2026: ano base 2025 (S12). | em parte |
| Perímetro e cobertura | SIN e subsistemas: usinas com relacionamento com o ONS, conjuntos Tipo II C e grupos de pequenas usinas Tipo III (previsão do ONS, 5,72% da geração de 2025), mais a MMGD estimada pelo ONS desde 29/04/2023 (8,45% em 2025) (R04, S38). A autoprodução não injetada na rede não faz parte do SIN; a EPE a obtém por coleta direta (S45, p. 34). | IEA: nacional, com autoprodutores (S01). BEN 2026: geração de 775,9 TWh em 2025, dos quais 176 TWh de autoprodução, e desses 97,6 TWh não injetados na rede (S13, p. 11). A matriz elétrica do BEN inclui o SIN, os sistemas isolados e a autoprodução não injetada; a "geração centralizada" exclui isolados, importação, autoprodução não injetada e MMGD (S12, p. 35). | não |
| Energia ou capacidade | Energia. A participação de geração não se compara com a de capacidade instalada (R10). | Energia. | sim |
| Bruta ou líquida | O dicionário do ONS (versão 1.2, 09/06/2023) não declara. O módulo escreve "geração bruta verificada" numa nota sobre usinas nucleares, sem fonte primária (S38, R04). | Bruta na IEA (S01, p. 15), na Ember anual (S08, p. 10) e no BEN, para a hidráulica (S45, p. 33). A Ember usa fatores de emissão de geração líquida e, onde reporta geração bruta, ajusta os fatores em 6% para fontes térmicas e 1% para as demais (S08, p. 15). | não verificada |
| Autoprodução e MMGD | MMGD entra como estimativa do ONS (8,45% da geração de 2025). O dicionário do conjunto não tem campo que marque autoprodutor (S38), e a autoprodução não injetada não faz parte do SIN. | IEA inclui autoprodutores (S01, p. 27). O BEN inclui MMGD e autoprodução não injetada (S12, p. 35; S13, p. 11). | não |
| Mesmo ano | O ano civil de 2025 traz participação sem MMGD (62,88% de hidráulica); o MWmed do ano inclui a MMGD estimada, e a participação com MMGD existe para as janelas de 1, 7, 30 e 365 dias (R04). | BEN: 2025 completo. Ember: 2025, com importação carregada do ano anterior (PB06). IEA: 2025 provisório e agregado (S01, p. 7). | em parte |
| Licença e reuso | ONS: Creative Commons Atribuição (CC BY), declarada no portal (S38). | IEA: "All rights reserved", dados sujeitos a termos em iea.org/terms, que não abriu (S01, S06). Ember: CC BY 4.0, livre para compartilhar e adaptar com crédito (S10); a cadeia de direitos dos dados de terceiros não foi verificada. EPE: CC BY 4.0 no rodapé do portal (S11, S44). | Ember e EPE: sim; IEA: não verificada |
| Metodologia publicada | Dicionário do ONS e regras do módulo (S38, R04). | IEA: documentações de julho e de abril de 2026 (S01, S02). Ember: PDF de metodologia (S08). BEN: relatório final e Manual Metodológico, edição 2022, sem confirmação de aplicação ao BEN 2026 (S13, S45). | sim |

Valores lidos, só para documentar perímetro (não plotar, não são benchmark):

| Base | Ano | Grandeza | Valor |
| --- | --- | --- | --- |
| ONS via gold do observatório (R04) | 2025 | Hidráulica, % da geração do SIN, sem MMGD | 62,88% |
| BEN 2026, Síntese, p. 36 (S12) | 2025 | Hidráulica, % da oferta interna de eletricidade (a importação, 0,9%, aparece à parte) | 51,2% |
| BEN 2026, Relatório Final, p. 12 (S13) | 2025 | Fonte hídrica, % da oferta interna, considerando a importação de Itaipu | 52,2% |
| Ember, CSV anual (S09) | 2025 | Hídrica, % da geração total do Brasil (763,673 TWh) | 52,103% |
| BEN 2026, Síntese, p. 35 (S12) | 2025 | Renováveis na oferta interna de eletricidade | 86,8% |
| BEN 2026, Síntese, p. 35 (S12), figura com "Fonte: EPE; Agência Internacional de Energia" | 2023; 2024 | Renováveis na matriz elétrica, Mundo (2023) e OCDE (2024) | 30,6%; 35,4% |
| Arquivo `geracao_capacidade_usina_mensal.csv` (R11) | 12/2024 | Grupo "ITAIPU 50 HZ + ITAIPU 60 HZ", 14.000 MW | 5.615.678,5 MWh no mês |

As bases diferem em perímetro (SIN, oferta interna com importação, geração nacional bruta). A diferença numérica não foi decomposta. A Ember informa que, no Brasil, a bioeletricidade "is generally not scheduled by ONS, so is underreported in monthly data" (S08, p. 27). Na mesma figura, a EPE põe Brasil (2025, 2024 e 2023), Mundo (2023) e OCDE (2024) lado a lado, em anos diferentes; o dado internacional vem da IEA, que não foi aberta.

**Razão do veredito.**

* O contrato do prompt exige energia contra capacidade, geração bruta ou líquida, autoprodução e MMGD, e mesmo ano. O primeiro fecha. O segundo não fecha para o ONS, que não declara. O terceiro não fecha: SIN com relacionamento com o ONS contra geração nacional com autoprodução não injetada e MMGD de outra origem.
* Itaipu. IEA e Ember descrevem a produção como dividida igualmente entre Brasil e Paraguai (S02, p. 345; S08, p. 27), e o BEN diz que quase toda a importação vem de Itaipu (S13, p. 12). O arquivo do observatório soma as unidades de 50 Hz e 60 Hz do mesmo CEG. A Ember descreve que, no dado mensal, cada país informa a energia que consumiu da usina (S08, p. 27); o que o ONS informa não foi verificado.
* O SIN do ONS e a geração nacional são medidas diferentes por construção. Plotar o número nacional como referência sobre o gráfico do SIN sugeriria desvio onde há diferença de perímetro.
* Independência. Em 2024 o total, a hidráulica, a eólica, a solar, a nuclear e o gás natural da Ember para o Brasil são iguais aos do BEN 2026 (S09; S12, p. 41), e o BEN é alimentado pelo ONS. Concordância entre essas bases não confirma o dado do ONS.

**O que falta para virar A.** Um módulo anual nacional (BEN, EPE) com geração por fonte em TWh, bruta ou líquida declarada, autoprodução e MMGD separadas; resposta do ONS sobre bruta ou líquida e sobre Itaipu; leitura do dado e dos termos da IEA para o Brasil por combustível em 2025; mesmo ano civil fechado nas duas bases. A "geração centralizada" do BEN, que exclui isolados, importação, autoprodução não injetada e MMGD, é o recorte do BEN mais próximo do SIN sem MMGD, mas os dois perímetros não foram reconciliados. Mesmo assim o painel do SIN não se torna A: só a série nacional anual poderia.

**Dado público adequado e integração.** BEN: séries históricas de 1970 a 2025 em planilhas, CC BY 4.0 no rodapé (S44). Ember: CSV anual aberto, CC BY 4.0, com o Brasil de 1985 a 2025 (S07, S09, S10). O Anexo III do BEN, "Dados Mundiais de Energia", cita a IEA (Key World Energy Statistics 2020) e traz rankings de 2018 e 2019, e não serve de referência para 2025 (S46). IEA: restrita, não verificada. Integração viável, de porte médio (novo módulo anual), fora do escopo desta rodada.

**Referência nacional que sustenta a leitura.** Histórico do próprio SIN em janelas de 7, 30 e 365 dias e por ano civil desde 2021, com a natureza medida, prevista e estimada ao lado (R04).

**Condições de exibição se o contexto for adotado.** Painel próprio, com título que diga "geração nacional anual"; Brasil e demais países da mesma base e do mesmo ano civil fechado; definição dita (bruta, com autoprodução e MMGD, fronteira nacional); nenhum valor do SIN do ONS ao lado; valores lidos de arquivo versionado com URL, data de acesso e SHA 256, nunca constantes no código; critério de ordenação escrito.

**Estado da verificação: verificada com lacunas.** Não verificados: dado e termos da IEA (S05, S06; HTTP 403), IRENA (S42; HTTP 403), portal de dados da OCDE (S43; HTTP 403), bruta ou líquida e Itaipu no ONS. Fontes: S01, S02, S05 a S13, S38, S42 a S46, R04, R10, R11.

### 3.2 Conta: preços ao consumidor

**Veredito: C.** Nenhuma fonte aberta cobre o Brasil com preço final por banda de consumo e tributos declarados. A que cobre o Brasil usa uma grandeza que o observatório não publica.

| Campo | Observatório | Referência internacional | Fecha? |
| --- | --- | --- | --- |
| Conceito e definição | Tarifa de aplicação TE + TUSD homologada pela ANEEL para o subgrupo B1, subclasse residencial, modalidade convencional, na vigência que cobre a data de referência (`conta_tarifa_b1_aplicacao`); o custo do perfil é o consumo do perfil vezes essa tarifa (`conta_custo_perfil`). A tarifa média de fornecimento é "Receita de fornecimento dividida pela energia vendida" e "Não é calculada neste módulo" (R05, R10). | Eurostat: preço final ao domicílio, que inclui "the basic price of electricity, transmission and distribution charges, meter rental, and other services" e, no nível de tributação final, tributos, encargos e IVA (S15). IEA, para o Brasil: "Tarifa média de fornecimento com tributos" publicada pela ANEEL, média anual, com PIS/Cofins e ICMS (S04, p. 439). | não |
| Unidade | R$/MWh e R$/mês (R05). | Eurostat: euro, PPS e moeda nacional, por kWh (S14). IEA: moeda nacional (S04). | em parte |
| Período | Vigência na data de referência, 30/09/2026 (R05). | Eurostat: média de seis meses, de janeiro a junho e de julho a dezembro; o conjunto traz períodos até 2026 S1 (S14, S15). IEA: média anual (S04, p. 439). | não |
| Perímetro e cobertura | 81 distribuidoras com vigência na data, de 115 CNPJs com tarifa B1 residencial no conjunto; 34 ficam fora (R05). | Eurostat: 43 entidades geográficas (dois agregados e 41 países: Estados membros da União Europeia, Islândia, Liechtenstein, Noruega, Reino Unido e países candidatos ou vizinhos), nenhuma das Américas (S14). IEA: 147 países, com o Brasil, e detalhamento da tributação só para membros da OCDE (S04, p. 3). | não |
| Banda de consumo | Perfis de 100, 200 e 300 kWh/mês, isto é, 1.200, 2.400 e 3.600 kWh/ano, que caem nas bandas DB, DB e DC do Eurostat (DB: de 1.000 a 2.499 kWh/ano; DC: de 2.500 a 4.999) (R05, S14). | Eurostat: cinco bandas, DA a DE; o artigo do Eurostat usa a DC (S15). ACER: o relatório de varejo de 2025 usa a banda DC, e o documento de 2026 usa a média de todas as bandas domiciliares (S18, p. 19 a 21; S19, p. 20). IEA: média anual do setor residencial, sem banda (S04). | em parte |
| Tributos | Sem ICMS, PIS/Pasep, Cofins, contribuição de iluminação pública e bandeira. Os encargos setoriais (CDE, Proinfa e outros) já estão dentro da TE e da TUSD (R05). | Eurostat: três níveis (sem tributos e encargos; sem IVA e tributos recuperáveis; todos incluídos) e componentes separados, entre eles tributos de renováveis, de capacidade, ambientais e nucleares (S14). IEA: trata Proinfa e CDE como "Renewable Energy Supply tax", sem valores específicos (S04, p. 439). | não |
| Moeda e poder de compra | R$ nominais e em reais do último mês com IPCA; sem conversão cambial nem paridade de poder de compra (R05, R10). | Eurostat oferece euro, PPS e moeda nacional (S14). Para o Brasil a paridade teria de vir de outra fonte, como o fator de conversão do consumo das famílias do Banco Mundial, indicador PA.NUS.PRVT.PP (S21). | não |
| Licença e reuso | ANEEL: ODbL no conjunto de tarifas; rodapé das páginas gov.br com Creative Commons Atribuição SemDerivações 3.0 (R05, S34). | Eurostat: reuso comercial e não comercial autorizado com citação da fonte; modificações nos dados devem ser declaradas, com aviso de não responsabilidade (S16). IEA: termos não verificados (S06). GlobalPetrolPrices: Creative Commons Atribuição, Uso Não Comercial, Sem Derivações 3.0 (S20). | Eurostat: sim; IEA: não verificada; GlobalPetrolPrices: não |
| Metodologia publicada | Sim, na gold e no módulo (R05). | Eurostat: artigo e API, com rótulos de bandas, níveis de tributação e componentes (S14, S15); a página de metadados respondeu 404 (S17). IEA: documentação (S04). GlobalPetrolPrices: banda e ponderação não constam da página (S20). | em parte |

**Razão do veredito.**

* TE + TUSD não é fatura final, e o prompt proíbe compará-la com ela. O preço do Eurostat é final por definição.
* O candidato que cobre o Brasil na IEA é a tarifa média de fornecimento com tributos, grandeza que o observatório não publica. A alternativa avaliada, o SAMP, traz meses isolados com valores declarados com erro de ordem de grandeza (três meses atípicos da CEMIG-D, de 9,7 a 10,8 vezes a mediana dos outros meses) (R05).
* Os encargos setoriais brasileiros estão dentro da tarifa; na base de tributação da IEA, Proinfa e CDE formam uma categoria de tributo. A classificação muda o que "sem tributos" significa.
* Dois documentos da ACER de anos consecutivos usam critérios diferentes (banda DC em 2025, média de todas as bandas em 2026), o que mostra que a banda faz parte da definição.
* GlobalPetrolPrices publica um preço residencial do Brasil (coleta de março de 2026, com tributos; fontes ANEEL, Cemig D, CPFL Energia, Enel Brasil e Light), mas a licença proíbe obras derivadas e a página não declara banda nem ponderação (S20). O estudo anterior do projeto já registrava que dados proprietários de HEPI e VaasaETT não podem ser reutilizados e que a comparação internacional exige fonte aberta e perfis equivalentes (R01).

**O que falta para virar A.** Preço final residencial brasileiro por distribuidora para uma banda definida, com tributos e bandeira, validado contra fonte independente; classificação documentada dos encargos setoriais nas categorias do Eurostat; paridade de poder de compra e câmbio com fonte e período; mesmo semestre; uma fonte harmonizada que inclua o Brasil. Em 09/10/2026 nenhum desses itens existe.

**Dado público adequado e integração.** Eurostat é aberto e de reuso autorizado, mas não tem o Brasil. A base da IEA tem o Brasil, com termos não verificados e grandeza diferente. Integração inviável nesta rodada.

**Referência nacional que sustenta a leitura.** Mediana, quartis e extremos entre as 81 distribuidoras com vigência na data (pares, com universo e sem ponderação) e a mediana mensal nominal e real desde fev/2010 (R05).

**Estado da verificação: verificada com lacunas.** Não verificados: termos da IEA (HTTP 403); tarifa média de fornecimento da ANEEL (não aberta); metadados do Eurostat (404, substituídos pela API). Fontes: S04, S14 a S22, R01, R05, R10.

### 3.3 Qualidade: SAIDI e SAIFI

**Veredito: C.** O próprio regulador europeu avisa que a falta de harmonização pode levar a interpretação enganosa em relatórios de benchmark. Os dados europeus lidos param em 2018, e o apurado brasileiro soma parcelas programadas e não programadas.

| Campo | Observatório | Referência internacional | Fecha? |
| --- | --- | --- | --- |
| Conceito e definição | DEC: média mensal do DEC dos conjuntos ponderada pelas UCs de cada conjunto no mês, somada nos 12 meses; FEC igual (`qualidade_dec_distribuidora`, `qualidade_fec_distribuidora`). O apurado desde 2022 é a soma das parcelas interna programada e interna não programada não expurgável (IP + IND) (R06, R10). | SAIDI: média anual da duração acumulada de interrupções por cliente atendido; SAIFI: média anual do número de interrupções por cliente (S29, nota 1). O relatório europeu trata separadamente interrupções planejadas e não planejadas e, entre as não planejadas, os recortes com todos os eventos e sem eventos excepcionais (S27, p. 8). | não |
| Unidade | Horas e centésimos de hora por UC (9,33 h são 9 h 20 min, não 9 h 33 min); interrupções e centésimos por UC (R06). | Minutos por cliente por ano (S27, p. 51). EIA: minutos por ano (SAIDI) e vezes por ano (SAIFI), para interrupções não momentâneas (S32). | em parte |
| Período | Ano civil de 2025 completo (R06). | 7º Relatório CEER e ECRB (referência C22-EQS-103-03, publicado em 22/12/2022): séries de continuidade de 2010 a 2018 (S27, p. 51). A busca de publicações no site da CEER em 09/10/2026 devolve o 7º relatório como a edição mais recente (S27). EIA: série anual até 2024 (S32). | não |
| Perímetro e cobertura | Todos os conjuntos com indicador (3.150 em 2025, com 92,6 milhões de UCs em média no ano). Brasil é o total das distribuidoras com indicadores publicados, inclusive permissionárias (9,33 h); o universo que a ANEEL divulga, só concessionárias, dá 9,30 h e 4,66 interrupções, com 51 delas (R06). | CEER e ECRB: 39 países da região que as duas entidades cobrem, e os níveis de tensão incluídos variam por país e por indicador (S27, p. 14 e 44). O Brasil não consta do relatório (busca de texto sem ocorrência). EIA: concessionárias dos Estados Unidos que reportam pela Form EIA 861 (S32). | não |
| Duração mínima | Interrupções de duração "maior ou igual a 3 minutos" (S34). O conjunto de dados traz DEC e FEC de 3 minutos e também de 1 minuto (Dec1, Fec1); o observatório usa os de 3 minutos (S36, R06). | Em geral "longer than three minutes but there are exceptions" (S27, p. 14); a fronteira é "mais de" 3 minutos na CEER e "maior ou igual a" 3 minutos na ANEEL. EIA: interrupções não momentâneas, sem limiar dito na página (S32). | em parte |
| Eventos excepcionais e expurgos | Expurgadas do apurado: situação de emergência (INE), dia crítico (INC e IPC), origem externa (XN, XP, XNC e XPC) e racionamento ou alívio de carga pelo ONS (INO). O DEC de todas as origens publicadas foi 17,20 h em 2025, contra 9,33 h do apurado (R06, S36). | "The individual definitions, however, are far from harmonised" (eventos excepcionais, por causa ou por critério estatístico) (S27, p. 35, 47 e 48). O CEER 6.1 diz que o SAIDI não planejado com todos os eventos "is possibly more reliable for benchmarking because of significant differences in definitions of exceptional events across Europe" (S28, p. 7). EIA: dia de grande evento é o que excede o limiar diário Tmed, calculado dos últimos cinco anos, nas concessionárias que seguem o IEEE 1366; nas demais, o evento é definido pela própria concessionária (S32). | não |
| Ponderação | Por UC do conjunto no mês, soma dos meses; limite global ponderado pelas UCs médias do ano (R06, S34). | Maioria dos países pondera por clientes. Espanha usa TIEPI e NIEPI (TIEPI também em Portugal), ponderados pela potência instalada ou contratada, no lugar de SAIDI e SAIFI. "The weighting impacts the results" (S27, p. 35 e 44). | em parte |
| Planejada ou não planejada | O agregado publicado soma IP e IND. A fonte traz DECIP e DECIND separadas, mas as séries do observatório não (R06, S36). | Separadas nos indicadores europeus (S27, p. 8). | não |
| Licença e reuso | ANEEL: ODbL no conjunto (S36). | CEER: licença não declarada nos PDFs lidos, e a página Disclaimer do site não tem texto (S31). EIA: domínio público, com citação sugerida (S33). | CEER: não verificada; EIA: sim |
| Metodologia publicada | Dicionário do conjunto (versão 1.0, 06/06/2022) e tabela de domínio dos indicadores (S36). PRODIST Módulo 8, versão 14, listado como vigente na página do PRODIST; texto não aberto (S37). | CEER: relatórios e nota de comparabilidade (S27 a S29). EIA: notas da Tabela 11.1 (S32). | em parte |

Valores lidos (não plotar, não comparar entre países):

| Base | Medida | Ano | Valor |
| --- | --- | --- | --- |
| Observatório (R06) | DEC apurado (IP + IND), Brasil, todas as distribuidoras | 2025 | 9,33 h |
| Observatório (R06) | DEC de todas as origens publicadas | 2025 | 17,20 h |
| EIA, Tabela 11.1 (S32) | SAIDI, método IEEE, Estados Unidos, todos os eventos | 2024 | 662,6 min por ano |
| EIA, Tabela 11.1 (S32) | SAIDI, método IEEE, Estados Unidos, sem dias de grande evento | 2024 | 131,6 min por ano |

Os dois pares mostram que a escolha do recorte de eventos faz parte da definição da medida, no Brasil e nos Estados Unidos.

**Razão do veredito.**

* A CEER escreve que "there are many implementation factors which impinge on the comparability of reported indicator values" e que a falta de harmonização pode manter a possibilidade de "misleading interpretation of data in benchmarking reports" (S29). A mesma nota diz que as diferenças pesam mais para a comparação internacional do que para a regulação nacional por incentivos.
* O apurado brasileiro (IP + IND, depois de expurgos por categoria) não é o SAIDI não planejado com todos os eventos, que a CEER considera possivelmente mais confiável para comparar. Também não é o SAIDI sem eventos excepcionais, porque o conceito europeu depende de definições nacionais não harmonizadas.
* A unidade (horas com centésimos contra minutos) convida a erro de leitura, e a fronteira de duração difere (3 minutos ou mais contra mais de 3 minutos).
* Os dados europeus de continuidade lidos no 7º relatório vão até 2018. O observatório publica 2025.

**O que falta para virar A.** Série brasileira "não planejada, todos os eventos, 3 minutos ou mais" derivada das parcelas da fonte (IND, INE, INC, INO, XN e XNC; sem IP, IPC, XP e XPC), com a mesma ponderação e contrato publicado; segunda série "sem eventos excepcionais" com mapeamento explícito de cada parcela expurgada para a definição de cada país comparado, que a CEER diz não ser harmonizada; dados europeus do mesmo ano; níveis de tensão alinhados; licença da CEER.

**Dado público adequado e integração.** CEER: tabelas em PDF, sem formato de dados aberto localizado, licença não verificada. EIA: Tabela 11.1 em domínio público, de um único país. Integração inviável nesta rodada.

**Reabrir quando.** Houver edição da CEER posterior à 7ª com dados depois de 2018 e a série brasileira não planejada existir. Uma nota explicativa sem valores (o que são SAIDI e SAIFI e por que não equivalem a DEC e FEC) pode entrar em Aprenda sem benchmark.

**Referência nacional que sustenta a leitura.** Limite do próprio ente: DEC e FEC contra o limite agregado da distribuidora e dos conjuntos no mesmo ano (em 2025, limite agregado de 10,87 h para o DEC e de 7,34 para o FEC) e histórico desde 2010 (R06).

**Estado da verificação: verificada com lacunas.** Não verificados: PRODIST Módulo 8, versão 14 (git.aneel.gov.br, HTTP 403) e licença da CEER (página sem texto). Fontes: S27 a S29, S31 a S34, S36, S37, R06, R10.

### 3.4 Perdas

**Veredito: B, condicionado à licença da CEER.** Contexto textual separado, com a faixa europeia da CEER para 2022 e a diferença de definição dita, só depois de confirmada a licença. As perdas de transmissão e distribuição somadas (Banco Mundial, IEA, BEN) ficam fora.

| Campo | Observatório | Referência internacional | Fecha? |
| --- | --- | --- | --- |
| Conceito e definição | "Energia injetada na rede da distribuidora que não chega a ser entregue como consumo medido: diferença calculada pela ANEEL no SAMP Balanço (valor medido)", dividida pela energia injetada de referência; razão de somas, nunca média de taxas (`perdas_totais_energia`, `perdas_taxa_total_injetada`) (R07, R10). | CEER: perdas são "the difference between injections and offtakes", em % da energia injetada, separadas em distribuição, transmissão e total (S30, p. 9, 13 e 18). Banco Mundial: perdas de transmissão e distribuição, com furto, como parcela da produção total (S21). BEN: linha de perdas na distribuição e armazenagem, que inclui linhas de transmissão e redes de distribuição de eletricidade (S13, p. 203). | CEER: em parte; Banco Mundial e BEN: não |
| Unidade | % da energia injetada e MWh (R07). | % da energia injetada (CEER); % da produção (Banco Mundial); % da oferta interna (BEN). | em parte |
| Período | Ano civil; série de 2003 a 2025 para concessionárias; 2022: 14,53% (52 concessionárias); 2025: 14,75% (51) (R07). | CEER: de 2013 a 2022, com 2022 como último ano com dado (S30, p. 19). Banco Mundial: até 2025 (S21). | CEER: sim para 2022 |
| Perímetro e cobertura | Distribuição das concessionárias com balanço no SAMP. A Rede Básica fica fora e é apurada pela CCEE (S35). O conjunto de distribuidoras somadas muda de ano para ano; há série de universo fixo de 16 distribuidoras de 2023 a 2025 (R07). | CEER: 40 países da região, sem o Brasil (busca de texto sem ocorrência); as definições de rede de distribuição e de transmissão não são padronizadas e os níveis de tensão diferem (S30, p. 8 e 14). | não |
| Fronteira e denominador | Energia injetada: "Energia inserida na rede para atender aos consumidores, incluindo as perdas". No leiaute de 2024 (REN 1.003/2022) a energia injetada publicada deixa de fechar o balanço com a perda da fonte, e o observatório usa a energia implícita no cálculo da fonte (fornecida + irregular + perdas); a causa da diferença não é atribuída (R07). | CEER: a energia injetada na distribuição inclui a repassada da transmissão e a gerada em redes de distribuição, para não contar energia duas vezes (S30, p. 9). Banco Mundial: o denominador é a produção total. BEN: o denominador não é dito em texto; a conta deste registro, (783,3 menos 667,8 TWh) sobre 783,3 TWh, dá 14,74% (S12, p. 38). | em parte |
| Base | Medida; a faturada fica nos CSV. Em 2024, 14,74% pela base medida contra 14,0% pela base faturada do relatório da ANEEL, "porque o faturado inclui custo de disponibilidade e compensação de MMGD" (R07). | CEER: injeções menos retiradas, medidas ou estimadas; 24 de 39 respondentes combinam medição e estimativa (S30, p. 16). | em parte |
| Perdas não técnicas | Furto (ligação clandestina, desvio direto da rede) ou fraude de energia, erros de medição e de faturamento (S35). | Componentes variam por país: perdas ocultas, consumo não medido, furto e outros (erros e diferenças de medição, faturamento e processamento de dados), conforme as Tabelas 1 e 2 do relatório; a Croácia não inclui iluminação pública (S30, p. 13 a 15). | em parte |
| Licença e reuso | ANEEL: ODbL no SAMP Balanço (R07). | CEER: não verificada (S31). Banco Mundial: Creative Commons Atribuição 4.0 no catálogo do WDI; a nota do indicador cita a IEA como fonte, cuja cadeia de direitos não foi verificada (S21, S22). | CEER: não verificada |
| Metodologia publicada | Página de perdas da ANEEL e regras do módulo (S35, R07). PRODIST Módulo 7, versão 6, listado como vigente; texto não aberto (S37). | CEER: relatório com tabelas por país (S30). IEA: "Distribution losses" reúne "all losses due to transport and distribution" (S01, p. 9). | em parte |

Valores lidos, só para documentar o risco de leitura (não plotar):

| Base | Medida e denominador | Ano | Valor |
| --- | --- | --- | --- |
| Observatório (R07) | Distribuição, perdas totais medidas sobre a energia injetada de referência, 51 concessionárias | 2025 | 14,75% |
| Observatório (R07) | Idem, 52 concessionárias | 2022 | 14,53% |
| BEN 2026, Síntese, p. 38 (S12) | Perdas (comerciais + técnicas) no sistema elétrico; o gráfico rotula 14,74% em 2024 e 14,73% em 2025, e o texto da página fala em "leve acréscimo de 0,01 ponto percentual" | 2024; 2025 | 14,74%; 14,73% (rótulos do gráfico) |
| Banco Mundial, EG.ELC.LOSS.ZS (S21) | Transmissão e distribuição, % da produção | 2025 | 14,87% |
| CEER, 3º Relatório (S30, p. 9 e 19) | Distribuição, % da energia injetada, menor e maior valor entre os países, no último ano com dado | 2022 | 1,95% a 22,63% |

Três bases com denominadores e fronteiras diferentes dão valores próximos para o Brasil, de 14,73% a 14,87%. A coincidência numérica não valida a medida do observatório: as definições diferem e as bases não são independentes, porque a IEA cita MME e EPE como fonte do Brasil (S02, p. 345) e a nota do indicador do Banco Mundial cita a IEA. A mesma nota cita acesso à IEA em 25/03/2025, e a série traz valor de 2025 (atualização de 08/10/2026): a origem do dado de 2025 não foi verificada (S21).

**Razão do veredito.**

* A CEER é a única fonte lida cujo recorte (distribuição, em % da energia injetada) tem o mesmo desenho conceitual da medida brasileira. Por isso B, e não C.
* A própria CEER avisa que "what is considered a loss in one country, might be considered delivered energy in another" (S30, p. 18) e que a falta de definições harmonizadas é "an obstacle to straightforward benchmarking" (S30, p. 9).
* Transmissão mais distribuição (Banco Mundial, IEA, BEN) não pode ser posta ao lado da distribuição. A Rede Básica brasileira é apurada à parte, pela CCEE, e o observatório não a integra (S35).
* O Brasil não está na CEER. O ano comparável é 2022, anterior à quebra de 2024 do leiaute do SAMP.

**O que falta para virar A.** Reconciliar cada componente da definição brasileira com as Tabelas 1 e 2 do relatório da CEER (perdas ocultas, consumo não medido, furto, erros de medição e de faturamento); confirmar que a energia injetada brasileira tem a mesma fronteira (inclui a repassada da transmissão e a geração distribuída); extrair os valores por país da Tabela 22 do Anexo 4 (p. 228); confirmar a licença; usar 2022, com a base e o leiaute declarados.

**Dado público adequado e integração.** PDF com tabelas por país (Anexo 4), sem formato de dados aberto; licença não verificada. Extração única e manual, viável com ressalva.

**Condições de exibição.** Uma frase fora do gráfico: "Na Europa, as perdas de distribuição foram de 1,95% a 22,63% da energia injetada em 2022 (CEER, 40 países); as definições nacionais não são harmonizadas." Sem posicionar o Brasil na faixa, sem linha, sem ordenação de países, sem perdas de transmissão e distribuição somadas.

**Referência nacional que sustenta a leitura.** Histórico da taxa agregada desde 2003, comparação entre distribuidoras com cobertura e universo ditos, e percentual técnico regulatório de cada processo tarifário (R07).

**Estado da verificação: verificada com lacunas.** Não verificados: PRODIST Módulo 7, versão 6 (HTTP 403), licença da CEER, dado e termos da IEA (HTTP 403). A Tabela 22 foi lida, não extraída para arquivo. Fontes: S01, S02, S12, S13, S21, S22, S30, S31, S35, S37, R01, R07, R10.

### 3.5 Emissões: fator de emissão

**Veredito: C.** Nenhuma candidata coincide com o fator do MCTI em gás, fronteira e perímetro ao mesmo tempo. A candidata aberta mede outra coisa.

| Campo | Observatório | Referência internacional | Fecha? |
| --- | --- | --- | --- |
| Conceito e definição | Fator médio de CO2 do SIN: "Ele calcula a média das emissões da geração, levando em consideração todas as usinas que estão gerando energia e não somente aquelas que estejam funcionando na margem", para inventários; não é o fator da margem de operação, de uso em projetos do MDL (S39, R08). | Ember: "full lifecycle emissions including upstream methane, supply chain and manufacturing emissions", com todos os gases em CO2e em escala de 100 anos (S08, p. 15). IEA: razão entre as emissões dos combustíveis fósseis consumidos na geração e a eletricidade gerada por todas as fontes, com produtores principais e autoprodutores (S03, p. 9). EEA: CO2e de combustão, com fator zero para nuclear e renováveis, porque o método não considera emissões de ciclo de vida (S41). | não |
| Unidade | tCO2/MWh; 0,0461 tCO2/MWh são 46,1 g/kWh (R08). | gCO2e/kWh na Ember e na EEA; gCO2 e gCO2eq por kWh na IEA (S03, S09, S41). | sim, com conversão |
| CO2 ou CO2e | Só CO2 ("CO2 (não CO2e)") (R08, R10). | CO2e na Ember e na EEA. IEA: CO2 como padrão, com CH4 e N2O convertidos em CO2eq à parte, pelo potencial de 100 anos do AR6 (S03, p. 8 e 11). A Ember assume para o metano de montante potencial 21 vezes o do CO2 (S08, p. 16). | não |
| Operação ou ciclo de vida | Operação das usinas (R08). | Ember: ciclo de vida. IEA e EEA: combustão; a IEA publica o ciclo de vida em produto separado (S03, p. 4 e 9). | Ember: não; IEA e EEA: sim |
| Importação | O MCTI não trata importação nas páginas lidas (S39, S40). | IEA: ajuste de comércio de eletricidade só para países da OCDE e fora do fator base (S03, p. 8 e 9). Ember: importação líquida em linha à parte, com emissões zero (S09). | não verificado |
| Geração ou consumo | Fator da geração despachada no SIN; o texto do MCTI diz que, aplicado à energia consumida, o somatório reproduz as emissões do SIN (S39). | Geração (IEA, Ember e EEA). | sim |
| Perímetro e cobertura | SIN. A partir de janeiro de 2025 a base de usinas do ONS foi ampliada (termelétricas a biomassa e conjuntos de usinas solares e eólicas, de emissão nula de CO2) e a energia despachada na planilha foi de 459,8 TWh em 2024 a 596,8 TWh em 2025 (R08, S40). | IEA: nacional, com autoprodutores (S01, S03). Ember: Brasil como país (S09). EEA: União Europeia (S41). | não |
| Período | Mensal de 01/2006 a 08/2026; anual de 2006 a 2025; 2025: 0,0461 tCO2/MWh; 08/2026: 0,0471 tCO2/MWh (R08). | IEA: de 1990 a 2024, com 2025 provisório para a OCDE e países selecionados (S03, p. 7 e 8). Ember: até 2025 (S09). EEA: de 1990 a 2024 (S41). | em parte |
| Licença e reuso | Rodapé do portal do MCTI: Creative Commons Atribuição SemDerivações 3.0 Não Adaptada, lido em 09/10/2026; a proveniência da gold registra "sem licença específica declarada na página" (S39, R08). | Ember: CC BY 4.0 (S10). IEA: termos não verificados (S06). EEA: licença não localizada na página lida (S41). | Ember: sim |
| Metodologia publicada | Planilhas do MCTI e nota técnica de junho de 2025 (S39, S40). | Documentação da IEA (S03), PDF da Ember (S08), página da EEA (S41). | sim |

Valores lidos, só para documentar a diferença de definição (não plotar):

| Base | Medida | Ano | Valor |
| --- | --- | --- | --- |
| MCTI via gold (R08) | Fator médio de CO2 do SIN, operação | 2025 | 0,0461 tCO2/MWh (46,1 g/kWh) |
| Ember, CSV anual (S09) | Intensidade de emissões da geração total do Brasil, CO2e, ciclo de vida | 2025 | 109,218 gCO2e/kWh |

**Razão do veredito.** O par mais próximo do fator do MCTI é o CO2 de combustão por kWh da IEA, mas o perímetro é nacional e o dado do Brasil e os termos não foram abertos. A candidata aberta, a Ember, mede ciclo de vida em CO2e: o prompt já estabelece que CO2 operacional não é CO2e de ciclo de vida. Na Ember, a importação líquida do Brasil em 2025 é igual à de 2024 (11,588 TWh), por regra declarada de carregar o último ano da EIA (S08, p. 10 e 27; S09), enquanto o BEN 2026 traz 11,6 TWh em 2024 e 7,4 TWh em 2025 (S12, p. 38). O total de 2025 da Ember (763,673 TWh) difere do do BEN 2026 (775,896 TWh) (S09; S12, p. 41).

**O que falta para virar A.** Leitura do CO2 por kWh só de eletricidade da IEA para o Brasil (2024 e 2025 provisório) e dos termos de uso; reconciliação do perímetro SIN contra nacional (autoprodução, isolados) e do denominador (geração bruta); mesmo ano; tratamento de importação declarado pelo MCTI; confirmação de que o fator da IEA é só CO2.

**Dado público adequado e integração.** Ember: aberto e CC BY 4.0, mas de outra definição. IEA: restrita, não verificada. EEA: aberta, mas só para a União Europeia. Integrar a Ember como bloco "ciclo de vida" é viável tecnicamente (CSV), com benefício baixo e risco alto de leitura errada ao lado do fator do MCTI. Decisão: não integrar.

**Referência nacional que sustenta a leitura.** Histórico mensal (de 01/2006 a 08/2026) e anual (de 2006 a 2025) do próprio fator, com a quebra de 01/2025 marcada, e as margens do MDL como séries distintas (R08).

**Estado da verificação: verificada com lacunas.** Não verificados: dado e termos da IEA (HTTP 403); tratamento de importação pelo MCTI; licença da EEA. Fontes: S03, S06, S08 a S10, S12, S13, S39 a S41, R08, R10.

### 3.6 Inclusão: acesso domiciliar à eletricidade

**Veredito: C.** A comparação do Brasil com o Banco Mundial não traz informação independente: a unidade difere, o relatório declara que dados de pesquisa do Brasil foram estendidos nesta edição, e o dataset que separa pesquisa de modelo não abriu.

| Campo | Observatório | Referência internacional | Fecha? |
| --- | --- | --- | --- |
| Conceito e definição | Domicílios particulares permanentes com energia elétrica de "rede geral ou fonte alternativa" (qualquer fonte, inclusive gerador ou painel próprio); os ligados à rede geral; e, entre os ligados, os que a têm em tempo integral (tabelas 6737, 6738 e 6731 da PNAD Contínua anual) (S25, R09). | Percentual da população com acesso à eletricidade (S21). O acompanhamento do ODS 7 "relies on binary electrification data" (acesso ou não), coletados de concessionárias e de pesquisas domiciliares (S23, p. 41). A Global Electrification Database reúne pesquisas e censos e usa modelo para os anos sem dado (S23, p. 156). | não |
| Domicílio ou população | Domicílios. A tabela 6737 traz também moradores em domicílios com energia (variável 10137), que o observatório não publica (S25). | População (S21). | em parte |
| Unidade | % de domicílios e mil domicílios (R09). | % da população (S21). | não |
| Período | Série da PNAD de 2016 a 2025, sem 2020 e 2021; 2025 completo (R09, S25). | WDI, Brasil: 2022: 100; 2023: 99,8; 2024: 99,8; 2025: sem valor (série atualizada em 08/10/2026) (S21). | em parte |
| Definição de acesso e qualidade | Binária por domicílio, mais as dimensões "rede geral" e "tempo integral"; a gold diz que a segunda "mede interrupção declarada, não qualidade técnica" (R09). | "Data inconsistencies in reported figures and difficulties in cross-country comparisons arise from diverse definitions of electricity access across countries, variations in survey questions, and different data collection approaches" (S23, p. 159). O Multi-Tier Framework trata o acesso em várias dimensões e conduziu pesquisas em mais de 29 países (S23, p. 41 e 157). | não |
| Pesquisa e incerteza | Estimativa amostral do IBGE, com coeficiente de variação publicado (0,0% no total do Brasil, arredondado); domicílios sem energia são a diferença de duas estimativas, sem erro padrão (R09, S25). | O modelo pode interpolar taxas irreais de 100%; para evitá-las, "the country's latest survey data are extended", o que nesta edição foi feito para Brasil, Bolívia, Jamaica e Laos; países de alta renda são assumidos em 100% (S23, p. 156). A diferença entre dado de pesquisa e valor estimado é identificada no dataset do ESMAP, que não abriu (S23, p. 156; S24). Não há incerteza no WDI. | não |
| Perímetro e cobertura | Brasil, regiões e UF; total, urbana e rural (R09). | País (S21). A IEA mantém uma base própria de acesso, com dados de concessionárias, que dá estimativas diferentes das pesquisas, em geral menores (S23, p. 157). | em parte |
| Licença e reuso | IBGE: "uso livre com citação" segundo a proveniência da gold; a página de termos do IBGE respondeu com desafio de navegador e não foi aberta (R09, S26). | WDI: Creative Commons Atribuição 4.0 no catálogo (S22). Relatório Tracking SDG7 2026: Creative Commons Atribuição Uso Não Comercial 3.0 IGO (S23, p. 2). Dataset do ESMAP: não aberto (S24). | WDI: sim; relatório: só uso não comercial; IBGE: não verificada |
| Metodologia publicada | Metadados da API do IBGE, com variáveis e classificações (S25). | Anexo metodológico do Tracking SDG7 de 2026 (S23). | sim |

Valores lidos (não plotar):

| Base | Medida | Ano | Valor |
| --- | --- | --- | --- |
| IBGE via gold do observatório (R09) | % de domicílios com energia elétrica de qualquer fonte | 2022; 2025 | 99,8%; 99,8% |
| IBGE, SIDRA 6737, variável 10137 (S25) | % de moradores em domicílios com energia elétrica | 2022; 2025 | 99,8%; 99,9% |
| Banco Mundial, EG.ELC.ACCS.ZS (S21) | % da população com acesso | 2022; 2023; 2024; 2025 | 100; 99,8; 99,8; sem valor |
| Tracking SDG7 2026 (S23, p. 25) | % da população mundial com acesso | 2024 | 91,9% |

**Razão do veredito.**

* O Brasil do WDI vem da Global Electrification Database (pesquisas domiciliares e censos mais modelo), e o relatório informa que, para o Brasil, os dados da última pesquisa foram estendidos nesta edição (S23, p. 156). Comparar a série com a PNAD seria comparar a pesquisa com uma extensão dela. Qual pesquisa alimenta cada ano não foi verificado.
* A unidade difere (domicílios contra população), e a PNAD publica as duas: em 2022, 99,8% dos domicílios e 99,8% dos moradores; em 2025, 99,8% e 99,9% (S25). O WDI traz 100 em 2022. A diferença de 0,2 ponto percentual com a PNAD de 2022 não foi decomposta e não deve ser lida como erro de uma das fontes.
* A comparação entre países exige a mesma definição de acesso, que o próprio relatório diz não ser harmonizada. O agregado mundial (91,9% em 2024) é de outra natureza (modelo, população).
* A IEA mantém uma base de acesso com dados administrativos de concessionárias (S23, p. 157), que não foi aberta.

**O que falta para virar A.** Publicar a variável de moradores da PNAD (SIDRA 6737, variável 10137) para igualar a unidade; abrir o dataset do ESMAP e identificar, por ano, o que é pesquisa e o que é modelo ou extensão para o Brasil; confirmar qual pesquisa alimenta o Brasil; mesma definição de acesso; incerteza comparável; mesmo ano; licença compatível com o uso.

**Dado público adequado e integração.** WDI aberto por API (CC BY 4.0), integração simples, sem ganho informativo em 09/10/2026. ESMAP e termos do IBGE não abriram.

**Reabrir quando.** O dataset do ESMAP marcar o Brasil com ano de pesquisa próprio e a unidade de moradores estiver publicada.

**Referência nacional que sustenta a leitura.** Histórico da PNAD de 2016 a 2025, recortes por UF, urbana e rural, com coeficiente de variação publicado (R09).

**Estado da verificação: verificada com lacunas.** Não verificados: dataset do ESMAP (HTTP 403), termos do IBGE (HTTP 403), base de acesso da IEA. Fontes: S21 a S26, R09.

## 4. Comparações nacionais novas ou modificadas: lista de verificação

Serve à auditoria da etapa 4 do prompt (referências estatísticas novas: pesos, mediana, extremos, empates, cobertura e elegibilidade). Esta seção não traz resultados do redesenho: diz o que conferir e onde. Para cada item conferido, anotar quem recalculou, quando, a partir de qual arquivo e a divergência encontrada.

1. **Peso e rótulo.** Média simples, mediana e razão de somas têm rótulos distintos, e o peso vem dito junto do número. Regras já publicadas: mediana e quartis tipo 7 entre distribuidoras, sem ponderação por consumo (`conta_tarifa_b1_aplicacao`); razão de somas, nunca média de taxas (`perdas_taxa_total_injetada`, `geracao_participacao`); ponderação por UC do conjunto no mês (`qualidade_dec_distribuidora`); média temporal simples do PLD, não ponderada pela carga (`visao_pld_media_diaria`).
2. **Mediana.** O universo da mediana é o mesmo do resumo, do gráfico, da tabela e do CSV, e a mediana é recalculada a partir dos valores publicados. Conta de luz: 81 distribuidoras de 115 CNPJs na referência 30/09/2026. Água e clima: mediana do mesmo dia do calendário nos anos completos anteriores, com mínimo de 5 anos (`agua_ear_faixa_sazonal`).
3. **Extremos.** O menor e o maior valem para o mesmo universo e período da mediana, com a unidade. Nomear uma só entidade exige conferir empate. Funções que nomeiam extremos: `respostaTarifa` e `vereditoTarifa`, em `src/lib/energia/conta.ts`, tomam a primeira e a última da ordenação por posição; `extremos`, em `src/lib/energia/perdas.ts`, desempata pelo nome e devolve um valor.
4. **Empates.** Mostrar todas as entidades empatadas ou dizer que há empate. `faixaComparacao` e `PontaFaixa`, em `perdas.ts`, guardam todas as distribuidoras empatadas. No PLD, as horas com os quatro submercados no piso têm diferença zero por construção (`pld_empates_piso`).
5. **Cobertura.** Numerador e denominador junto do valor. Conta de luz: 81 de 115, com 34 fora (22 com vigência encerrada há até 90 dias e 12 sem tarifa há mais de 90 dias). Perdas: parcela técnica publicada por 18 de 51 concessionárias em 2025, 32,6% da energia injetada. Qualidade: mês nacional só entra com UCs de DEC em 99% do máximo dos 12 meses anteriores. Geração: janelas só com dias completos.
6. **Elegibilidade.** Critério escrito e igual em gráfico, tabela, frase e exportação. Ano parcial não concorre com ano completo. Carga só compara períodos do mesmo regime do ONS, com 29 e 30/04/2023 fora (`carga_variacao_equivalente`). Qualidade: igual ao limite não é transgressão (`qualidade_pct_conjuntos_acima`). Perdas: ano completo, balanço que fecha e sem alerta. Inclusão: CV até 15% publicado, de 15% a 30% com cautela, acima de 30% suprimido.
7. **Resumo e exportação.** O resumo muda com os filtros, e a exportação contém a mesma população elegível: conferir por amostra que a contagem exportada é igual ao n do resumo.

Onde recalcular, por rota (prefixo `/setor-eletrico`):

| Rota | Comparação a recalcular | Arquivo de origem |
| --- | --- | --- |
| 02 `/visao-geral` | Média diária do PLD por submercado | `public/energia/gold/sintese.json`, copiada de `pld.json` |
| 04 `/agua-e-clima` | EAR do dia contra faixa sazonal (10º, 50º e 90º percentis) | `public/energia/gold/agua_detalhe.json` |
| 05 `/geracao` | Participação por categoria, com e sem MMGD | `public/energia/gold/geracao_detalhe.json` |
| 06 `/carga` | Variação contra a janela deslocada de 364 dias | `public/energia/gold/carga_detalhe.json` |
| 08 `/pld` | Horas no piso e empates | `public/energia/gold/pld_detalhe.json` |
| 12 `/conta-de-luz` | Menor, mediana, maior e quartis entre distribuidoras | `public/energia/gold/conta.json` (`tarifas.resumo`, `tarifas.vigentes`) |
| 13 `/perdas` | Taxa agregada e faixa entre distribuidoras | `public/energia/gold/perdas.json` (`nacional`, `distribuidoras`) |
| 14 `/qualidade` | DEC e FEC contra o limite; conjuntos acima do limite | `public/energia/gold/qualidade.json` (`brasil.anual`, `distribuidoras`) |
| 15 `/inclusao-energetica` | Acesso da PNAD; razões da POF | `public/energia/gold/inclusao.json` |
| 18 `/transicao` | Fator médio e margens do MDL | `public/energia/gold/transicao.json` (`emissoes`) |

Conferência pontual feita na elaboração deste registro, só para a Conta de luz (`conta.json`, referência 30/09/2026): o menor valor de TE + TUSD (DMED, 617,57 R$/MWh) e o maior (CERES, 1.569,23 R$/MWh) não têm empate; a mediana recalculada dos 81 valores, 821,18 R$/MWh, é igual à publicada; os quartis tipo 7 recalculados, 759,75 e 903,29 R$/MWh, são iguais aos publicados. As demais comparações ficam para a auditoria da etapa 4.

## 5. Registro de fontes

Todas as fontes externas foram acessadas em 09/10/2026. "Estado": "aberta" quando o conteúdo foi lido; "não verificada" quando o acesso falhou (a causa vem na coluna); "indisponível" quando a página não existe, está vazia ou deu erro do servidor. Hash completo na seção 5.3.

### 5.1 Arquivos do repositório

| ID | Arquivo | Data de referência ou geração |
| --- | --- | --- |
| R01 | `docs/observatorios/energia/BENCHMARKS.md` | 30/09/2026 |
| R02 | `docs/energia/redesign/RUBRICA.md` (critério F), `DESIGN_SYSTEM.md` (seção 7) e `GUIA_MIGRACAO.md` | 09/10/2026 |
| R03 | Prompt de redesenho completo do observatório de energia (arquivo `Prompt_Claude_Redesenho_Completo_Energia_1.md`), seções "Comparações e benchmarks", "Auditoria de consistência" e "Cobertura mínima por tema" | 09/10/2026 |
| R04 | `public/energia/gold/geracao_detalhe.json` e `geracao.json`; `docs/observatorios/energia/modulos/geracao.md` | `geracao_detalhe.json` gerado em 01/10/2026 07h08 UTC; `geracao.json` em 01/10/2026 00h28 UTC; último dia completo 29/09/2026 |
| R05 | `public/energia/gold/conta.json`; `modulos/conta.md` | referência 30/09/2026; gerada em 30/09/2026 23h56 UTC |
| R06 | `public/energia/gold/qualidade.json`; `modulos/qualidade.md`; `public/energia/series/qualidade_*.csv` | ano de referência 2025; gerada em 01/10/2026 05h53 UTC |
| R07 | `public/energia/gold/perdas.json`; `modulos/perdas.md` | ano de referência 2025, última competência 08/2026; gerada em 01/10/2026 06h06 UTC |
| R08 | `public/energia/gold/transicao.json`; `modulos/transicao.md` | fator anual até 2025 e mensal até 08/2026; gerada em 01/10/2026 06h38 UTC |
| R09 | `public/energia/gold/inclusao.json`; `modulos/inclusao.md` | PNAD até 2025; gerada em 01/10/2026 00h28 UTC |
| R10 | `public/energia/gold/metricas.json` (276 métricas) | gerada em 06/10/2026 20h02 UTC |
| R11 | `public/energia/series/geracao_capacidade_usina_mensal.csv` | de 09/2024 a 08/2026 |
| R12 | `pipeline/energia/catalogo_manual.json`, entrada `epe:ben` | 09/10/2026 |
| R13 | `src/lib/energia/conta.ts` (funções `respostaTarifa` e `vereditoTarifa`) e `perdas.ts` (funções `extremos` e `faixaComparacao`) | commit `61d043b58`; em `conta.ts` as duas funções começam nas linhas 782 e 892, no commit e na árvore de trabalho de 09/10/2026; `perdas.ts` não tem edição na árvore de trabalho |

### 5.2 Fontes externas

| ID | Organização e documento | URL | Estado | Reuso lido |
| --- | --- | --- | --- | --- |
| S01 | IEA, Electricity information: database documentation, edição de julho de 2026 | https://iea.blob.core.windows.net/assets/cb3a6a93-3e09-4866-b978-1ed00cc3375f/DocumentationforElectricityInformationJuly2026edition.pdf | aberta | "All rights reserved"; condições em iea.org/terms (S06) |
| S02 | IEA, World Energy Balances: database documentation, edição de abril de 2026 (notas do Brasil nas p. 343 a 345) | https://iea.blob.core.windows.net/assets/4c066cb0-d2bd-4d53-9053-5a4f654c11d3/EARLYBAL_Documentation_April2026.pdf | aberta | idem |
| S03 | IEA, Emission Factors 2026 edition: database documentation | https://iea.blob.core.windows.net/assets/1448c682-f204-48fd-bf46-442bb43b6657/IEA_Methodology_Emission_Factors_2026_package.pdf | aberta | condições em iea.org/terms (p. 5) |
| S04 | IEA, Energy Prices 2025 edition: database documentation (edição de janeiro de 2025) | https://iea.blob.core.windows.net/assets/e29a2d27-3ab2-4060-8713-22f39a4c77d7/EnergyPrices_Documentation.pdf | aberta | publicação sujeita a restrições específicas de uso e distribuição (p. 2) |
| S05 | IEA, Energy Statistics Data Browser | https://www.iea.org/data-and-statistics/data-tools/energy-statistics-data-browser | não verificada: HTTP 403 | não verificado |
| S06 | IEA, Terms | https://www.iea.org/terms | não verificada: HTTP 403 | não verificado |
| S07 | Ember, Yearly Electricity Data (página) | https://ember-energy.org/data/yearly-electricity-data/ | aberta | CC BY 4.0 no rodapé |
| S08 | Ember, Electricity data methodology (PDF) | https://files.ember-energy.org/public-downloads/ember_electricity_data_methodology.pdf | aberta | CC BY 4.0 (S10) |
| S09 | Ember, release_generation_yearly_global.csv | https://files.ember-energy.org/public-downloads/generation/outputs/release_generation_yearly_global.csv | aberta | CC BY 4.0 (S10) |
| S10 | Ember, Creative Commons | https://ember-energy.org/creative-commons/ | aberta | conteúdo da Ember em CC BY 4.0, livre para compartilhar e adaptar com crédito |
| S11 | EPE, Balanço Energético Nacional 2026 (página) | https://www.epe.gov.br/pt/publicacoes-dados-abertos/publicacoes/balanco-energetico-nacional-2026 | aberta | CC BY 4.0 no rodapé |
| S12 | EPE, BEN 2026, Relatório Síntese, ano base 2025 | https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/publicacao-975/topico-847/BEN_S%C3%ADntese_2026_PT.pdf | aberta | CC BY 4.0 (S11) |
| S13 | EPE, BEN 2026, Relatório Final | https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/publicacao-975/topico-850/BEN2026.pdf | aberta | CC BY 4.0 (S11) |
| S14 | Eurostat, API de disseminação: nrg_pc_204 (preços residenciais, semestrais; atualizado em 08/10/2026) e nrg_pc_204_c (componentes, anuais; atualizado em 07/10/2026) | https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_pc_204 e https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_pc_204_c | aberta | ver S16 |
| S15 | Eurostat, Statistics Explained: Electricity price statistics (dados extraídos em abril de 2026; próxima atualização do artigo prevista para 30/10/2026) | https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Electricity_price_statistics | aberta | ver S16 |
| S16 | Eurostat, Copyright notice and free re-use of data | https://ec.europa.eu/eurostat/help/copyright-notice | aberta | reuso comercial e não comercial autorizado com citação da fonte |
| S17 | Eurostat, metadados de nrg_pc_204 (ESMS) | https://ec.europa.eu/eurostat/cache/metadata/en/nrg_pc_204_sims.htm | indisponível: HTTP 404 | não aplicável |
| S18 | ACER e CEER, Rewarding flexibility: how retail contract choice can help unlock consumer flexibility, 2025 Monitoring Report, 27/11/2025 (p. 19 a 21) | https://www.acer.europa.eu/sites/default/files/documents/Publications/ACER-CEER-2025-Retail-monitoring.pdf | aberta | reprodução autorizada com citação da fonte (p. 2) |
| S19 | ACER, Key developments in EU electricity and gas markets, 2026 Monitoring Report, 16/03/2026 (p. 20) | https://www.acer.europa.eu/sites/default/files/documents/Publications/2026-ACER-Gas-Electricity-Key-Developments.pdf | aberta | não localizado nas primeiras páginas |
| S20 | GlobalPetrolPrices.com, Brazil electricity prices (coleta de março de 2026) | https://www.globalpetrolprices.com/Brazil/electricity_prices/ | aberta | Creative Commons Atribuição, Uso Não Comercial, Sem Derivações 3.0 |
| S21 | Banco Mundial, API v2: EG.ELC.ACCS.ZS, EG.ELC.LOSS.ZS e PA.NUS.PRVT.PP (série atualizada em 08/10/2026) | https://api.worldbank.org/v2/country/BRA/indicator/EG.ELC.ACCS.ZS e https://api.worldbank.org/v2/country/BRA/indicator/EG.ELC.LOSS.ZS | aberta | ver S22 |
| S22 | Banco Mundial, Data Catalog: World Development Indicators | https://datacatalog.worldbank.org/search/dataset/0037712/World-Development-Indicators | aberta | Creative Commons Atribuição 4.0 |
| S23 | IEA, IRENA, UNSD, Banco Mundial e OMS, Tracking SDG 7: The Energy Progress Report 2026 | https://iea.blob.core.windows.net/assets/5e20ffbb-fdb0-4bc4-98ea-41add3575f2f/TrackingSDG7TheEnergyProgressReport,2026.pdf | aberta | Creative Commons Atribuição Uso Não Comercial 3.0 IGO (p. 2) |
| S24 | ESMAP, Tracking SDG7: Downloads (SDG 7.1.1 Electrification Dataset) | https://trackingsdg7.esmap.org/downloads | não verificada: HTTP 403 | não verificado |
| S25 | IBGE, API de dados agregados: tabelas 6737, 6738 e 6731 da PNAD Contínua anual (metadados e dados) | https://servicodados.ibge.gov.br/api/v3/agregados/6737/metadados | aberta | ver S26 |
| S26 | IBGE, termos de uso | https://www.ibge.gov.br/acesso-informacao/institucional/termos-de-uso.html | não verificada: HTTP 403 | não verificado |
| S27 | CEER e ECRB, 7th CEER-ECRB Benchmarking Report on the Quality of Electricity and Gas Supply (referência C22-EQS-103-03; 22/12/2022 segundo a página da publicação) | https://ceer.eu/wp-content/uploads/2024/04/7th-Benchmarking-Report-2022.pdf e https://www.ceer.eu/publication/7th-ceer-ecrb-benchmarking-report-on-the-quality-of-electricity-and-gas-supply/ | aberta; a busca de publicações do site (API do WordPress) não devolve edição mais nova | não declarada nos PDFs (S31) |
| S28 | CEER, Benchmarking Report 6.1 on the Continuity of Electricity and Gas Supply (referência C18-EQS-86-03, 26/07/2018) | https://ceer.eu/wp-content/uploads/2024/04/C18-EQS-86-03_Benchmarking_Report_6.1.pdf | aberta | não declarada |
| S29 | CEER, nota sobre a comparabilidade dos indicadores de continuidade (referência C19-EQS-95-03b, 03/10/2019) | https://ceer.eu/wp-content/uploads/2024/04/C19-EQS-95-03b_CEER-note-on-comparability-of-continuity-indicators.pdf | aberta | não declarada |
| S30 | CEER, 3rd CEER Report on Power Losses (referência C24-EQS-106-03, 11/02/2025) | https://www.ceer.eu/wp-content/uploads/2025/02/3rd-CEER-Report-on-Power-Losses.pdf e https://www.ceer.eu/publication/3rd-ceer-report-on-power-losses/ | aberta | não declarada |
| S31 | CEER, página Disclaimer | https://www.ceer.eu/disclaimer/ | indisponível: página sem texto (modificada em 16/06/2025) | não localizada |
| S32 | EIA, Electric Power Annual, Table 11.1 Reliability Metrics of U.S. Distribution System | https://www.eia.gov/electricity/annual/html/epa_11_01.html | aberta | domínio público (S33) |
| S33 | EIA, Copyrights and Reuse | https://www.eia.gov/about/copyrights_reuse.php | aberta | domínio público, com citação sugerida |
| S34 | ANEEL, Qualidade do Fornecimento de Energia Elétrica (atualizada em 29/04/2026) | https://www.gov.br/aneel/pt-br/assuntos/distribuicao/qualidade-do-fornecimento-de-energia-eletrica | aberta | rodapé: Creative Commons Atribuição SemDerivações 3.0 Não Adaptada |
| S35 | ANEEL, Perdas de Energia (atualizada em 30/04/2026) | https://www.gov.br/aneel/pt-br/assuntos/distribuicao/perdas-de-energia/perdas-de-energia | aberta | idem |
| S36 | ANEEL, Dados Abertos: Indicadores Coletivos de Continuidade (DEC e FEC), com o dicionário (versão 1.0, 06/06/2022) e a tabela de domínio dos indicadores (gerada em 05/10/2026) | https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec; dicionário em https://dadosabertos.aneel.gov.br/dataset/d5f0712e-62f6-4736-8dff-9991f10758a7/resource/5d91171a-eb4e-4f66-8418-2833567123ae/download/dm-indicadores-continuidade.pdf; domínio em https://dadosabertos.aneel.gov.br/dataset/d5f0712e-62f6-4736-8dff-9991f10758a7/resource/17fc99b7-e707-4ec4-9553-a43d7a41f7a6/download/dominio-indicadores.csv | aberta | ODbL |
| S37 | ANEEL, PRODIST (página) e Módulos 7 (v6) e 8 (v14) | https://www.gov.br/aneel/pt-br/centrais-de-conteudos/procedimentos-regulatorios/prodist | página aberta; módulos não verificados (git.aneel.gov.br e www2.aneel.gov.br: HTTP 403) | página: Creative Commons Atribuição SemDerivações 3.0 Não Adaptada |
| S38 | ONS, Dados Abertos: Geração por Usina em Base Horária, com o dicionário (versão 1.2, 09/06/2023) | https://dados.ons.org.br/dataset/geracao-usina-2; dicionário em https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/geracao_usina_2_ho/DicionarioDados_GeracaoPorUsina.pdf | aberta | Creative Commons Atribuição |
| S39 | MCTI, Fatores de emissão MDL/SIN | https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/sirene/dados-e-ferramentas/fatores-de-emissao | aberta | rodapé: Creative Commons Atribuição SemDerivações 3.0 Não Adaptada |
| S40 | MCTI, Nota técnica de junho de 2025 (NT_FE_jun25) | https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/cgcl/paginas/NT_FE_jun25.pdf | aberta | idem |
| S41 | EEA, Greenhouse gas emission intensity of electricity generation in Europe | https://www.eea.europa.eu/en/analysis/indicators/greenhouse-gas-emission-intensity-of-1 | aberta | licença não localizada na página |
| S42 | IRENA, Renewable energy statistics 2025 e IRENASTAT | https://www.irena.org/Publications/2025/Jul/Renewable-energy-statistics-2025 e https://www.irena.org/Data/Downloads/IRENASTAT | não verificada: HTTP 403 | não verificado |
| S43 | OCDE, data.oecd.org: Electricity generation | https://data.oecd.org/energy/electricity-generation.htm | não verificada: HTTP 403 | não verificado |
| S44 | EPE, BEN: página raiz (endereço do catálogo `epe:ben`) e página de séries históricas e matrizes | https://www.epe.gov.br/pt/publicacoes-dados-abertos/publicacoes/balanco-energetico-nacional-ben e https://www.epe.gov.br/pt/publicacoes-dados-abertos/publicacoes/BEN-Series-Historicas-Completas | aberta; planilhas de 1970 a 2025 listadas, só o Anexo III foi lido | CC BY 4.0 no rodapé |
| S45 | EPE, Manual Metodológico do Balanço Energético Nacional (NT-EPE-DEA-SEE 005/2021; arquivo "BEN _ Manual 2022.pdf") | https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/publicacao-578/BEN%20_%20Manual%202022.pdf | aberta | CC BY 4.0 (S44) |
| S46 | EPE, BEN, Anexo III, Dados Mundiais de Energia (planilha) | https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/publicacao-145/topico-515/Anexo%20III%20-%20Dados%20Mundiais%20de%20Energia.xlsx | aberta | CC BY 4.0 (S44) |
| S47 | EPE, BEN Interativo | https://ben.epe.gov.br/ | indisponível: HTTP 500 | não aplicável |

### 5.3 SHA 256 dos arquivos baixados

Calculado sobre o arquivo como baixado em 09/10/2026. Páginas HTML e respostas de API não têm hash registrado, porque mudam a cada consulta.

| ID | SHA 256 |
| --- | --- |
| S01 | `e6b955909d6309a3bf17c7f53755bd15ff166f9ef03291dc1f0eb14f652de598` |
| S02 | `64cff3a57a0700575728054defff970ddea08f8d921952f5438535d21434c4c6` |
| S03 | `f60e5c7320e10fd881f93237599048b96202f8b2c8983e105fb58ae27ac3462a` |
| S04 | `3a6fcb25821241c1f93cd708fd772591ce669b3d0076b84109177d1b4013790e` |
| S08 | `67c5eaac3bfbeb7e67bb786f9ea9680f67f6f26e75318560562ee52d439de908` |
| S09 | `b2ac49fa9b27035fedda3c6afb85917bf136de9253bfcbaf09c3410904ec7cd1` |
| S12 | `0b4327c52cf695adc38c97e23533422dbdd5ea40f3098f43602801796061375b` |
| S13 | `1242772db925fe7f236b2737698eadf5be0be981f97b036c9ee769a498d593cf` |
| S18 | `4d59f2e0d925e90644a15816cff11172aa47711e4aedd35757fc9ccf3c509635` |
| S19 | `5357647f1759c6b07e9856486aaa86b953e4f8b8849cbab5286f133a2f8053e5` |
| S23 | `a56c2553ad50fc99011a7dbfac1927634a316ad4021ec60236a3aea3fdebed49` |
| S27 | `73dbb21d007dd2aab35e9c4625a5fde9fa907922ae207494bb9ab7383e6c868a` |
| S28 | `bf59eeb44ce78539dcc3242cd4e234d7f6b74de731aeb512cf6f9493d72255d3` |
| S29 | `f97c019b10e6cb9c0fa76094e581920809ba1052411a44d0d9b5304a62ebe60a` |
| S30 | `c02a417fc04a439bbedb85086695925f577e1e96bac2267dce18bc8dce155b57` |
| S36, dicionário | `1d024457693b04ab9e17e860b31a689ddc5fa968e6b9eea5a5d78f586ec2b10c` |
| S36, tabela de domínio | `fd08d3dab0af7a082ca354cbcf116848ddd544b90aeb9d0a83e630e706dd17c5` |
| S38, dicionário | `c254f312198ad314bc9c142bf016351c90ffb3f384b9b6be88e3e19d61c6a78e` |
| S40 | `a6ca97b54a667ee905803bf27a61296e09404bf7dff183720baf61bdda379506` |
| S45 | `8d3b2ced403f0f375b7098ebd34025622465f21ea94b83df692fe316370087cf` |
| S46 | `416c91f16cbee8d382fa6fc08c30bc5377634459a9254ab8721ead7c981c062b` |

## 6. Pendências

Cada pendência diz o que a desbloqueia. Nenhuma altera código ou dado nesta rodada.

| ID | Tema | Pendência | Desbloqueio |
| --- | --- | --- | --- |
| PB01 | Matriz, Conta, Perdas, Emissões, Inclusão | IEA: o navegador de dados e os termos de uso não abriram (S05, S06; HTTP 403). Falta confirmar se há geração por combustível do Brasil em 2025, o CO2 por kWh do Brasil, as condições de redistribuição e de obra derivada, e o que a base de acesso da IEA diz do Brasil. | Acesso a partir de ambiente sem desafio de navegador, ou contato com a IEA. |
| PB02 | Matriz | Confirmar com o ONS, em documento primário ou resposta formal, se `val_geracao` é geração bruta ou líquida e o que entra de Itaipu (as unidades de 50 Hz inteiras, inclusive a parcela consumida no Paraguai, ou só a parcela consumida no Brasil, como a Ember descreve). | Resposta do ONS; atualização do dicionário. |
| PB03 | Matriz | O BEN 2026 traz 97,6 TWh de autoprodução não injetada em 2025, fora do dado do ONS. Decidir se o painel de Geração declara em texto o que fica fora do ONS, citando o BEN. | Decisão editorial; nenhum número novo na gold. |
| PB04 | Matriz | Inconsistências dentro do BEN 2026. Renováveis na oferta interna: 86,8% na Síntese (p. 35 e 36), com a importação de Itaipu tratada como renovável, e 86,6% no Relatório Final (p. 12), onde a p. 11 traz 13,4% de fontes não renováveis na geração nacional; a Síntese traz 13,2% de não renováveis na oferta interna (p. 36). A diferença entre 51,2% e 52,2% de hidráulica está explicada no texto: o Relatório Final soma a importação de Itaipu à hidráulica (S13, p. 12). Na p. 38 da Síntese, o gráfico rotula 14,74% para 2024 e 14,73% para 2025, e o texto fala em acréscimo de 0,01 ponto percentual. | Reconciliar com a EPE. |
| PB05 | Matriz | A entrada `epe:ben` do catálogo manual (R12) tem licença nula e a descrição "Endereço a conferir". O endereço respondeu HTTP 200 em 09/10/2026 e lista BEN 2026, séries históricas de 1970 a 2025, relatório dinâmico, BEN Interativo (ben.epe.gov.br: HTTP 500) e Manual Metodológico; o rodapé declara CC BY 4.0. | Atualizar o catálogo com licença e endereço conferidos. |
| PB06 | Matriz, Emissões | Ember: em 2024 as séries do Brasil coincidem com o BEN; em 2025 a importação líquida repete a de 2024 (11,588 TWh), por regra de carregar o último ano, e o total (763,673 TWh) difere do BEN (775,896 TWh). Tratar o Brasil de 2025 da Ember como provisório e reler a cada release. | Nova edição da Ember. |
| PB07 | Conta | Falta preço final residencial brasileiro por banda e tributos, validado. O SAMP traz meses isolados com valores declarados com erro de ordem de grandeza; a tarifa média de fornecimento não é publicada. | Base oficial estruturada com tributos e regra de tratamento validada contra fonte independente. |
| PB08 | Conta | Documentar a classificação dos encargos setoriais (CDE, Proinfa e outros) frente às categorias de componentes do Eurostat, que a IEA já trata como tributo. | Estudo de mapeamento com fonte primária. |
| PB09 | Qualidade | O agregado publica IP + IND somadas; a fonte traz DECIP e DECIND separadas. Uma série "não planejada" exigiria essa separação e o mapeamento dos expurgos. | Nova gold com contrato publicado. |
| PB10 | Qualidade, Perdas | CEER: licença de reuso não localizada (página Disclaimer sem texto, PDFs sem licença). Edição posterior à 7ª, com dados depois de 2018, não localizada na busca do site em 09/10/2026. | Contato com a CEER; nova edição. |
| PB11 | Qualidade, Perdas | PRODIST Módulos 7 (v6) e 8 (v14): git.aneel.gov.br e www2.aneel.gov.br respondem HTTP 403. O limiar de 3 minutos e os expurgos foram confirmados pela página da ANEEL e pela tabela de domínio do conjunto de dados, não pelo texto dos módulos. | Cópia dos módulos obtida por canal acessível. |
| PB12 | Perdas | Reconciliar a definição brasileira com as Tabelas 1 e 2 da CEER, conferir a fronteira da energia injetada e extrair a Tabela 22 (Anexo 4, p. 228) para 2022. Dizer em cada uso se a base é medida ou faturada (14,74% contra 14,0% em 2024). | Trabalho de reconciliação e licença da CEER. |
| PB13 | Perdas | Os valores próximos de 14,7% a 14,9% em três bases com denominadores diferentes (ANEEL, BEN e WDI) não são validação independente. A nota do indicador do WDI cita acesso à IEA em 25/03/2025, e a série traz 2025. Manter a ressalva em qualquer texto de perdas. | Nota no verbete de perdas; origem do dado de 2025 do WDI. |
| PB14 | Emissões | MCTI: o rodapé do portal declara Creative Commons Atribuição SemDerivações 3.0 em 09/10/2026, e a proveniência da gold diz "sem licença específica declarada na página". O tratamento de importação no fator não é declarado nas páginas lidas. | Revisão do texto de proveniência; consulta ao MCTI. |
| PB15 | Inclusão | A variável de moradores da PNAD (SIDRA 6737, variável 10137) existe na fonte e não está na gold. O dataset do ESMAP e os termos do IBGE não abriram. O relatório Tracking SDG7 2026 é de uso não comercial. | Decisão de publicar; acesso aos dois sites; análise de compatibilidade da licença. |
| PB16 | Matriz, Transição | IRENA (estatísticas de capacidade e geração renovável, S42) e portal de dados da OCDE (S43) não abriram (HTTP 403); não foram usados. | Acesso. |
| PB17 | Conta | A página de metadados do Eurostat (ESMS) respondeu 404; citar a API ou a URL vigente. | Localizar a URL vigente. |
| PB18 | Matriz | O Manual Metodológico do BEN lido é a edição 2022 (NT-EPE-DEA-SEE 005/2021). Confirmar se vale para o BEN 2026 e se define o denominador das perdas elétricas. | Confirmação com a EPE ou manual mais novo. |
| PB19 | Todas | Reabrir cada ficha na próxima edição das fontes: Eurostat (atualização do artigo prevista para 30/10/2026), IEA, Ember, Tracking SDG7 de 2027, BEN de 2027 e CEER. | Calendário de revisão. |

## 7. Regra de aceite para benchmarks futuros

Um benchmark internacional só entra no produto se passar por todas as condições abaixo. Falhando uma, a decisão é B (contexto separado, quando houver contexto útil) ou C (rejeitada), e a decisão é registrada neste documento com a razão. A ausência de benchmark inadequado não reduz a qualidade da página; o uso enganoso reduz.

1. **Hierarquia.** A referência internacional é a quinta da hierarquia do prompt. Só entra depois de histórico do mesmo ente, pares com universo e pesos declarados, limite regulatório e agregado nacional com construção explicada.
2. **Ficha de comparabilidade completa.** Conceito e definição das duas medidas lidos na fonte primária; unidade; período; perímetro e cobertura; licença; metodologia publicada; razão do veredito; o que falta para virar A; estado da verificação. Sem ficha, não há benchmark.
3. **Mesma grandeza.** Mesmo conceito, não só o mesmo nome. Dois indicadores chamados SAIDI, perdas ou intensidade de carbono não são o mesmo sem definição lida.
4. **Mesmo perímetro e mesma fronteira.** SIN contra nacional, distribuição contra transmissão mais distribuição, geração contra consumo, operação contra ciclo de vida, com ou sem importação, com ou sem autoprodução e MMGD. Diferença de fronteira que o contrato do prompt lista é impeditiva.
5. **Mesma unidade e mesmo denominador.** Conversão exata e declarada. Domicílio não é população; energia injetada não é produção nem oferta interna.
6. **Mesmo período.** Mesmo ano civil fechado ou mesmo semestre. Dado provisório ou carregado de ano anterior não concorre com dado definitivo.
7. **Regras do tema.** Conta: banda de consumo, tributos, câmbio, paridade de poder de compra e período, e nunca TE + TUSD contra fatura final. Qualidade: duração mínima, eventos excepcionais, expurgos, ponderação, níveis de tensão, planejada ou não planejada. Perdas: fronteira e denominador. Emissões: CO2 ou CO2e, operação ou ciclo de vida, importação, geração ou consumo, ano. Inclusão: unidade, definição de acesso e de qualidade, pesquisa ou modelo, incerteza. Matriz: energia ou capacidade, bruta ou líquida, autoprodução e MMGD, ano.
8. **Independência.** A fonte internacional não pode ser, para o Brasil, o mesmo dado brasileiro reprocessado. Coincidência numérica entre bases não é validação. Exemplos lidos: o total, a hidráulica, a eólica, a solar, a nuclear e o gás natural de 2024 da Ember para o Brasil são iguais aos do BEN (S09; S12, p. 41); a IEA cita MME e EPE como fonte do Brasil (S02, p. 345); o BEN recebe do ONS a geração verificada do SIN (S45, p. 34). Valor internacional reproduzido por fonte nacional, como "Mundo (2023)" e "OCDE (2024)" na Síntese do BEN, vale como pista e só entra depois de lido na fonte primária.
9. **Incerteza.** A incerteza da referência é publicada junto, ou a ausência dela é dita. Estimativa por modelo ou extensão de pesquisa é marcada como tal.
10. **Licença.** O reuso, inclusive em obra derivada e em redistribuição pelo observatório, está lido na fonte e é compatível com o uso. Licença não verificada, com restrição a obras derivadas ou limitada a uso não comercial reprova a integração.
11. **Rastreabilidade.** Cada valor vem de arquivo versionado, com URL, data de acesso, versão ou edição e SHA 256, e é reproduzível. Nenhum valor internacional é constante no código, e nenhum número de exemplo de galeria vai para produção. Valor lido de gráfico em PDF é conferido na imagem da página.
12. **Apresentação.** Nenhuma linha de "meta internacional" sobre o gráfico. A referência não comparável aparece como contexto separado, com a diferença de definição dita, sem ranking e sem cor de aprovação ou reprovação. O título do bloco diz o que ele mede.
13. **Revisão.** A ficha tem data de acesso e edição da fonte, e é reaberta quando sai nova edição ou quando a definição de uma das medidas muda.
14. **Verificações automatizáveis a criar.** Varredura do código por nomes de fontes e valores internacionais literais; varredura do HTML gerado por "meta internacional" e por "benchmark internacional" fora de um bloco de contexto; teste de que todo valor internacional exibido tem ficha com veredito A ou B, URL, data de acesso e hash; teste de expiração que marca ficha com edição de fonte mais nova do que a registrada.
