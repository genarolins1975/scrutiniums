# Sistema de design editorial do observatório de energia

Escopo: domínio Energia (`/setor-eletrico`). Nenhum token global, nenhum componente do observatório de Crédito e nenhum comportamento de dados muda. Tudo o que é novo mora em `.dominio-energia`, em classes `ed-*` e em componentes de `src/components/energia`.

## 1. Princípios

1. **O observatório apresenta fatos, referências e limites; o leitor conclui.** Sem "bom" ou "ruim", sem nota composta, sem cor de aprovação ou reprovação para alta ou queda, sem causalidade automática, sem ranking de qualidade. Ordenar por uma medida é permitido, com o critério dito.
2. **A primeira tela responde.** Em 1440 por 900 px: título, uma ou duas frases, recorte e fonte curta, faixa de métricas e o começo da figura principal. Em 390 px: pergunta, medida e referência antes de qualquer navegação extensa.
3. **Profundidade visível, texto sob demanda.** Gráficos que respondem a perguntas próprias ficam à vista em Entender, organizados em seções com pergunta. Tabela completa, regra por extenso, versão, arquivo e hash ficam em Analisar e Auditar (HTML do servidor, sem perda sem JavaScript).
4. **A ressalva essencial fica junto do dado.** "O que não é possível concluir", "Como interpretar" e "O que mudou" ficam sob a figura, à vista. Só a motivação ("Por que isso importa") vai para bloco recolhível.
5. **Uma navegação local por página.** Faixa de irmãs nas páginas filhas, capítulos nas aberturas. Nunca as duas, nunca índice mais cartões mais abas com os mesmos rótulos.
6. **Um número, um seletor.** Gráfico, tabela, frase, KPI e CSV leem da mesma função. A faixa de métricas nunca calcula por conta própria.
7. **Ausência, zero e não se aplica são estados diferentes** e aparecem como tal (hachura "sem dado", "não se aplica", "indisponível nesta publicação").

## 2. Tokens

Os tokens de cor do repositório já passam AA e são compartilhados com o outro observatório; ficam como estão. A referência da galeria (`#f8f7f2`, `#182b36`, `#09697a`, `#e7efee`, `#d7dcd7`) foi conferida e é equivalente em função: o teal da galeria tem 5,9:1 sobre o papel, o do repositório tem 6,7:1; a tinta da galeria 13,6:1, a do repositório 15,9:1. Trocar a paleta alteraria o outro observatório sem ganho de contraste.

| Papel | Token | Valor | Contraste sobre o papel `#faf8f2` |
| --- | --- | --- | --- |
| Fundo | `papel` | `#faf8f2` | |
| Superfície de gráfico e campo | `superficie` | `#ffffff` | |
| Texto | `carvao` | `#1a1d21` | 15,9:1 |
| Texto secundário | `carvao-muted` | `#3d4147` | 9,7:1 |
| Metadado | `mineral` | `#6b6d6a` | 4,9:1 |
| Destaque, links | `energia` / `energia-dark` | `#0e6170` / `#0a4a56` | 6,7:1 / 9,3:1 |
| Fundo suave (item ativo, sub navegação) | `energia-fundo` | `#e6eeee` | texto carvão 8,7:1 |
| Marcação não textual | `energia-soft` | `#5e98a3` | 3,0:1; nunca como cor de texto |
| Linha fina (separador, não contorno de controle) | `linha` | `#d8d2c6` | 1,4:1 |
| Contorno de campo | `mineral` | `#6b6d6a` | 4,9:1 (WCAG 1.4.11) |

Séries de gráfico, escalas sequenciais e divergentes: variáveis `--serie-*` e `--escala-*` de `globals.css`. Cor de série nunca é cor de texto, e a forma (glifo, traço, rótulo direto) sempre acompanha a cor.

### Escala tipográfica e grade

| Uso | Classe | Tamanho |
| --- | --- | --- |
| Título da página | `ed-h1 font-serif` | 30 px no celular a 44 px no desktop (`clamp`) |
| Título de painel ou seção principal | `ed-h2 font-serif` | 22 a 28 px |
| Título de seção interna | `ed-h3 font-serif` | 20 px |
| Frase de abertura | `ed-lead` | 16 px, 17 px a partir de 768 px |
| Texto | `text-base` | 16 px |
| Texto de apoio | `text-sm` | 14 px |
| Metadado, fonte, contexto | `text-xs` | 13 px no domínio Energia (0,8125 rem, entrelinha de 1,2 rem); texto dentro de SVG não desce de 12 px |
| Rótulo em caixa alta | `rotulo` | 12 px no domínio Energia |
| Valor de métrica | `font-serif`, `tabular-nums` | 28 px no celular, 36 px no desktop |

Largura de leitura: `ed-pagina` (conteúdo de 1.160 px a partir de 1.240 px de janela; margem de 16 px no celular a 40 px no desktop). Texto corrido até `max-w-prose2` (44 rem). Sem sombras e sem cantos arredondados; separação por linha fina e espaço.

## 3. Componentes

| Componente | Arquivo | Uso |
| --- | --- | --- |
| `CabecalhoEnergia` | `CabecalhoEnergia.tsx` | Casca: marca, seletor, Dados e fontes, Metodologia, seis grupos, páginas do grupo. 130 px no desktop, 96 px no celular. |
| `CabecalhoModulo` | `CabecalhoModulo.tsx` | Abertura editorial. Com `lead`: título curto, duas frases, `recorte`, `fonte`, `metricas`; `referencia`, `datas`, `siglas` e `children` (texto longo) vão para o bloco "Fontes, datas e siglas". Sem `lead`: desenho anterior (páginas ainda não migradas). `rotulo` é opcional e fica fora da abertura de módulo. |
| `FaixaMetricas` + `Numero variante="faixa"` | `FaixaMetricas.tsx`, `Numero.tsx` | De 2 a 6 medidas com valor, unidade, período, natureza (selo curto em texto) e "Comprove este número". Celular: linhas de lista. Desktop: colunas com divisória. |
| `ModoProfundidade` | `evidencia/ModoProfundidade.tsx` | Entender, Analisar, Auditar. Controle segmentado de 40 px (44 px no toque). `?modo=` e semântica inalterados. |
| `PainelEvidencia` | `evidencia/PainelEvidencia.tsx` | Pergunta em serifa, subtítulo com selos, figura, `NotasDoPainel` (o que mudou, como interpretar, o que não é possível concluir), "Por que isso importa" recolhível, fonte curta agrupada por órgão e data, "Sobre este dado". |
| `NotasDoPainel` | `evidencia/PainelEvidencia.tsx` | As três notas em três colunas. Em painel composto, a página a renderiza logo depois da figura principal e passa `naoConcluirNoCorpo`. |
| `NavegacaoLocal` | `NavegacaoLocal.tsx` | `faixa` nas filhas; `capitulos` nas aberturas (nome, pergunta, link; a página atual não entra). `nivelTitulo={3}` quando o bloco de capítulos fica dentro de um painel, que já é `h2`. A faixa quebra linha abaixo de 640 px, duas abas por linha (87 px para quatro abas), sem rolagem horizontal. |
| `SecaoDoPainel` | `SecaoDoPainel.tsx` | Seção com pergunta em serifa. Sem `nivel`: visível em Entender. Com `nivel`: Analisar ou Auditar. |
| `SeguirPainel` | `SeguirPainel.tsx` | Próximos passos numa linha: baixar os dados (link direto se for um; bloco recolhível se forem vários), copiar link com o recorte, próxima pergunta. |
| `DetalheDoNivel` | `DetalheDoNivel.tsx` | `<details>` que abre sozinho a partir de um nível (`abreEm`). Disclosure de método e de leitura. |
| `RespostaCurta` | `RespostaCurta.tsx` | Veredito curto sempre à vista e números por trás em Analisar, como antes. Vem antes dos controles; `depois` mantém a resposta na ordem do documento, depois das figuras, quando a faixa de métricas já traz o mesmo número (atributo `data-resposta-depois`, exceção declarada da regra de ordem em `globals.css`). |
| Legenda interativa de `GraficoLinhas` | `GraficoLinhas.tsx`, `globals.css` | Botões de 32 px em tela larga com ponteiro fino (a figura começa mais acima); 44 px no toque e abaixo de 768 px. |
| `PequenosMultiplos` | `PequenosMultiplos.tsx` | Legenda com uma entrada por rótulo e traço (os painéis podem usar ids de série próprios); se a cor muda entre painéis, a amostra é neutra e a linha "A cor identifica o painel" aparece. Linhas finas da grade por borda de célula: com número ímpar de painéis a célula que sobra fica vazia, sem bloco. |
| Ano em tabela | `lib/energia/tabela.ts` | Coluna numérica cujo rótulo começa por "Ano" (casas 0) exibe o ano sem separador de milhar ("2026", nunca "2.026"); o arquivo exportado não muda. |
| `Footer compacto` | `layout/Footer.tsx` | Rodapé de uma faixa, usado só pelo domínio Energia. Todos os links institucionais continuam. |

### Contratos que não mudam

- Seis campos editoriais obrigatórios em `PainelEvidencia` (um painel sem "o que não é possível concluir" não compila).
- `data-nivel`, `?modo=`, âncoras, rotas, parâmetros de URL e `data-resposta` seguem como estavam.
- `Comprove este número` com a mesma ficha e o mesmo endereço de citação; `SobreEsteDado` por série.
- Selo de natureza com forma e rótulo, nunca só cor.

### Baixar imagem do gráfico

`BaixarImagem` (`BaixarImagem.tsx`, com as funções puras em `lib/energia/imagem-grafico.ts`) leva um gráfico para um slide ou uma matéria com o contexto junto. O botão fica ao lado da legenda de `GraficoLinhas`, `GraficoBarras`, `GraficoPontos`, `PequenosMultiplos` e `Histograma` e não aparece quando o gráfico está em estado vazio. `MapaCoropletico` ainda não tem o botão.

- **O que o PNG traz:** título em negrito, unidade, legenda com as amostras de cor, traço e hachura, o desenho do gráfico como está na tela, as notas de estado que o próprio gráfico escreve (recorte parcial, intervalo exibido, escala livre; no histograma, amostra e período, marcados com `data-nota-imagem`), a fonte, a versão dos dados, o endereço da página (com o recorte da URL e a âncora do painel), a data do clique em dd/mm/aaaa e a identificação "Scrutiniums, Observatório Brasileiro do Setor Elétrico". O svg tem de 720 a 800 px e o PNG, em 2x, de 1440 a 1600 px; gráfico de celular é ampliado e o largo é reduzido, sem perder a proporção entre texto e desenho. O nome do arquivo vem do título (sem acento, minúsculas, hífens, até 80 caracteres).
- **De onde vêm título, fonte e versão:** o título e a unidade são os do próprio gráfico. Fonte e versão são os do rodapé do painel mais próximo (`section[data-painel-evidencia]`, parágrafo "Fonte: ..."): a versão é a de "Versão dos dados: X" ou as datas de "(referência até X)". Fora de painel, a imagem leva só o endereço e a data. Nenhuma fonte é inventada.
- **Como funciona:** no clique lê o DOM, clona os svgs marcados com `data-svg-grafico`, tira a cruz do cursor, a seleção de intervalo e os realces de passagem e de foco (`data-nao-exportar`), troca `var(--token)` pelos valores calculados da página, leva junto os padrões de hachura e desenha num canvas. Sem biblioteca, sem rede, sem imagem externa. Gráfico novo entra marcando seus svgs com `data-svg-grafico` e plugando `BaixarImagem` ao lado da legenda.
- **Botão:** texto "Baixar imagem", `aria-label` com o título, 24 px em ponteiro fino e 44 px em ponteiro grosso, oculto na impressão, erro em região `aria-live` (sem `alert`). Só aparece depois da hidratação; o HTML do servidor traz um espaço invisível do mesmo tamanho, para o layout não saltar e para os testes de servidor lerem o mesmo HTML.
- **Limites:** fonte do sistema (a imagem não carrega as fontes da página); sem interatividade (nada de dica, cruz ou foco); a imagem mostra o gráfico no momento do clique, então série oculta, intervalo ampliado, ordem e seleção valem como estão; imagem muito alta usa escala menor que 2x para ficar dentro do limite de pixels dos navegadores.

### Acréscimos da rodada de melhoria

Comportamentos e componentes que entraram depois da migração das aberturas, para que a próxima página já nasça com eles.

| Item | Arquivo | O que faz e quando usar |
| --- | --- | --- |
| `CabecalhoModulo` com `limite` | `CabecalhoModulo.tsx` | Uma ou duas frases sob o recorte e a fonte, com o rótulo "Não permite concluir": é a quarta resposta da abertura (o que estou vendo, por que importa, com o que comparar, o que não permite concluir, onde aprofundar). Sempre à vista, nunca dentro do bloco recolhido. Modelo: `agua-e-clima/afluencia/page.tsx`. Não repete a nota do painel: é a versão curta dela. |
| `LinkSemPrefetch` | `LinkSemPrefetch.tsx` | `next/link` com `prefetch={false}`. Usar em páginas com dezenas de ligações (inicial, catálogos, índices): a rolagem deixava de 20 a 47 pedidos de pré-busca, de 0,5 a 1,4 MB, só para ligações que o leitor talvez não abra. |
| `MarcaRolagem` | `MarcaRolagem.tsx`, montado em `setor-eletrico/layout.tsx` | Grava `data-rolavel="sim"` em `div.tabela-scroll` que rola de fato; a sombra de borda só aparece nesses blocos (sombra em tabela que cabe inteira lia-se como conteúdo cortado). |
| Legenda de siglas e de natureza | `LegendaSiglas.tsx`, `SeloNatureza.tsx` | A legenda do bloco "Fontes, datas e siglas" lista as siglas do texto à vista e, depois da hidratação, a definição em texto de cada natureza do dado (Observado, Calculado, Estimado, Previsto, Cenário) cujo selo está à vista. A dica do selo (`title`) não existe no toque nem para leitor de tela; o selo leva `data-natureza`. |
| `GraficoBarras` | `GraficoBarras.tsx` | Série `opcional` (existe só em parte das categorias); `limiteInicial` (desenha as N primeiras, com escala, tabela e seleção do conjunto inteiro; seleção fora do limite desenha todas); rolagem até a barra selecionada; rótulo lateral em até duas linhas (coluna de até 42% e 260 px); linhas de base e de referência que pulam a faixa do rótulo e dos valores no celular; 12 px no celular. |
| `GraficoLinhas` | `GraficoLinhas.tsx` | Rótulo de marco quebra em até três linhas dentro da área do gráfico; `semTitulo` e dica ao lado da cruz. |
| `MapaCalor` | `MapaCalor.tsx` | `colunaInicial` abre a grade rolada até a coluna que importa (ex.: a hora do pico mais frequente) com borda que esmaece enquanto há colunas escondidas; classe de cor com menos de 3:1 contra o papel recebe contorno de 1 px na célula e na legenda (medido no navegador, pois a cor chega como token). |
| `TabelaInterativa` | `TabelaInterativa.tsx` | `tamanhoPagina` aceita 10 ou 12 linhas; a primeira coluna fica fixa. |
| `Numero recorte` | `Numero.tsx` | Diz o recorte do número (UF, classe, base) junto do período, na linha de contexto, sem depender do resto da página. |
| `NavegacaoLocal atualEhSecao` | `NavegacaoLocal.tsx` | A página atual é filha do item (verbete dentro de seção, trilha): o item leva `aria-current="true"` e não `"page"`. |
| `ModoProfundidade` | `evidencia/ModoProfundidade.tsx` | O foco em `main#conteudo` depois de clicar em área sem controle não rola mais a página ao topo; botões de nível com 44 px abaixo de 768 px. |
| `SeguirPainel` | `SeguirPainel.tsx` | A lista "Baixar os dados (N arquivos)" abre sozinha em Analisar e Auditar. |

Regras de texto que vieram da rodada:

- `text-xs` no domínio Energia vale 13 px (0,8125 rem, entrelinha de 1,2 rem): 12 px lia-se pequeno em nota e fonte. O texto dentro de SVG não desce de 12 px.
- Toda ressalva que muda o que o número permite concluir fica à vista, junto do número, nunca só em "Sobre este dado".
- Valor negativo que a fonte publica onde o conceito não admite sinal (desconto negativo) fica como a fonte publicou, com nota ao lado e classe própria na escala; o observatório não corrige nem exclui.
- Um número, um arredondamento: calcula-se uma vez, arredonda-se uma vez (meio para cima) e o mesmo valor serve ao gráfico, ao rótulo, à tabela, ao CSV, à frase e à ficha.

## 4. Receita de uma abertura temática

1. `CabecalhoModulo` com título de 5 a 9 palavras (a pergunta do tema, sem repetir o título da primeira figura), `lead` de uma ou duas frases sem "hoje" nem "agora" (o dado tem a própria data), `recorte` (data, universo, unidade) e `fonte` curta. O texto longo antigo vai em `children`; fontes por extenso em `referencia`; datas de cada parte em `datas`.
2. `FaixaMetricas` com as medidas que respondem à pergunta, cada uma com período e referência na linha de contexto. Valores dos mesmos seletores do gráfico. Nunca somar nem comparar medidas de datas ou universos diferentes dentro da faixa.
3. Figura principal já na primeira tela (em 1440 por 900 px aparece o título dela e as primeiras marcas), seguida de comparação, notas (`NotasDoPainel`) e tabela equivalente recolhida.
4. Seções complementares visíveis, cada uma com pergunta própria (`SecaoDoPainel`): evolução, distribuição, composição, território, conexões, conforme o tema.
5. Capítulos (`NavegacaoLocal variante="capitulos"`) depois da figura principal, com a pergunta de cada página irmã.
6. Analisar: tabelas completas, filtros, exportação, comparação de entidades, simuladores. Auditar: fórmula, versões, arquivos, hashes, controles, limitações.
7. Rodapé do painel com `SeguirPainel`.

Página filha: `CabecalhoModulo` com `rotulo` (migalha do módulo), título e `lead`; `NavegacaoLocal variante="faixa"` no alto; sem faixa de métricas quando a página não tem medida de abertura; mesma ordem de painel.

## 5. Estados de disponibilidade

| Estado | Como aparece |
| --- | --- |
| Ausente na fonte | "sem dado" com hachura, nunca zero |
| Não se aplica | "não se aplica", com o motivo (ex.: recorte sem armazenamento) |
| Indisponível nesta publicação | bloco com o motivo e o que o leitor pode fazer; sem número de reserva |
| Em integração | o que já existe de verificável (conceitos, documentação, conjuntos catalogados com estado real), sem estatística, barra, percentual nem previsão de entrega inventados |
| Provisório ou parcial | rótulo junto ao valor (período em curso, cobertura parcial); período parcial nunca concorre com ano completo |
| Não comparável | fora da média, com a razão |

## 6. Acessibilidade e movimento

WCAG 2.2 AA como meta. Foco visível com o teal do domínio. Alvos de 44 por 44 px no toque (`pointer: coarse`) e no mínimo 24 px em ponteiro fino. Esc fecha menus e diálogos e devolve o foco. Movimento respeita `prefers-reduced-motion`. Contorno de campo com 3:1. A verificação automática (axe) não substitui teste com leitor de tela real, que não foi feito nesta rodada.

## 7. O que o sistema não faz

Não desenha ilustração decorativa, mapa para preencher espaço, gráfico 3D, velocímetro, donut em série nem eixo duplo para sugerir associação. Não cria leque de incerteza sem calibração publicada. Não usa benchmark internacional sem ficha de comparabilidade.
