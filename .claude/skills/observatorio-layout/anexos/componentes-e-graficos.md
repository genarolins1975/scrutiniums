# Observatório Layout, anexo: Componentes e gráficos

Carregar quando a tarefa tocar número de destaque, figura, tabela, controles, logos, estados, gramática dos gráficos, rótulos de medida. Texto movido sem alteração do SKILL.md de 22/10/2026; os números de seção são os do original.

## 5. Contrato dos componentes

### Número de destaque

Exibir rótulo preciso, valor, unidade, recorte temporal e referência identificada. Mostrar variação com base e período. Não exibir seta sem explicar a comparação. Não reduzir o valor a abreviação ambígua; oferecer precisão apropriada no detalhe.

### Figura analítica

Incluir pergunta/título curto, subtítulo com unidade e universo, marcas legíveis, referência, fonte e ressalva material. Evitar repetir o título da página. Usar legenda apenas quando os rótulos diretos não resolverem.

Disponibilizar tabela equivalente e exportação quando existentes. Preservar, em toda alternância, seleção, elegibilidade e unidades. Resumo visual não autoriza exportar apenas a amostra mostrada sem aviso.

### Tabela

Definir colunas pela tarefa, não pela ordem da base. Fixar identificação apenas quando ajudar e sem ocultar valores. Agrupar cabeçalhos de modo semântico. Ordenar com estado visível, mantendo tratamento explícito de ausências e empates.

No OBEE, dar visibilidade a gasto total, por habitante e por matrícula quando metodologicamente válidos, além de referência e cobertura; não escondê-los em tooltip. Não chamar matrícula de estudante único sem suporte do contrato.

Manter diferenças entre zero, ausência, inelegibilidade e indisponibilidade. Evitar ícones sem texto explicativo.

No celular, preservar identificação e valores essenciais. Se a tarefa exigir comparação entre colunas, permitir rolagem apenas na tabela, com indicação perceptível, em vez de converter tudo em cards e perder a comparação. Não permitir rolagem horizontal da página inteira.

### Controles e notas

Colocar filtros perto do conteúdo afetado; rotular todos. Mostrar seleção, ação de limpar e estado de carregamento quando pertinentes. Preservar foco após atualização.

Usar ajuda curta para conceitos; usar expansão para detalhes. Manter ressalvas materiais fora de tooltips. Não espalhar um botão “Passaporte” em cada célula; oferecer uma ficha coerente por indicador com contexto do recorte.

### Identidade de empresas (logos)

O usuário quer o símbolo de cada empresa sempre que a página fala de uma companhia identificada (fichas, vitrines, tabelas de grupos, vencedoras de leilão).

- Só o arquivo oficial publicado pela própria companhia (RI, kit de marca), baixado e servido localmente; nunca redesenhar, aproximar ou usar fonte de terceiros.
- Manifesto versionado por logo (`public/energia/logos/manifesto.json`): papel, nome de exibição, CNPJ da holding, CNPJ do grupo no topo da cadeia, arquivo, URL de origem, data de captura, sha256, tom do fundo e ausência com motivo.
- Vínculo entre logo e entidade só por CNPJ ou cadeia de controle provada; nunca por semelhança de nome. Quando a base não traz CNPJ (ex.: vencedora de leilão), ligar pelo ativo ao controlador atual e dizer que não é o vencedor na data.
- Placa no tom do arquivo (logos publicados só em branco ganham placa escura); tamanho fixo e discreto; alt com o nome; sem logo oficial, o nome em texto e a ausência registrada.
- SVG com script, evento, conteúdo embutido, entidade ou referência externa é recusado (não "limpo"); a pasta de logos responde com CSP restritiva.

### Estados

Projetar padrão, carregamento, ausência, erro, cobertura insuficiente, estimativa, quebra de série e seleção extrema. Explicar o que falta e o que continua utilizável. Não substituir ausência por zero nem preencher painel com dado demonstrativo em produção.

## 6. Gramática dos gráficos

| Pergunta | Preferência | Cuidado |
|---|---|---|
| Como evoluiu? | Linha e referência temporal compatível | Mostrar lacunas e quebras; não inventar continuidade |
| Como se compara? | Pontos, barras ou pequenos múltiplos | Usar mesma unidade, universo e escala quando comparáveis |
| Onde está na distribuição? | Pontos, histograma ou boxplot explicado | Declarar população, mediana e cobertura |
| Do que se compõe? | Barras empilhadas e categorias completas | Não apresentar “cinco maiores” como total fechado |
| Onde ocorre? | Mapa com geometria oficial | Oferecer comparação tabular; respeitar grão territorial |
| Como duas medidas se relacionam? | Dispersão com contexto | Não sugerir causalidade ou ranking de eficiência |
| Como funciona? | Diagrama curto e rotulado | Distinguir mecanismo, fluxo e associação |
| Qual é a incerteza? | Faixa ou intervalo documentado | Não criar leque de previsão sem método |

- Iniciar barras quantitativas em zero; justificar e sinalizar exceções de outros tipos de gráfico. Evitar eixo duplo como atalho para medidas distintas.
- Escolher precisão coerente com fonte e tarefa. Diferenciar pontos percentuais de variação percentual.
- Mostrar extremos sem comprimir todos os demais até ficarem ilegíveis: pequenos múltiplos, distribuição ou escalas explicitamente alternativas. Não remover o extremo silenciosamente.
- Usar referência histórica sazonal quando a sazonalidade fizer parte do fenômeno. Não tratar máximo observado como meta.
- Exigir numerador, denominador, janela e ponderação compatíveis. Não converter benchmark incompatível em linha de meta.
- Posicionar labels diretamente e testar nomes longos. No mobile, reduzir ticks e anotações opcionais, não reduzir todo o gráfico até ilegibilidade.
- Usar curvas e transições apenas quando preservarem significado. Não suavizar séries para esconder volatilidade; não animar contadores decorativos.

### Rótulos de medida (achados recorrentes de revisão)

- **A unidade da contagem é a do dado.** Linha de arquivo não é entidade: "1.552 vendas de 1.469 usinas distintas", não "1.552 empreendimentos". Antes de rotular, conferir chave única.
- **A data é a da fonte que produziu o número.** Contagem derivada do índice de distribuidoras não leva a data do cadastro de agentes; texto que cita uma data alternativa não leva o rótulo da fonte principal (ex.: "(bolsa)" sem carteira da bolsa).
- **Zero calculado não é "sem dado".** Companhia sem distribuidora sob controle mostra 0 com a regra, não ausência.
- **Identificador oficial na forma da fonte.** Número de leilão como a ANEEL designa ("nº 10/2013"), nunca em formato que pareça ano e mês.
