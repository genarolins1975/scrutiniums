---
name: observatorio-layout
description: Criar, redesenhar e avaliar interfaces da Scrutiniums e dos observatórios de Energia, Eficiência Estatal (OBEE) e Crédito com estética editorial excepcional, visualização de dados rigorosa e profundidade analítica. Usar em pedidos de layout, mock, painel, tabela, gráfico, página inicial, responsividade ou revisão estética desses observatórios. Não usar para alterações exclusivamente de dados ou backend sem efeito na apresentação.
---

# Observatório Layout

## Direção

Atuar como diretor de arte editorial e designer de informação. Criar uma linguagem reconhecível para a Scrutiniums: elegante, precisa, acolhedora à leitura e rica em evidência. Organizar profundidade sem empobrecer o conteúdo.

Tratar a identidade como um sistema de decisões, não como uma coleção de cards. Fazer cada elemento visual justificar sua presença pela compreensão, comparação, navegação ou confiança que acrescenta.

Aplicar ao observatório indicado pelo usuário. Compartilhar linguagem e componentes, mas preservar diferenças entre temas. Não estender uma tarefa ao restante da plataforma sem necessidade ou autorização.

Respeitar instruções explícitas do usuário e regras do repositório. Esta skill não autoriza deploy, merge, alteração de acessos ou modificação metodológica. Executar autonomamente as melhorias de interface autorizadas.

## 1. Contrato editorial inegociável

- Apresentar indicadores, referências, diferenças e limitações; deixar as conclusões ao leitor.
- Usar títulos descritivos e perguntas curtas. Permitir frases factuais calculadas pelo mesmo contrato do gráfico.
- Não usar rótulos como “gestão ruim”, “eficiente”, “desperdício”, “melhor empresa” ou “fonte superior” inferidos de um indicador isolado.
- Não transformar cor, ordenação ou título em julgamento que o texto não sustentaria.
- Mostrar referência, unidade, período, universo e ressalva material junto à medida. Reservar detalhes de reprodução para a ficha metodológica.
- Não reduzir conteúdo para produzir uma tela artificialmente vazia. Remover duplicações e competição visual; preservar análises úteis.
- Nunca inventar série, mapa, benchmark, intervalo ou estatística para preencher espaço. Em mock, identificar dados sintéticos junto ao visual; preferir dados verificados quando disponíveis.
- Tratar ausência, zero, estimativa, previsão e cenário como estados diferentes também na apresentação.

## 2. Antes de desenhar

1. Ler instruções do projeto, componentes, tokens, fontes e dependências existentes. Reutilizar o que funciona; não trocar framework para resolver layout.
2. Examinar a tela atual no navegador e seus estados, quando houver acesso. Registrar quando a análise se limitar ao código ou a uma imagem.
3. Inventariar gráficos, filtros, comparações, tabelas, downloads e notas materiais. Mapear sua localização depois da mudança.
4. Definir em uma frase a tarefa da página e identificar seu arquétipo: entrada, panorama, exploração, ficha, comparação, catálogo ou método.
5. Escolher a pergunta principal e as perguntas complementares. Para cada visual, explicitar internamente qual comparação ele torna possível.
6. Usar preferências conhecidas do usuário. Perguntar somente se faltar uma decisão que altere substancialmente o resultado. Não perguntar novamente por cores e direção já definidas.

## 3. Identidade visual de referência

Adotar a paleta abaixo como ponto de partida quando o projeto não possuir tokens equivalentes. Mapear para os tokens existentes e verificar contraste em cada uso. Não afirmar que uma cor isolada garante acessibilidade.

| Papel | Referência | Aplicação |
|---|---|---|
| Papel | `#F8F7F2` | Fundo editorial principal |
| Superfície | `#FFFFFF` | Controles, menus e superfícies funcionais |
| Tinta | `#182B36` | Texto e valores principais |
| Texto secundário | `#58666B` | Contexto e metadados legíveis |
| Destaque | `#09697A` | Série focal, links e seleção |
| Contexto suave | `#E7EFEE` | Faixas de referência e seleção discreta |
| Regra | `#D7DCD7` | Separadores decorativos; não depender dela para distinguir controles |
| Comparação | `#806A45` | Série de referência quando necessária; verificar contraste |

Usar uma cor focal e referências neutras por padrão. Em composição multissérie, aplicar uma paleta categórica acessível com identidade estável, rótulos e alternativas à cor. Não pintar cada entidade com uma cor diferente sem função.

Reservar cores de aviso para estados documentados. Não usar verde/vermelho para dizer que gastar mais, gerar mais ou cobrar menos é bom ou ruim.

Preservar o logotipo e os ativos oficiais. Não redesenhá-los por aproximação. Preferir a aparência clara editorial; preservar e testar modo escuro se o produto já o oferecer, sem adicioná-lo apenas como adorno.

### Tipografia

- Reutilizar as famílias licenciadas já carregadas. Usar serifada editorial para títulos e sans-serif legível para texto, controles, unidades e tabelas.
- Na ausência de fontes próprias, usar fallbacks de sistema coerentes. Não depender de download externo para a primeira leitura.
- Adotar como referência: H1 40–48 px desktop e 30–36 px mobile; H2 28–34/24–28; H3 20–24; corpo 16–18; tabelas 14–16; metadados 12–14.
- Tratar faixas como orientação, não medidas rígidas. Respeitar zoom, texto ampliado, tradução e títulos longos.
- Usar entrelinha de aproximadamente 1,5–1,65 em texto corrido e 1,1–1,25 em títulos. Evitar tracking apertado que prejudique acentos.
- Preferir pesos 400, 500 e 600; reservar negrito para hierarquia real. Não transformar a página em competição de números gigantes.
- Usar algarismos tabulares em colunas e comparações; alinhar números à direita. Aplicar padrão brasileiro de números e datas.
- Limitar parágrafos de explicação a uma largura confortável, aproximadamente 60–75 caracteres. Não restringir gráficos e tabelas à largura do texto.

### Geometria e ritmo

- Usar escala de espaçamento consistente: 4, 8, 12, 16, 24, 32, 48 e 64 px como referência.
- Adotar área principal de cerca de 1.160–1.240 px; permitir maior largura em tabelas analíticas quando a tarefa exigir.
- Usar margens laterais de 32–48 px no desktop e 16–24 px no celular, ajustadas ao espaço real.
- Preferir linhas, alinhamento e proximidade a caixas. Agrupar com superfície apenas quando houver uma função distinta: controles, seleção, aviso ou comparação delimitada.
- Evitar sombras em gráficos, bordas em cada bloco e grandes raios. Reservar sombra discreta para sobreposição real, como menu ou diálogo.
- Construir seções pela pergunta; evitar uma sucessão monótona de três cards iguais.

## 4. Arquiteturas de página

### Inicial do observatório

Combinar: identidade e promessa curta → explicação visual do tema → amostra equilibrada de indicadores com referências → caminhos por perguntas → índice temático completo → fontes e atualidade acessíveis.

Garantir informação substantiva cedo. Evitar hero de marketing que consuma a primeira tela, fotografia decorativa, manifesto longo e mosaico interminável de KPI.

Usar o diagrama do sistema para ensinar relações reais. Diferenciar fluxos físicos, relações institucionais, financeiras e associações. Não desenhar uma seta causal onde existe apenas conexão temática.

Oferecer uma navegação principal e busca funcional quando houver índice confiável. Não repetir os mesmos destinos em quatro menus e conjuntos de cards.

### Panorama temático

Organizar: pergunta → recorte → medida com referência → visual principal → análises complementares visíveis → conexões úteis → aprofundamento e método.

Escolher a densidade conforme a pergunta. Não impor limite universal de três indicadores ou um gráfico. Mostrar evolução, distribuição, composição e território quando acrescentarem entendimento; não apenas links com esses nomes.

### Exploração e comparação

Priorizar área analítica, controles locais, estado da seleção, resumo do universo e referências recalculadas. Usar duas colunas quando as medidas precisarem ser vistas juntas e uma quando a figura exigir largura.

Preservar filtros na URL quando o projeto suportar. Permitir compartilhar o recorte. Evitar filtros globais que pareçam sincronizar indicadores com calendários incompatíveis.

### Ficha de entidade

Dar identidade, perímetro e cobertura à entidade antes de comparar. Organizar dimensões em capítulos. Não inventar nota composta para sintetizar indicadores heterogêneos.

### Catálogo e metodologia

Dar prioridade à busca, classificação e reprodução. Evitar hero alto, indicadores ornamentais e documentação integral antes do primeiro recurso útil. Manter datas de referência, captura e publicação distintas.

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

## 7. Adaptação ao tema

| Tema | Preservar na apresentação |
|---|---|
| Energia | Potência versus energia; PLD versus tarifa/fatura; medição versus estimativa; fluxo bruto versus saldo; limites com vigência; projetos versus operação; previsão versus cenário |
| OBEE | Gasto versus serviço versus resultado; universos próprios; valores totais e denominadores válidos; cobertura e elegibilidade; anos de resultados e gastos; ausência de julgamento automático de eficiência |
| Crédito | Estoque versus fluxo; saldo versus concessão; taxa versus spread; inadimplência com conceito e janela; PF/PJ; perímetros de instituições; comparações de produtos e períodos compatíveis |

Não inserir valores ou datas fixos desta skill nos painéis. Buscar tudo nos contratos reais. Encaminhar problemas de dados à investigação metodológica sem “corrigi-los” por CSS, arredondamento ou exclusão silenciosa.

## 8. Acessibilidade e comportamento

- Projetar responsivamente pelo conteúdo; testar pelo menos 320, 390, 768 e 1440 px, zoom de 200% e reflow com texto ampliado quando viável.
- Mirar alvos confortáveis de 44 × 44 px para controles de toque. Manter texto essencial legível sem depender de zoom.
- Verificar teclado, ordem de leitura, foco visível, links, menus e alternativa ao hover. Não esconder o foco sob cabeçalhos fixos.
- Usar estrutura semântica, cabeçalhos de tabela, nomes acessíveis e descrição dos gráficos. Não anunciar todas as mudanças do gráfico em região viva.
- Usar contraste de texto como critério verificável: referência de 4,5:1 para texto comum e 3:1 para texto grande; verificar também limites perceptíveis dos controles e elementos gráficos necessários.
- Respeitar preferência por movimento reduzido. Evitar carrosséis automáticos, animações de entrada em todos os blocos e modais instrutivos obrigatórios.
- Não declarar conformidade integral por teste automático. Registrar se leitor de tela ou verificação manual não puderam ser executados.

## 9. Processo de execução

1. Diagnosticar o estado atual com capturas e inventário proporcional ao escopo.
2. Definir uma composição coerente e tokens compartilhados. Criar alternativas somente se houver uma decisão real ainda aberta.
3. Em redesenho amplo, implementar primeiro uma página representativa com gráfico, tabela, filtros e ressalva; validar e continuar pelas demais sem parar em piloto.
4. Extrair componentes após confirmar seu comportamento. Evitar abstração que force todas as páginas a uma grade idêntica.
5. Conferir valores, referências, filtros e exportações. Não alterar contratos de dados sob pretexto estético.
6. Abrir o resultado no navegador, inspecionar telas completas e detalhes. Verificar começo, meio e fim da página, não apenas hero.
7. Revisar usando a rubrica abaixo, corrigir problemas e repetir apenas enquanto houver avanço verificável.
8. Entregar mudança revisável, evidências, limitações e próximos bloqueios reais. Não realizar publicação adicional sem autorização.

Não instalar bibliotecas, fontes ou animações pesadas sem necessidade concreta. Reutilizar a infraestrutura de gráficos e componentes do projeto; usar carregamento progressivo para séries extensas sem esconder seus resumos.

## 10. Rubrica de excelência estética e funcional

Pontuar separadamente cada página alterada. Não compensar um critério ruim com a média dos demais.

| Critério | Evidência esperada para 9/10 |
|---|---|
| Direção de arte | Identidade coerente e sóbria; nenhuma decoração sem função; componentes e estados consistentes |
| Hierarquia | Pergunta, medida e referência reconhecíveis; seções com prioridades claras; ausência de competição entre títulos, KPI e controles |
| Tipografia e acabamento | Escala coerente; linhas e números alinhados; rótulos sem cortes; espaçamento intencional; nomes longos tratados |
| Densidade e profundidade | Análises preservadas e bem agrupadas; detalhes acessíveis; ausência tanto de entulho quanto de vazio artificial |
| Didática visual | Conceitos, unidades e relações compreensíveis; gráfico adequado à tarefa; notas no lugar necessário |
| Comparabilidade | Referências válidas, cobertura e universos claros; escalas e cores não induzem julgamento indevido |
| Interação e acessibilidade | Tarefas essenciais funcionam por teclado e toque; estados claros; evidência manual além da automação |
| Responsividade | Mesma tarefa realizável em tela estreita; sem cortes, sobreposição ou perda silenciosa de valores |

Usar 5–6 para funcional com problemas importantes; 7–8 para bom com limitações relevantes; 9 para excelente demonstrado; 10 para excepcional com evidência adicional. Registrar nota, rota/estado, evidência e limitação remanescente.

Buscar pelo menos 9 em cada critério. Não garantir essa nota nem atribuí-la por desejo de encerrar. Marcar “não verificado” quando faltar acesso ou evidência. Se existir revisão independente disponível, usá-la; não chamar autoavaliação de independente.

Reprovar enquanto houver: dado enganoso, ressalva essencial escondida, funcionalidade perdida, valor ilegível, sobreposição, tarefa essencial inacessível ou referência incompatível.

Após duas rodadas sem ganho verificável, reconsiderar a solução ou declarar o bloqueio. Não gerar alterações cosméticas sem finalidade nem prolongar indefinidamente o trabalho.

## 11. Exemplos de decisão

- “A página está entulhada”: agrupar controles, retirar repetições e organizar capítulos; preservar série, distribuição e comparação, em vez de apagá-las.
- “Quero padrão mundial”: traduzir em alinhamento, hierarquia, leitura e tarefas verificáveis; não apenas trocar fontes, usar gradientes ou adicionar cards.
- “Quero mais referências”: escolher régua pertinente ao indicador, declarar universo e mostrar a posição; não colocar média de grupo incompatível.
- “Quero que se entenda se está bem ou mal”: oferecer distância da referência, distribuição e limite aplicável; deixar o julgamento ao leitor.
- “No celular a tabela ficou enorme”: priorizar identificação e medidas, permitir exploração do restante e rolagem localizada quando necessária; não ocultar gasto por habitante ou por matrícula sem acesso claro.
- “O gráfico está bonito”: verificar a tarefa. Se a pessoa não consegue comparar ou entender a unidade, refazer mesmo que a imagem pareça sofisticada.

## 12. Entrega

Relatar de forma curta: o que melhorou para o leitor, telas e tarefas verificadas, visões preservadas e limitações. Em mudanças amplas, anexar capturas antes/depois e matriz por página. Não despejar detalhes internos do processo na interface pública.

Se solicitado apenas mock, entregar mock identificado. Se solicitada implementação, concluir código e verificações autorizadas. Não apresentar uma proposta visual como funcionalidade implantada.
