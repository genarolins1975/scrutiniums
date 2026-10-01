# Módulo Mercado: livre e regulado, agentes e migração, MRE e GSF, encargos (P032 a P035)

Documento de método do módulo `mercado` (rota `/setor-eletrico/mercado`; família de silver `mercado`, ordem 35). Estado em 01/10/2026, fim da fase de dados: coleta, silver, gold, métricas, tipos e testes prontos; a página ainda usa `ModuloEmIntegracao` e será substituída na fase de interface.

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Coleta, silver e gold | `pipeline/energia/modulos/mercado.py` |
| Leitores (funções puras) | `pipeline/energia/fontes/epe_mercado.py`, `aneel_mercado.py`, `mme_mercado.py`, `ccee_mercado.py` |
| Metadados versionados da CCEE | `pipeline/energia/seed/ccee_mercado/v20261001T003925Z/` (package_show de cada conjunto, com MANIFESTO.json e sha256) |
| Métricas (21 medidas) | `pipeline/energia/metricas/mercado.py` |
| Testes (41, sem rede) | `pipeline/tests/test_energia_mercado.py`, recortes reais em `pipeline/tests/dados/energia_mercado/` |
| Gold | `public/energia/gold/mercado.json` (427 KB) |
| Leitura sob demanda | `public/energia/series/mercado_detalhe.json` (113 KB: resultado do MCP por submercado, Conta Bandeira mensal, risco hidrológico mensal, desligamentos por classe) |
| Downloads | `public/energia/series/mercado_*.csv` (consumo EPE nacional, por região e por UF; SAMP por distribuidora e mês e tabela anual; Conta Bandeira; encargos do boletim do MME; séries mensais da CCEE; desligamentos; cadastro de agentes da ANEEL) |
| Tipos | `src/lib/energia/tipos-mercado.ts` (`MercadoGold` e `MercadoDetalhe`; conferidos com `satisfies` sobre os dois JSON publicados) |

Execução: `python3 pipeline/energia/executar_modulo.py mercado` (coleta e gold) ou `--sem-coleta` (só gold). Pico de memória medido em 01/10/2026: 257 MB (coleta com recursos já capturados e construção da gold); o processamento dos Parquet do SAMP e dos CSV de parcelas de carga é feito em lotes e em fluxo.

## 1. Painéis e estado

O campo `paineis[].estado_dados` da gold é calculado pela própria construção: "concluido_com_limitacao" quando todas as verificações essenciais do critério de aceite do Anexo A passam. Ele descreve a camada de dados. Nenhum painel é declarado entregue antes da página, da inspeção visual e dos testes de interface.

| Painel | O que a gold responde | Estado dos dados |
| --- | --- | --- |
| P032 Livre e regulado | Participação do livre no consumo na rede (EPE, mensal desde 2004, por classe, região, subsistema e UF); consumo contabilizado por ambiente (CCEE, desde maio de 2023, ACR e ACL pelas classes de agente); mercado livre e cativo faturado por distribuidora (SAMP, CNPJ, desde 2019); comparação dos três universos e contexto da carga (boletim do MME) | Concluído com limitação declarada |
| P033 Agentes e migração | Agentes contabilizados por classe (mensal); entradas e saídas de CNPJ na lista de associados (desde outubro de 2025); posição do cadastro de perfis (perfis por classe e status, perfis por agente); parcelas de carga e migrações no mês; desligamentos voluntários e compulsórios com sucessão; unidades consumidoras livres (EPE e SAMP por característica); cadastro de agentes da ANEEL | Concluído com limitação declarada |
| P034 MRE e GSF | GSF mensal, anual e de 12 meses (razão de energias), geração e garantia física lado a lado, por submercado; custo do risco hidrológico alocado às distribuidoras (Conta Bandeira, desde 2015) | Concluído com limitação declarada |
| P035 Encargos e contabilização | ESS por tipo e por mês de competência, resposta da demanda, encargo de energia de reserva, pagamento e alívio, liquidação (a liquidar, liquidado, inadimplência), balanço e resultado do MCP por submercado, encargos do boletim do MME com o reprocessamento entre edições, ESS e EER das distribuidoras (Conta Bandeira) | Concluído com limitação declarada |

Acesso à CCEE: em 01/10/2026 (05h45 UTC) o `curl` recebeu HTTP 403 ("Acesso bloqueado") em `https://dadosabertos.ccee.org.br/api/3/action/package_show?id=mre_mensal`; o cliente HTTP do pipeline (`pipeline.common.http_get`, urllib da biblioteca padrão com o User-Agent do projeto, `ObservatorioBrasileiroDeCredito/0.1 (prototipo academico; dados abertos)`) recebeu HTTP 200 na mesma chamada, como já acontecia na coleta direta do PLD no GitHub Actions. Nada foi alterado para contornar o bloqueio (nenhum cabeçalho de navegador, nenhum outro caminho de rede). O registro fica na gold (`acesso_ccee`) e cada tentativa fica na tabela `coletas` do silver. Ver o pedido 1 da seção 6.

## 2. Fontes verificadas (consulta em 01/10/2026)

| Órgão | Conjunto e recurso | URL | Licença | Período no silver | Grão e frequência |
| --- | --- | --- | --- | --- | --- |
| EPE | Consumo mensal de energia elétrica, dados abertos: `Dados_abertos_Consumo_Mensal.xlsx` (abas CONSUMO E NUMCONS SAM e SAM UF) e dicionário `Consumo-Mensal-Dicionario-de-Dados.pdf` | www.epe.gov.br/pt/publicacoes-dados-abertos/dados-abertos/dados-do-consumo-mensal-de-energia-eletrica | CC BY 4.0 (rodapé do portal) | jan/2004 a ago/2026 (UF até o penúltimo mês); versão dos dados 18/09/2026; Last-Modified 30/09/2026 13h51 UTC | mês × região × subsistema × classe × tipo (cativo, livre); UF; mensal |
| EPE | Planilha formatada `CONSUMO MENSAL DE ENERGIA ELÉTRICA POR CLASSE.xlsx` (conferência) | www.epe.gov.br/pt/publicacoes-dados-abertos/publicacoes/consumo-de-energia-eletrica | CC BY 4.0 | jan/2004 a ago/2026; 2026 marcado como preliminar | total nacional por mês; mensal |
| ANEEL | SAMP: `samp-2019.parquet` a `samp-2026.parquet` (Parquet oficial equivalente ao CSV) e dicionário | dadosabertos.aneel.gov.br/dataset/samp | ODbL | jan/2019 a ago/2026 | distribuidora (CNPJ) × mês × opção de energia × tipo de mercado × característica; mensal |
| ANEEL | Bandeiras tarifárias, recurso "Bandeira Tarifária - Conta Bandeira" (CSV) e dicionário | dadosabertos.aneel.gov.br/dataset/bandeiras-tarifarias | ODbL | jan/2015 a jul/2026 | distribuidora × competência; mensal |
| ANEEL | Agentes do setor elétrico (CSV) | dadosabertos.aneel.gov.br/dataset/agentes-do-setor-eletrico | ODbL | posição gerada em 01/09/2026 | CNPJ; posição |
| MME | Boletim Mensal de Monitoramento do Sistema Elétrico, edições de março a junho de 2026 (PDF) | gov.br/mme/.../boletim-de-monitoramento-do-sistema-eletrico/2026 | CC BY-ND 3.0 (rodapé do gov.br; números reproduzidos com atribuição) | encargos jan a jun/2026; consumo por ambiente fev a jun/2026 | mês de competência × tipo; edição mensal |
| CCEE | 19 conjuntos do portal de dados abertos (CSV anuais): consumo_mensal_ambiente_comercializacao, consumo_classe_agente, agente_qtd_contabilizacao, lista_agente_associado, lista_perfil_v1, desligamento_voluntario, desligamento_compulsorio, parcela_carga_consumo, geracao_submercado, garantia_fisica_sazo_mre_submercado, mre_mensal, encargo_ess_ancilar, rd_encargos_contab_mensal, reserva_encargo, encargo_pgto_mensal, sumario_mensal_compra_venda_submercado, sumario_mensal_liquidacao | dadosabertos.ccee.org.br/dataset/<conjunto> | CC-BY-4.0 | entre maio e dezembro de 2023 (conforme o conjunto) até jul ou ago/2026; associados desde out/2025; desligamentos desde 2010 | mês × classe, submercado ou perfil; mensal (MS+22du) |
| CCEE | InfoMercado mensal em PDF, edições 206 (ago/2024), 208 (out/2024) e 229 (jul/2026, publicada em 10/09/2026), usado só para conferência | www.ccee.org.br/web/guest/dados-e-analises/dados-mercado-mensal | publicação da CCEE, números reproduzidos com atribuição | três edições | sumário executivo e composição dos encargos |

Esquema conferido na chegada: cada conjunto da CCEE declara as colunas lidas do cabeçalho real e conferidas com a descrição de cada campo no package_show versionado. Duas divergências reais foram registradas e tratadas de forma explícita: o package_show de ENCARGO_ESS_ANCILAR documenta `RESSARCIMENTO_DIST_IMPL_OP` e o arquivo traz `RESSARCIMENTO_DIST_IMPL_OP_MNT` (os quatro arquivos foram recusados na primeira leitura e aceitos com o nome do arquivo); as classes "Varejista", "Importador" e "Transmissor" aparecem nos arquivos sem constar do domínio do dicionário e foram acrescentadas uma a uma. Qualquer outra divergência recusa o arquivo sem gravar número.

Revisões: cada captura vira uma vintage com sha256 no silver; observação que muda entre capturas é registrada como revisão (bloco `revisoes_conhecidas` da proveniência e texto de revisões na evidência). Entre edições do boletim do MME, o reprocessamento é publicado em `encargos.mme.revisoes`.

## 3. Método

### 3.1 Universos de consumo (P032)

* **EPE, consumo na rede.** Soma da coluna Consumo (MWh) das linhas da tabela longa por tipo de consumidor; participação do livre = 100 × Σ livre ÷ Σ (cativo + livre) do período (mês, ano civil, 12 meses), nunca média de percentuais. Ano com menos de 12 meses com os dois tipos é marcado incompleto; janela de 12 meses com lacuna não é calculada.
* **CCEE, consumo contabilizado.** ACR = classe Distribuidor e ACL = soma das demais classes do conjunto CONSUMO_CLASSE_AGENTE (centro de gravidade, MW médios); MWh = MW médios × horas do mês civil. Motivo: em fevereiro de 2026 a CCEE trocou a classe Comercializador pela Varejista e o conjunto CONSUMO_MENSAL_AMBIENTE_COMERCIALIZACAO deixou de contar a Varejista no ACL (cerca de 2.500 MW médios, 3,5% do consumo). Até janeiro de 2026 os dois conjuntos fecham (resíduo máximo de 0,94 MW médio); de fevereiro em diante a diferença é, mês a mês, o consumo da Varejista (resíduo máximo de 3,97 MW médios; tolerância de 5 MW médios). O valor publicado no conjunto de ambiente segue ao lado (`acr_publicado_mwmed`, `acl_publicado_mwmed`, `varejista_mwmed`). A quebra está registrada em `quebras` dos dois conjuntos.
* **SAMP, mercado faturado.** Livre = Energia TUSD e número de consumidores com opção LIVRE; cativo = Energia TE (a TUSD do cativo fica em medida de conferência e coincide com a TE); só os tipos de mercado faturados na competência (Regular, sistemas isolados e individuais, compensação GD I a III); refaturamento em medida própria, sem competência. Linhas da mesma distribuidora, mês e medida (classe, subgrupo, posto) são somadas. Mês nacional só entra em comparação quando publicado por pelo menos 95% da mediana de distribuidoras dos 12 meses anteriores; ano de referência = último ano civil completo (2025).
* **Carga.** Nenhum universo é igualado à carga do ONS. O boletim do MME publica a carga e a linha "Perdas e Diferenças"; a gold publica o consumo da EPE como fração da carga em cada edição (75,0% a 82,7% entre fevereiro e junho de 2026).

### 3.2 Agentes, perfis, parcelas e unidades (P033)

Agente = pessoa jurídica (CNPJ de 14 dígitos, `entidades.cnpj`); perfil = registro do agente na CCEE (COD_PERF_AGENTE); parcela de carga = unidade de consumo modelada na CCEE ligada a um perfil; unidade consumidora = ponto de entrega medido (EPE e SAMP). As contagens nunca se somam entre si. Entrada no mês m = CNPJ presente na lista de associados em m e ausente em m−1; saída = o inverso; o primeiro mês e o mês depois de uma lacuna não têm fluxo. Saída da lista não é desligamento: o desligamento vem dos conjuntos oficiais, com tipo (voluntário ou compulsório) e sucessão (completa, financeira ou sem sucessão). Migração no mês = parcela de carga com DATA_MIGRACAO no próprio mês de referência. Perfis vêm de uma posição do cadastro (sem série mensal).

### 3.3 GSF e risco hidrológico (P034)

GSF = 100 × Σ GERACAO_MRE dos quatro submercados ÷ GARANTIA_FISICA_MODULADA_FDISP (GFIS_2, conjunto MRE_MENSAL), a razão que reproduz o fator publicado pela CCEE no InfoMercado. Período = Σ(geração × horas) ÷ Σ(GFIS_2 × horas). Mês sem os quatro submercados fica sem GSF. Garantia física e geração ficam em colunas separadas; o painel não infere exposição financeira de usina ou agente. Risco hidrológico alocado às distribuidoras = Itaipu + repactuadas + cotas (Conta Bandeira), com a identidade do dicionário conferida em cada linha (CCGF e repactuadas líquido = repactuadas + CCGF + previsão + prêmio, tolerância de R$ 1; 0 de 13.745 linhas fora).

### 3.4 Encargos, pagamento e liquidação (P035)

ESS do mês = soma dos nove tipos de ENCARGO_ESS_ANCILAR (constrained-on, constrained-off, unit commitment, suporte de reativo, outros serviços ancilares, segurança energética, deslocamento hidráulico, importação, reserva operativa). As seis colunas RESSARCIMENTO_* não são somadas: o dicionário define OUTROS_SERVICOS_ANCILARES como a soma do encargo que remunera esses ressarcimentos, e o arquivo confirma a identidade ao centavo em todos os meses de 2023 a 2026. A versão anterior do módulo somava as quinze colunas e contava os ressarcimentos duas vezes (R$ 25.159,06 a mais em outubro de 2024, R$ 13,6 milhões em maio de 2025); o defeito foi encontrado na conferência com o InfoMercado e corrigido nesta retomada. A resposta da demanda vem do conjunto próprio RD_ENCARGOS_CONTAB_MENSAL (célula vazia é ausência; mês com os quatro submercados vazios fica sem valor; zero publicado é zero).

Competência, pagamento e reprocessamento são grandezas separadas: encargos por mês de competência; pagamento (PAGAMENTO_ENCARGO_ESS e _SE) e alívio em série própria; reprocessamento detectado entre capturas e entre edições do boletim do MME (março de 2026: 344.773 mil R$ na edição de março, 344.493 na de junho, que retirou a parcela de 280 mil R$ de suporte de reativo vinculado à resposta da demanda). Liquidação: inadimplência = 100 × VALOR_INAD ÷ VALOR_TOTAL_LIQ_PRE só nos meses em que a liquidar = liquidado + inadimplência; maio de 2025, março e abril de 2026 vêm com 0 em liquidado e inadimplência e valor a liquidar positivo, e ficam como "liquidação não informada", sem taxa.

### 3.5 Evidências e textos

Cada KPI da gold traz `evidencia` montada por `pipeline/energia/evidencia.py` (arquivos e sha256 de todas as vintages usadas, chaves ou consulta de origem, fórmula, numerador e denominador, testes, reconciliação com tolerância em unidade, downloads, reprodução e citação). Os textos de resposta de cada painel (`paineis[].resposta`) saem de funções puras testadas (`resposta_p032` a `resposta_p035`) e só descrevem observação, sem causa.

## 4. Evidências de aceite (conferências contra a fonte)

| Medida | Entidade e período | Gold | Fonte independente | Diferença | Tolerância |
| --- | --- | --- | --- | --- | --- |
| Consumo total na rede | Brasil, jul/2026 | 46.896.041,9 MWh (soma da tabela longa) | 46.896.044,066 MWh (planilha formatada, TOTAL BRASIL) | 2,1 MWh | maior entre 1 MWh e 10⁻⁶ do total |
| Consumo livre | Brasil, jul/2026 | 21.884.508,4 MWh | 21.884.509,776 MWh (TOTAL LIVRE) | 1,4 MWh | idem |
| Unidades livres | Brasil, jul/2026 | 96.370 | 96.370 (planilha) | 0 | 1 unidade |
| Tabela longa × planilha | Brasil, 2004 a 2026 | 1.252 comparações | planilha formatada | 0 acima da tolerância; maior 3,22 MWh | idem |
| ACL do mês | Brasil, jun/2026 | 21.474,6 GWh | 21.475 GWh (boletim do MME de junho) | 0,4 GWh | 1 GWh |
| ACL em 12 meses | Brasil, jul/2025 a jun/2026 | 258.133,0 GWh | 257.741 GWh (boletim de junho) | 392 GWh (ressalva: o boletim usa a consolidação da EPE da data da edição) | 1 GWh |
| Unidades livres, SAMP × EPE | Brasil, jul/2026 | 94.934 (SAMP) | 96.370 (EPE) | 98,5% | 3% (universos diferentes) |
| GSF | MRE, ago/2024 | 79,366% | 79,37% (InfoMercado Nº 206) | 0,004 p.p. | 0,006 p.p. |
| GSF | MRE, out/2024 | 73,485% | 73,49% (InfoMercado Nº 208) | 0,005 p.p. | 0,006 p.p. |
| GSF | MRE, jul/2026 | 76,825% | 76,83% (InfoMercado Nº 229) | 0,005 p.p. | 0,006 p.p. |
| Geração do MRE | jul/2026 | 39.194,7 MW médios | 39.195 MW médios | 0,3 | 0,5 MW médio |
| ESS sem parcelas fora do conjunto | ago/2024 | R$ 477,516 milhões | 481,38 − 3,87 = R$ 477,51 milhões (InfoMercado Nº 206) | 0,006 | R$ 0,06 milhão |
| ESS sem parcelas fora do conjunto | out/2024 | R$ 265,479 milhões | 268,8 − 3,32 = R$ 265,48 milhões | 0,001 | R$ 0,06 milhão |
| ESS sem parcelas fora do conjunto | jul/2026 | R$ 63,890 milhões | 64,96 − 1,07 (sandbox) = R$ 63,89 milhões | 0,000 | R$ 0,06 milhão |
| Restrição de operação | ago/2024 | R$ 447,780 milhões | R$ 447,78 milhões | 0,000 | R$ 0,005 milhão |
| Deslocamento hidráulico | jul/2026 | R$ 2,584 milhões | 2,05 + 0,54 = R$ 2,59 milhões | 0,006 | R$ 0,010 milhão (duas parcelas publicadas) |
| Resposta da demanda | ago/2024 | R$ 3,868 milhões | R$ 3,87 milhões | 0,002 | R$ 0,005 milhão |
| ESS por tipo × boletim do MME | jan a jun/2026 | 66 valores | boletim de junho de 2026 | 66 de 66 dentro | 0,5 mil R$ por tipo; 6 mil R$ no total |
| Valor a liquidar | jul/2026 | R$ 2,1315 bilhões | R$ 2,13 bilhões (InfoMercado Nº 229) | 0,0015 | R$ 0,005 bilhão |
| Pagamento de ESS (total − alívio) | ago/2024 e out/2024 | R$ 361,544 e 20,862 milhões | R$ 361,54 e 20,87 milhões | até 0,008 | R$ 0,06 milhão |

Divergências entre fontes publicadas como ressalva (fora do critério de aceite, visíveis na gold): pagamento de ESS em julho de 2026 (InfoMercado implica R$ 2,55 milhões; o conjunto ENCARGO_PGTO_MENSAL traz R$ 0,00); resposta da demanda de janeiro de 2026 (5.859 mil R$ no boletim do MME; 0 no conjunto) e de outubro de 2024 (R$ 3,32 milhões no InfoMercado; mês ausente do conjunto); agentes contabilizados (15.803, 15.936 e 16.376 no conjunto aberto contra 15.795, 15.932 e 16.364 no InfoMercado de ago/2024, out/2024 e jul/2026: o conjunto é a versão vigente da contabilização e o InfoMercado de 2026 declara contar a CCEE como participante); "Consumo/Geração" do InfoMercado 0,1% a 0,2% acima da soma das classes (definição não detalhada pela fonte).

Testes (`python3 -m unittest pipeline.tests.test_energia_mercado`, 41 testes, 0,2 s, sem rede): reconciliação da tabela longa da EPE com a planilha formatada; releitura do Parquet do SAMP com pyarrow.compute para CEMIG-D (grande, 6.956 unidades livres em dez/2025) e CERAL Anitápolis (pequena, refaturamento de 0,1 MWh fora da competência); GSF contra as três edições do InfoMercado; componentes de encargos contra o InfoMercado; ressarcimentos não contados duas vezes; boletim do MME por tipo e mês e reprocessamento entre edições; quebra da classe Varejista; Roraima em dois subsistemas; fluxos de CNPJ com entrada, saída e volta; desligamento com sucessão (Geranorte sucedida pela Eneva); ausência, zero e "liquidação não informada" distintos; esquema divergente (coluna renomeada, classe nova, submercado desconhecido, rótulo novo no InfoMercado) recusado; textos derivados; catálogo de métricas.

## 5. Limitações materiais

* Os conjuntos abertos da CCEE começam em 2023: GSF, consumo contabilizado por ambiente e encargos da CCEE não têm série anterior. As planilhas "InfoMercado Dados Gerais" (2013 a maio de 2024), listadas na página Mercado Mensal da CCEE, estenderiam as séries e não foram integradas (`pendencias` na gold).
* O cadastro de perfis é uma posição: o painel não publica entradas e encerramentos mensais de perfis. O conjunto LISTA_PERFIL (status no mês de referência, 2024 e 2025) não foi integrado.
* A lista de associados mês a mês começa em outubro de 2025.
* O boletim do MME só está acessível para 2026: a página índice lista pastas de 2011 a 2022 e 2026, e o endereço da pasta de 2025 devolve uma página genérica sem PDF (`bloqueios` na gold, com captura e sha256 da página).
* SAMP: o consumidor livre ligado direto à rede básica não é faturado por distribuidora; "fonte incentivada" inclui os consumidores especiais sem separá-los; "ERC" não é definido no dicionário.
* EPE: o ano corrente é preliminar; o livre inclui livres, especiais e autoprodutores que compram no ACL, sem separação.
* A data de modificação informada pelo CKAN da CCEE nem sempre acompanha o conteúdo (o arquivo de 2026 de ENCARGO_ESS_ANCILAR traz julho com data de modificação de junho); a gold não usa essa data como data do dado.
* Não se pode concluir: preço de contrato do mercado livre (o PLD não é preço contratual; não há PPA nem curva a termo no escopo aberto), exposição financeira de usina ou agente ao GSF, causa de variação de consumo ou de encargos.

## 6. Pedidos ao integrador

1. **Acesso à CCEE.** Confirmar que a coleta pelo cliente HTTP do pipeline (o mesmo do PLD no Actions, sem disfarce de navegador) é aceitável quando o `curl` recebe 403. Se a decisão for não usar a CCEE a partir deste ambiente, o módulo continua coletando no Actions; aqui a gold conserva a última captura válida.
2. **Workflow.** `atualizar-energia.yml` já instala `poppler-utils` (pdftotext), usado pelo boletim do MME e pelo InfoMercado; manter. O módulo baixa cerca de 260 MB de CSV da CCEE (parcelas de carga) e 75 MB de Parquet do SAMP na primeira coleta; nas seguintes, só o que mudou (política de 7 dias e last_modified).
3. **Página.** `src/app/setor-eletrico/mercado/page.tsx` ainda usa `ModuloEmIntegracao`; a fase de interface deve substituí-la lendo `lerGold<MercadoGold>("mercado.json")`, sem recalcular razões, e carregar sob demanda `/energia/series/mercado_detalhe.json` (endereço em `detalhe.url` de cada seção) e os CSV (`livre_regulado.distribuidoras.csv` tem a tabela completa das 103 distribuidoras).
4. **Verbetes.** `src/lib/energia/conteudo/conceitos-mercado.ts` está vazio; as definições a usar estão em `definicoes` da gold (ACL, ACR, agente, perfil, parcela de carga, unidade consumidora, migração, desligamento, MRE, GSF, ESS, EER, competência e pagamento, PLD).
