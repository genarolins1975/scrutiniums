# Matriz de painéis e critérios de aceite

Gerada por `scripts/energia_matriz.py` a partir do Anexo A da especificação e de `status_paineis.json`. Denominador fixo: 71 painéis (P001 a P071). Estado inicial = inventário do código em 30/09/2026 (commit d95d8f8b4).

| Estado | Painéis |
| --- | ---: |
| Concluído | 2 |
| Concluído com limitação declarada | 14 |
| Parcial | 1 |
| Bloqueado (externo, com evidência) | 0 |
| Pendente | 54 |
| **Total** | **71** |


## Mapa

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P001 | Página inicial como mapa geral didático | Para que serve o observatório e onde encontro a resposta à minha pergunta? | P0 |  | D0 | parcial | Pendente | Todas as promessas correspondem a destinos implementados; todos os módulos têm pergunta e utilidade explícitas; navegação testada com perfis e em celular. |  |
| P002 | Mapa geográfico transversal | O que acontece na minha região? | P1 |  | S14, S16, S22 | inexistente | Pendente | Nenhum indicador atribuído a uma granularidade inferior à de origem. |  |
| P003 | Trilhas e atualidade | Que dado posso usar hoje? | P1 |  | D0 | parcial | Pendente | Data da captura nunca apresentada como referência do dado. |  |

## Visão geral

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P004 | O sistema em 60 segundos | O que mudou e merece atenção? | P0 |  | D0, S1, S21 | parcial | Concluído | Todas as frases reproduzíveis a partir dos números exibidos e de suas versões. | Página /setor-eletrico/visao-geral ligada à gold sintese.json em 06/10/2026 (branch claude/kind-mayer-v9tpwi): resposta curta, recorte, visual com referência, tabela equivalente, Comprove este número, download, link e próxima pergunta; 530 KB de HTML; axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px; testes em src/tests/energia-visao.test.ts. Revisão adversarial da interface pendente. |
| P005 | Preço, água, geração, carga e rede | Como estão os principais determinantes? | P0 |  | S1, S3, S21 | parcial | Concluído | Mesmos números dos módulos de origem; eixos, universo e datas consistentes. | Página /setor-eletrico/visao-geral ligada à gold sintese.json em 06/10/2026 (branch claude/kind-mayer-v9tpwi): resposta curta, recorte, visual com referência, tabela equivalente, Comprove este número, download, link e próxima pergunta; 530 KB de HTML; axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px; testes em src/tests/energia-visao.test.ts. Revisão adversarial da interface pendente. |
| P006 | Energia e sociedade | Como custo e qualidade chegam ao consumidor? | P1 |  | S5, S6, S8, S9, S10 | inexistente | Concluído com limitação declarada | Não apresentar séries anuais como situação do dia; cobertura explícita. | Página /setor-eletrico/visao-geral ligada à gold sintese.json em 06/10/2026 (branch claude/kind-mayer-v9tpwi): resposta curta, recorte, visual com referência, tabela equivalente, Comprove este número, download, link e próxima pergunta; 530 KB de HTML; axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px; testes em src/tests/energia-visao.test.ts. Revisão adversarial da interface pendente. Limitação declarada na página: Tarifa Social com referência mai/2025 e conjunto SCS atrasado no painel de saúde dos dados. |
| P007 | O que observar | Quais alterações são relevantes? | P1 |  | D0, S4, S20 | parcial | Concluído com limitação declarada | Alerta não implica causalidade; frequência de falsos alarmes monitorada. | Página /setor-eletrico/visao-geral ligada à gold sintese.json em 06/10/2026 (branch claude/kind-mayer-v9tpwi): resposta curta, recorte, visual com referência, tabela equivalente, Comprove este número, download, link e próxima pergunta; 530 KB de HTML; axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px; testes em src/tests/energia-visao.test.ts. Revisão adversarial da interface pendente. Limitação declarada na página: registro das publicações iniciado em 01/10/2026 e revisões avaliáveis desde 27/09/2026. |

## PLD

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P008 | Entenda o preço | O que o PLD remunera e como é formado? | P0 |  | D0, S2 | parcial | Pendente | Toda ligação conceitual validada; exemplo não se passa por contabilização real. |  |
| P009 | CMO e formação de preço | Qual a relação entre custo e preço? | P0 |  | S3, S2 | parcial | Pendente | Não comparar valores de semanas e dias distintos como se fossem o mesmo produto. |  |
| P010 | Limites, piso e tetos | Quando o preço encosta nos limites? | P0 |  | S20, S2 | parcial | Pendente | Conferência no ato primário; não inferir limite pelo mínimo observado. |  |
| P011 | Histórico e distribuição | O preço está alto para esta época? | P1 |  | S1, S2, S23 | parcial | Pendente | Média temporal e ponderada identificadas; períodos parciais sinalizados. |  |
| P012 | Diferenças regionais | Quando e quanto os preços se separam? | P0 |  | S1, S21 | parcial | Pendente | Todas as diferenças calculadas entre mesmos intervalos e versões compatíveis. |  |

## Previsões e modelos

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P013 | Previsão atual | Quais os preços possíveis nos próximos períodos? | P0 |  | D0 | placeholder | Pendente | Valores reais do modelo, alvo e emissão preservados; bandas só com método documentado. |  |
| P014 | Registro de modelos | Como cada previsão foi calculada? | P0 |  | D0 | parcial | Pendente | Reexecução reproduz a previsão arquivada dentro da tolerância definida. |  |
| P015 | Arquivo de emissões | O que foi previsto antes do resultado? | P0 |  | D0 | parcial | Pendente | Nenhuma previsão registrada retroativamente como se fosse original. |  |
| P016 | Desempenho e calibração | O modelo supera referências simples? | P1 |  | D0 | placeholder | Pendente | Teste fora da amostra e sem dado posterior ao corte; incerteza e tamanho amostral explícitos. |  |

## Água e clima

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P017 | Armazenamento | Quanta energia está armazenada? | P0 |  | S21, D0 | parcial | Pendente | Agregado reproduzível; amostra e mudanças de capacidade documentadas. |  |
| P018 | Afluência | A água que chega está acima do normal? | P0 |  | S21, D0 | parcial | Pendente | Unidades e períodos do numerador e denominador compatíveis; sem média simples de percentuais. |  |
| P019 | Chuva, temperatura e clima | Como o clima se relaciona com água e demanda? | P1 |  | S21, S23 | inexistente | Pendente | Cobertura de estações/grades e agregação espacial publicadas. |  |
| P020 | Reservatórios e balanço | Por que o armazenamento mudou? | P2 |  | S21, S23 | inexistente | Pendente | Não explicar variação de EAR apenas pela ENA; nenhum balanço fecha por ajuste arbitrário. |  |

## Geração

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P021 | Matriz efetiva | Quais fontes atenderam a carga? | P0 |  | S21, S14 | parcial | Pendente | Energia e participação reconciliadas; categorias desconhecidas permanecem explícitas. |  |
| P022 | Despacho térmico | Quanto gerou e por que foi acionado? | P1 |  | S21, D0 | parcial | Pendente | Combustível e motivo são dimensões separadas; soma consistente com universo divulgado. |  |
| P023 | Renováveis restringidas | Quanta geração foi restringida? | P1 |  | S4, S21 | inexistente | Concluído com limitação declarada | Denominador da taxa documentado; corte não confundido com indisponibilidade ou falta de vento. | Página /setor-eletrico/geracao/restricoes ligada à gold geracao_detalhe.json em 06/10/2026 (branch claude/kind-mayer-v9tpwi): resposta curta, recorte, visual com referência, tabela equivalente, Comprove este número, download, link e próxima pergunta; modos Entender, Analisar e Auditar; axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px; testes em src/tests/energia-geracao.test.ts. Revisão adversarial da interface pendente. 502 KB de HTML. Limitação declarada: energia não gerada estimada sobre a referência do ONS (natureza ESTIMADO); universo Tipo I, II-B e II-C; série fotovoltaica desde 04/2024; detalhamento por usina só nos 3 meses mais recentes; 2 de 100 marcas com a subestação coletora em UF vizinha à informada. |
| P024 | Capacidade e utilização | Quanto está instalado e quanto produz? | P1 |  | S14, S21, S22 | inexistente | Concluído com limitação declarada | Sem dupla contagem MMGD; não usar capacidade final para todo o histórico sem ressalva. | Página /setor-eletrico/geracao/capacidade ligada à gold geracao_detalhe.json em 06/10/2026 (branch claude/kind-mayer-v9tpwi): resposta curta, recorte, visual com referência, tabela equivalente, Comprove este número, download, link e próxima pergunta; modos Entender, Analisar e Auditar; axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px; testes em src/tests/energia-geracao.test.ts. Revisão adversarial da interface pendente. 409 KB de HTML. Limitação declarada: o conjunto de capacidade do ONS não tem histórico (potência do ato atual; usinas que saíram do despacho não aparecem); série da ANEEL trimestral e sem combustível; SIGA por usina só como retrato do dia; 228 usina-meses acima de 100%. |

## Carga

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P025 | Nível e crescimento | Quanto o sistema está consumindo? | P0 |  | S21, D0 | parcial | Pendente | Não interpretar +10,5% como atividade econômica sem evidência adicional. |  |
| P026 | MMGD e perfil horário | Qual parcela é estimada e quando ocorre o pico? | P1 |  | S21, D0 | inexistente | Pendente | Nenhuma dupla contagem; tipo de carga e conceito de líquido declarados. |  |
| P027 | Clima e calendário | Quanto da variação é compatível com clima e calendário? | P2 |  | S21, S23 | inexistente | Pendente | Resultado não apresentado como causal; backtest e sensibilidade publicados. |  |

## Rede

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P028 | Circulação de energia | Como a energia circula entre regiões? | P0 |  | S21, D0 | parcial | Pendente | Não inferir saturação pela espessura da seta ou pela diferença de preço. |  |
| P029 | Balanço e exterior | De onde vem a diferença de energia? | P0 |  | S21, D0 | parcial | Pendente | Resíduo explicado no perímetro correto ou sinalizado; não forçar soma zero. |  |
| P030 | Restrições e capacidade | Quando há evidência de limitação da rede? | P1 |  | S21, S22 | inexistente | Pendente | Sem percentual de utilização calculado com limite nominal de linha usado como limite regional. |  |
| P031 | Planejado e realizado | Quanto o fluxo divergiu do programa? | P1 |  | S21, D0 | parcial | Pendente | Desvio não automaticamente chamado de falha; programa e revisão identificados. |  |

## Mercado

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P032 | Livre e regulado | Como se distribui o consumo? | P1 |  | S2 | placeholder | Concluído com limitação declarada | ACL+ACR reconcilia com o universo escolhido, sem igualar automaticamente à carga do ONS. | Página /setor-eletrico/mercado ligadas à gold mercado.json em 06/10/2026 (branch claude/kind-mayer-v9tpwi), com a coleta da CCEE autorizada e refeita no mesmo dia (dados até ago/2026): resposta curta da gold, recorte, visual com referência, tabela equivalente, Comprove este número, download, link e próxima pergunta; modos Entender, Analisar e Auditar; axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px; testes em src/tests/energia-mercado-pagina.test.ts e energia-mercado.test.ts. Revisão adversarial da interface pendente. 456 KB de HTML. Limitação declarada: três universos com perímetros diferentes (EPE, CCEE e SAMP), nenhum igualado à carga do ONS; conjuntos da CCEE desde 2023; divergência anual EPE × consolidação do MME publicada como ressalva. |
| P033 | Agentes e migração | Quem participa e como a composição mudou? | P1 |  | S2, S22 | placeholder | Concluído com limitação declarada | Sem chamar novos perfis de novas empresas; cancelamentos e migrações definidos. | Página /setor-eletrico/mercado/agentes ligadas à gold mercado.json em 06/10/2026 (branch claude/kind-mayer-v9tpwi), com a coleta da CCEE autorizada e refeita no mesmo dia (dados até ago/2026): resposta curta da gold, recorte, visual com referência, tabela equivalente, Comprove este número, download, link e próxima pergunta; modos Entender, Analisar e Auditar; axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px; testes em src/tests/energia-mercado-pagina.test.ts e energia-mercado.test.ts. Revisão adversarial da interface pendente. 400 KB de HTML. Limitação declarada: cadastro de perfis sem data de posição; lista de associados mês a mês desde out/2025; ano corrente dos desligamentos parcial. |
| P034 | MRE e GSF | Como foi o ajuste da garantia física? | P1 |  | S2 | placeholder | Parcial | GSF reconciliado à publicação oficial; garantia física e geração não misturadas. | Página /setor-eletrico/mercado/mre-e-gsf ligadas à gold mercado.json em 06/10/2026 (branch claude/kind-mayer-v9tpwi), com a coleta da CCEE autorizada e refeita no mesmo dia (dados até ago/2026): resposta curta da gold, recorte, visual com referência, tabela equivalente, Comprove este número, download, link e próxima pergunta; modos Entender, Analisar e Auditar; axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px; testes em src/tests/energia-mercado-pagina.test.ts e energia-mercado.test.ts. Revisão adversarial da interface pendente. 308 KB de HTML. Parcial: GSF mensal reconciliado com o InfoMercado; o 'ajuste médio do MRE nos últimos doze meses' do InfoMercado (92,55% no Nº 229) não é reproduzido por nenhuma definição testada, divergência publicada na página. |
| P035 | Encargos e contabilização | Quais custos públicos aparecem na liquidação? | P1 |  | S2, S6 | placeholder | Concluído com limitação declarada | Nenhuma série inventada de PPA ou curva a termo; preços privados permanecem fora do escopo aberto. | Página /setor-eletrico/mercado/encargos ligadas à gold mercado.json em 06/10/2026 (branch claude/kind-mayer-v9tpwi), com a coleta da CCEE autorizada e refeita no mesmo dia (dados até ago/2026): resposta curta da gold, recorte, visual com referência, tabela equivalente, Comprove este número, download, link e próxima pergunta; modos Entender, Analisar e Auditar; axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px; testes em src/tests/energia-mercado-pagina.test.ts e energia-mercado.test.ts. Revisão adversarial da interface pendente. 427 KB de HTML. Limitação declarada: pagamento de ESS de fev/2025 a ago/2026 publicado como zero e não confirmado (nulo rotulado); liquidação de abr/2025 ausente da fonte; resposta da demanda fora do conjunto aberto de encargos. |

## Empresas

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P036 | Cadastro e ativos | Quem opera quais ativos? | P1 |  | S14, S22 | placeholder | Pendente | Zero vínculo por mera semelhança de nome; ativo sem vínculo permanece identificado. |  |
| P037 | Perfil da distribuidora | Como a empresa atende sua área? | P1 |  | S5, S8, S9, S16 | placeholder | Pendente | Mesma consulta dos módulos de origem; conjunto elétrico e área oficial preservados. |  |
| P038 | Finanças e investimentos | Como evoluem os fundamentos reportados? | P1 |  | S6, S23 | placeholder | Pendente | Sem somar subsidiária e controladora; cobertura de listadas não apresentada como setor inteiro. |  |
| P039 | Controle e concentração | Quem controla e qual a concentração? | P2 |  | S14, S22, S23 | placeholder | Pendente | Sem consolidação onde faltar participação; fronteira de mercado explícita para índices de concentração. |  |

## Expansão

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P040 | Carteira de projetos | O que está planejado e em construção? | P1 |  | S14, S15 | placeholder | Pendente | Outorga não contada como capacidade que certamente entrará. |  |
| P041 | Cronograma e atrasos | Quando deve entrar e o que atrasou? | P1 |  | S15 | placeholder | Pendente | Data da previsão conhecida e preservada; atraso sem data-base não publicado. |  |
| P042 | Geração e transmissão | A expansão vem acompanhada de rede? | P1 |  | S14, S15, S22 | placeholder | Pendente | km, MVA, MW e investimento separados; nenhuma soma de unidades incompatíveis. |  |
| P043 | Cenários oficiais | Como o planejamento enxerga a matriz? | P2 |  | S23 | placeholder | Pendente | Selo CENÁRIO; data-base, hipóteses e universo declarados. |  |

## Regulação

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P044 | Limites e regras de preço | Quais regras valem em cada período? | P0 |  | S20, S2 | placeholder | Pendente | Publicação não confundida com vigência; teto estrutural e horário em campos separados. |  |
| P045 | Linha do tempo | O que mudou e quem é afetado? | P1 |  | S6, S16, S2 | placeholder | Pendente | Sem inferir causalidade por coincidência entre norma e gráfico. |  |
| P046 | Consultas e agenda | Quais decisões estão abertas ou próximas? | P1 |  | S16, S22 | placeholder | Pendente | Prazo e situação verificados; não manter consulta vencida como aberta. |  |

## Conta de luz

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P047 | Tarifa e comparação | Quanto custa um perfil comparável? | P1 |  | S9, S6 | inexistente | Pendente | Comparar a mesma modalidade; distinguir tarifa homologada, tarifa média e conta simulada. |  |
| P048 | Composição | Para onde vai o valor da conta? | P1 |  | S6, S9 | inexistente | Pendente | Componentes fecham com o total; sem dupla contagem TE/TUSD. |  |
| P049 | Simulador de consumo | Como minha conta varia com consumo e perfil? | P1 |  | S9, S6, S10 | inexistente | Pendente | Resultado rotulado como estimativa quando faltar item; memória de cálculo visível. |  |
| P050 | Reajustes, bandeiras e subsídios | O que mudou e quem financia benefícios? | P1 |  | S6, S13, S23 | inexistente | Pendente | Não apresentar diferença PLD–tarifa como margem da distribuidora. |  |

## Qualidade do serviço

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P051 | Duração e frequência | Por quanto tempo e quantas vezes faltou luz? | P1 |  | S8, S16 | inexistente | Pendente | Agregação ponderada e referência regulatória corretas; não converter centésimos de hora em minutos por leitura literal. |  |
| P052 | Realizado e limites | O serviço cumpriu o padrão? | P1 |  | S8 | inexistente | Pendente | Realizado e limite da mesma vigência e cobertura; médias não escondem caudas. |  |
| P053 | Compensações | Quais compensações foram pagas? | P1 |  | S8 | inexistente | Pendente | Não estimar crédito individual a partir de DEC/FEC agregado. |  |
| P054 | Atendimento e resiliência | Como o consumidor é atendido e como a rede se recupera? | P2 |  | S16, S22 | inexistente | Pendente | Número de reclamações não comparado sem população exposta; pesquisa exibe amostra. |  |

## Perdas

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P055 | Mapa e comparação | Onde estão as perdas e como evoluíram? | P1 |  | S5, S6, S7, S22 | inexistente | Pendente | Geografia não mais fina que o dado; sem dado separado de zero; taxa agregada ponderada pela base. |  |
| P056 | Técnicas e não técnicas | Qual a composição das perdas? | P1 |  | S5, S6, S7 | inexistente | Pendente | Não somar percentuais com denominadores diferentes; totais conciliados quando compatíveis. |  |
| P057 | Realizado e regulatório | Quanto diverge da referência reconhecida? | P1 |  | S6 | inexistente | Pendente | Parâmetro regulatório não confundido com perda realizada nem obrigação de perda zero. |  |
| P058 | Custo e contexto social | Qual é a dimensão econômica e territorial? | P1 |  | S6, S23 | inexistente | Pendente | Sem monetizar por tarifa cheia ou atribuir fraude à população de uma área. |  |

## Inclusão energética

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P059 | Tarifa Social | Onde e quanto o benefício alcança? | P1 |  | S10, S11, S12 | inexistente | Pendente | Contagens e unidades corretas; nenhuma exposição de beneficiários individuais. |  |
| P060 | Cobertura potencial | Quem pode estar ficando de fora? | P2 |  | S10, S11, S23 | inexistente | Pendente | Lacuna de cobertura só publicada com denominador elegível validado; proxy recebe rótulo próprio. |  |
| P061 | Peso no orçamento | Para quem a energia pesa mais? | P2 |  | S18 | inexistente | Pendente | Sem mapa municipal observado derivado indevidamente de amostra; razão de médias não substitui média de razões. |  |
| P062 | Acesso e sistemas isolados | Quem ainda precisa de acesso adequado? | P1 |  | S17, S16, S23 | inexistente | Pendente | Não usar carga do SIN como medida de acesso para todo o Brasil. |  |

## Transição e ambiente

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P063 | MMGD e distribuição territorial | Onde a geração distribuída cresce? | P1 |  | S14, S22 | inexistente | Pendente | Capacidade cadastrada não apresentada como energia gerada; revisão e duplicidade controladas. |  |
| P064 | Emissões | Como varia a intensidade de emissões? | P2 |  | S19, S21 | inexistente | Pendente | Fator médio não apresentado como marginal; unidades CO2 e CO2e preservadas. |  |

## Aprenda

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P065 | Glossário completo | O que significam os conceitos? | P1 |  | D0, S5, S8, S9, S2 | parcial | Concluído com limitação declarada | Definição clara, exemplo, não confundir com, fonte primária e data de revisão. | Páginas /setor-eletrico/aprenda e /setor-eletrico/aprenda/<verbete> publicadas em 06/10/2026 e completadas em 07/10/2026 (branch claude/kind-mayer-v9tpwi): 48 verbetes, todos conferidos com definição, unidade quando é grandeza, exemplo real ligado ao painel (26 com a ficha de prova do painel, 21 lidos da gold, 1 sintético rotulado), não confundir com (41 pares), fonte primária com trecho literal e data de conferência e de revisão. Das oito pendências do inventário, todas foram conferidas: MRE (InfoMercado Nº 229) e ACR, ACL, garantia física e ESS (Decreto nº 5.163/2004) em 06/10/2026; GSF (boletim e relatório do GT do MRE, do MME), REE (EPE, MME e ONS) e constrained-off (nota técnica da EPE que cita a REN ANEEL nº 1.030/2022) em 07/10/2026, tudo com captura versionada e sha256. axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px; testes em src/tests/energia-aprenda.test.ts. Revisão adversarial da interface pendente. Limitação declarada: a definição regulatória do GSF (Regras de Comercialização da CCEE), o texto original da REN ANEEL nº 1.030/2022 e os Procedimentos de Rede do ONS não foram acessados; cada verbete diz o que foi e o que não foi lido. |
| P066 | Trilhas e exemplos | Como ligar conceitos aos números? | P1 |  | D0, S2, S5, S8 | parcial | Concluído com limitação declarada | Usuário chega do conceito à evidência e retorna ao contexto. | Páginas /setor-eletrico/aprenda/trilhas, /trilhas/agua-operacao-preco e /trilhas/custo-tarifa-orcamento publicadas em 06/10/2026: passos com verbetes conferidos, número real com a ficha de prova e link ao painel, ligações tipificadas com o traço do mapa do setor, exemplo sintético interativo com rótulo permanente que não lê nem alimenta indicadores, e botão de volta do painel ao passo ou ao verbete (conferido em navegador em 390 e 1440 px). axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px; testes em src/tests/energia-aprenda.test.ts. Revisão adversarial da interface pendente. Limitação declarada: a liquidação sintética simplifica as Regras de Comercialização da CCEE, não conferidas; o peso no orçamento vem da POF 2017-2018. |

## Dados

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P067 | Catálogo utilizável | Quais dados estão de fato validados? | P0 |  | D0, S2 | parcial | Concluído com limitação declarada | Nenhum salto de catalogado para utilizado oculta validação; descontinuados identificados. | Página /setor-eletrico/dados ligada às golds catalogo.json e publicacao.json (gold de 01/10/2026) em 07/10/2026 (branch claude/kind-mayer-v9tpwi): escada catalogado, recurso verificado, integrado, validado e publicado com a contagem e o critério de cada etapa; tabela de 415 conjuntos com as cinco etapas em colunas, uso declarado à parte e filtros na URL; ficha do conjunto com a evidência de cada etapa e de cada integração; os 6 conjuntos em uso abaixo de publicado listados com a ressalva do catálogo; 12 descontinuados com critério e evidência; recurso a recurso da CCEE (733 arquivos) lido do CSV publicado. Revisão adversarial da interface pendente. axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px nos modos Entender e Auditar; testes em src/tests/energia-dados-interface.test.ts. Limitação declarada: estados e contagens valem para a execução de 01/10/2026 (Mercado de 06/10, Geração P023 e P024 e Aprenda ainda fora do catálogo); recurso verificado lê só 64 KB de um arquivo por conjunto. |
| P068 | Saúde e revisões | O que atrasou ou mudou? | P0 |  | D0 | parcial | Concluído com limitação declarada | Falha nunca renova artificialmente a data do dado; versão anterior preservada. | Página /setor-eletrico/dados/saude ligada à gold publicacao.json (referência 01/10/2026) em 07/10/2026: situação dos 151 conjuntos integrados por cadência declarada e SLA, calendário de 120 dias com cinco medidas na URL, tabela com atraso, último período, completude, coleta e revisões, revisões com as duas capturas, falhas com último período e última captura lado a lado, regras A a E. O teste confere que o prazo parte do fim do último período (ou da publicação da fonte nos casos D e E), nunca da captura. Revisão adversarial da interface pendente. axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px nos modos Entender e Auditar; testes em src/tests/energia-dados-interface.test.ts. Limitação declarada: a primeira captura registrada é de 27/09/2026 (antes, medidas de captura aparecem como sem dado); a situação vale para 01/10/2026. |
| P069 | Download e reprodução | Consigo reproduzir este gráfico? | P1 |  | D0, B7 | parcial | Concluído com limitação declarada | Pacote gera o mesmo agregado e não depende de links temporários para existir. | Página /setor-eletrico/dados/reproducao ligada ao manifesto.json em 07/10/2026: 269 arquivos com sha256, tamanho, linhas, colunas, dicionário e Parquet equivalente; ficha do arquivo com download, versão permanente no GitHub, dicionário e colunas; conferência de um arquivo baixado por sha256 no navegador (igual, outra versão ou desconhecido), conferida em navegador; conferência do manifesto contra os arquivos entregues na construção (269 de 269); 25 Parquet com equivalência conferida; passos de reprodução. Defeito corrigido: o manifesto de 01/10/2026 estava incompleto e 9 arquivos tinham outro sha256; run.py e executar_modulo.py passam a gravar o manifesto final e ele foi regravado. Revisão adversarial da interface pendente. axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px nos modos Entender e Auditar; testes em src/tests/energia-dados-interface.test.ts. Limitação declarada: o pacote por consulta (CSV e XLSX) é o da tabela de cada painel; o silver com as vintages não é publicado no repositório; Parquet só nos CSV acima de 2 MB. |

## Metodologia

| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P070 | Regras e limites | Quais interpretações são permitidas? | P0 |  | D0, S3, S5, S8 | parcial | Concluído com limitação declarada | Cada afirmação de fonte integrada corresponde a recurso realmente verificado. | Página /setor-eletrico/metodologia ligada às golds metricas.json e publicacao.json em 07/10/2026: regras dos 276 indicadores em 18 módulos (definição, fórmula, unidade, recortes, agregação, cobertura, ausência, validações, limitações e código), lidas sob demanda e todas completas segundo o teste; 8 afirmações sobre fontes integradas conferidas com o catálogo (a de limites de intercâmbio com a afirmação anterior e a correção); matriz natureza e validação; regras do pipeline; limitações gerais atualizadas (saíram três afirmações que deixaram de ser verdade). Revisão adversarial da interface pendente. axe sem violações e sem rolagem horizontal em 360, 390, 768 e 1440 px nos modos Entender e Auditar; testes em src/tests/energia-dados-interface.test.ts. Limitação declarada: 142 de 154 fichas de evidência sem natureza vinculada e natureza estimada sem separar fonte de observatório (pedidos 4 e 8 do documento do módulo). |
| P071 | Avaliação dos painéis | Como demonstrar que a qualidade evoluiu? | P1 |  | D0 | inexistente | Concluído com limitação declarada | Notas só após inspeção e testes; não atribuir nota estética com base apenas em descrição. | Avaliação dos painéis publicada em 07/10/2026: rubrica de dez dimensões com peso (seção 15.1), instrumento de inspeção em Chromium (360, 390, 768 e 1440 px; Entender e Auditar; axe, rolagem, teclado, alvos de toque, controles, ficha de prova, links, peso e anatomia), dez jornadas da seção 15.2 por roteiro, revisão de didatismo e qualidade visual por nove revisores em contexto limpo, três rodadas medidas sobre 94 de 368 rotas (r1 de base com 89 páginas e r2 recalculadas, r3 final depois de uma rodada de correção do código). Resultado da r3 (inspeção de 07/10/2026, dados de referência de 01/10/2026): nota ponderada média 8,2, nenhuma página na meta de produto, nenhum defeito crítico (4 altos, 34 médios, 12 baixos; eram 94 defeitos na r2), dez jornadas cumpridas, didatismo 7,0 e qualidade visual 7,2, rolagem horizontal de 23 páginas para nenhuma, alvos de toque abaixo de 24 px de 67 páginas para nenhuma, axe sem violações. gold avaliacao.json integrada ao publicacao.json e ao manifesto; página /setor-eletrico/metodologia/avaliacao (axe sem violações e sem rolagem horizontal em 12 combinações); AVALIACAO_PAGINAS.md e EVIDENCIAS_ACEITE.md gerados; testes em pipeline/tests/test_energia_avaliacao.py e src/tests/energia-avaliacao.test.ts. Erro da r2 corrigido (título em pergunta não medido contado como ausente; r1 e r2 recalculadas e marcadas). Limitação declarada: revisão e jornadas não são teste com pessoas e os revisores da r3 são outras instâncias de agente, sem calibração entre rodadas; sem leitor de tela real nem dado de campo (teto de 9,0 em acessibilidade e desempenho); famílias dinâmicas amostradas; a própria página de avaliação não está entre as medidas; largura mínima da primeira coluna das tabelas e alinhamento da aba atual foram corrigidos depois da medição e entram na r4. |
