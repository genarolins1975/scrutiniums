# Pedidos de mudança compartilhada: família Qualidade do serviço

Rota `/setor-eletrico/qualidade`. Cada pedido diz o que mudar, por que e em que arquivo. Nenhum deles bloqueia a página: ela segue com a melhor solução local, descrita em cada item.

## 0. Arquivo sem uso para apagar no fim (regra do coordenador: não apagar componente com o servidor no ar)

- `src/components/energia/QualidadeLinkPainel.tsx`: nenhum arquivo o importa mais. O rodapé de cada painel passou a usar o `SeguirPainel` compartilhado, com o mesmo botão "Copiar link deste painel", o mesmo endereço e a mesma mensagem de cópia. O arquivo chegou a ser apagado durante a migração, antes da regra, e foi restaurado com o conteúdo original (56 linhas); nenhum teste depende dele.

## 1. Âncoras de verbetes e do mapa (resolvido)

O coordenador corrigiu `evidencias-verbetes.ts` (DEC e FEC em `#p051`, conjunto em `#p052`, compensação em `#p053`) e `mapa.ts` (`#expurgos` para "Quanto as regras tiram do tempo apurado"). Conferido no código. Ficam na página as âncoras `p051` a `p054`, `duracao`, `limites`, `compensacoes`, `atendimento` e `expurgos`.

## 2. Links que levam um parâmetro de URL sem levar o leitor ao bloco que reage a ele

O parâmetro `?dist=` (CNPJ da distribuidora) e o `?mun=` (código IBGE do município) já funcionam na página: o primeiro marca a distribuidora no gráfico de limites, abre o histórico dela e preenche a comparação lado a lado; o segundo acende o município no mapa e abre a tabela dos conjuntos dele. Os links de outras famílias chegam ao topo da página, onde nenhum dos dois aparece:

- `src/app/setor-eletrico/page.tsx`, linha 449 (`EscolhaDistribuidora`, `ancora="p051"`): trocar por `comparar-distribuidoras`.
- `src/lib/energia/territorio.ts`, linhas 1096 e 1104: acrescentar `#comparar-distribuidoras` ao link com `?dist=` e `#mapa-municipios` ao link com `?mun=`.
- `src/lib/energia/empresas.ts`, linha 892: acrescentar `#comparar-distribuidoras` ao link com `?dist=`.

Local: as âncoras existem e estão visíveis em Entender (a seção de comparação, `comparar-distribuidoras`, e a do mapa, `mapa-municipios`), então o pedido é só trocar o destino do link. O teste `energia-territorio.test.ts` (linha 531) confere o início do endereço (`/setor-eletrico/qualidade?dist=`); a âncora entra depois do parâmetro e não o quebra.

## 3. `NavegacaoLocal variante="capitulos"` com título cria um `h2` dentro do painel

Com `titulo`, o componente escreve um `h2`. Dentro de um `PainelEvidencia` (que já é `h2`), os títulos de seção que vêm depois (`h3`) passam a parecer filhos do bloco de capítulos na lista de títulos do leitor de tela. A página de Água tem o mesmo desenho. Proposta: aceitar `nivelTitulo` (ou trocar por um rótulo em texto). Local: a página Qualidade não passa `titulo` e escreve o rótulo "Nesta página, as outras perguntas" como texto (`QualidadeCapitulos`).

## 4. Legenda interativa do `GraficoLinhas` gasta cerca de 90 px acima da figura

Com `legendaInterativa`, cada linha da legenda tem 44 px e há mais uma linha de estado (`data-estado-grafico`) com 28 px. Para duas figuras lado a lado na primeira tela, isso empurra o início do traçado para perto da dobra. Proposta: uma variante compacta (botões de 32 px com ponteiro fino, 44 px no toque, e a unidade na mesma linha). Local: as duas figuras de abertura usam a legenda simples (as séries têm rótulo curto); o que explica "só concessionárias" está no Universo logo abaixo da figura e na nota do cartão do DEC.

## 5. A regra de `globals.css` que põe `[data-resposta]` primeiro em todo `space-y-*`

`[class*="space-y-"] > [data-resposta] { order: -1; ... }` garante a resposta antes da figura, o que serve a todos os painéis. No P051 a faixa de métricas logo acima já traz os mesmos números (DEC, FEC e a comparação com o ano anterior), e a resposta antes das figuras empurrava o começo do gráfico para fora da primeira tela. A página envolve a resposta do P051 em um `div` (que escapa da regra) e a coloca logo depois das duas figuras. Proposta: um atributo de exceção explícita (por exemplo `data-resposta-depois`) em vez de depender da estrutura do contêiner.

## 6. `PequenosMultiplos`: legenda repetida em cada painel e célula vazia com número ímpar de painéis

- Cada painel repete a legenda das séries ("DEC apurado", "Limite"); com quatro painéis são quatro legendas iguais. Proposta: uma legenda só, acima da grade, quando todos os painéis têm as mesmas séries.
- Com número ímpar de painéis a última célula fica um bloco bege vazio. A página evita o caso do painel único (usa um `GraficoLinhas` de uma coluna), mas com três painéis a célula vazia continua. Proposta: o último painel ocupar a linha toda, ou a grade se adaptar ao número de painéis.
- Escala: o componente já aceita `escala="livre"`; a página oferece a escolha (A mesma em todos os painéis, Própria de cada painel) no comparador e na ficha do município, porque a escala comum, ditada por uma distribuidora muito acima das outras, achata as demais (São Paulo: CERIS e ELETROPAULO).

## 7. `MapaCoropletico`: gancho para dizer "maior de 22 conjuntos" na dica e na linha Seleção

A avaliação de produto pede que a dica e a linha "Seleção" do mapa digam "maior de 22 conjuntos" (Manaus 102,73 h é o maior valor entre 22 conjuntos, não um valor do município). O mapa só recebe `valores` por região e `unidade`; a contagem de conjuntos de cada município não chega ao texto da dica. Proposta: uma prop `detalheRegiao?: (id: string) => string | null` acrescentada a `fraseRegiao`, usada na dica, na linha Seleção e na tabela de regiões. Local: a unidade passada ao mapa é "h, maior entre os conjuntos do município" (ou "menor"), a ficha do município diz "Cor do mapa: o maior valor entre os 22 conjuntos citados, 102,73 h" e a tabela dos conjuntos traz os 22 com valores.

## 8. Peso da página (meta 600 kB): o que a página cortou e o que depende de componente compartilhado

Medido no HTML servido, com o fluxo RSC (`self.__next_f`) dentro: 851.611 B na avaliação (versão anterior ao redesenho; fluxo de cerca de 381 kB), 865.282 B nesta versão antes dos cortes e **818.212 B** depois (fluxo de 337 kB, HTML de 481 kB). A página cortou o que é dela: a lista de pontos do painel de limites viaja numa lista só (de 26 kB para cerca de 10 kB no fluxo), cada gráfico recebe só as colunas que desenha (cerca de 26 kB) e o texto longo de cada fonte vem resumido (a descrição completa fica na página da fonte). A meta de 600 kB não se alcança sem tocar nos compartilhados, que somam mais de 250 kB:

- 12 `dialog` "Sobre este dado" (`SobreEsteDado`): 87,5 kB de HTML e cerca de 33 kB de props no fluxo. O conteúdo de um diálogo só se vê depois de abri-lo (com JavaScript): montar o conteúdo na primeira abertura, em vez de no HTML e no fluxo, tira cerca de 120 kB.
- 6 fichas "Comprove este número" (`ComproveNumero`): cerca de 33 kB de props no fluxo (cada objeto de evidência tem 5 kB). Mesma proposta: carregar a ficha na abertura.
- `GraficoPontos`: cerca de 1 kB de SVG por ponto (55 kB só no gráfico de DEC com 51 concessionárias, mais 17 kB da tabela equivalente fechada). Proposta: estilo por classe e `defs` compartilhados em vez de atributos repetidos em cada marca.
- Atributos `class` somam 148 kB do HTML da página; o cabeçalho de Energia, 22 kB; rodapés e navegação, 10 kB.

A instabilidade visual (CLS) caiu com o redesenho: 0,000 a 0,0004 em seis medições de laboratório (1440 e 390 px, com e sem rolagem), contra 0,097 a 0,189 da avaliação (o texto de fontes e datas refluía e empurrava o quadro de unidades, que não existe mais na primeira tela).

## 9. `GraficoPontos` e `Histograma` no celular

- `GraficoPontos`: a vista inicial é parcial (cerca de 11 das 51 linhas) numa caixa de rolagem de 520 px; em 320 px o SVG reduz a escala e se centraliza na vertical, com uma faixa vazia de cerca de 136 px acima da primeira linha; os rótulos ficam com 10 px efetivos. Proposta: altura da caixa pelo conteúdo no celular, `viewBox` sem centralização vertical e piso de 11 px para o texto.
- `Histograma` em 390 px: o rótulo do limite sai da borda do SVG e fica cortado, e os rótulos P25, Mediana e P75 se sobrepõem. Local: o rótulo do limite passou a ser só "Limite". Proposta: posicionar os rótulos em duas linhas e fixar o mínimo em 11 px.
- Links de glossário em linha (`Termo`) com 19 px de altura e "Mais 1 sigla" com 24 px, no celular.

## 10. Texto de fonte que chega da gold com marcação crua e termos do processamento

`proveniencia.*.notas_fonte` traz o texto da fonte colado como veio (Markdown com `__negrito__`, itens com asterisco e até 5,2 mil caracteres no atendimento telefônico), e `limitacoes` cita "silver" e "bronze". As regras da gold citam `NumCon`, `dec_concessionarias` e `fec_concessionarias`. Local: a página limpa tudo isso antes de mostrar (`paraLeitor`, `limpaProveniencia` e `resumirTexto` em `qualidade.ts`: sublinhados e asterisco saem, os nomes viram palavras comuns e a descrição longa vira o primeiro parágrafo, com o aviso de que foi resumida). A causa está no pipeline: limpar `notas_fonte` e trocar os termos na origem tiraria a necessidade do filtro local.

## 11. Gold e pipeline (do coordenador): o FEC de jun/2025 da ELEKTRO e os meses de FEC

A página já trata, sem mudar a gold: marca o FEC anual como de cobertura parcial quando difere da soma das parcelas internas (FECIP + FECIND) em mais de 0,02 (hoje, só a ELEKTRO: 3,25 contra 3,38), diz o mês e a cobertura (jun/2025, 0,74% das UCs, lidos de `ucs_fec` e `ucs_total` do CSV mensal) e mostra o valor pelas parcelas ao lado. Para a próxima coleta, a página lê dois campos opcionais por distribuidora, se a gold passar a trazê-los: `meses_fec` (meses com FEC publicado, menor que `meses` marca o ano como parcial) e `cobertura_fec` (menor cobertura mensal do FEC no ano, de 0 a 1; abaixo de 0,99 marca). Sem os campos, nada muda. Sugestões de dado:

- `qualidade_conjuntos_anual_*.csv`: acrescentar `meses_fec` (hoje a razão de FEC fica vazia sem dizer por quê, e a página deduz "menos de 12 meses de FEC" de razão vazia com FEC e limite presentes: 132 conjuntos em 2025, 128 da ELEKTRO).
- `qualidade_municipios.csv`: `fec_min` e `fec_max` usam só os conjuntos de 12 meses de FEC e deixam de fora os de 11 meses (35 municípios da área da ELEKTRO: em Aguaí, SP, o intervalo "4,71 a 5,28" ignora quatro dos seis conjuntos). A ficha do município agora lista todos os conjuntos citados e diz, em frase, quais ficam fora do intervalo.

## 12. Equivalências para a matriz de preservação (`equivalencias.json`)

A conferência mecânica casa 58 das 60 visões comparáveis da rota por tipo e título; as duas que sobram são os títulos dos dois primeiros painéis, que mudaram para a pergunta que a página passou a responder (as visões de dentro de cada painel continuam, com os mesmos gráficos, tabelas e controles):

```json
"/setor-eletrico/qualidade": [
  { "antes": "painel|por quanto tempo e quantas vezes faltou luz?", "depois": "painel|duração e frequência das interrupções no brasil, ano a ano", "justificativa": "mesmo painel P051, título novo; DEC e FEC em gráficos próprios, parcelas, mapa e comparação continuam" },
  { "antes": "painel|o serviço cumpriu o padrão?", "depois": "painel|cada distribuidora e cada conjunto diante do próprio limite", "justificativa": "mesmo painel P052, título em fato e não em julgamento; limites, razão, distribuição, caudas e DGC continuam" }
]
```

Visões que o rastreador marca "nível mudou" para Auditar ou Analisar sem terem mudado (o mapa e a tabela de municípios) são o mapa que só carrega quando chega perto da tela: em Entender ele está à vista; a medição automática a 1440 px o perde quando o servidor está lento.
