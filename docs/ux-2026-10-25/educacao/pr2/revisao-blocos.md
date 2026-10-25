# Revisão visual independente — blocos abertos do PR2

2026-10-25. Evidência intermediária, anterior à correção de associação explícita htmlFor/id dos selects e à correção do invólucro do mapa. Não certifica o build final. Somente leitura; sem alterar repositório ou executar navegador/testes. Não usei a coleta geral interrompida `/tmp/educacao-pr2-depois` como evidência final.

## Capturas abertas

Abri em modo original todas as18 capturas de `blocos-intermediarios`: seis prefixos abaixo, cada um nas larguras390,768,1440.

- `recolhido-metas`: entrada, contagens nacionais.
- `recolhido-decada`: entrada, Brasil e27UFs.
- `variacao-ideb`: ficha de Amparo do São Francisco, decomposiçãoAI2019→2025.
- `metas-inep`: ficha, oito edições nas duas etapas.
- `distribuicoes-cidade`: ficha, Brasil/SE nas duas etapas.
- `quem-atende`: ficha, cinco barras de matrículas.

As três capturas da década excedem6000px e o visualizador as reduziu; avaliei sequência, estados dos indicadores e escalas. Não certifico leitura de cada rótulo fino da década390 em tamanho natural. Os demais recortes foram suficientemente legíveis para as observações abaixo. São recortes dos blocos, sem cabeçalho/rodapé: não permitem medir orçamento da página completa ou hierarquia da primeira tela.

## Defeitos observados e ações verificáveis

### 1. Indicadores de recolhimento aninhados mostram estado errado

Evidência: `recolhido-decada-768.jpg` e `-1440.jpg`, também perceptível a390. “A década do Ideb” está aberta; todos os “Valores por edição” mostram menos, embora suas tabelas não estejam expostas. Isso indica recolhimento onde a próxima ação é expansão.

A leitura de `src/components/observatorios/Recolhido.tsx` confirma causa plausível e específica: `group-open/recolhido:after:rotate-90` responde ao ancestral externo aberto com o mesmo nome de grupo, não apenas ao details dono do summary.

Correção: vincular a rotação ao estado do details proprietário e ao summary filho direto, preservando usos existentes. Verificação posterior: década aberta+tabela fechada deve mostrar mais; tabela aberta, menos; fechar/reabrir década não pode adulterar estado visual das tabelas. Esta é uma inconsistência de estado observada, não ausência de evidência de teclado.

### 2. Histogramas768 comprimem os rótulos além da legibilidade confortável

Evidência: `distribuicoes-cidade-768.jpg`. Os dois gráficos lado a lado usam eixos/unidades muito menores que os textos adjacentes e que os gráficos equivalentes390/1440. O gráfico largo é comprimido dentro da meia coluna; a mediana e marcas do eixo exigem ampliação. A década768, usando sua variante compacta, não apresenta a mesma redução relativa.

Correção: variante compacta apropriada ao contêiner, ou empilhamento até largura suficiente. Verificar o recorte768 em tamanho natural; rótulos devem ter tamanho comparável ao móvel, sem retirar marcas importantes ou reduzir fonte.

### 3. Domínios horizontais distintos nos histogramas pareados

Evidência: `distribuicoes-cidade-{390,768,1440}.jpg`. AI: Brasil3–10, Sergipe4–8. AF: Brasil2–10, Sergipe3–6. A faixa de meio ponto tem larguras visuais diferentes e o mesmo Ideb ocupa posições distintas. Isso dificulta a comparação espacial prometida pelo pareamento.

Os eixos estão explícitos; não há número falsificado ou ausência escondida. Classifico como limitação concreta de comparabilidade, não bloqueio isolado por dado enganoso. Recomendo0–10 comum no eixoX apenas nestes novos pares. EixoY pode continuar próprio, pois BR/UF têm números de redes muito distintos e estes estão explicitados. Confirmar marca da cidade, mediana, quartis e vinte faixas após o ajuste.

### 4. Motivo histórico usa afirmação mais específica do que a evidência

Evidência: `metas-inep-{390,768,1440}.jpg`, anos finais2015: “Sem Ideb. O INEP não publicou Ideb desta rede nesta etapa: a rede não aparece na planilha de resultados.” A série da rede existe e contém outras edições; o fallback histórico genérico não demonstra que a rede não aparece na planilha. Ele demonstra ausência naquele ponto.

Correção: mensagem histórica conservadora, por exemplo “Sem Ideb publicado nesta edição; motivo não informado”, reservando explicações específicas a marcas presentes na fonte. Não transferir motivo de matrícula de edição recente para anos antigos. Verificar que anos com marcaND mantêm a explicação de participação e que ausência não recebe nota zero. Este ponto é de precisão textual dos dados, não estética.

### 5. Títulos repetidos nos blocos da entrada (menor)

Evidência: recortes `recolhido-metas` e `recolhido-decada`, três larguras. Summary apresenta o título e, logo abaixo, o conteúdo repete o mesmo título. Ocupa espaço sem acrescentar orientação.

Correção opcional: permitir ao conteúdo omitir seu título quando já está corretamente identificado pelo summary da entrada, mantendo título na ficha e hierarquia semântica. Verificar que a seção continue nomeada para tecnologia assistiva. Não redesenhar a entrada inteira.

## O que ficou demonstrado

- Decomposição: controles íntegros, valoresN/P legíveis, movimentos com sinal e unidade; aviso claro do limiar0,05. No caso observado o Ideb publicado cai5,4→5,3, mas o produto tem movimento menor que0,05; a ressalva de arredondamento está no próprio envelope. Não trata essa diferença como erro do cálculo.
- Metas da ficha: oito edições lado a lado em1440, quatro colunas768 e duas390; símbolos preenchido/vazado com texto, ausências explícitas e2023/2025 sem meta. Notas extensas de ausência alongam algumas células, sem cortes. Precisão do fallback2015 é a ressalva acima.
- Metas nacionais: denominador é dito em cada edição; redes sem Ideb não viram zero; contagens separadas de sem meta. Não há cor de semáforo.
- Década: Brasil municipal separado dasUFs públicas, mesma escala0–10, marca2021 e ordem por nome. Os27estados estão presentes no conjunto, incluindoDF. A ressalva de não causalidade e o caráter do agregado nacional estão expostos.
- Matrículas: total e contagens por dependência legíveis nas três larguras; zero aparece como0matrículas, não ausência. Segmentos mantêm proporção e legenda; as limitações de agrupamento por etapa estão no texto. Não observei clipping. Não exige inferir quatro dependências onde a gold só oferece grupos.

## Rubrica §10 — estritamente dos blocos capturados

Notas abaixo não são aprovação das páginas inteiras ou do build final. NV = falta de evidência. Critérios9 referem-se ao estado visível e ao contrato concreto da skill, não a excepcionalidade10.

| Página/blocos | Arte | Hierarquia | Tipografia/acabamento | Densidade/profundidade | Didática | Comparabilidade | Interação/acessibilidade | Responsividade |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Entrada: metas e década abertas |8|8|9*|8|9|9|NV|9*|
| Ficha: quatro novos blocos abertos |9|9|7|9|8|8|NV|7|

Justificativa de cada redução: entrada/arte8 por indicadores de estado inconsistentes (achado1); hierarquia8 e densidade8 pela duplicação imediata dos títulos (achado5). Ficha/tipografia7 e responsividade7 pelos eixos comprimidos768 (achado2); didática8 pelo texto histórico excessivamente específico (achado4); comparabilidade8 pelas escalas horizontais distintas (achado3). Não atribuí8 genericamente por “não parecer excepcional”.

Os9: identidade sóbria sem decoração gratuita nos blocos da ficha; hierarquia de etapa/território/valor explícita; detalhes disponíveis sem apagar profundidade; na entrada, conceitos/universos e escalas das séries estão nomeados e consistentes. **Asterisco:** tipografia/responsividade da década390 permanecem parcialmente limitadas pela redução do visualizador; os9 não certificam leitura pixel a pixel de cada rótulo desse arquivo muito longo. Para essa subevidência específica, a avaliação éNV, sem penalizar arbitrariamente os demais recortes.

Interação/acessibilidadeNV: não operei selects, teclado, toque ou leitor de tela. A correção posterior de htmlFor/id não está demonstrada pelas capturas. A decomposição foi vista apenas no estado de variação pequena; contribuições não nulas, componentes zero, ausência de par, troca de etapa e tabelas expandidas ainda precisam de evidência. Mapa não pertence a estes18recortes e não recebeu nota nesta rodada.

## Adendo — novas capturas das19:25, correções conferidas

Reabri as18 capturas renovadas nos mesmos caminhos, três larguras e seis blocos. Não usei as capturas gerais ainda em geração, não operei navegador e não alterei arquivos do worktree.

**Confirmado visualmente:**

1. Década aberta mostra menos no pai e **mais** em “Valores por edição” fechado, nas três larguras. O defeito do indicador aninhado está corrigido neste estado. Filho aberto e transições continuam dependentes de interação/teste, não visíveis nestes recortes.
2. Histogramas768 têm unidades, marcas e medianas legíveis, comparáveis em tamanho ao390. A compressão anterior foi corrigida.
3. Os quatro histogramas usam X0–10, inclusive faixas vazias. A mesma nota agora ocupa a mesma posição relativa. Texto declara que Y é próprio de cada universo; n,mediana,quartis e faixa da cidade permanecem visíveis.
4. AF2015 no placar agora diz apenas “O INEP não divulgou o Ideb nesta edição”. A inferência indevida de que a rede não aparece na planilha foi removida;2013 conserva motivo específico de participação.

Não observei novo bloqueio de dados ou perda de informação. Decomposição e atendimento preservam controles, valores e notas. A correção de labels não é certificável por imagem; a mudança de atributo do mapa não é parte destes recortes.

**Limitações visuais restantes:**

- Permanece o título duplicado nos recolhidos nacionais de metas e década. É redundância editorial menor, conforme achado5, sem bloqueio funcional.
- A variante compacta do histograma resolveu768, mas em1440 é ampliada com todo o SVG: unidade, marcas e “Mediana” ficam maiores que o título territorial Brasil/Sergipe e o texto explicativo. É uma desproporção tipográfica leve, visível em `distribuicoes-cidade-1440.jpg`, não ilegibilidade. Se houver ajuste, usar variante/contêiner que conserve tamanho de fonte moderado em largura grande, sem reintroduzir a redução768. Não considero necessário prolongar esta rodada apenas por cosmética.
- Permanecem limites de evidência: década390 é reduzida pelo visualizador; estados alternativos da decomposição e tabelas abertas não estão capturados; avaliação global da página depende da coleta final.

### Rubrica atualizada, somente dos blocos/estados vistos

| Página/blocos | Arte | Hierarquia | Tipografia/acabamento | Densidade/profundidade | Didática | Comparabilidade | Interação/acessibilidade | Responsividade |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Entrada: metas e década abertas |9|8|9*|8|9|9|NV|9*|
| Ficha: quatro novos blocos abertos |9|9|8|9|9|9|NV|9|

A mudança das notas decorre das correções observadas: estado do indicador coerente, eixo comum, texto histórico preciso e legibilidade768. Entrada mantém8 em hierarquia/densidade pela repetição dos títulos. Ficha mantém8 em acabamento pela escala tipográfica exagerada do histograma1440, descrita acima; não é uma exigência de excepcionalidade10. Os asteriscos e limites da década390 continuam os mesmos. Interação permaneceNV, mesmo que a suíte do agente principal venha a passar: este relatório não representa interação manual minha.

### Atualização de estado posterior, sem novas capturas

O agente principal informou retirada do título duplicado via `mostrarTitulo=false` apenas na entrada e correção do mapa com `grid-cols-1/min-w-0` após teste390 detectar overflow de488px. Ainda não há captura final dessas alterações nesta revisão: não as considero visualmente verificadas nem atualizo a rubrica com base apenas no relato. O mapa não havia sido rubricado nos18recortes.
