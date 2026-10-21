# Estudo de benchmarks do Observatório do Setor Elétrico

Registro da pesquisa pedida na seção 4 da [especificação](ESPECIFICACAO.md): o que cada referência faz bem, o que faz mal e o que isso muda neste observatório. As referências servem de régua de ambição e de padrão de comparação. Nenhuma delas certifica o nosso produto, e página comercial não prova a acurácia de modelo nenhum.

Componentes citados: [catálogo de componentes](../COMPONENTES_ENERGIA.md). Arquivos por módulo e regras numéricas: [contrato dos módulos](CONTRATO_MODULOS.md). Rotas: seção 5.2 da especificação e `src/lib/energia/navegacao.ts`. Em 30/09/2026 as páginas `/setor-eletrico/conta-de-luz`, `/perdas`, `/qualidade`, `/inclusao-energetica` e `/transicao` ainda não existem (`publicado: false`); as decisões que se aplicam a elas valem para a fase de interface desses módulos.

## Como a consulta foi feita

* **Data:** 30/09/2026, entre 23h39 e 23h59 UTC (20h39 a 20h59 em Brasília).
* **Leitura do conteúdo:** curl 8.5.0 pelo proxy HTTPS do ambiente, com o status HTTP de cada endereço registrado abaixo. O HTML foi convertido em texto para leitura; nada foi republicado.
* **Experiência visual e interação:** Chromium 141 headless (playwright-core 1.56.0) em dois dispositivos: desktop de 1440 × 900 px e celular de 390 × 844 px (toque, escala 2). O navegador foi configurado para aceitar a autoridade certificadora do proxy do ambiente, sem desligar a verificação TLS. Em cada página: captura da primeira tela e da página inteira, largura do documento contra a largura da janela, e, nas páginas interativas, cliques nos controles, inspeção do DOM (tabelas, nomes acessíveis, estado das abas) e percurso por teclado.
* **Capturas:** guardadas fora do repositório, no diretório de trabalho da sessão (`scratchpad/benchmarks/`), com os nomes citados em cada referência. Não foram versionadas porque reproduzem a identidade visual de terceiros.
* **Cuidados:** nenhum texto longo copiado (as citações abaixo têm no máximo uma linha), nenhum dado proprietário baixado ou reutilizado. Os termos de uso do HEPI proíbem a raspagem dos dados brutos; a página foi apenas observada.

| Endereço pedido | Status HTTP | Observação |
| --- | --- | --- |
| https://discoverwater.co.uk | 200 | |
| https://www.discoverwater.co.uk/leaking-pipes | 200 | |
| https://www.discoverwater.co.uk/about | 200 | |
| https://vaasaett.com/services/energy-cost-insights-forecast/ | 200 | |
| https://www.energypriceindex.com/ | 200 | consultadas também `/methodology` (200) e `/price-data` (200) |
| https://www.smard.de/en | 200 | consultadas também `/en/marktdaten` (200), a central de download (200), `/en/datennutzung` (200) e `/en/user-guide` (200) |
| https://www.eia.gov/electricity/data/ | **403** | corpo "You do not have permission to view this directory or page." no curl e no Chromium; HEAD respondeu 503 (Akamai). A página equivalente, ligada pelo próprio menu da EIA como "Browse Data", é https://www.eia.gov/electricity/data.php (200), consultada no lugar |
| https://www.eia.gov/electricity/data/guide/pdf/guide.pdf | 200 | PDF de 18 páginas, datado de março de 2018 |
| https://www.eia.gov/electricity/data/browser/ | 200 | ferramenta renderizada por JavaScript, explorada no Chromium |
| https://data.open-power-system-data.org/ | 200 | consultadas também `/time_series/` (200) e `/time_series/latest/` (200) |

## 1. Referências

### 1.1 DiscoverWater (B1 e B2)

**Consultado:** página inicial, `/leaking-pipes` (abertura, painel "Click for company comparison" com as abas "About leakage", "Latest results" e "Previous years") e `/about`, em desktop e celular. Capturas: `discoverwater-home-{desktop,celular}.png`, `discoverwater-leaking-pipes-{desktop,celular}*.png` (variações `-kpis`, `-painel`, `-ultimos`, `-real-vs-meta`, `-por-km`), `discoverwater-about-{desktop,celular}.png`.

**Padrões observados:**

* **Entrada pelo cotidiano.** A página inicial agrupa o setor em blocos que o cidadão reconhece ("About your drinking water", "Water to your tap", "Looking at the money") e cada bloco abre uma lista "What would you like to know more about ..." com três a seis destinos.
* **Número de abertura com escala e procedência.** Em `/leaking-pipes`, "352,119km" e o volume diário perdido vêm com uma equivalência concreta ("Equivalent to 1,187 Olympic swimming pools per day") e com fonte, território e período logo abaixo ("Source: Water UK; England and Wales").
* **Explicação antes da comparação.** A aba "About leakage" diz como comparar antes de mostrar o gráfico ("There are different ways to compare how companies are doing on leaks") e lista o que faz o resultado variar ("Leaks can also vary due to:") sem atribuir causa a nenhuma empresa.
* **Várias normalizações, cada uma com o seu denominador.** Abas "Total Leakage", "Cubic metres per km of main (per day)" e "Litres per property (per day)", justificadas por "To compare companies of different sizes".
* **Realizado contra meta.** A aba "Actual versus Target" mostra barras pareadas "2024-25 Actual" e "2024-25 Target" por empresa, com a linha de base declarada ("the baseline level is set at the 2019-20 actual three-year average").
* **Referência de conjunto no gráfico.** Os gráficos por km e por imóvel trazem uma barra "Average" e uma linha vertical de referência; as empresas aparecem em ordem alfabética, sem cor de "bom" ou "ruim".
* **Rótulo acima da barra no celular.** Em 390 px o nome da empresa sobe para cima da barra, sem corte (captura `discoverwater-leaking-pipes-celular-por-km.png`).
* **Governança datada.** `/about` diz quem produz e quem concordou com os dados, quando houve a última atualização ("updated in January 2026 with 2024-25 company performance data") e quando virá a próxima ("will be updated in late 2026").

**Limitações:**

* Texto que contradiz a medida: a descrição do gráfico por imóvel diz "compared to the overall length of water pipes"; o texto de vazamentos fala em "spills" e "discharge targets", termos de esgoto.
* A mesma empresa aparece como "Dwr Cymru Welsh Water" num gráfico e "Dŵr Cymru Welsh Water" nos demais.
* Seis gráficos SVG sem `title` nem `aria-label` e nenhum `<table>` na página. Os gráficos são alimentados por CSV servidos em `/csv/`, mas não há link de download visível.
* As abas têm `role="tab"` e `tabindex="0"`, mas nenhum `aria-selected`: o estado ativo existe só na classe `is-active`, invisível para leitor de tela.
* No celular, o seletor das quatro medidas ocupa a tela inteira antes do gráfico, com opções não selecionadas em cinza claro sobre cinza escuro.
* O número de destaque da página inicial ("OVERALL PERFORMANCE 3.72") aparece sem escala nem unidade.
* Metas e resultados em média de três anos suavizam o efeito do clima, mas escondem o ano a ano na leitura principal.
* Frases de defesa do setor ("Water companies take leakage extremely seriously") convivem com os dados, sem separação entre informação e posição das empresas.

### 1.2 VaasaETT (B3)

**Consultado:** `/services/energy-cost-insights-forecast/` em desktop e celular. Capturas: `vaasaett-energy-cost-{desktop,celular}*.png`.

**Padrões observados:**

* **Escopo separado por tipo de preço e custo.** A lista "Forecasting focus" distingue "Wholesale market", "PPA prices", "Ancillary markets", "Power bill" e "Fuel & carbon costs". É exatamente a separação que o observatório precisa fazer entre PLD, preço de contrato, tarifa e conta.

**Limitações:**

* Página comercial: não descreve método, amostra, período de validação nem erro de nenhum modelo. Afirmações como "globally renowned" e "Saved hundreds of €m" não são evidência.
* A única métrica de desempenho citada, "Over 99% accuracy in monthly prediction of national inflation rates", trata de inflação, não de preço de energia, e não traz definição de acurácia, horizonte nem amostra. Não serve de régua para a previsão do PLD.
* Fotografia decorativa ocupa a primeira tela; dados e séries são produto pago, sem acesso público.

### 1.3 HEPI, Household Energy Price Index (B4)

**Consultado:** página inicial, `/methodology` e `/price-data` (mapas Datawrapper e painéis Power BI incorporados), em desktop e celular. Capturas: `hepi-home-*.png`, `hepi-methodology-*.png`, `hepi-price-data-{desktop,celular}*.png` (variações `-mapa` e `-powerbi`).

**Padrões observados:**

* **Perfil típico declarado.** Os preços valem para "Residential customers with a typical consumption for the national capital city", com tarifa fixa somada ao preço por kWh ("Standing fees are added to the price per kWh").
* **O que entra e o que fica de fora.** A metodologia tem uma lista explícita de exclusões ("HEPI prices do not relate to:"), que inclui tarifas sociais, bônus e contratos antigos.
* **Decomposição do preço final.** "Breakdown of end-user price composition": energia, distribuição e transmissão, tributos e IVA.
* **Ponderação declarada.** O peso de cada cidade é o tamanho do mercado ("number of households x average residential consumption").
* **Revisão declarada.** "Note on retrospective price adjustments" explica por que o índice pode diferir da conta real de um mês.
* **Ressalva territorial e recorte padrão.** "the price for GB is not representative of the price in Northern Ireland"; "not all markets are contained by default" para não poluir os gráficos históricos.

**Limitações:**

* Os mapas pintam o país inteiro com o preço da capital, o que sugere cobertura territorial que a medida não tem. A escala é um gradiente contínuo (8,41 a 39,29 c€/kWh) sem classes, e países em cinza não têm explicação na legenda.
* No celular, os painéis Power BI abrem com zoom de 24% e ficam ilegíveis (captura `hepi-price-data-celular-powerbi.png`); os `iframe` do Power BI e do livro digital não têm `title`.
* Termos de uso: "Automated or manual scraping of the raw data is prohibited". Os dados não podem ser reutilizados aqui.
* Primeira tela tomada por fotografia decorativa.

### 1.4 SMARD (B5)

**Consultado:** página inicial, "Market data visuals" (pelo menu e por um link pronto da página inicial com geração e consumo), alternância gráfico e tabela, menu "More", central de download, "Data use" e "User guide", em desktop e celular; teste de restauração de um link com período explícito. Capturas: `smard-home-*.png`, `smard-market-data-{desktop,celular}*.png` (variações `-grafico`, `-tabela`, `-mais`, `-url-restaurada`), `smard-download-*.png`.

**Padrões observados:**

* **Estado completo na URL.** `marketDataAttributes` guarda resolução, início, fim, séries (`moduleIds`), região e estilo; há botão "Copy link". Um link com período explícito abriu com as mesmas séries e o período reajustado ao fuso do navegador (ver limitações).
* **Gráfico e tabela sobre os mesmos dados.** "Show table" e "Show diagram" alternam a visualização; a tabela traz "Starting time" e "Endtime" de cada intervalo e a unidade no cabeçalho ("Biomass in MWh").
* **Definição de cada série no controle.** O ícone de informação de cada categoria traz unidade, intervalo, natureza e defasagem: "electricity generation is estimated where data is incomplete", "data is delivered up to one hour after actual generation", "[Source: ENTSO-E]".
* **Previsão distinguida do realizado.** Linhas de previsão tracejadas sobre o realizado contínuo; legenda com alternância de visibilidade por série; seletor de período com visão geral sob o gráfico.
* **Território com vigência.** A central de download oferece "Bidding zone: DE/LU (from 10/01/2018)" e "DE/AT/LU (until 09/30/2018)", além de resolução original, CSV, XLSX e XML.
* **Licença e atribuição prontas.** "Data use": CC BY 4.0, com o texto de atribuição a usar.
* **Explicação separada dos dados.** Menus "Energy market explained", "Plain Language" e "Sign Language".

**Limitações:**

* Pelo menu, "Market data visuals" abre vazio: "Please select at least one component."
* Datas na URL em milissegundos de época. Um link que começava às 0h de 01/01/2026 no horário alemão abriu, num navegador em UTC, com início em 31/12/2025: o período restaurado depende do fuso de quem abre.
* No celular, a página inicial e "Market data visuals" transbordam: `scrollWidth` de 402 px numa janela de 390 px.
* Chaves de tradução expostas no texto acessível: os botões de ocultar série contêm "moduleList.label.hideModule"; a janela de feedback mostra "[--- accessibility.error.message ---]".
* Página inicial com carrossel de rotação automática (há botão de pausa) e fotografia grande.
* O gráfico de geração empilha 12 fontes com cores próximas e sobrepõe quatro linhas de consumo; no celular a leitura fica muito densa.
* O manual do usuário publicado é de setembro de 2021.

### 1.5 EIA (B6)

**Consultado:** `/electricity/data/` (403, ver tabela acima), `/electricity/data.php` no lugar, o guia em PDF e o Electricity Data Browser (gráfico, tabela, menu de download, troca de frequência e estado da URL), em desktop e celular. Capturas: `eia-electricity-data-dir-*.png` (página de erro), `eia-electricity-data-php-*.png`, `eia-data-browser-{desktop,celular}*.png` (variações `-download` e `-mapa`).

**Padrões observados:**

* **Catálogo com datas e formatos por produto.** Cada tabela em `data.php` mostra data de publicação, publicação de origem e formatos: "Release date: September 29, 2026 | Data from: Monthly Energy Review", "Available formats: PDF CSV XLS Interactive"; séries mensais e anuais separadas ("Annual (back to 2009)").
* **Consulta livre ou relatório pronto.** O browser oferece "Change data set" ou "View a pre-generated report".
* **Identificadores estáveis na URL.** O estado fica no hash com códigos de série e frequência (`ELEC.GEN.ALL-US-99.A`, `freq=A`).
* **Composição em tabela hierárquica.** "All fuels" se abre em carvão, gás natural, nuclear, "Other renewables" e assim por diante, com subtotais.
* **Índice com base no início.** "CHART INDEXING OPTIONS: None | Index to start as percent | Index to start as value".
* **Download do gráfico e dos dados.** "Chart: PDF PNG SVG EMBED" e "Data: Chart (CSV) Table (CSV)".
* **Precisão como estado.** "NM = Not meaningful due to large relative standard error", com opção de mostrar o erro relativo entre parênteses.
* **Guia que declara imputação e cobertura.** Valores mensais estimados por amostra são substituídos pelo censo anual ("imputed values ... are replaced by reported values"); a qualidade varia por período ("most consistent ... beginning with the 2002 data"); edições antigas só em PDF.

**Limitações:**

* O endereço pedido, `/electricity/data/`, responde 403.
* O browser não tem `meta viewport`: num telefone de 390 px a página é desenhada com 980 px e o texto fica minúsculo (captura `eia-data-browser-celular.png`).
* O guia é de março de 2018 e descreve o produto daquele ano; a página do browser ainda anuncia "Explore the new Beta version", sem data.
* API com registro obrigatório; densidade de controles alta para quem não é do setor.

### 1.6 Open Power System Data (B7)

**Consultado:** página da plataforma e pacote "Time series" (versões, downloads, filtros, documentação de campos), em desktop e celular; teste do endereço `latest`. Capturas: `opsd-home-*.png`, `opsd-home-celular-pacotes.png`, `opsd-time-series-*.png`.

**Padrões observados:**

* **Pacote versionado.** Cada pacote tem data de versão, DOI ("10.25832/time_series/2020-10-06"), lista de todas as versões e um endereço estável `latest` (respondeu 200).
* **Documentação campo a campo.** "Field documentation": nome, tipo e formato, descrição com unidade e fonte ("Total load in Austria in MW").
* **Reprodução ao lado do dado.** Script e documentação em notebook, link para o GitHub, "View original input data", `README.md` e `datapackage.json`.
* **Dois carimbos de tempo.** `utc_timestamp` e `cet_cest_timestamp`, ambos como início do intervalo.
* **Matriz de disponibilidade.** "Data availability overview": país × conjunto com o ano de início ("2015+", "2006+").
* **Citação pronta com versão** e aviso de que os direitos são do dono do dado primário.

**Limitações:**

* Atualidade: a versão mais recente das séries temporais é de 06/10/2020 e cobre "2015-mid 2020", embora o pacote declare "Last changes: Yearly update". O pacote mais novo da plataforma é de 27/07/2023. Serve como modelo de organização, não como fonte atual.
* A página do pacote tem 38.690 px de altura em 1440 px, porque o dicionário inteiro vem embutido.
* No celular, os links "Docs" da lista de pacotes começam em x = 375 px e têm 30 px de largura numa tela de 390 px: ficam parcialmente cortados.

## 2. Registro de benchmark

Cada linha liga um padrão observado a uma decisão e a uma forma de verificar. "Já atende" indica componente que, segundo o catálogo, já cumpre a decisão; "página pendente" indica destino ainda sem página em 30/09/2026; "teste a criar" é verificação ainda não escrita.

| Padrão observado | Evidência | Decisão adotada | Componente/página onde se aplica | Forma de verificar a melhoria |
| --- | --- | --- | --- | --- |
| **DW-1** Entrada por perguntas e temas do cotidiano, cada um com poucos destinos | Blocos da página inicial do DiscoverWater; "What would you like to know more about ..." | Seção D da home com perguntas cotidianas que levam ao destino específico (perdas, qualidade, conta) e ao recorte quando a página aceitar; nenhuma pergunta aponta para destino sem página | `/setor-eletrico`, seções C e D (`id="perguntas"`, `id="trilhas"`); `CabecalhoEnergia` | `energia-comp-navegacao` (nenhum link para `publicado: false`); teste a criar em `energia-mapa.test.ts`: toda pergunta da seção D aponta para rota existente; jornada da seção 15.2 medida com Playwright a 390 px: da home à resposta de "Minha distribuidora perde muita energia?" em até dois toques |
| **DW-2** Número de abertura com fonte, território e período logo abaixo | "352,119km" seguido de "Source: Water UK; England and Wales" e do período | Todo número de abertura usa `Numero` com período, universo e fonte visíveis e prova no "Comprove este número" | `Numero` e `ComproveNumero` (já atendem); abertura de `/setor-eletrico/perdas`, `/qualidade` e `/conta-de-luz` (páginas pendentes) | `energia-comp-evidencia`; varredura do HTML gerado: todo KPI tem período não vazio e botão de prova |
| **DW-3** Equivalência concreta para dar escala a um volume | "Equivalent to 1,187 Olympic swimming pools per day" | Adotada com restrição: equivalência só quando calculada no pipeline com denominador público do mesmo período e fonte (ex.: perda anual em GWh expressa em consumo residencial medido); natureza CALCULADO e fórmula na prova. Sem esse denominador, não há equivalência | `/setor-eletrico/perdas`, abertura do P055 (página pendente); `Numero` | Teste a criar em `test_energia_perdas.py`: equivalência = volume ÷ denominador da gold, com numerador e denominador conferidos; varredura da página por fator numérico literal no código |
| **DW-4** Normalizações alternativas para comparar empresas de portes diferentes, cada uma com o seu denominador | Abas "Total Leakage", "Cubic metres per km of main (per day)", "Litres per property (per day)" | Seletor de medida em Perdas: volume (GWh), taxa total sobre a energia injetada, não técnica sobre o mercado de baixa tensão medido; o rótulo nomeia o denominador; por unidade consumidora só com contagem da mesma fonte e período; por km de rede não adotado (extensão de rede não integrada) | `/setor-eletrico/perdas` P055 e P056 (página pendente); `GraficoBarras` horizontal; `TabelaInterativa`; `pipeline/energia/metricas/perdas.py` | `test_energia_perdas.py` (agregado = 100 × Σ numeradores ÷ Σ denominadores); teste a criar: rótulo e unidade exibidos para cada medida iguais aos do catálogo de métricas |
| **DW-5** Realizado contra meta por empresa, com linha de base declarada | Aba "Actual versus Target", barras pareadas; "the baseline level is set at the 2019-20 actual three-year average" | Pontos pareados realizado × referência com diferença escrita: DEC e FEC apurados × limite do mesmo ano (P052); perda técnica × percentual regulatório implícito do mesmo trecho de vigência (P057); a referência de não técnica segue declarada como bloqueada, sem par inventado | `GraficoPontos` (já atende: sinal e sentido na precisão exibida, sem cor de bom ou ruim); `/setor-eletrico/qualidade`, `/setor-eletrico/perdas` (páginas pendentes) | `energia-comp-grafico-pontos`; teste a criar em `test_energia_qualidade.py`: limite e apurado do mesmo ano por conjunto; inspeção: legenda nomeia a vigência da referência |
| **DW-6** Referência de conjunto desenhada no gráfico de comparação | Barra "Average" e linha vertical nos gráficos por km e por imóvel | Linha de referência do Brasil calculada por razão de somas, com rótulo que diz isso, nunca média simples de percentuais | `GraficoBarras` (`referencias`); `/perdas`, `/qualidade` (páginas pendentes) | Teste a criar: valor da referência = 100 × Σ numeradores ÷ Σ denominadores das entidades listadas, com as excluídas contadas por motivo |
| **DW-7** Como comparar explicado antes do gráfico; fatores de variação listados sem culpa | "There are different ways to compare how companies are doing on leaks"; "Leaks can also vary due to:" | "Como ler" antes do visual principal e "O que não permite concluir" ao lado; fatores de contexto (extensão e densidade da rede, perfil de consumo, área atendida) descritos como associação; nenhuma responsabilidade atribuída às famílias da área | `ModoProfundidade` (Entender); `GraficoDispersao` (rodapé com aviso de causalidade, já atende); `/perdas` P058, `/qualidade` | `energia-comp-dispersao`; teste a criar sobre os textos gerados por `resumos.ts` e `leituras.ts`: nenhuma frase automática de associação usa verbo causal ("causou", "por causa de", "devido a") |
| **DW-8** Governança datada: quem produz, última e próxima atualização | `/about`: "updated in January 2026 with 2024-25 company performance data"; "will be updated in late 2026" | Por fonte: último período disponível, data de captura e, só quando a fonte publica calendário, a próxima atualização; nada de "dados atualizados" sem data | `/setor-eletrico` seção G (`id="fontes"`); `/setor-eletrico/dados` (`TabelaDados`, `CatalogoFiltro`) | Teste a criar em `energia-gold-contrato.test.ts`: período de referência e captura são campos distintos e preenchidos; "próxima atualização" só aparece com campo de origem declarado |
| **DW-9** (limitação) Texto do gráfico contradiz a medida | Gráfico por imóvel descrito com "compared to the overall length of water pipes"; "spills" e "discharge targets" no texto de vazamentos | Subtítulo, unidade e denominador de cada gráfico vêm do catálogo de métricas, fonte única; nenhum texto livre repete a definição | `src/lib/energia/metricas.ts` e `pipeline/energia/metricas/*.py`; todas as páginas temáticas | Teste a criar: em cada gráfico ligado a uma métrica, unidade e denominador renderizados iguais aos de `metricas.json` |
| **DW-10** (limitação) Mesma empresa com grafias diferentes | "Dwr Cymru Welsh Water" num gráfico, "Dŵr Cymru Welsh Water" nos outros | Identidade por CNPJ (`pipeline/energia/entidades.py`) e um único nome de exibição por CNPJ em todo o observatório | `/perdas`, `/qualidade`, `/conta-de-luz`, `/empresas`; `Comparador`, `TabelaInterativa` | Teste a criar: em `perdas.json`, `qualidade.json`, `conta.json` e `empresas.json`, cada CNPJ tem um só nome de exibição |
| **DW-11** (limitação) Gráficos sem tabela, sem nome acessível e sem download | Seis SVG sem `title` nem `aria-label`; zero `<table>`; CSV servidos sem link | Todo gráfico tem tabela equivalente com os mesmos números, nome acessível e exportação do recorte exibido | `GraficoLinhas`, `GraficoBarras`, `GraficoPontos` (tabela equivalente, já atendem); `TabelaInterativa` (CSV e XLSX, já atende) | `energia-comp-integracao` e `energia-comp-tabela` (equivalência gráfico, tabela e exportação); inspeção com leitor de tela de uma página por módulo |
| **DW-12** (limitação) No celular, seletor ocupa a tela antes do gráfico; abas sem estado anunciado | Captura `discoverwater-leaking-pipes-celular-ultimos.png`; `role="tab"` sem `aria-selected` | Seletor de medida compacto (uma linha com rolagem interna ou `select` nativo) e estado anunciado por `aria-checked`, `aria-selected` ou `aria-pressed` | `ModoProfundidade` (já usa `radiogroup` com `aria-checked`); seletores de medida de `/perdas` e `/qualidade` (páginas pendentes) | Playwright a 390 × 844: topo do gráfico principal dentro da primeira tela após título e seletor; teste dos atributos de estado nos seletores |
| **HE-1** Perfil de consumo típico declarado para comparar preços | "Residential customers with a typical consumption for the national capital city" | Perfis de 100, 200 e 300 kWh/mês apresentados como "perfis de referência do observatório", nunca como consumo médio; o mesmo perfil para todas as distribuidoras | `/setor-eletrico/conta-de-luz` P047 (página pendente); `GraficoBarras`, `TabelaInterativa` | `test_energia_conta.py` (custo do perfil = kWh × (TE + TUSD) ÷ 1000); teste a criar: a página diz "perfil de referência" e não associa os perfis a "consumo médio" |
| **HE-2** Lista explícita do que o preço inclui e exclui | "HEPI prices do not relate to:" | Caixa "O que este valor inclui e não inclui" em cada número da conta: TE + TUSD; sem ICMS, PIS/Pasep, Cofins e iluminação pública; bandeira separada; Tarifa Social fora do ranking | `/conta-de-luz` P047 a P049 (página pendente); `Numero` (`nota`), `ComproveNumero` (exclusões) | Teste a criar: toda evidência da conta tem `exclusoes` preenchido e a página o exibe; jornada "Por que a conta de luz subiu?" sem atribuição causal automática |
| **HE-3** Decomposição do preço final | "Breakdown of end-user price composition" | Composição empilhada (energia, transmissão, distribuição, perdas, encargos, outros, créditos); tributos declarados como fora do valor, não como zero | `/conta-de-luz` P048 (página pendente); `GraficoBarras` empilhado (pilha incompleta sem total, já atende) | `test_energia_conta.py` (componentes fecham com a tarifa); `energia-comp-grafico-barras` |
| **HE-4** Revisão retroativa explicada como causa de diferença para a conta | "Note on retrospective price adjustments" | Perfis e simulador rotulados como estimativa (natureza ESTIMADO); revisões registradas e visíveis na prova | `/conta-de-luz` P049 (página pendente); `SeloNatureza`, `ComproveNumero` (revisões) | `energia-comp-evidencia`; teste a criar: nenhum texto do simulador usa "conta final" ou "valor exato" |
| **HE-5** Ponderação do agregado declarada | "number of households x average residential consumption" | Todo agregado diz se é ponderado e por quê: mediana simples entre distribuidoras na conta, DEC e FEC ponderados por unidades consumidoras, perdas por razão de somas | `ComproveNumero` (`pesos`); `/conta-de-luz`, `/qualidade`, `/perdas` | Teste a criar: toda evidência de agregado tem `pesos` preenchido, inclusive "sem ponderação"; `test_energia_qualidade.py` (ponderação por UC) |
| **HE-6** Recorte padrão pequeno, o resto por escolha | "not all markets are contained by default" | Comparação de até quatro entidades, seleção padrão dita no texto | `Comparador` (`LIMITE_COMPARACAO`, já atende); `/perdas`, `/qualidade`, `/conta-de-luz` | `energia-comp-comparador` (limite anunciado, domínio comum calculado só sobre as selecionadas) |
| **HE-7** Ressalva territorial explícita | "the price for GB is not representative of the price in Northern Ireland" | Tarifa vale para a área da distribuidora; município atendido por mais de uma distribuidora ou permissionária é marcado; nenhum município herda valor de quem não o atende | `MapaCoropletico` com `agruparPorChave`; `/conta-de-luz`, `/perdas` | `energia-comp-mapa-coropletico`; teste a criar: no mapa da conta, todo município com valor está ligado à distribuidora pela relação oficial da ANEEL |
| **VA-1** Escopo separado por tipo de preço e custo | "Wholesale market", "PPA prices", "Ancillary markets", "Power bill" | PLD (curto prazo), preço de contrato (ACL e ACR), tarifa homologada (TE + TUSD) e conta simulada são coisas diferentes no texto, na navegação e no mapa conceitual; o PLD só se liga à conta como componente de custo; nenhum cálculo da conta usa PLD × consumo | Mapa conceitual da home (seção B); `CabecalhoEnergia` (grupos "Preços e mercado" e "Consumidor e território"); `/pld`, `/mercado`, `/conta-de-luz`; verbetes do Aprenda | Teste a criar em `test_energia_conta.py`: a gold da conta não lê conjunto de PLD; teste de texto: `/conta-de-luz` só cita "PLD" no bloco explicativo; inspeção do tipo de ligação no mapa conceitual |
| **SM-1** Estado completo da consulta na URL, com "Copiar link" | `marketDataAttributes` com `resolution`, `from`, `to`, `moduleIds`, `region`; botão "COPY LINK" | Filtros, período, entidade e medida na URL; datas como data civil de Brasília (AAAA-MM-DD, formato de `tiposUrl.data`), nunca milissegundos; ação "Copiar link" | `useEstadoUrl` (já atende o formato de data); `GraficoLinhas` (`intervalo`), `TabelaInterativa` e `Comparador` (`chaveUrl`); `/pld`, `/carga`, `/geracao`, `/perdas` | `energia-comp-estado-url`; teste a criar: o mesmo link restaura o mesmo intervalo com `TZ=UTC` e `TZ=America/Sao_Paulo` |
| **SM-2** Gráfico e tabela alternáveis; tabela com início e fim do intervalo e unidade no cabeçalho | "Show table" e "Show diagram"; colunas "Starting time", "Endtime", "Biomass in MWh" | Tabela equivalente com início e fim do intervalo nas séries horárias e semi-horárias, unidade no cabeçalho | `GraficoLinhas` (tabela equivalente), `TabelaInterativa`; `/pld`, `/carga`, `/rede` | `energia-comp-integracao`; teste a criar: tabela de série sub-diária tem início, fim e unidade no cabeçalho |
| **SM-3** Definição de cada série no controle: unidade, intervalo, natureza, defasagem e fonte | "electricity generation is estimated where data is incomplete"; "[Source: ENTSO-E]" | Cada série abre, por foco, toque e clique, unidade, intervalo, natureza (medido, estimado, previsão), defasagem típica de publicação e fonte, tirados da proveniência da gold | `SobreEsteDado`, `SeloNatureza`, legenda do `GraficoLinhas`; `/geracao`, `/carga`, `/agua-e-clima`, `/rede` | `energia-gold-contrato` (proveniência com unidade, frequência e limitações não vazias); inspeção por teclado |
| **SM-4** Previsão tracejada sobre o realizado | Linhas de previsão tracejadas em "Market data visuals" | Previsão e programação sempre tracejadas e nomeadas na legenda e na tabela; realizado em traço contínuo | `GraficoLinhas` (`tracejada`); `/carga` (verificada × programada), `/setor-eletrico/pld/previsoes` | Teste a criar: série com natureza de previsão ou programação é passada com `tracejada` |
| **SM-5** Território e entidade com vigência | "Bidding zone: DE/LU (from 10/01/2018)"; "DE/AT/LU (until 09/30/2018)" | Incorporações e mudanças de área datadas no catálogo, no dicionário dos CSV e nas quebras do REGISTRO | `/setor-eletrico/dados/[dataset]`; `REGISTRO.quebras`; `LinhaDoTempo` | Teste a criar: entidade encerrada (ex.: RGE, maio de 2019) tem data de fim no dicionário e nenhuma linha posterior |
| **SM-6** Download por categoria, território, resolução (inclusive a original) e formato; licença com atribuição | "Resolution: original resolution"; CSV, XLSX e XML; "Data use" com CC BY 4.0 | Arquivo no grão publicado e agregados, CSV e XLSX, licença da fonte original e citação com versão em cada conjunto | `/setor-eletrico/dados`; `TabelaInterativa` (exportação, já atende); `ComproveNumero` (citação ABNT, já atende) | Teste a criar: todo conjunto em `datasets.ts` tem licença e download existente em `public/energia/series/` |
| **SM-7** Explicação em linguagem simples a um clique dos dados | Menus "Energy market explained" e "Plain Language" | Verbetes do Aprenda ligados de cada painel no ponto em que o conceito aparece | `/setor-eletrico/aprenda/[conceito]`; links "entender" dos cartões da seção C da home | Teste a criar: todo link de conceito em página temática resolve para verbete existente em `conteudo/conceitos*.ts` |
| **SM-8** (limitação) Estado inicial vazio | "Please select at least one component." ao entrar pelo menu | Toda página abre com seleção padrão que já responde à pergunta do título | Todas as páginas com filtros | Playwright: nenhuma página abre com gráfico sem dado; teste a criar: o padrão de cada esquema de URL corresponde a valor presente na gold |
| **SM-9** (limitação) Transbordo no celular e chaves de tradução expostas | `scrollWidth` 402 px em 390 px; "moduleList.label.hideModule" no texto dos botões | Zero transbordo da página em 360, 390, 768 e 1440 px; nenhum identificador interno de texto no HTML | Todas as rotas `/setor-eletrico/**` | Playwright: `document.documentElement.scrollWidth` igual à largura da janela nas quatro larguras; varredura do HTML estático por chaves de interface |
| **EI-1** Catálogo com data de publicação, origem e formatos por produto | "Release date: September 29, 2026 \| Data from: Monthly Energy Review"; "Available formats: PDF CSV XLS Interactive" | Cada conjunto mostra período de referência, publicação pela fonte (se informada), captura, formatos e páginas que o usam | `/setor-eletrico/dados`; `CatalogoFiltro`, `TabelaDados` | `energia-gold-contrato`; teste a criar: as três datas são campos distintos e a captura nunca substitui o período |
| **EI-2** Relatório pronto ao lado da consulta livre | "Change data set" OR "View a pre-generated report" | Perguntas da home e "próxima pergunta" de cada painel como links com estado na URL | `/setor-eletrico` seção D; rodapé de cada painel; `useEstadoUrl` | Teste a criar: cada link pronto, lido por `buscaDeParametros`, produz estado válido sem cair no padrão por valor inválido |
| **EI-3** Identificadores estáveis de série na URL | `ELEC.GEN.ALL-US-99.A` e `freq=A` no hash | Entidades na URL por CNPJ, código de submercado ou slug de conjunto, nunca por nome de exibição | `useEstadoUrl`, `Comparador`, `TabelaInterativa` | Teste a criar: trocar o nome de exibição de uma entidade não altera a URL nem quebra a restauração |
| **EI-4** Composição em tabela com subtotais | "All fuels" com carvão, gás natural e "Other renewables" abertos em subitens | Composição como coluna de grupo filtrável e linhas de subtotal marcadas, com soma conferida; sem árvore expansível | `TabelaInterativa` (coluna categórica), `GraficoBarras` empilhado; `/geracao`, `/conta-de-luz` P048 | Teste a criar: subtotal de cada grupo = soma dos filhos dentro da tolerância declarada no documento do módulo |
| **EI-5** Índice com base no início do período | "CHART INDEXING OPTIONS: None \| Index to start as percent" | Variação acumulada desde uma data-base escrita, calculada no pipeline, para comparar tarifa e IPCA | `/conta-de-luz` P050 (página pendente); `GraficoLinhas` | `test_energia_conta.py` (variações em 12, 60 e 120 meses); teste a criar: índice igual a 100 na data-base |
| **EI-6** Download dos dados do gráfico e da tabela | "Data: Chart (CSV) Table (CSV)" | Exportação exatamente do que o gráfico e a tabela mostram, em CSV e XLSX; imagem e incorporação ficam para depois | `TabelaInterativa` e tabelas equivalentes (já atendem) | `energia-comp-tabela` (recorte e ordem exibidos, valor sem arredondamento) |
| **EI-7** Precisão como estado: "não significativo" e erro relativo | "NM = Not meaningful due to large relative standard error" | Estimativa amostral com CV: até 15% publicada, de 15% a 30% com cautela, acima de 30% suprimida com rótulo, nunca zero | `/setor-eletrico/inclusao-energetica` P061 (POF), `/qualidade` (IASC com amostra); `TabelaInterativa` | `test_energia_inclusao.py` (estados de precisão); teste a criar: nenhum valor `suprimido` aparece como número no HTML |
| **EI-8** Imputação e substituição declaradas | Guia, seção IV: "imputed values ... are replaced by reported values" | Natureza por ponto (medido, estimado, provisório, revisado); valor revisado mostra o anterior na prova | `SeloNatureza`, `ComproveNumero` (revisões); `/carga`, `/agua-e-clima`, `/transicao` | `energia-comp-evidencia`; teste a criar: ponto provisório na gold aparece com selo na tabela |
| **EI-9** Qualidade e cobertura variam por período | "most consistent ... beginning with the 2002 data" | Quebras metodológicas e trechos de cobertura diferente marcados nos gráficos e no catálogo | `GraficoLinhas` (`marcos`); `REGISTRO.quebras`; `/geracao` (achado A11), `/perdas` (leiaute do SAMP de 2024) | Teste a criar: todo conjunto com `quebras` tem marco no gráfico da página que o usa |
| **EI-10** (limitação) Ferramenta sem layout de celular; guia desatualizado | Browser sem `meta viewport` (980 px num telefone de 390 px); guia de março de 2018 | Viewport responsivo em toda página; documentos de método com data de estado e revisados a cada publicação | Layout de `/setor-eletrico/**`; `docs/observatorios/energia/modulos/*.md` | Playwright a 390 px; teste a criar: o "Estado em" de cada documento de módulo não é anterior à última gold publicada |
| **OP-1** Pacote versionado com DOI, lista de versões e endereço `latest` | "2020-10-06 (latest)"; `"latest" URL`; DOI do pacote | Download com versão (data da publicação) e dois links distintos: "dados atuais" e "snapshot histórico" | `/setor-eletrico/dados/[dataset]`; manifesto da publicação; `ComproveNumero` (versão) | Teste a criar: todo download listado tem versão no manifesto e os dois endereços existem no build |
| **OP-2** Documentação campo a campo | "Field documentation": nome, "number", "Total load in Austria in MW" | Dicionário de cada CSV com coluna, tipo, unidade, regra de ausência e fonte | `REGISTRO.arquivos`; `/setor-eletrico/dados/[dataset]` | Teste a criar: todo cabeçalho de `public/energia/series/*.csv` está no dicionário com unidade ou "sem unidade" |
| **OP-3** Código, dados originais e metadados legíveis por máquina junto do pacote | "View original input data"; `README.md`; `datapackage.json`; script no GitHub | Reprodução no "Comprove" (comando `executar_modulo.py`, versão do código, sha256 do original) e manifesto legível por máquina dos downloads | `ComproveNumero` (reprodução, já atende); `pipeline/energia/evidencia.py`; `/setor-eletrico/dados` | `test_energia_evidencia.py`; teste a criar: `executar_modulo.py <id> --sem-coleta` sobre o mesmo bronze reproduz a gold, ignorados os carimbos de processamento |
| **OP-4** Carimbo em UTC e em hora local | `utc_timestamp` e `cet_cest_timestamp`, início do intervalo | CSV horário e semi-horário com início do intervalo em horário de Brasília e em UTC; nas séries que alcançam o horário de verão (até fevereiro de 2019), a conversão o respeita | `public/energia/series/` de PLD, CMO e carga; `/pld`, `/carga` | Teste a criar: diferença de 3 h fora e de 2 h dentro do horário de verão nas séries que o alcançam |
| **OP-5** Matriz de disponibilidade por território e conjunto | "Data availability overview" com "2015+", "2006+" | Matriz de cobertura (tema × entidade ou território, início e fim) calculada da gold; "último período disponível" por fonte na home | `/setor-eletrico/dados` (P067, P068); `/setor-eletrico` seção G | Teste a criar: início e fim exibidos = mínimo e máximo do período presente na gold |
| **OP-6** Citação pronta com versão | "Open Power System Data. 2020. Data Package Time series. Version 2020-10-06." | Citação ABNT com versão da publicação e data de acesso do leitor | `ComproveNumero` (já atende) | `energia-comp-evidencia` |
| **OP-7** (limitação) Cadência declarada não garante atualidade | "Last changes: Yearly update", com última versão de 06/10/2020 | Atualidade medida pelo dado: último período disponível e idade contra a frequência esperada, com critério escrito; nada de selo verde sem critério | `/setor-eletrico/dados` (saúde, P068); seção G da home | Teste a criar: conjunto com último período mais antigo que frequência × tolerância aparece como defasado |
| **OP-8** (limitação) Página de pacote enorme e link cortado no celular | 38.690 px de altura em 1440 px; links "Docs" em x = 375 px com 30 px de largura em 390 px | Dicionário recolhido e carregado sob demanda; HTML abaixo de ~600 KB por página (contrato, seção 5.1) | `/setor-eletrico/dados/[dataset]` | Medida do tamanho do HTML gerado por rota; Playwright a 390 px |

## 3. O que não foi adotado e por quê

| O que não foi adotado | Onde foi visto | Por quê |
| --- | --- | --- |
| "99% de acurácia" ou qualquer acurácia genérica como métrica de previsão | VaasaETT ("Over 99% accuracy in monthly prediction of national inflation rates") | A afirmação trata de inflação, não traz definição, horizonte nem amostra, e vem de página comercial. A previsão do PLD é avaliada contra referências simples (persistência e sazonal) com diferença pareada de MAE e calibração das faixas ([governança da previsão](../PLD_GOVERNANCA_PREVISAO.md)). Verificação: teste a criar que procura "acurácia" seguida de percentual no HTML gerado e falha se encontrar |
| Página comercial como prova de qualidade de modelo ou de dado | VaasaETT ("globally renowned", "Saved hundreds of €m") | Não há método nem validação publicados. Serve só para o padrão de escopo (VA-1) |
| Reutilizar dados do HEPI ou da VaasaETT, inclusive para comparar Brasil e Europa | HEPI, `/price-data` | Dados proprietários; os termos proíbem a raspagem dos dados brutos. Uma comparação internacional, se vier, precisa de fonte aberta e de perfis equivalentes |
| Copiar identidade visual (blocos azuis do DiscoverWater, paleta do SMARD, cabeçalho da EIA) ou textos | Todas as referências | O observatório segue o próprio design system e tokens; as capturas ficaram fora do repositório |
| Carrossel automático e fotografia decorativa na primeira tela | SMARD (página inicial), VaasaETT, HEPI | A seção 6.2 proíbe; a primeira tela tem de orientar, não decorar |
| Índice composto sem escala nem unidade | DiscoverWater ("OVERALL PERFORMANCE 3.72") | A seção 10.4 proíbe índice composto opaco; número sem escala não se interpreta |
| Painéis de terceiros incorporados (Power BI, Datawrapper, livro digital) | HEPI | No celular o Power BI abre a 24% de zoom; `iframe` sem `title`; sem tabela equivalente; dependência externa e peso de página. Os gráficos do observatório são componentes próprios renderizados no servidor |
| Pintar um território inteiro com o valor de um ponto | HEPI (preço da capital no país todo) | A seção 8.3 proíbe replicar valor por território; o mapa da conta é por área de distribuidora (HE-7) |
| Escala contínua sem classes e cinza sem legenda | Mapas do HEPI | O `MapaCoropletico` usa classes explícitas e distingue sem dado, não se aplica e zero na legenda |
| Média móvel de três anos como leitura principal | DiscoverWater | Suaviza e esconde eventos (seção 8.2). Publica-se o valor anual; quando uma referência regulatória usar média de vários anos, ela aparece ao lado do valor anual, com a janela escrita |
| Voz institucional das empresas misturada aos dados | DiscoverWater ("Water companies take leakage extremely seriously") | O observatório não fala pelas empresas; o texto descreve dados e limites em tom neutro |
| Datas da URL em milissegundos de época | SMARD | O período restaurado mudou com o fuso de quem abriu o link; o observatório usa data civil (SM-1) |
| Configurações salvas em conta de usuário e API com registro | SMARD (nomear configurações), EIA (API com chave) | Publicação estática sem contas; o estado vive na URL e os dados em arquivos abertos |
| Formatos adicionais (multiíndice, empilhado, SQLite, XML) e exportação de imagem ou código de incorporação | OPSD, SMARD, EIA | Custo de manutenção para uma operação de uma pessoa; CSV e XLSX do recorte cobrem o reuso. Reavaliar se houver demanda registrada |
| Seletor de período com mini-gráfico de visão geral | SMARD | O `GraficoLinhas` já tem zoom por arrasto e "Restaurar"; o mini-gráfico duplica a série no navegador e pesa no celular. Pode ser reavaliado nas séries mais longas |
| Empilhar muitas fontes com cores próximas e sobrepor várias linhas no mesmo gráfico | SMARD (12 fontes e 4 linhas de consumo) | Leitura densa no celular e dependência de cor; preferem-se grupos de fontes e `PequenosMultiplos` (seção 8.2) |
| Equivalência ilustrativa com constante fixa | DiscoverWater (piscinas olímpicas, voltas ao equador) | Só entra equivalência calculada com denominador público e rastreável (DW-3) |
| Língua de sinais e versão bilíngue | SMARD ("Sign Language"), DiscoverWater (Cymraeg) | Fora do escopo atual; a linguagem simples foi adotada (SM-7) |
| Normalização por km de rede | DiscoverWater ("Cubic metres per km of main") | A extensão de rede por distribuidora não está integrada; publicar a razão sem o denominador de mesma fonte e período violaria a seção 10.3 |
