# Resposta na entrada — avaliação independente de layout, antes da implementação

Data: 27/10/2026. Base: `8a7cd80b27e5110f0024236fc73ae1fabb61de69`, em `/workspace/scrutiniums-resposta-na-entrada`. Escopo: `/custo-de-vida`, `/conectividade`, `/combustiveis`, `/educacao-municipal` e `/eficiencia-estatal`.

**Diagnóstico:** as cinco entradas têm identidade editorial reconhecível, mas a ordem visual privilegia o panorama da coleção antes da tarefa local. O principal ganho é formar uma unidade contínua de **pergunta → escolha explícita → resposta do recorte → referência e limite**. Só aproximar um seletor do H1 não basta se a resposta continuar depois de números nacionais, cartões de outros assuntos ou um catálogo de temas.

Esta avaliação precede a implementação e não recebeu suas justificativas. Não alterei arquivos do repositório, não executei build ou testes e não fiz nova auditoria de produção. O único arquivo produzido é este parecer. A segunda avaliação, mecânica, fica separada desta leitura visual e semântica, como pede o Impeccable.

## Evidência e limites da avaliação

- Li `AGENTS.md`, `CLAUDE.md`, as quatro skills obrigatórias e os anexos de arquiteturas, identidade, componentes, tema/acessibilidade, acesso e navegação. A referência local de marca é `docs/observatorios/DESIGN_SYSTEM_OBSERVATORIOS.md`: papel, marfim, serifa editorial, texto sans-serif, acentos existentes, rótulos e filetes da casa.
- Inspecionei visualmente as dez capturas de abertura das cinco rotas, a 390 e 1440 px, e as cinco capturas móveis completas de `/workspace/conselho-2026-10-27/capturas/`. Nas páginas completas, a redução automática permitiu avaliar a sequência e densidade; os detalhes foram conferidos nas aberturas e no código.
- As capturas e as medições de posição são da avaliação do conselho em 27/10/2026, em build local autenticado da mesma revisão. Fonte das posições: `/workspace/scrutiniums-conselho-2026-10-27/docs/ux-2026-10-27/conselho/evidencias/jornadas.json`. São distâncias no documento, não tempos de tarefa medidos.
- Conferi os componentes de entrada e consulta, os estados vazios/inválidos, os leitores de dados e os aperitivos de Educação e Conectividade. Não reavaliei numericamente as bases inteiras.
- Não há evidência visual nova de 320, 768, zoom de 200%, teclado, leitor de tela, dropdown aberto ou todas as seleções. Riscos derivados do código estão identificados como riscos, não como falhas reproduzidas.
- O launcher `.claude/skills/impeccable/scripts/impeccable` está ausente. A tentativa de contexto terminou com `No such file or directory`; `PRODUCT.md` e `DESIGN.md` não foram encontrados no checkout. Usei o sistema visual documentado e a implementação existente. Não substituí a revisão visual por uma alegação de detector aprovado.

## Prioridades

| Prioridade | Antes | Depois exigido | Por quê / evidência |
|---|---|---|---|
| P0 — ordem da tarefa | Abertura → quatro números de panorama → cartões “Para você” → consulta local. | Escolha e resposta local antes do panorama e dos caminhos. | `EntradaColecao.tsx:153–159` põe escala antes de `paraVoce`; `ParaVoce.tsx` põe `children` depois da grade. As capturas móveis mostram só panorama no primeiro viewport. |
| P0 — resposta coerente com a pergunta | “Como se vive em Recife?” abre com medianas de 26 capitais; escolher outra capital primeiro muda população, área e densidade. | Capital identificada junto de valores dos resultados locais; referência claramente separada. O retrato dos sete resultados deve acompanhar a escolha antes do catálogo. | `eficiencia-estatal/page.tsx:64–68`: escala mediana, seletor em ParaVoce, régua em `secaoPropria` após destinos. `SeletoresRetrato` não entrega os sete resultados. |
| P0 — escolher e trocar na mesma região | Em Educação, um `?ibge=` válido mostra extrato no topo, mas a busca continua após escala e cartões. | Busca persistente junto ao extrato, nos estados sem seleção, com seleção e inválido. | `PainelEducacao.tsx:50–54` e `SecaoMunicipio:168`. A antecipação parcial resolve o retorno por link, não a primeira escolha nem a troca. |
| P1 — cumprir a promessa do tanque | H1 pergunta custo para encher o tanque, mas a resposta usa como título e maior número o preço por litro; custo para os litros é linha secundária. | UF e litros com resultado calculado reconhecível de imediato; produto, média por litro e mês sustentam a conta. | `PrecoNoEstado.tsx:41–139`. Não exige estimativa de rendimento, posto ou recomendação de combustível. |
| P1 — ressalvas específicas | Custo de vida usa a nota padrão “não se comparam entre si” mesmo para IPCA de 12 meses de áreas e Brasil no mesmo período. | Explicar quais áreas/janelas são comparáveis e quais não são; p.p. para a diferença entre variações. | A nota vem de `EntradaColecao.tsx:70`; os números da abertura vêm da mesma tabela/janela em `custo-de-vida/page.tsx:69–74`. |
| P1 — compressão semântica da consulta | Educação e Conectividade repetem H2 e introdução extensa antes do campo; Conectividade sem escolha abre depois uma tabela de quantis. | Pergunta principal curta, campo, resposta/estado; explicação e distribuição seguem como aprofundamento, sem competir com a escolha. | `SecaoMunicipio` dos dois painéis. `Distribuicao` da Conectividade é útil, mas não constitui resposta municipal. |
| P1 — extremos móveis | O seletor amplo de área usa `min-w-[18rem]`; em 320 px, um contêiner com 24 px de cada lado dispõe de 272 px. | Campo respeita a largura disponível; rótulo de área metropolitana continua reconhecível; sem rolagem do documento. | Risco de código em `inflacao/comum.tsx:56`, ainda não reproduzido a 320. |

Não há motivo nesta evidência para substituir fontes, identidade, framework ou mapas, nem para apagar séries, tabelas, downloads ou explicações existentes. O pedido atual autoriza rever a antiga ordem fixa do molde: não é preciso conservar uma precedência de escala que contradiz “resposta específica logo na entrada”. Os invariantes de prova, acesso e profundidade permanecem.

## Avaliação espacial

| Eixo do Impeccable | Leitura independente | Evidência |
|---|---|---|
| Ordem de leitura / squint test | A serifa e o H1 são o primeiro foco; a faixa de quatro números é o segundo. O controle local não é visível no primeiro viewport das cinco entradas. Isso dá prioridade ao panorama, embora três títulos prometam explicitamente cidade, estado ou Recife. | Dez capturas `*-inicio.jpg`; posições abaixo. |
| Agrupamento | O caso do leitor está agrupado com links para outros assuntos, pela convenção de `ParaVoce`, em vez de junto da pergunta. Na Síntese, escolha e régua dos resultados ficam separadas pelo catálogo; na Educação selecionada, busca e extrato ficam em seções diferentes. | `ParaVoce` renderiza cartões antes dos filhos; chamadas das páginas. |
| Ritmo | Há bom espaçamento interno e margens consistentes, mas repete-se a mesma cadência de faixa de números, cartões de perguntas e destinos. No celular, o empilhamento dá a conteúdos auxiliares o comprimento e o peso de uma etapa obrigatória. | Capturas móveis completas; grid de `Escala` passa de quatro a uma coluna. |
| Estrutura | O molde reconhece o tema, mas usa a topologia de apresentação da coleção para uma consulta. A tarefa pede uma região de operação logo na abertura e profundidade progressiva depois. | `EntradaColecao`, `ParaVoce` e consultas existentes. |
| Densidade | A primeira tela tem muita prova de panorama e nenhuma ação local. Reduzir fontes ou letra não resolve: o espaço deve trocar de função. Na resposta, um resumo com comparação pertinente cabe antes de análises longas. | Capturas de abertura e componentes com resumos já calculados. |
| Adaptação | A largura se adapta por empilhamento, porém a prioridade não se adapta: quatro números e vários links precedem a consulta tanto no desktop quanto no celular. O problema móvel é distância, não falta de conteúdo. | Abas rolam localmente; corpo vira uma coluna; nenhuma inversão relevante de ordem DOM foi identificada nas peças examinadas. |
| Extremos | Nomes longos, busca aberta, município sem uma das fontes, parâmetro inválido e ausência de Ideb precisam manter campo e explicação no mesmo grupo. Seleção por URL deve abrir já no recorte e permitir trocá-lo. | Estados existentes em `consultarMunicipio`, `useArea`, `PrecoNoEstado`, `BuscaMunicipio`; ausência de capturas desses extremos nesta rodada. |

Modo: **Operate** na abertura, para consultar; **Read** nos capítulos de explicação. Tese espacial: a identidade e a pergunta orientam, a escolha conduz, a resposta local domina, a comparação sustenta e as limitações acompanham. O panorama e os caminhos ganham um título de contexto depois da resposta. Desktop pode alinhar controle e resumo em colunas; mobile deve conservar a sequência linear. Nenhum reordenamento apenas visual pode divergir da ordem de teclado e leitura assistiva.

## Contrato de aceite por rota

As posições atuais abaixo são as medidas históricas do conselho, a 390 × 900 px. O novo aceite exige **campo e rótulo inteiramente visíveis no primeiro viewport**, sem abrir menu auxiliar ou seguir âncora. A resposta é o bloco seguinte da tarefa, sem interveniência de panorama ou recomendações. Para resposta já disponível, seu começo e ao menos a medida principal devem aparecer cedo; não exigir que toda a análise e todas as ressalvas caibam em 900 px à custa de legibilidade.

### `/custo-de-vida` — posição atual do campo: 2.522 px

Tarefa: escolher uma área efetivamente pesquisada e ler sua inflação acumulada, com comparação válida.

- Campo “Sua cidade ou região” no primeiro viewport; lista distingue região metropolitana de município. A opção Brasil pode existir como referência explícita, sem se apresentar como localização inferida.
- Depois de escolher: nome/UF/tipo da área, IPCA em 12 meses, janela, IPCA Brasil da mesma janela e diferença em pontos percentuais. Mês e acumulado do ano são complementos identificados, nunca usados como a mesma medida.
- Limite próximo: são 16 áreas do IPCA; cidade fora delas não tem índice próprio. A área mais próxima não se torna índice da cidade. O índice de uma cesta média não mede a inflação de uma família específica nem o nível de preços entre cidades.
- Fonte: IBGE, IPCA, tabela 7060/SIDRA e datas da publicação carregada; não usar a data de captura como mês de referência. Mostrar o mesmo valor do resumo, série e tabela.
- Preservar os nove grupos, seus pesos e variações, série desde 2020, comparação das áreas, destaques de subitens, modelo de ponderação e método. A nota genérica de incomparabilidade deve deixar de negar comparações permitidas.
- Parâmetro inválido mantém aviso junto ao campo e identifica o retorno ao Brasil. Não esconder o motivo nem rotular o Brasil como resposta local.

### `/conectividade` — posição atual do campo: 2.724 px

Tarefa: buscar o município e distinguir acessos contratados e cobertura móvel declarada.

- Busca por nome e UF junto da pergunta. Nenhuma escolha automática por localização ou perfil. Sem seleção, a ação deve liderar; o panorama de quantis não pode parecer a resposta do município.
- Resultado seguinte identifica município/UF e dá ao menos a medida principal de acessos fixos por 100 habitantes e cobertura 4G/5G, mantendo as respectivas unidades e meses; fibra e prestadoras completam o retrato.
- Fonte/limite: Anatel; acessos são contratos/linhas, não pessoas conectadas ou domicílios. Cobertura é mancha declarada cruzada com moradores do Censo 2022, não velocidade medida, sinal dentro de casa ou qualidade. Fixa, móvel e cobertura podem ter períodos e universos distintos.
- Referências só com a mesma medida, unidade e período; posições indicam o universo dos municípios com valor publicado. Não interpretar posição como qualidade da operadora.
- Município válido com fonte parcial mostra o que existe e a ausência específica, sem substituir por zero, média Brasil ou estado. Ausência de cobertura não equivale a cobertura de 0%.
- Preservar empresas, meios e velocidade contratada, séries, tabelas de estados, distribuição, operadoras e método; a gold municipal permanece no servidor. Trocar de município permanece possível na mesma região da resposta.

### `/combustiveis` — posição atual do campo: 2.607 px; litros: 2.687 px

Tarefa: escolher UF e volume para obter a conta de um tanque com os preços médios publicados.

- UF e litros no primeiro viewport, com o volume de exemplo explicitamente reconhecível. Resultado logo depois explicita produto e custo calculado para o volume escolhido; o R$/litro sustenta a conta e não precisa ser a resposta dominante ao H1.
- Conta = média do produto na UF × litros válidos. Exibir mês, ANP, tamanho de amostra quando publicado e distância para a média Brasil da mesma fonte/mês. Ausência de preço em uma UF não vira média Brasil.
- Limite junto da conta: média da amostra, não orçamento de posto nem garantia de preço. Amostra pequena conserva a ressalva. Etanol/gasolina não vira recomendação de rendimento para o veículo.
- Volume vazio, zero, negativo ou acima do limite não produz valor enganoso nem `NaN`; a validação informa o problema. Produto sem preço tem ausência explícita; produtos restantes continuam utilizáveis.
- Preservar histórico nominal/real, estados, razão etanol/gasolina, mecanismo da pesquisa, método e consulta direta `/combustiveis/no-meu-estado`. A consulta direta é caminho de acesso, não substituto para responder na entrada autenticada.
- A perda de litros após recarregar está documentada na prioridade 3 do conselho. Neste escopo, ao menos não regredir UF, cálculo ou inputs ao reorganizar. Se houver alteração do contrato de estado, volume e resultado precisam ser conferidos no retorno por URL; não declarar persistência completa sem verificá-la.

### `/educacao-municipal` — posição atual do campo: 2.417 px

Tarefa: escolher município e ler o Ideb publicado da rede municipal em cada etapa, reconhecendo ausências e universos das referências.

- Uma única região reúne busca, município selecionado e extrato. O campo continua no primeiro viewport depois de escolher, sem exigir passar pelos números nacionais para trocar.
- A resposta mostra anos iniciais/finais, rede municipal, ano e escala 0 a 10. Referências estaduais e nacionais mantêm seus nomes completos: rede pública do estado e redes municipais do Brasil têm universos próprios.
- Limite próximo: resultado da rede, não da escola individual nem nota da gestão. Sem Ideb na edição atual, mostrar motivo publicado; não voltar silenciosamente ao último ano disponível ou trocar rede municipal por pública.
- Fonte: INEP/Ideb com edição e ano corretos. Censo Escolar e matrículas conservam seu próprio ano; matrícula não é aluno único. Não usar ausência como zero.
- Preservar ficha completa, séries, aprendizagem/aprovação, metas do período válido, distribuições, porte, matrículas/escolas, mapa, downloads e laboratório. A ficha completa deve receber o município escolhido.
- Seleção inválida: mensagem ao lado da busca e caminho para corrigir; um número nacional pode servir de contexto, claramente identificado.

### `/eficiencia-estatal` — posição atual do campo: 2.385 px

Tarefa: escolher capital e referência, e compreender resultados observados entre seus moradores.

- Capital e comparador junto do H1. O nome no título, os controles e os resultados descrevem o mesmo recorte. Sem inferência de que Recife seja a capital do leitor.
- Escolher capital deve revelar imediatamente valores locais de condições de vida; população, área e densidade são contexto, não resposta suficiente a “Como se vive”. A régua dos sete resultados ou resumo equivalente permanece contígua à escolha e antes do catálogo de temas.
- Se medianas forem mantidas, o título identifica “Referência das 26 capitais”; não podem parecer medidas da capital nomeada. Preferir referência pertinente junto ao valor local a uma faixa inteira antes dele.
- Fontes/períodos: resultados do Censo 2022 e respectivos SIDRA, quando esse é o contrato da medida; educação, saúde e recursos mantêm seus anos próprios. A faixa geral de atualização não substitui os períodos junto dos valores.
- Limites visíveis: 26 capitais estaduais, sem DF; precisão municipal não quantificada nas medidas amostrais; resultado do território não identifica autor nem efeito da gestão. Posição é relativa, não meta ou nota de eficiência. Não promover índice composto na abertura.
- Preservar as sete condições, comparação entre duas capitais, recursos, educação por idade/aprendizagem, catálogo de cobertura, modelo e método. Ao seguir para painéis de tema, manter os parâmetros já suportados.

## Verificação de conclusão e preservação

1. Capturar cada rota a 390 × 900 e 1440 × 900, nos estados inicial e com seleção real. Medir topo e base do controle, começo da resposta e presença do limite principal. Comparar com a mesma base; não substituir a conclusão por redução de comprimento total.
2. Confirmar a sequência do DOM: título → campo → resposta/ausência → referência/limite → aprofundamento. Não basta `order` em CSS. Nenhum cartão “Para você”, escala nacional ou catálogo deve interromper campo e resposta.
3. Repetir com nomes longos e 320/768 px, zoom de 200% e texto ampliado. Sem rolagem horizontal do documento; rolagem localizada de tabela é permitida e indicada. Campo, opção selecionada, unidade e ausência permanecem legíveis. Alvos de toque de pelo menos 44 px; não reduzir o texto essencial para cumprir o viewport.
4. Usar teclado para encontrar município, percorrer opções, selecionar, fechar, corrigir e trocar. Foco visível e resultado encontrável, sem salto para seção nacional. Dropdown não pode ser cortado pelo novo contêiner. Anunciar atualização de forma breve, sem ler automaticamente todos os nove grupos ou todas as tabelas.
5. Conferir sem parâmetro, parâmetro válido, inválido, município com dado parcial e ausência real. A seleção inválida não pode produzir uma resposta local aparentemente válida. Carregamento do índice municipal não pode parecer “nenhum resultado” permanente.
6. Conferir com e sem sessão as rotas que já têm aperitivo e o retorno do login com o recorte. Não abrir novos painéis/arquivos, não criar segundo aperitivo por tema e manter `ConviteAperitivo`. A mudança no molde compartilhado pede amostra de regressão em outra entrada, pois o escopo visual prioritário continua sendo estas cinco.
7. Conferir que toda análise anteriormente disponível continua alcançável: gráficos, tabelas, notas materiais, downloads, fonte/método e destinos. Não mover limite material para tooltip ou `<details>` fechado. Metodologia de reprodução pode ficar recolhida.
8. Para alegar ganho de uso, observar pessoas concluindo as três jornadas do conselho: inflação local, internet municipal e combustível por estado; pedir que expliquem número, referência e uma limitação. Medir tempo e conclusão contra a base, sem inventar meta de conversão. Sem esse teste, a conclusão é ganho demonstrado de proximidade e clareza estrutural, não conversão comprovada.

## Rubrica inicial — notas independentes por rota

Escala da skill: 5–6 funcional com problemas importantes; 7–8 bom com limitações relevantes; 9 exige excelência demonstrada. Notas de responsividade referem-se à tarefa observada a 390 px, não certificam todas as larguras. Acessibilidade interativa fica não verificada nesta rodada.

| Rota / estado inicial autenticado | Arte | Hierarquia | Tipografia/acabamento | Densidade/profundidade | Didática | Comparabilidade | Interação/a11y | Responsividade da tarefa |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Custo de vida | 8 | 5 | 8 | 6 | 7 | 6 | Não verificado | 6 |
| Conectividade | 8 | 5 | 8 | 6 | 7 | 7 | Não verificado | 6 |
| Combustíveis | 8 | 5 | 8 | 6 | 7 | 8 | Não verificado | 6 |
| Educação | 8 | 5 | 8 | 6 | 7 | 7 | Não verificado | 6 |
| Síntese das capitais | 8 | 4 | 8 | 6 | 6 | 6 | Não verificado | 6 |

As notas de arte e tipografia se apoiam nas aberturas legíveis e na identidade coerente; hierarquia/densidade caem pela ausência de ação local na primeira tela. Comparabilidade cai quando o contexto nega comparações válidas ou aproxima visualmente uma capital de números do conjunto. Nenhuma média compensa um bloqueio: a entrega só está resolvida quando o leitor consegue **escolher, receber a resposta correspondente e reconhecer o limite dela na mesma sequência**.
