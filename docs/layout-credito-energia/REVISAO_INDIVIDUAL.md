# Revisão individual de Crédito e Energia — 10/10/2026

Base: `c5f7c40`, depois do PR #134. Revisão efetuada com a skill `observatorio-layout`.

## O que foi efetivamente conferido

As 94 rotas de Energia do inventário foram abertas nesta rodada. Em Crédito, foram abertas as páginas temáticas e de referência, fichas de instituição, setor, município, estado e dois produtos; também foram percorridas as 7 abas de Bancos na Bolsa, 9 de Sinais antecedentes e 9 do Comparador. O Comparador foi exercitado com o atalho de cinco grandes bancos.

A inspeção individual cobre estrutura renderizada, títulos, capítulos, unidades e explicações selecionadas. Fichas geradas por entidade foram examinadas por amostra de gabarito: **não** significa que todas as instituições, municípios, verbetes e datasets possíveis foram abertos. O inventário histórico de gráficos não é contado como evidência nova.

Capturas visuais nesta rodada: Pulso do crédito, Geração térmica e Qualidade. Os outros registros foram examinados pelo conteúdo renderizado e pelos controles. **Não há aprovação visual de todas as figuras, nem certificação em 320/390/768/1440 px e zoom de 200%.** O navegador remoto não acessa a aplicação local; a validação da versão alterada depende de preview acessível.

## Energia: decisão por rota

Em cada linha, a decisão se refere aos painéis e capítulos exibidos naquela rota. Conteúdo coerente foi preservado; não se alteraram séries, fórmulas ou fontes.

| Rota | Observação e decisão individual |
| --- | --- |
| `/setor-eletrico` | Perguntas de entrada, mapa e catálogo: caminhos por tarefa preservados. |
| `/setor-eletrico/agua-e-clima` | EAR: reserva em energia e faixa sazonal; manter distinto de risco de desabastecimento. |
| `/setor-eletrico/agua-e-clima/afluencia` | ENA: MLT e mediana são referências distintas; manter explicação dos dois normais. |
| `/setor-eletrico/agua-e-clima/chuva-e-temperatura` | Título ajustado à comparação com a média; previsão separada do histórico estimado. |
| `/setor-eletrico/agua-e-clima/reservatorios` | Título corrigido: onde o armazenamento variou, sem prometer identificar por que variou. |
| `/setor-eletrico/aprenda` | Busca e escopo dos verbetes: catálogo didático vinculado aos painéis. |
| `/setor-eletrico/aprenda/trilhas` | Percursos em ordem com exemplos publicados e limites. |
| `/setor-eletrico/aprenda/trilhas/agua-operacao-preco` | Seis passos, exemplo hipotético e limites: simulação separada do número observado. |
| `/setor-eletrico/aprenda/trilhas/custo-tarifa-orcamento` | Tarifa, bandeira, benefício e orçamento em passos próprios; exemplo hipotético identificado. |
| `/setor-eletrico/carga` | Janelas equivalentes, revisões e quebras: manter duas réguas de comparação. |
| `/setor-eletrico/carga/clima-e-calendario` | Decomposição do modelo, previsão e sensibilidade: associação explicitada, não causa. |
| `/setor-eletrico/carga/perfil-horario` | Carga global, MMGD e líquida: manter definições separadas e quebra de inclusão da MMGD. |
| `/setor-eletrico/conta-de-luz` | Consumo comum e tarifa sem tributos: ressalva de que não é a fatura preservada. |
| `/setor-eletrico/conta-de-luz/reajustes-e-subsidios` | Tarifa B1, bandeiras e CDE: aprovado/homologado separado de desembolso. |
| `/setor-eletrico/dados` | Catálogo não se apresenta como inventário de tudo que é público; etapas e saúde distintas. |
| `/setor-eletrico/dados/reproducao` | Manifesto, versão e datas: separação entre coleta, referência e processamento mantida. |
| `/setor-eletrico/dados/saude` | Atualidade relativa à fonte, falha de coleta e revisão diferenciadas. |
| `/setor-eletrico/empresas` | CNPJ liga ativos, grupos e demonstrações; medidas não aditivas preservadas. |
| `/setor-eletrico/empresas/ativos` | Propriedade das usinas e transmissão: cobertura de vínculo e participação preservadas. |
| `/setor-eletrico/empresas/controle` | Detenção versus controle: cadeia e concentração por nível separadas. |
| `/setor-eletrico/empresas/distribuidoras` | Comparação por medida, ficha e universo; sem nota composta indevida. |
| `/setor-eletrico/empresas/financas` | Fundamentos reportados por companhia: sem soma entre companhias. |
| `/setor-eletrico/expansao` | Abertura esclarece etapas e que capacidade prevista ainda não é energia disponível. |
| `/setor-eletrico/expansao/carteira` | SIGA e RALIE explicados no ponto de uso; MW identificado como potência. |
| `/setor-eletrico/expansao/cenarios` | Cenário de dez anos separado de entrega garantida e do realizado. |
| `/setor-eletrico/expansao/cronograma` | Explicada diferença entre cronograma individual e datas convencionais atribuídas em bloco. |
| `/setor-eletrico/expansao/geracao-e-transmissao` | Explicadas as três medidas: MW, km e MVA, sem soma. |
| `/setor-eletrico/geracao` | Matriz: observado, estimado e previsto separados; reconciliação e MMGD preservadas. |
| `/setor-eletrico/geracao/capacidade` | Potência instalada e fator de capacidade: unidades e universos distintos preservados. |
| `/setor-eletrico/geracao/restricoes` | Corte em MW e energia não gerada: razões oficiais e controles separados. |
| `/setor-eletrico/geracao/termica` | Combustível, motivo e CVU: não confundir participação inflexível com preço da energia. |
| `/setor-eletrico/inclusao-energetica` | Despesa por renda, acesso e benefício: datas e unidades próprias. |
| `/setor-eletrico/inclusao-energetica/acesso` | Domicílios, pessoas e ligações: manter universos separados, inclusive sistemas isolados. |
| `/setor-eletrico/inclusao-energetica/cobertura` | Proxy traduzida como aproximação; razão faturas/famílias não chamada de taxa de famílias atendidas. |
| `/setor-eletrico/inclusao-energetica/orcamento` | Despesa, renda, precisão e limiar: POF 2017–2018 identificada. |
| `/setor-eletrico/inclusao-energetica/tarifa-social` | UC e faturas não viram pessoas; desconto negativo da fonte explicitado. |
| `/setor-eletrico/mercado` | Corrigida descrição da liquidação: diferença entre contratado e verificado. |
| `/setor-eletrico/mercado/agentes` | Agente, perfil, parcela e UC: contagens diferentes, sem soma. |
| `/setor-eletrico/mercado/encargos` | Competência versus liquidação: encargos e inadimplência em blocos próprios. |
| `/setor-eletrico/mercado/mre-e-gsf` | GSF agregado e garantia física: não interpretar como resultado individual de usina. |
| `/setor-eletrico/metodologia` | Percurso fonte–arquivo–indicador e regras de interpretação preservados. |
| `/setor-eletrico/perdas` | Taxa, volume e universo da distribuidora: manter mapa, comparação e evolução. |
| `/setor-eletrico/perdas/composicao` | Técnica e não técnica: estimativas e cobertura declaradas. |
| `/setor-eletrico/perdas/custo-e-contexto` | Base econômica tarifária e associação territorial: sem interpretação causal. |
| `/setor-eletrico/perdas/regulatorio` | Percentual técnico por trecho: realizado não comparado sem compatibilidade. |
| `/setor-eletrico/pld` | Quatro submercados na mesma escala; limites e formação separados da tarifa. |
| `/setor-eletrico/pld/cmo-e-formacao` | CMO semanal, semi-horário e PLD: produtos distintos alinhados pelo intervalo. |
| `/setor-eletrico/pld/diferencas-regionais` | Pares de regiões, frequência e diferença de preço: não atribuir causalidade ao fluxo. |
| `/setor-eletrico/pld/historico` | Referência sazonal, médias simples e ponderada: nomes das réguas explícitos. |
| `/setor-eletrico/pld/limites` | Piso, teto horário e teto estrutural: vigência e tolerância monetária preservadas. |
| `/setor-eletrico/pld/modelos` | Candidatos, referência simples, calibração e avaliação fora da amostra separados. |
| `/setor-eletrico/pld/modelos/b0` | Ficha B0: receita, entrada, corte e estado do modelo examinados; candidato e referência simples permanecem distintos. |
| `/setor-eletrico/pld/modelos/c1` | Ficha C1: receita, entrada, corte e estado do modelo examinados; candidato e referência simples permanecem distintos. |
| `/setor-eletrico/pld/modelos/c2-h` | Ficha C2-H: receita, entrada, corte e estado do modelo examinados; candidato e referência simples permanecem distintos. |
| `/setor-eletrico/pld/modelos/c2-p` | Ficha C2-P: receita, entrada, corte e estado do modelo examinados; candidato e referência simples permanecem distintos. |
| `/setor-eletrico/pld/modelos/s0` | Ficha S0: receita, entrada, corte e estado do modelo examinados; candidato e referência simples permanecem distintos. |
| `/setor-eletrico/pld/previsoes` | Abertura explica B0 como repetição do último período completo; arquivo preserva emissão anterior ao resultado. |
| `/setor-eletrico/qualidade` | Lead corrigido: DEC e FEC são médias, com comparação ao limite próprio; compensações ficam separadas. |
| `/setor-eletrico/rede` | Saldo versus fluxo nos dois sentidos: comparação adequada preservada. |
| `/setor-eletrico/rede/balanco-e-exterior` | Resíduos e identidades do balanço: Itaipu não rotulada como intercâmbio. |
| `/setor-eletrico/rede/programado` | Desvio do programa: diferença não chamada de falha; dias repetidos identificados. |
| `/setor-eletrico/rede/restricoes` | ATLS, cortes e perturbações: manter evidência documental em vez de inferir congestionamento. |
| `/setor-eletrico/regulacao` | Limites por vigência e documentos: publicação não confundida com início da regra. |
| `/setor-eletrico/regulacao/consultas-e-agenda` | Situação datada das consultas e agenda: previsão de decisão não apresentada como decisão tomada. |
| `/setor-eletrico/regulacao/linha-do-tempo` | Publicação versus vigência: intervalos e vínculos com painéis mantidos. |
| `/setor-eletrico/territorio` | Grão territorial explicitado: município, distribuidora e submercado não intercambiáveis. |
| `/setor-eletrico/transicao` | Abertura distingue capacidade adicionada e intensidade das emissões, sem sugerir causalidade. |
| `/setor-eletrico/transicao/emissoes` | Fator médio e MDL: CO₂ de operação não confundido com CO₂ equivalente. |
| `/setor-eletrico/transicao/energia-estimada` | MWmed explicado como potência média; estimativa não é medição nem capacidade instalada. |
| `/setor-eletrico/transicao/mmgd` | Potência, conexões e estoque: cadastro e revisões preservados. |
| `/setor-eletrico/visao-geral` | Calendário comum e referências próprias: alinhamento não vira explicação causal. |
| `/setor-eletrico/aprenda/acl` | Verbete acl: definição, exemplo real, confusões, limites e fonte oficial presentes; estrutura preservada. |
| `/setor-eletrico/aprenda/cde` | Verbete cde: definição, exemplo real, confusões, limites e fonte oficial presentes; estrutura preservada. |
| `/setor-eletrico/aprenda/dessem` | Verbete dessem: definição, exemplo real, confusões, limites e fonte oficial presentes; estrutura preservada. |
| `/setor-eletrico/aprenda/gsf` | Verbete gsf: definição, exemplo real, confusões, limites e fonte oficial presentes; estrutura preservada. |
| `/setor-eletrico/aprenda/percentual-regulatorio-de-perdas` | Verbete percentual-regulatorio-de-perdas: definição, exemplo real, confusões, limites e fonte oficial presentes; estrutura preservada. |
| `/setor-eletrico/aprenda/tarifa-te-tusd` | Verbete tarifa-te-tusd: definição, exemplo real, confusões, limites e fonte oficial presentes; estrutura preservada. |
| `/setor-eletrico/dados/aneel-agentes-geracao` | Ficha aneel-agentes-geracao: órgão, frequência declarada, uso, arquivos, citação e captura; ausência de frequência é explícita. |
| `/setor-eletrico/dados/aneel-pautas-atas-diretoria` | Ficha aneel-pautas-atas-diretoria: órgão, frequência declarada, uso, arquivos, citação e captura; ausência de frequência é explícita. |
| `/setor-eletrico/dados/ccee-lista-agente-associado` | Ficha ccee-lista-agente-associado: órgão, frequência declarada, uso, arquivos, citação e captura; ausência de frequência é explícita. |
| `/setor-eletrico/dados/ibge-pof-cv` | Ficha ibge-pof-cv: órgão, frequência declarada, uso, arquivos, citação e captura; ausência de frequência é explícita. |
| `/setor-eletrico/dados/ons-ena-diario-por-bacia` | Ficha ons-ena-diario-por-bacia: órgão, frequência declarada, uso, arquivos, citação e captura; ausência de frequência é explícita. |
| `/setor-eletrico/dados/senado-leis-feriados` | Ficha senado-leis-feriados: órgão, frequência declarada, uso, arquivos, citação e captura; ausência de frequência é explícita. |
| `/setor-eletrico/empresas/ambar-amazonas` | Ficha ambar-amazonas: perdas, continuidade, tarifa, pares, controle e CVM; identidade e datas próprias preservadas. |
| `/setor-eletrico/empresas/cerbranorte` | Ficha cerbranorte: perdas, continuidade, tarifa, pares, controle e CVM; identidade e datas próprias preservadas. |
| `/setor-eletrico/empresas/certhil` | Ficha certhil: perdas, continuidade, tarifa, pares, controle e CVM; identidade e datas próprias preservadas. |
| `/setor-eletrico/empresas/cpfl-piratining` | Ficha cpfl-piratining: perdas, continuidade, tarifa, pares, controle e CVM; identidade e datas próprias preservadas. |
| `/setor-eletrico/empresas/emt` | Ficha emt: perdas, continuidade, tarifa, pares, controle e CVM; identidade e datas próprias preservadas. |
| `/setor-eletrico/empresas/uhenpal` | Ficha uhenpal: perdas, continuidade, tarifa, pares, controle e CVM; identidade e datas próprias preservadas. |
| `/setor-eletrico/aprenda/ear` | Verbete ear: definição, exemplo real, confusões, limites e fonte oficial presentes; estrutura preservada. |
| `/setor-eletrico/aprenda/pld` | Verbete pld: definição, exemplo real, confusões, limites e fonte oficial presentes; estrutura preservada. |
| `/setor-eletrico/dados/aneel-scs` | Ficha aneel-scs: órgão, frequência declarada, uso, arquivos, citação e captura; ausência de frequência é explícita. |
| `/setor-eletrico/dados/ibge-pof-6715` | Ficha ibge-pof-6715: órgão, frequência declarada, uso, arquivos, citação e captura; ausência de frequência é explícita. |
| `/setor-eletrico/empresas/cemig-d` | Ficha cemig-d: perdas, continuidade, tarifa, pares, controle e CVM; identidade e datas próprias preservadas. |

## Crédito: decisão por subpainel

| Subpainel | Observação e decisão individual |
| --- | --- |
| Mapa do Observatório | Ciclo, perguntas, trilhas, fontes e réguas distintas preservados. |
| Visão geral | IBCC, mudanças mensais e recordes mantidos; guia passa a ocupar duas colunas em telas amplas. |
| Pulso do crédito | Juros, spread e inadimplência passam a variar em p.p.; saldo/concessões mantêm % nominal/real. Selic diária ganha dia/mês/ano no eixo, tabela e tooltip. Comparador ganha título próprio. |
| Quem toma crédito e onde | Corrigida dependência que impedia entrada direta. Saldo, taxa, composição PF/PJ e matriz não são tratados como causa. |
| Sinais antecedentes — Visão geral | Quatro famílias e subíndices preservados; corrigida dependência de entrada direta. |
| Sinais — Garantias | IVG-R real separado do alvo; candidato não promovido por aparência do gráfico. |
| Sinais — Empresarial e Judicial | Recuperações e falências ajuizadas mantêm naturezas diferentes. |
| Sinais — Crédito não bancário | FIDC, CRI, CRA e emissões não somados; inadimplência-alvo separada. |
| Sinais — Consumidor | Reclamações continuam associação exploratória. |
| Sinais — Regional | Cobertura dos tribunais permanece explícita. |
| Sinais — Buscas | Exportação manual e licença de coleta explicitadas. |
| Sinais — Protocolo e regimes | Critérios, reprovações e detecção de regimes preservados. |
| Sinais — Metodologia e licenças | Catálogo e matriz de coleta preservados. |
| Cenários | Base, choque condicional, backtest e limites da banda separados; perdas contra referência simples continuam visíveis. |
| Central de alertas | Corrigida dependência de entrada direta; regras locais não prometem notificação externa. |
| Buscas no Google | Corrigida dependência de entrada direta; escala por termo e associação exploratória preservadas. |
| Instituições | Pares e perímetros preservados. Removida repetição da mesma explicação na ausência declarada de guidance. |
| Ficha de instituição — BB | Capital, carteira, atraso, Pilar 3, pares, atendimento, pessoal e guidance examinados no gabarito. |
| Comparador — Visão geral | Seleção efetiva dos cinco grandes bancos; referências e escalas preservadas. |
| Comparador — Métricas-chave | Unidades e catálogo comum preservados. |
| Comparador — Série histórica | Normalização e séries das instituições selecionadas examinadas. |
| Comparador — Dispersão | Eixos e seleção examinados; sem ranking composto. |
| Comparador — Dados completos | Grupos de escala, carteira, rentabilidade, capital, qualidade e estrutura preservados. |
| Comparador — Custos e produtividade | Corrigida alegação de que o pipeline não coleta pessoal/TI: ausência é de integração ao comparador. Incluída ligação ao módulo operacional. |
| Comparador — Posições | Comparação dentro da régua selecionada preservada. |
| Comparador — Catálogo | Fórmula, cobertura e restrições de comparação preservadas. |
| Comparador — Watchlist | Estado vazio e regra de avaliação local examinados; nenhuma regra criada. |
| Entradas e saídas do SFN | Saída de cadastro/IF.data não chamada de quebra. |
| Captação dos bancos | M4, IF.data e CDA com universos próprios; dependência de mercado não rotulada automaticamente como fragilidade. |
| FIDCs | Lastro, cota, subordinação, vencimento e atraso separados. |
| Rede, pessoas e auditoria | Agências, postos, correspondentes, folha, pessoal, TI e remuneração: fontes próprias preservadas. |
| Bancos na Bolsa — Ações | Retorno, preço, drawdown e volatilidade com réguas distintas. |
| Bolsa — Dividendos e JCP | Corrigidos quinze tickers que apareciam como undefined; grade em duas colunas para legibilidade. |
| Bolsa — Valuation | Múltiplos e ROE não tratados como recomendação. |
| Bolsa — Resultados | Pontes completas e parciais identificadas. |
| Bolsa — Capital | Movimentos observáveis e limites de cobertura preservados. |
| Bolsa — Screener | Tabela final carregada com 18 listadas, múltiplos e retornos; ausências distintas de zero. Interação completa com todos os filtros não certificada. |
| Bolsa — Entidades e metodologia | Companhia, ação e conglomerado mantidos em níveis distintos. |
| Produtos de crédito | Eliminada duplicação PF/PJ no título rural; título vira link acessível por teclado. |
| Produto — Cartão PF | Mercado, evolução, matriz, atraso ≥15d, taxa e estimativa >90d examinados separadamente. |
| Produto — Capital de giro PJ | Removido truncamento de modalidades que escondia prazo/indexador nos botões; controles passam a quebrar linha. |
| Prazo da carteira | Prazo residual aproximado não apresentado como duração contratual. |
| Juros por instituição | Mediana entre instituições não confundida com taxa do sistema; seguro prestamista separado da taxa. |
| Crédito rural | Contratação, carteira e inadimplência separados; município e gênero mantêm seus universos. |
| Crédito direcionado e BNDES | Saldo, desembolso e contratação não somados; funil não chamado de conversão de safra. |
| Bancos e mercado de capitais | Emissão, saldo e lastro permanecem separados. |
| Consórcios | Taxa de administração não chamada de juros; cotas não chamadas de pessoas. |
| Estados | Estoques, fluxos e passivos não somados. |
| Ficha de São Paulo | Blocos de crédito, prazo, penetração, presença, Pix, moradia, consignado, rural, BNDES, emprego, consórcios, cobrança e União examinados. Rótulo do PVL esclarecido. |
| Crédito por município | ESTBAN identificado como escrituração nas dependências; gap não chamado de demanda comprovada. |
| Presença em São Paulo | Agências, postos, PAE, correspondentes e contexto regional separados. |
| Moradia | Conceitos de domicílio, contrato, verbete e gap mantidos; corrigida dependência compartilhada da entrada direta. |
| Consignado e aposentados | Removida numeração fora de ordem; remissões passam a citar nomes dos capítulos. Corrigida dependência compartilhada. |
| Emprego formal | Vínculos não chamados de pessoas ou massa salarial; mês preliminar identificado. |
| Crédito subnacional | Rótulos de valor “liberado” esclarecidos como valor com parecer favorável; não é desembolso. |
| Risco setorial | Produção, serviços, comércio, exposição e antecedentes em blocos próprios. |
| Ficha de produtos químicos | Decomposição do score, produção e variação examinadas no gabarito. |
| Desenrola | Operação, pessoa, valor após desconto e regularização continuam separados; sem atribuição causal. |
| Cobrança judicial | Ajuizamento não chamado de inadimplência; parcialidade recente preservada. |
| Recuperações e falências | KPI corrigido de “falências decretadas” para “falências ajuizadas”, alinhado à série mostrada. |
| Dívida com a União | Safra do saldo remanescente não confundida com inscrições no ano. |
| Pix e pagamentos | Corrigida entrada direta. Fluxos, usuários, chaves, natureza, MED e SPI continuam separados. |
| Open Finance | Consentimentos e chamadas de API não convertidos em clientes. |
| Sanções e reclamações | Processo, decisão, multa aplicada/paga e reclamação com conceitos próprios. |
| Clientes contra bancos na Justiça | Corrigida entrada direta; casos únicos versus registros e cobertura dos tribunais preservados. |
| Apostas e crédito | GGR, Pix bruto, estimativa privada e evidência acadêmica separados; sem correlação com amostra insuficiente. |
| Golpes e fraudes | Tentativa, ocorrência, perda e recuperação separados; quebras metodológicas explícitas. |
| Marcos regulatórios | Linha do tempo e ligações temáticas preservadas. |
| Metodologia e fontes | Réguas de inadimplência, carteiras, catálogo, modelos e linhagem preservados. |
| Perguntas rápidas | Fontes, data-base e revisões preservadas. |
| Sugestões | Formulário examinado sem envio. |
| Sobre | Autor, imprensa e participação preservados. |

## Mudanças visuais e interação

- Índice recolhível das seções em páginas extensas de Crédito, com links acionáveis por teclado e foco no título de destino.
- Guia de leitura em duas colunas no desktop e uma no celular, mantendo limites visíveis.
- Proventos em duas colunas, uma no celular; o código da ação vem do cadastro publicado.
- Modalidades de crédito com nomes completos, quebra de linha e alvo mínimo de 44 px.
- Títulos rurais sem repetição PF/PJ; links reais nos títulos do catálogo de produtos.
- Aberturas específicas de Energia reescritas para explicar siglas e separar potência, energia, cronograma, cenário e medição.

## Rubrica e limite da aprovação

Para as páginas alteradas, a verificação editorial observou pergunta, unidade, referência, universo e ressalva. A aprovação visual da versão nova permanece **não verificada** nos oito critérios da skill: direção de arte, hierarquia, tipografia, densidade, didática visual, comparabilidade visual, interação/acessibilidade e responsividade. Não se atribui nota 9 com base em leitura de código ou em capturas de outra versão.

O registro individual acima é uma revisão estrutural/editorial com correções funcionais. Não deve ser descrito como certificação estética integral de todos os gráficos, filtros e estados. Também não houve auditoria nova das fontes primárias, revisão econométrica ou alteração de dados.

## Validação técnica da versão alterada

- Build de produção concluído, com 475 páginas geradas.
- ESLint sem avisos ou erros; TypeScript sem erros.
- Suíte executada após o build com `EXIGIR_BUILD_HTML=1`: 180 arquivos, 4.389 testes aprovados e 1 ignorado.
- Seis regressões novas verificam helpers no núcleo servido, datas diárias/mensais, pontos percentuais, crescimento monetário e tickers das 18 companhias.
- Sintaxe dos dois arquivos JavaScript e `git diff --check` aprovados.

Esses resultados não substituem a validação visual declarada como pendente acima.
