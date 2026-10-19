---
name: observatorio-layout
description: Construir, redesenhar e avaliar páginas, painéis e observatórios da Scrutiniums (Setor Elétrico, Crédito, Eficiência Estatal, Gás Natural, Saneamento, Contas Públicas e os próximos) com estética editorial excepcional, didática para leigos, rigor máximo de dado e entrega até a produção. Usar em pedidos de painel ou observatório novo, página inicial ou de entrada, layout, mock, tabela, gráfico, artefato didático, logos e identidade de empresas, navegação, responsividade, revisão estética, e no ciclo de PR, merge e conferência em produção dessas páginas. Não usar para alterações exclusivamente de dados ou backend sem efeito na apresentação.
---

# Observatório Layout

## Direção

Atuar como diretor de arte editorial e designer de informação. Criar uma linguagem reconhecível para a Scrutiniums: elegante, precisa, acolhedora à leitura e rica em evidência. Organizar profundidade sem empobrecer o conteúdo.

Tratar a identidade como um sistema de decisões, não como uma coleção de cards. Fazer cada elemento visual justificar sua presença pela compreensão, comparação, navegação ou confiança que acrescenta.

Aplicar ao observatório indicado pelo usuário. Compartilhar linguagem e componentes, mas preservar diferenças entre temas. Não estender uma tarefa ao restante da plataforma sem necessidade ou autorização.

Respeitar instruções explícitas do usuário e regras do repositório. Esta skill não autoriza, por si só, merge, alteração de acessos ou modificação metodológica: merge só com autorização do usuário na conversa (seção 13). Executar autonomamente as melhorias de interface autorizadas.

### O que o usuário pede, em ordem

Prioridade declarada por ele: **clareza > narrativa > didatismo > credibilidade > quantidade de funcionalidades**. Na prática:

- **Público leigo, rigor máximo.** Quem chega não é especialista e precisa responder perguntas sozinho; o rigor não pode ser sacrificado para isso.
- **Páginas organizadas por perguntas importantes para a sociedade**, não pela estrutura das bases ou dos módulos.
- **Didática e beleza extremas, com artefatos interativos sempre que possível** (laboratórios, simuladores, diagramas do mecanismo), identificados como modelo didático.
- **Não vender o que não existe.** Nada planejado, incompleto, simulado ou fictício aparece como funcionalidade; ausência não vira zero nem estimativa silenciosa.
- **Coerência entre observatórios.** O de Crédito é a referência de página inicial didática ("um mapa geral do observatório"); um erro corrigido num painel é procurado e corrigido nos demais.
- **O trabalho só termina em produção**, com links das rotas entregues (seção 13).
- **Aberto responde ao curioso sobre o seu caso; com conta é profundidade** (decisão de 17/10/2026, revista em 19/10/2026). A camada aberta ("O Brasil em perguntas", `/perguntas/*`, e a home) mostra poucos números do tema com fonte e período, uma frase de contexto e o convite para o painel. Além disso, podem ser abertas, rota por rota e só com aprovação do dono, as consultas pessoais em modo de consulta: minha cidade, minha distribuidora, meu estado, meu banco, minha capital (lista de candidatas em `docs/BANCA_2026-10-19.md`, seção "Estratégia aberto e com conta"). Séries completas, comparações entre muitas entidades, fichas completas, downloads, API, cenários, previsões, recortes salvos e alertas ficam com conta, que deve ter grau de profundidade e beleza muito maior que a página aberta. Numa rota aberta, todo recurso fechado aparece com o selo "com conta"; exportação gerada no navegador sai da versão aberta. Não transformar a página aberta em painel.
- **Decisões do dono de 19/10/2026** (registro completo em `docs/BANCA_2026-10-19.md`):
  - Retrato das capitais: a nota composta de 0 a 100 sai da entrada da Eficiência Estatal e fica no painel; a entrada mostra só as posições.
  - Cadastro: as informações básicas continuam obrigatórias (email, celular verificado, CPF, UF e perfil de uso); a melhoria é de clareza e de etapa, não de retirar dado. Tipo de instituição, área e cargo só para perfis profissionais.
  - Inglês na 1.0: só a home e o Setor Elétrico. Fora desse escopo, não prometer inglês.
  - Gravuras: melhorar quando a revisão julgar necessário; o layout tem de estar perfeito, sem imagem quebrada, cortada ou sem função.
  - Expansão: não há congelamento. Painel novo entra pelo valor agregado, sem duplicar tema sem painel canônico, com atualização agendada, consulta pessoal aberta quando houver e o critério de conclusão do documento da banca.

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

### Página de entrada (observatório ou módulo)

É a página mais criticada pelo usuário ("confusa", "péssima", "pouco objetiva", "fator UAU da Apple"). Antes de entregar, conferir cada item:

1. **Primeira tela responde ao leitor, não ao método.** Título com a pergunta, uma frase do que a página mostra e no máximo quatro números de escala do tema, cada um com fonte e data. Siglas de base, contagens de cadastro, CNPJ e taxas de vínculo ficam nos painéis ou no método, não na abertura.
2. **O destino mais procurado está a um clique**, à vista logo depois dos números, com cartões que já mostram algo útil (ex.: as companhias listadas com logo, papel e o que controlam; não só uma aba no menu). Toda subpágina do módulo é alcançável em um clique da entrada.
3. **Um artefato didático do mecanismo** (ex.: "Da usina à tomada": o que cada elo faz, como é remunerado, quantos agentes, com link para o painel), distinguindo fluxo físico, contratual e financeiro.
4. **Busca e caminhos por pergunta** depois disso, em cartões com a resposta curta e um número com prova.
5. **Método, elos, recorte e downloads recolhidos no fim**, sem sumir do HTML (auditabilidade e testes).
6. **Imagens finais**: nenhuma gravura provisória; ilustração estilizada só quando acrescenta reconhecimento (ex.: a capital, o tema), nunca fotografia decorativa.
7. **Home e cards atualizados** quando um painel novo entra: a página não logada, os cards da home e o mapa do observatório citam o painel novo.

Na entrada de um observatório inteiro, combinar: identidade e promessa curta → explicação visual do tema → amostra equilibrada de indicadores com referências → caminhos por perguntas → índice temático completo → fontes e atualidade acessíveis.

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

### Navegação e acesso

- **Todos os painéis exigem conta.** As únicas rotas abertas são as de `src/lib/rotasPublicas.ts`; nenhuma mudança de layout pode abrir painel sem login nem apontar a barra superior para o login quando há sessão.
- Ao mexer em abas, barra superior, cards ou rotas, conferir **logado e deslogado, em todos os observatórios**, e corrigir README ou documentação que diga outra coisa.
- **Um só cabeçalho (achado A7 da banca de 19/10/2026):** todo observatório e painel abre com a barra comum (`CabecalhoPlataforma` sobre `BarraPlataforma`, estilo `bp-*` em `public/observatorios.css`): a mesma marca, os seis observatórios na ordem e com os rótulos do registro, o atual marcado, o seletor e a conta. Abaixo dela vem a navegação do módulo. O cabeçalho público usa a mesma barra com os destinos abertos. Na SPA do Crédito a barra é gerada do registro (`node scripts/barra-spa.mjs`). Cabeçalho novo não desenha marca própria (teste `cabecalho-movel`).
- **Cabeçalho no celular (abaixo de 640 px):** a lista dos observatórios sai (`public/observatorios.css`) e os mesmos destinos ficam no seletor de observatório da linha da marca (`SwitcherObservatorio`; na SPA do Crédito, `.obs-trocar`; no cabeçalho público, "Observatórios ▾"), com a conta na mesma linha quando cabe. Cabeçalho novo que mostra `NavegacaoObservatorios` traz o seletor (teste `cabecalho-movel`). Decisão do dono de 17/10/2026, etapa 4 da arquitetura do Saneamento.
- Destinos novos entram na navegação do módulo (ordem pela procura: o mais procurado logo depois da visão geral), na busca e no mapa do observatório. O sitemap só lista rotas públicas (`ehRotaPublica`): painel protegido fica fora dele, e nunca se abre um painel só para aparecer no sitemap.

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
8. Entregar mudança revisável, evidências, limitações e próximos bloqueios reais. Seguir o ciclo da seção 13 até onde o usuário autorizou.

Testes que fixam o desenho anterior (ordem de seções, título, faixa de números) mudam junto com um redesenho pedido pelo usuário: atualizar de propósito, preservando os invariantes (natureza, período e prova de cada número, links válidos, teto de HTML) e dizendo no PR o que mudou e por quê. Nunca apagar teste para passar.

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

Reprovar enquanto houver: dado enganoso, ressalva essencial escondida, funcionalidade perdida, valor ilegível, sobreposição, tarefa essencial inacessível, referência incompatível, destino mais procurado a mais de um clique da entrada, data ou unidade atribuída à fonte errada, logo sem vínculo provado ou gravura provisória.

Após duas rodadas sem ganho verificável, reconsiderar a solução ou declarar o bloqueio. Não gerar alterações cosméticas sem finalidade nem prolongar indefinidamente o trabalho.

## 11. Exemplos de decisão

- “A página está entulhada”: agrupar controles, retirar repetições e organizar capítulos; preservar série, distribuição e comparação, em vez de apagá-las.
- “Quero padrão mundial”: traduzir em alinhamento, hierarquia, leitura e tarefas verificáveis; não apenas trocar fontes, usar gradientes ou adicionar cards.
- “Quero mais referências”: escolher régua pertinente ao indicador, declarar universo e mostrar a posição; não colocar média de grupo incompatível.
- “Quero que se entenda se está bem ou mal”: oferecer distância da referência, distribuição e limite aplicável; deixar o julgamento ao leitor.
- “No celular a tabela ficou enorme”: priorizar identificação e medidas, permitir exploração do restante e rolagem localizada quando necessária; não ocultar gasto por habitante ou por matrícula sem acesso claro.
- “Esta página está confusa / péssima”: refazer pela checklist da página de entrada (seção 4): o que o leitor procura primeiro, a um clique; quatro números; um artefato do mecanismo; método recolhido. Não só trocar estilo.
- “Coloque o símbolo da empresa”: aplicar o contrato de logos a todas as superfícies onde a empresa aparece, inclusive tabelas de outras seções, pelo mesmo componente e manifesto.
- “Use artefato didático sempre que possível”: um laboratório que o leitor manipula e que mostra o mecanismo real, com o rótulo "modelo didático" e o que ele deixa de fora; não ilustração estática no lugar de dado.
- “O gráfico está bonito”: verificar a tarefa. Se a pessoa não consegue comparar ou entender a unidade, refazer mesmo que a imagem pareça sofisticada.

## 12. Entrega

Relatar de forma curta: o que melhorou para o leitor, telas e tarefas verificadas, visões preservadas e limitações. Em mudanças amplas, anexar capturas antes/depois e matriz por página. Não despejar detalhes internos do processo na interface pública.

Se solicitado apenas mock, entregar mock identificado. Se solicitada implementação, concluir código e verificações autorizadas. Não apresentar uma proposta visual como funcionalidade implantada.

Para o usuário (que lê muito pelo celular): resposta curta, links clicáveis das rotas afetadas, o estado real (aberto, verde, mergeado, no ar) e uma pergunta só quando houver decisão dele pendente. Instruções que ele precise executar vêm passo a passo, sem alternativas ambíguas.

## 13. Do PR à produção

O usuário autoriza em frases curtas ("abre o PR", "faz o merge quando o CI passar", "coloque em produção") e pergunta com frequência "já está em produção?". Fechar o ciclo sem precisar de novo pedido:

1. **PR** com resumo do que mudou para o leitor, verificações feitas e pendências reais; acompanhar o PR.
2. **CI e revisão automática**: corrigir falhas e achados procedentes (Codex, Claude Code Review) e responder cada thread. Se o CI não aparece, checar conflito com o main: PR em conflito não roda testes.
3. **Conflitos** em arquivos gerados se resolvem regenerando com a ferramenta do repositório, nunca à mão: `docs/i18n/cobertura.json` com `node scripts/cobertura-i18n.mjs`; no Setor Elétrico, `public/energia/gold/metricas.json`, `arquivos.json` e `manifesto.json` com `python3 pipeline/energia/executar_modulo.py <módulo> --sem-coleta` (um módulo qualquer já integrado basta, porque os três são derivados de todos os registros). Em outros domínios, usar o gerador próprio do domínio, não o de energia.
4. **Merge** só com autorização explícita do usuário nesta conversa; "faz o merge quando ficar verde" vale para o PR em questão.
5. **Produção**: depois do merge, conferir o deploy da Vercel no commit do main (status do commit no GitHub) e só então dizer "está no ar", com o horário e os links das rotas. Os painéis exigem login: dizer o que foi verificado (deploy, cabeçalhos, rotas públicas) e o que só ele pode ver logado. Mudança de navegação ou acesso exige conferência logado e deslogado.
6. **Encerramento**: uma linha com o estado final e a próxima decisão dele, se houver.

### Prompts para outros modelos

Quando o usuário pede um prompt para ChatGPT ou Codex: primeiro tentar executar a tarefa aqui (preferência dele). Se o prompt ainda for necessário, entregar em arquivo `.md` numa pasta que ele consiga abrir, orientado à ação do próximo passo (não só avaliação), com o contexto do repositório, os critérios desta skill, a lista do que está pendente (ex.: interativos não feitos) e o critério de aceite. Ao analisar o que outro modelo entregou, conferir contra o código e os dados, não contra a descrição.
