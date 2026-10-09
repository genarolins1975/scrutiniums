# Inventário de páginas do observatório de energia (HEAD antes do redesenho)

Gerado por `scripts/energia_inventario_visoes.py`. Uma linha por rota avaliada (as 94 de `docs/observatorios/energia/avaliacao/rotas.txt`, que incluem amostras de cada gabarito). As 22 aberturas da galeria vêm primeiro, com a medida da primeira tela. As rotas geradas por gabarito (fichas de conjunto, de empresa, verbetes) herdam a avaliação do gabarito.

## Aberturas (as 22 telas da galeria)

| ID | Rota | Tipo | Pergunta da abertura | Componente atual | Dado principal | Altura 1440 antes | H1 antes (palavras) | Primeiro gráfico em 1440 (px) | Altura 390 antes | Desenho alvo | Situação da migração |
| --- | --- | --- | --- | --- | --- | ---: | --- | ---: | ---: | --- | --- |
| 01 | `/` | porta de entrada | Energia, do sistema à sua conta | BuscaObservatorio, EscolhaDistribuidora, MapaConceitual, RedirecionaAncoraAntiga | `perdas.json`, `empresas.json`, `publicacao.json` | 14132 | Entenda a energia que move o Brasil (7) | 12232 | 33374 | Hero compacto, caminhos por intenção, seis perguntas prioritárias, índice completo | pendente |
| 02 | `/visao-geral` | abertura temática | O sistema em perspectiva | TextoDoLeitor, VisaoDeterminantes, VisaoFrases, VisaoObservar | `sintese.json`, `cmo.json`, `inclusao.json` | 13209 | O que está acontecendo no sistema elétrico brasileiro? (8) | 3853 | 24417 | Resumo de preço, água e carga; comparações próximas e datas próprias | pendente |
| 03 | `/territorio` | abertura temática | A energia no seu território | TerritorioExplorador, TerritorioPagina | `territorio.json` | 3933 | O que acontece na minha região? (6) | 1329 | 7780 | Busca e mapa dominantes; ficha com medidas separadas por grão | pendente |
| 04 | `/agua-e-clima` | abertura temática | Quanta energia está armazenada? | AguaArmazenamento, AguaPagina, FaixaMetricas, RedirecionaAncoraAntiga | `agua_detalhe.json`, `gold.hidrologia()` | 3765 | Quanta energia está guardada nos reservatórios, e quanta água está chegando? (11) | 1547 | 6782 | Valor do SIN e comparação de cada região com sua mediana sazonal | pendente |
| 05 | `/geracao` | abertura temática | De onde vem a eletricidade? | GeracaoMatriz, GeracaoPagina, GraficoLinhas, GraficoPontos | `geracao_detalhe.json` | 4406 | De onde vem a eletricidade e quais fontes estão sendo usadas? (11) | 1431 | 7833 | Barras por fonte, perímetro explícito e natureza da MMGD | pendente |
| 06 | `/carga` | abertura temática | Quanto o sistema consome? | CargaHistorico, CargaNivel, CargaPagina | `carga_detalhe.json`, `gold.carga()` | 3793 | Quanto o sistema está consumindo? (5) | 1341 | 6835 | Nível atual e janela equivalente lado a lado | pendente |
| 07 | `/rede` | abertura temática | Como a energia circula? | CursorSincronizado, GraficoLinhas, RedeCirculacao, RedePagina | `rede_detalhe.json`, `gold.rede()`, `gold.pld()` | 4241 | Como a energia circula entre regiões e que restrições são documentadas? (11) | 1639 | 7230 | Fronteiras, sentido, saldo e reversões, sem inferência de congestionamento | pendente |
| 08 | `/pld` | abertura temática | Quanto custa a energia no curto prazo? | CartoesPld, GraficoLinhas, PldFormacao, PldPagina | `pld_detalhe.json`, `gold.pld()`, `gold.hidrologia()` | 10050 | PLD (1) | 3896 | 20153 | Quatro submercados em escala comum, extremos e diferença entre regiões | pendente |
| 09 | `/pld/modelos` | página analítica de previsão | O que os modelos conseguem prever? | GraficoBarras, GraficoPontos, PrevisoesModelos, PrevisoesPagina | `modelos.json` | 7658 | Como cada previsão é calculada, e se ela supera as referências simples (12) | 1309 | 13970 | Estado e comparação de modelos; desempenho real por protocolo | pendente |
| 10 | `/pld/previsoes` | página analítica de previsão | O que foi publicado antes do resultado? | GraficoLinhas, PrevisoesArquivo, PrevisoesAtual, PrevisoesPagina | `gold.pld()` | 6443 | O que se projeta para o PLD, e o que ficou registrado antes do resultado (15) | 2172 | 11593 | Entregas, corte, referência experimental e arquivo | pendente |
| 11 | `/mercado` | abertura temática | Como a energia é contratada? | GraficoLinhas, GraficoBarras, TabelaDados, MercadoTabelasSobDemanda | `mercado.json` | 4733 | Como a energia é contratada, alocada e liquidada? (8) | 1854 | 9192 | Estado verdadeiro de integração e conteúdo verificável já disponível | pendente |
| 12 | `/conta-de-luz` | abertura temática | Quanto custa o mesmo consumo? | ContaComposicao, ContaHistorico, ContaLinkPainel, ContaSimulador | `conta.json` | 8359 | Quanto custa a energia ao consumidor e o que compõe a conta? (12) | 1837 | 15410 | Perfil comum, menor/mediana/maior e composição acessível | pendente |
| 13 | `/perdas` | abertura temática | Onde a energia se perde? | GraficoLinhas, TabelaDados, PerdasExplorador, PerdasAuditoria | `perdas.json` | 5889 | Onde se perde energia, quanto e com que efeito econômico? (10) | 1908 | 11259 | Taxa e energia; agregado separado de comparação entre distribuidoras | pendente |
| 14 | `/qualidade` | abertura temática | Quanto tempo falta luz? | CursorSincronizado, GraficoBarras, GraficoLinhas, Histograma | `qualidade.json` | 11627 | Com que frequência e por quanto tempo falta energia? (9) | 1821 | 20584 | DEC e FEC em gráficos próprios; limite do mesmo ente e ano | pendente |
| 15 | `/inclusao-energetica` | abertura temática | Para quem a energia pesa mais? | InclusaoPagina | `inclusao.json` | 4161 | Quem tem acesso adequado e para quem a energia pesa mais? (11) | sem gráfico visível | 7164 | Despesa por renda; acesso e benefício com unidades/datas próprias | pendente |
| 16 | `/empresas` | abertura temática | Quem atua no setor? | EmpresasPagina | `empresas.json`, `perdas.json` | 4156 | Quem é dono de quê no setor elétrico? (8) | sem gráfico visível | 7465 | Entrada para ativos, perfil, finanças e controle, unificados por identificadores | pendente |
| 17 | `/expansao` | abertura temática | O que está sendo construído? | ExpansaoPagina, GraficoBarras | `expansao.json` | 4883 | Quanta capacidade está chegando, e de que fontes? (8) | 849 | 8769 | Operação, obras e obra não iniciada separados; cronogramas e cenários | pendente |
| 18 | `/transicao` | abertura temática | Como a matriz está mudando? | TransicaoPagina | `transicao.json` | 3730 | Como a transformação do setor se distribui e afeta as emissões? (11) | sem gráfico visível | 6529 | Capacidade adicionada e intensidade de emissões em gráficos separados | pendente |
| 19 | `/regulacao` | abertura temática | Que regra vale em cada período? | GraficoBarras, GraficoPontos, RegulacaoLimites, RegulacaoPagina | `regulacao.json` | 3705 | Que regras mudaram, quando e com qual efeito declarado? (9) | 1382 | 6946 | Limites relevantes e linha do tempo de publicação e vigência | pendente |
| 20 | `/aprenda` | índice de conhecimento | Entenda um conceito | AbreDetalhesAoImprimir, AprendaIndice | lido por componente | 2530 | O que significam os conceitos e como se ligam aos números? (11) | sem gráfico visível | 4266 | Busca, verbetes curtos e ligação ao painel | pendente |
| 21 | `/dados` | catálogo e documentação de dados | Encontre a fonte | TextoDoLeitor, AoAparecer, DadosCatalogo, DadosEscada | lido por componente | 4074 | Quais dados estão de fato validados? (6) | sem gráfico visível | 8364 | Busca e catálogo único, filtros, cobertura e download | pendente |
| 22 | `/metodologia` | documento metodológico | Do arquivo ao número | DadosPainel, MetodologiaRegras | `gold.meta()`, `gold.sintese()`, `gold.pld()` | 8427 | Quais interpretações são permitidas? (4) | sem gráfico visível | 15870 | Linhagem visual e consulta de regras por indicador | pendente |

## Todas as rotas avaliadas

| Rota | Tipo | Visões | Painéis | Contratos de dados | Situação da migração |
| --- | --- | ---: | ---: | --- | --- |
| `/` | porta de entrada | 0 | 0 | `perdas.json`, `empresas.json`, `publicacao.json` | pendente |
| `/agua-e-clima` | abertura temática | 20 | 2 | `agua_detalhe.json`, `gold.hidrologia()` | pendente |
| `/agua-e-clima/afluencia` | página analítica | 16 | 1 | `agua_detalhe.json` | pendente |
| `/agua-e-clima/chuva-e-temperatura` | página analítica | 20 | 1 | `agua_detalhe.json` | pendente |
| `/agua-e-clima/reservatorios` | página analítica | 10 | 1 | `agua_detalhe.json` | pendente |
| `/aprenda` | índice de conhecimento | 0 | 0 | lido por componente | pendente |
| `/aprenda/trilhas` | índice de conhecimento | 0 | 0 | lido por componente | pendente |
| `/aprenda/trilhas/agua-operacao-preco` | trilha de leitura | 0 | 0 | lido por componente | pendente |
| `/aprenda/trilhas/custo-tarifa-orcamento` | trilha de leitura | 0 | 0 | lido por componente | pendente |
| `/carga` | abertura temática | 23 | 1 | `carga_detalhe.json`, `gold.carga()` | pendente |
| `/carga/clima-e-calendario` | página analítica | 22 | 1 | `carga_detalhe.json` | pendente |
| `/carga/perfil-horario` | página analítica | 28 | 1 | `carga_detalhe.json`, `gold.carga()` | pendente |
| `/conta-de-luz` | abertura temática | 14 | 5 | `conta.json` | pendente |
| `/conta-de-luz/reajustes-e-subsidios` | página analítica | 8 | 3 | `conta.json` | pendente |
| `/dados` | catálogo e documentação de dados | 5 | 1 | lido por componente | pendente |
| `/dados/reproducao` | catálogo e documentação de dados | 2 | 1 | `arquivos.json` | pendente |
| `/dados/saude` | catálogo e documentação de dados | 5 | 1 | lido por componente | pendente |
| `/empresas` | abertura temática | 4 | 4 | `empresas.json`, `perdas.json` | pendente |
| `/empresas/ativos` | página analítica | 15 | 1 | `empresas.json`, `expansao.json` | pendente |
| `/empresas/controle` | página analítica | 13 | 2 | `empresas.json` | pendente |
| `/empresas/distribuidoras` | página analítica | 7 | 1 | `empresas.json`, `perdas.json` | pendente |
| `/empresas/financas` | página analítica | 8 | 1 | `empresas.json` | pendente |
| `/expansao` | abertura temática | 6 | 4 | `expansao.json` | pendente |
| `/expansao/carteira` | página analítica | 22 | 1 | `expansao.json` | pendente |
| `/expansao/cenarios` | página analítica | 8 | 1 | `expansao.json` | pendente |
| `/expansao/cronograma` | página analítica | 23 | 1 | `expansao.json` | pendente |
| `/expansao/geracao-e-transmissao` | página analítica | 22 | 1 | `expansao.json` | pendente |
| `/geracao` | abertura temática | 35 | 1 | `geracao_detalhe.json` | pendente |
| `/geracao/capacidade` | página analítica | 21 | 1 | `geracao_detalhe.json` | pendente |
| `/geracao/restricoes` | página analítica | 15 | 1 | `geracao_detalhe.json` | pendente |
| `/geracao/termica` | página analítica | 23 | 1 | `geracao_detalhe.json`, `gold.geracao()` | pendente |
| `/inclusao-energetica` | abertura temática | 4 | 4 | `inclusao.json` | pendente |
| `/inclusao-energetica/acesso` | página analítica | 20 | 1 | `inclusao.json` | pendente |
| `/inclusao-energetica/cobertura` | página analítica | 11 | 1 | `inclusao.json` | pendente |
| `/inclusao-energetica/orcamento` | página analítica | 12 | 1 | `inclusao.json` | pendente |
| `/inclusao-energetica/tarifa-social` | página analítica | 18 | 1 | `inclusao.json` | pendente |
| `/mercado` | abertura temática | 19 | 1 | `mercado.json` | pendente |
| `/mercado/agentes` | página analítica | 19 | 1 | `mercado.json` | pendente |
| `/mercado/encargos` | página analítica | 16 | 1 | `mercado.json` | pendente |
| `/mercado/mre-e-gsf` | página analítica | 12 | 1 | `mercado.json` | pendente |
| `/metodologia` | documento metodológico | 2 | 1 | `gold.meta()`, `gold.sintese()`, `gold.pld()` | pendente |
| `/perdas` | abertura temática | 9 | 4 | `perdas.json` | pendente |
| `/perdas/composicao` | página analítica | 8 | 1 | `perdas.json` | pendente |
| `/perdas/custo-e-contexto` | página analítica | 8 | 2 | `perdas.json` | pendente |
| `/perdas/regulatorio` | página analítica | 4 | 1 | `perdas.json` | pendente |
| `/pld` | abertura temática | 13 | 5 | `pld_detalhe.json`, `gold.pld()`, `gold.hidrologia()` | pendente |
| `/pld/cmo-e-formacao` | página analítica | 13 | 1 | `pld_detalhe.json` | pendente |
| `/pld/diferencas-regionais` | página analítica | 14 | 1 | `pld_detalhe.json`, `gold.pld()` | pendente |
| `/pld/historico` | página analítica | 13 | 1 | `pld_detalhe.json` | pendente |
| `/pld/limites` | página analítica | 13 | 1 | `pld_detalhe.json` | pendente |
| `/pld/modelos` | página analítica de previsão | 16 | 5 | `modelos.json` | pendente |
| `/pld/modelos/b0` | ficha de modelo | 1 | 1 | `modelos.json` | pendente |
| `/pld/modelos/c1` | ficha de modelo | 1 | 1 | `modelos.json` | pendente |
| `/pld/modelos/c2-h` | ficha de modelo | 4 | 1 | `modelos.json` | pendente |
| `/pld/modelos/c2-p` | ficha de modelo | 4 | 1 | `modelos.json` | pendente |
| `/pld/modelos/s0` | ficha de modelo | 1 | 1 | `modelos.json` | pendente |
| `/pld/previsoes` | página analítica de previsão | 14 | 2 | `gold.pld()` | pendente |
| `/qualidade` | abertura temática | 60 | 5 | `qualidade.json` | pendente |
| `/rede` | abertura temática | 25 | 2 | `rede_detalhe.json`, `gold.rede()`, `gold.pld()` | pendente |
| `/rede/balanco-e-exterior` | página analítica | 16 | 1 | `rede_detalhe.json` | pendente |
| `/rede/programado` | página analítica | 13 | 1 | `rede_detalhe.json` | pendente |
| `/rede/restricoes` | página analítica | 14 | 1 | `rede_detalhe.json` | pendente |
| `/regulacao` | abertura temática | 18 | 3 | `regulacao.json` | pendente |
| `/regulacao/consultas-e-agenda` | página analítica | 13 | 3 | `regulacao.json` | pendente |
| `/regulacao/linha-do-tempo` | página analítica | 9 | 2 | `regulacao.json` | pendente |
| `/territorio` | abertura temática | 6 | 1 | `territorio.json` | pendente |
| `/transicao` | abertura temática | 3 | 3 | `transicao.json` | pendente |
| `/transicao/emissoes` | página analítica | 12 | 1 | `transicao.json` | pendente |
| `/transicao/energia-estimada` | página analítica | 13 | 2 | `transicao.json` | pendente |
| `/transicao/mmgd` | página analítica | 18 | 1 | `transicao.json` | pendente |
| `/visao-geral` | abertura temática | 25 | 6 | `sintese.json`, `cmo.json`, `inclusao.json` | pendente |
| `/aprenda/acl` | verbete | 0 | 0 | lido por componente | pendente |
| `/aprenda/cde` | verbete | 0 | 0 | lido por componente | pendente |
| `/aprenda/dessem` | verbete | 0 | 0 | lido por componente | pendente |
| `/aprenda/gsf` | verbete | 0 | 0 | lido por componente | pendente |
| `/aprenda/percentual-regulatorio-de-perdas` | verbete | 0 | 0 | lido por componente | pendente |
| `/aprenda/tarifa-te-tusd` | verbete | 0 | 0 | lido por componente | pendente |
| `/dados/aneel-agentes-geracao` | ficha de conjunto de dados | 0 | 0 | `gold.meta()` | pendente |
| `/dados/aneel-pautas-atas-diretoria` | ficha de conjunto de dados | 0 | 0 | `gold.meta()` | pendente |
| `/dados/ccee-lista-agente-associado` | ficha de conjunto de dados | 0 | 0 | `gold.meta()` | pendente |
| `/dados/ibge-pof-cv` | ficha de conjunto de dados | 0 | 0 | `gold.meta()` | pendente |
| `/dados/ons-ena-diario-por-bacia` | ficha de conjunto de dados | 0 | 0 | `gold.meta()` | pendente |
| `/dados/senado-leis-feriados` | ficha de conjunto de dados | 0 | 0 | `gold.meta()` | pendente |
| `/empresas/ambar-amazonas` | ficha de entidade | 15 | 1 | `empresas.json`, `perdas.json` | pendente |
| `/empresas/cerbranorte` | ficha de entidade | 14 | 1 | `empresas.json`, `perdas.json` | pendente |
| `/empresas/certhil` | ficha de entidade | 15 | 1 | `empresas.json`, `perdas.json` | pendente |
| `/empresas/cpfl-piratining` | ficha de entidade | 19 | 1 | `empresas.json`, `perdas.json` | pendente |
| `/empresas/emt` | ficha de entidade | 19 | 1 | `empresas.json`, `perdas.json` | pendente |
| `/empresas/uhenpal` | ficha de entidade | 15 | 1 | `empresas.json`, `perdas.json` | pendente |
| `/aprenda/ear` | verbete | 0 | 0 | lido por componente | pendente |
| `/aprenda/pld` | verbete | 0 | 0 | lido por componente | pendente |
| `/dados/aneel-scs` | ficha de conjunto de dados | 0 | 0 | `gold.meta()` | pendente |
| `/dados/ibge-pof-6715` | ficha de conjunto de dados | 0 | 0 | `gold.meta()` | pendente |
| `/empresas/cemig-d` | ficha de entidade | 19 | 1 | `empresas.json`, `perdas.json` | pendente |
