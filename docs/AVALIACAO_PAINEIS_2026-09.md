# Avaliação completa dos painéis do Observatório

**Data:** 5 de setembro de 2026 · **Base avaliada:** gold gerado em 2026-09-04 15:08 UTC (commit `38c99a4c`), SPA v0.86.0
**Escopo:** as 30 abas do catálogo, as 4 rotas dinâmicas (instituição, produto, setor, município), o pipeline (38 coletores, 62 objetos gold, 74,9 MB publicados) e a camada Next pública que orbita a SPA.
**Método:** leitura do código e dos golds; renderização real das 34 rotas em Chromium a 1440 px e a 390 px com medição por script (altura, palavras, tabelas, gráficos, fontes, overflow, erros de console); comparação com as auditorias anteriores (30/07, 03/08, 04/08 e 12/08) para não repetir o que já foi tratado.

Em todo o documento: **E** = evidência (o que foi medido ou lido), **I** = inferência (leitura minha sobre a evidência), **R** = recomendação.

---

## 1. Síntese executiva

O Observatório é hoje um produto de nível profissional em rigor de dados: 816 testes em 65 arquivos travam totais, reconciliações e invariantes editoriais; nenhuma rota renderiza erro de JavaScript; a linhagem cobre 100% dos objetos publicados. O problema não é mais de número. É de **forma, hierarquia e cobertura**, e concentra-se em cinco pontos:

1. **A informação certa está atrás de texto demais.** Sete abas passam de 10 mil pixels de altura em desktop (Operacional 15.718 px, Bets 15.532, Desenrola 14.414, Fraudes 11.120, Consignado 10.981, Metodologia 10.424, Moradia 10.244) e três passam de 6 mil palavras (Instituições 8.334, Operacional 6.812, Metodologia 6.735). Em celular, Bets chega a 28.734 px. A caixa de método da aba Instituições ocupa 9 linhas antes da primeira linha de dado.
2. **Em celular, o conteúdo largo rola dentro do próprio contêiner; o corte real é residual.** Correção da primeira versão deste documento: a varredura de 390 px acusou elementos além da viewport em oito abas, mas a verificação elemento a elemento mostrou que quase todos estão dentro de `.tblwrap` ou `.heatwrap`, que rolam na horizontal e recebem foco de teclado. O que de fato ultrapassa a tela sem rolagem: o histograma do painel de produto (SVG de 462 px), um botão de segmento no Panorama e no Pix (grupos `.seg` sem quebra de linha) e dois cartões da ficha de IF com 8 px a mais. Os três casos entram no backlog como P2, não P0.
3. **Sinais e alertas estão dominados por ruído.** Dos 21 alertas ativos, 14 são flags operacionais de FRE não entregue (variações de "−100%" em empregados de Alfa Holdings, Bemge, Mercantil Financeira) e 16 não têm nível. Em "O que mudou" da Visão geral, 4 dos 6 itens são liquidações de DTVMs e administradoras de consórcio, com link para a aba errada (Pulso). O subíndice de crédito não bancário dos Sinais Antecedentes marca +3,33σ com um único componente (FIDC) e a tabela de defasagens o declara "amostra insuficiente".
4. **Uma aba pública ainda publica ficção.** Recuperações & Falências mistura séries reais do DataJud com fichas de "Metalúrgica Exemplo S.A. (demo)" e "Agro Fictícia S.A. (demo)", porque a coleta do DJEN devolve HTTP 403 em 8 de 8 tribunais desde a última execução. Em plataforma indexada e citável por imprensa, demonstração e dado real não deveriam dividir a mesma página.
5. **Há lacunas de cobertura que um observatório de crédito brasileiro não pode ter.** Crédito rural (R$ 700,6 bi só na carteira PF, IF.data 2026-T1, segundo o próprio painel de produtos) não tem aba, embora a Matriz de Dados do Crédito Rural do BCB seja municipal, mensal e aberta desde 2013. BNDES e crédito direcionado não aparecem. O mercado de capitais como funding (debêntures, CRI, CRA, ofertas registradas na CVM) está reduzido a um subíndice de FIDC.

O que já está bom e não precisa de retrabalho: sistema de tokens e tipografia (documentado em `styles.css`), selos de status (observado, calculado, estimado, previsão, demonstrativo), rodapé metodológico obrigatório em 35 gráficos, guia "entenda esta página" em 25 abas, 26 conceitos didáticos em seis camadas, embeds e permalinks, exportação com procedência, split do bundle por rota, acessibilidade AA verificada por axe.

---

## 2. Avaliação técnica

### 2.1 Pipeline e fontes

**E.** `meta.json` de 2026-09-04: 38 coletores, 209 chaves ok, 58 falhas. Falhas com efeito visível:

| Coletor | Falha | Efeito no painel |
|---|---|---|
| `scr_data` | 3 de 3 anos (zip inválido, `IncompleteRead`) | Panorama continua em 2026-07 por reter o silver; sem novas datas-base enquanto a falha persistir |
| `djen` e `djen_credores` | HTTP 403 em 8 tribunais | RJ sem fichas nominais reais; página cai para fichas fictícias |
| `pilar3` | 33 falhas em 45 instituições (404, 503, 520, SSL, formato) | Cobertura KM1 reduzida a 12 instituições |
| `desenrola` | esquema do CSV mudou (7 colunas ausentes) | Data-base parada em 2026-06 |
| `trends_manual` | arquivo manual ausente | Tendências em 2026-06 |
| `judicial:tst_ranking` | layout HTML mudou | TST em carry-forward |
| `reclamacoes_consig` | 504 | Reclamações do consignado sem atualização |
| `bcb_sgs:selic_meta` | JSON vazio | Página de Juros exibe Selic vigente de outra origem |

Vintages: SGS 2026-07, SCR 2026-07, txjuros 2026-08, B3 2026-09, DataJud 2026-07, IF.data 2026-03, Trends 2026-06.

**I.** O sistema de vigílias (OPERACOES.md) pega pipeline parado e gold regredido, mas não pega **fonte silenciosamente parada** dentro de um gold que continua sendo publicado: o SCR falhando 3 de 3 e o DJEN 8 de 8 não geram issue porque o gold sai íntegro com o dado antigo. A frescor é medida do gold, não da fonte. O IF.data em 2026-03 no início de setembro merece verificação: se o 2T26 já foi divulgado pelo BCB, o coletor não o absorveu.

**R.**
- Vigília por **vintage de fonte**: issue quando a data-base de um coletor essencial (SCR, IF.data, DJEN, txjuros) não avança por mais que sua periodicidade mais 30 dias, mesmo com o gold íntegro.
- Faixa de "fonte em pane" no cabeçalho da aba, alimentada por `fontes_status`, quando o coletor da aba falhou na última execução. Hoje o leitor não tem como saber que o Panorama de 2026-07 pode ser o último por um tempo.
- `scr_data`: baixar por streaming com `Range` e retomada; o `IncompleteRead` em 171 MB é assinatura de conexão cortada, não de fonte fora do ar.
- `djen`: o 403 uniforme sugere bloqueio por User-Agent ou por origem (runner do GitHub). Testar da sessão local antes de assumir que a API fechou.

### 2.2 SPA

**E.** `app.js` com 11.096 linhas e 914 KB (core minificado 555 KB mais dois chunks de 133 KB e 57 KB); 1.108 atributos `style=` inline; 261 `onclick` inline; 58 âncoras `javascript:void(0)`; 15 chamadas a `alert()`; 100 atribuições a `innerHTML`. Estado fragmentado em oito singletons por aba (`state.pan`, `state.px`, `state.mkt`...). Testes leem o bundle por regex (`app.indexOf("const GUIA = {")`). Na aba Sobre, o link "LinkedIn" tem `href="HREF_LINKEDIN"`, literal que ninguém substitui em runtime: em produção resolve para `/observatorio/HREF_LINKEDIN` e responde 404.

**E.** Golds pesados baixados inteiros ao abrir a aba: Instituições puxa `institutions.json` (597 KB) + `inst_index.json` (355 KB) + `npl.json` (991 KB) + `guidance` + `regimes`; Mercado puxa `market.json` (1,17 MB); Juros 453 KB; Pulso 623 KB no núcleo de toda visita.

**I.** A arquitetura sem framework foi uma decisão consciente e funciona; o custo aparece na manutenção (cada correção exige varredura por regex em 11 mil linhas) e na fragilidade dos testes, que quebram por reformatação sem quebra funcional. O peso dos golds é aceitável com compressão do CDN, mas a estratégia que resolveu os municipais (corpo leve + `_mun.json` sob demanda) ainda não foi aplicada a `npl`, `market`, `juros` e `trends`, onde as séries longas dominam o tamanho.

**R.**
- Separar séries de resumos em `npl`, `market`, `juros` e `trends` (mesmo padrão dos municipais). Ganho estimado: Instituições cai de ~1,9 MB para menos de 500 KB no primeiro paint.
- Substituir os 15 `alert()` por um toast não bloqueante (o "URL copiada" hoje trava a página).
- Trocar `javascript:void(0)` por `<button>` ou por `href` real da rota (as âncoras de navegação interna já têm rota; um `href="/observatorio/pulse"` com `onclick` que previne o default mantém o comportamento e ganha semântica, abrir em nova aba e pré-visualização de link).
- Sem migrar de framework agora. O que compensa é **modularizar em arquivos** (ES modules concatenados no build) para que os testes importem funções em vez de fatiar o bundle por string.

### 2.3 Camada Next e duplicação de superfícies

**E.** Existem duas metodologias (`/metodologia` no Next, genérica, e `/observatorio/methodology`, viva), dois glossários (`/glossario` com `GLOSSARIO` e os 26 `CONCEITOS` da SPA), duas listas de fontes (`/fontes` com cinco categorias genéricas e o `FONTES_*.md` com 40 seções) e três portas de entrada (`/`, `/observatorio-do-credito`, `/observatorio`). O rodapé da SPA diz "Fontes reais: BCB/SGS · BCB/IF.data · IBGE · Ipeadata" e `meta.fontes_reais` lista 4 fontes, enquanto o pipeline tem 38 coletores; `meta.fontes_demo` ainda lista Open Finance, cujo gold tem `demo: false`. O `og:description` do `index.html` fala em "12 fontes oficiais".

**I.** As páginas Next institucionais foram escritas antes do Observatório virar o produto e descrevem uma plataforma que não existe mais ("CADE, SUSEP e Diário Oficial", "ajuste sazonal"). Para quem chega por busca, a `/metodologia` genérica compete com a verdadeira e a contradiz.

**R.** Uma única metodologia, um único glossário, uma única lista de fontes, todos gerados do gold (`method.json`, `lineage.json`, `CONCEITOS`). As páginas Next viram redirecionamentos ou renderizações do mesmo JSON. Atualizar `fontes_reais`, `fontes_demo` e o rodapé a partir de `fontes_status` em vez de literais.

---

## 3. Avaliação de layout

### 3.1 Medições por aba (desktop 1440 px, dado de 2026-09-05)

| Aba | Altura px | Palavras | Tabelas | `<details>` | Fonte mín. | Corte mobile |
|---|---:|---:|---:|---:|---:|:---:|
| Visão geral | 2.824 | 954 | 3 | 5 | 10 | |
| Panorama | 3.985 | 1.286 | 3 | 4 | 9,5 | sim |
| Penetração | 8.952 | 2.604 | 4 | 3 | 9,5 | |
| Moradia | 10.244 | 3.204 | 9 | 5 | 10 | |
| Consignado | 10.981 | 3.191 | 10 | 4 | 9 | |
| Pulso | 4.250 | 1.787 | 16 | 17 | 9 | |
| Sinais antecedentes | 2.313 | 710 | 1 | 1 | 10 | |
| Tendências | 3.564 | 1.132 | 28 | 37 | 8,5 | |
| Risco setorial | 4.565 | 2.007 | 5 | 45 | 10 | |
| RJ & Falências | 2.183 | 608 | 3 | 12 | 9 | |
| Instituições | 6.778 | 8.334 | 9 | 101 | 10,5 | |
| Operacional | 15.718 | 6.812 | 17 | 2 | 10,5 | sim |
| Produtos | 1.832 | 671 | 0 | 1 | 10,5 | |
| Juros | 3.689 | 1.820 | 5 | 2 | 10 | |
| Comparador | 900 | 119 | 0 | 1 | 12 | |
| Mercado & Valor | 2.313 | 764 | 2 | 3 | 9 | |
| Pix | 8.739 | 3.161 | 15 | 16 | 8,6 | sim |
| Open Finance | 3.064 | 1.135 | 8 | 6 | 10 | sim |
| Cenários | 3.645 | 1.019 | 5 | 3 | 9 | |
| Alertas | 6.234 | 3.369 | 2 | 2 | 10,5 | |
| Regulação | 2.502 | 813 | 0 | 0 | 10,5 | |
| Perguntas rápidas | 900 | 121 | 0 | 1 | 12 | |
| Ações judiciais | 3.604 | 1.067 | 3 | 2 | 10,5 | |
| Dívida Ativa | 6.900 | 1.472 | 7 | 7 | 10,5 | |
| Desenrola | 14.414 | 3.835 | 8 | 8 | 9 | |
| Bets | 15.532 | 6.185 | 14 | 5 | 9 | sim |
| Fraudes | 11.120 | 4.640 | 8 | 2 | 9 | sim |
| Metodologia | 10.424 | 6.735 | 4 | 31 | 10,5 | sim |
| Ficha de IF (Itaú) | 6.359 | 2.346 | 10 | 4 | 9 | sim |
| Painel de produto (cartão PF) | 6.040 | 3.540 | 8 | 5 | 8,5 | |

### 3.2 Achados

**E1. Dobra ocupada por cromo.** Em todas as abas, os primeiros 300 px são: título, descrição, linha de vintage, barra de 4 a 8 botões (copiar URL, XLSX, salvar visão, PDF), caixa "entenda esta página", e frequentemente uma caixa de método ou de aviso. Em Instituições, o primeiro número aparece a 700 px; em Desenrola, a 900 px (dois parágrafos e uma caixa de 12 linhas antes do índice de capítulos). Na Visão geral, a caixa "Comece por aqui" e o botão "personalizar página" ficam acima do diagnóstico.

**I1.** A barra de ações é idêntica em 30 abas e é usada por uma fração pequena dos leitores; as caixas de método são honestas, mas colocadas onde deveriam estar os números. A plataforma paga o preço da própria transparência por colocá-la antes do conteúdo em vez de ao lado.

**R1.** Barra de ações recolhida num único botão "⋯" (ou ícones sem rótulo com `title`), fixa no canto direito do cabeçalho. Caixas de método e de aviso viram `<details>` fechados posicionados **depois** do primeiro bloco de números, com o resumo de uma linha visível ("método: score relativo ao grupo de pares · limitações ▸"). "Comece por aqui" só na primeira visita (já há `obc_boas_vindas_ok`; hoje reaparece porque o padrão é aberto).

**E2. Dossiês monolíticos.** As sete abas acima de 10 mil px têm subnav fixa com 9 a 10 âncoras, mas tudo carrega e renderiza de uma vez. Bets tem 14 tabelas e 6.185 palavras numa única rolagem; Operacional tem 17 tabelas, uma delas com 1.013 elementos cortados em celular.

**R2.** Modo capítulo para páginas acima de ~8 mil px: a subnav vira paginação (uma seção por tela, `?sec=` já existe e já é permalink), com "próximo capítulo" ao fim de cada seção. Preserva URL, embed e exportação e reduz o custo de render e de leitura. Piloto sugerido: Bets e Operacional.

**E3. Conteúdo largo em celular** (item 2 da síntese, corrigido). A primeira varredura contou elementos além da viewport; a segunda, elemento a elemento, mostrou que as tabelas e os mapas de calor já estão em contêineres com rolagem horizontal e foco de teclado. Restam três casos sem rolagem: o histograma do painel de produto (SVG com largura fixa), grupos de botões `.seg` que não quebram linha (Panorama e Pix) e dois cartões da ficha de IF com 8 px a mais.

**R3.** `.seg` com `flex-wrap` (aplicado em 05/09); histograma com `viewBox` em vez de largura fixa; teste sintético a 390 px que falha para elemento fora de contêiner rolável.

**E4. Tipografia abaixo do piso declarado.** `styles.css` fixa piso de 10,5 px e o justifica. Os SVGs usam `font-size="8.5"` em eixos e rótulos (18 ocorrências de 8 a 9 px em `app.js`); fonte mínima medida a 1440 px: 8,5 px em Tendências, Pix e painel de produto; 9 px em 8 abas.

**R4.** Eixos em 10,5 px com `viewBox` ajustado, ou rótulos de eixo fora do SVG (HTML posicionado), o que também resolve o texto que não escala com o zoom do navegador.

**E5. Gráfico de retorno em Mercado & Valor.** O outlier Mercantil do Brasil (base 100 → 1.145) comprime as outras sete séries no quinto inferior do gráfico; os rótulos de evento "BTG Pactual ex JCP" e "Itaú Unibanco ex DIV" se sobrepõem; o título da seção diz "os três perfis do piloto" e o gráfico mostra oito companhias.

**R5.** Escala logarítmica como padrão para base-100 com dispersão acima de uma ordem de grandeza (ou exclusão declarada do outlier, com botão "incluir BMEB4"); rótulos de evento em faixa própria abaixo do eixo com colisão resolvida; corrigir o título.

**E6. Tabelas de ranking com 12 colunas** (Instituições) estouram a 1440 px e a coluna "Ficha" some; cada linha carrega grupo prudencial em texto corrido ("S1 — grandes (≥10% do PIB ou atividade internacional)") repetido 100 vezes.

**R6.** Grupo prudencial como chip curto com `dica()`; colunas "Evolução 5 trim." e "Basileia pós-choque" movidas para a ficha ou para um toggle "mais colunas". Padrão de 7 colunas visíveis a 1440 px.

**E7. Páginas de estado vazio.** Comparador, Perguntas rápidas e Sugestões abrem com 77 a 121 palavras e nenhum dado; o Comparador exibe apenas um campo de busca e quatro presets.

**R7.** Comparador abre já com o preset "5 grandes bancos" carregado (o estado vazio é a única visão que não ensina nada). Perguntas rápidas sai do menu principal e vira o campo de busca do topo (ver §5). Sugestões vira link no rodapé.

**E8. Tema escuro** segue `prefers-color-scheme` e tem toggle; tokens AA verificados na auditoria de 03/08. Não reavaliado aqui.

---

## 4. Avaliação didática

### 4.1 O que existe

**E.** `GUIA` com pergunta, importância, leitura e limite para 25 abas; `CONCEITOS` com 26 verbetes em seis camadas e 23 aplicações de `termo()`; `chartFooter` em 35 gráficos; `ponte()` entre painéis irmãos em 5 lugares; `placar` de abertura em 2 abas; subnav em 7; "As três inadimplências" em Metodologia; "Indisponíveis nesta página (e por quê)" no painel de produto.

**I.** É a camada mais bem resolvida do produto e a que mais o diferencia de um dashboard. O gargalo não é conteúdo didático, é **distribuição e consistência**.

### 4.2 Achados

**E9. Cobertura desigual do guia.** Renderizado em 0 das abas Juros, Bets, Fraudes e Regulação (Juros tem verbete em `GUIA` mas `renderJuros` não usa `pageHead`), e em nenhuma das quatro rotas dinâmicas (ficha de IF, produto, setor, município), justamente as páginas de cauda longa por onde o buscador traz leitor novo (1.422 fichas e 5.570 municípios no sitemap).

**R9.** `pageHead` obrigatório em todo renderizador (teste que falha para rota sem guia), com verbetes para `inst`, `product`, `sector`, `presmun` parametrizados pelo nome da entidade.

**E10. Nomenclatura em três versões.** Dez abas têm rótulo de menu diferente do título do catálogo (ex.: menu "Perguntas rápidas", catálogo "Pesquisa", H2 "Pesquisa — assistente de consulta estruturada"; menu "Regulação", catálogo "Regulação do Crédito", H2 "Regulação do mercado de crédito"). Dezesseis H2 renderizados diferem do catálogo por acrescentar selos e qualificadores ("Sinais Antecedentes de Estresse de Crédito MVP").

**R10.** Um nome por aba, nas três superfícies, com o teste `observatorio-publico` estendido ao H2 renderizado. O selo "MVP" em Sinais Antecedentes deve sair ou virar data ("versão metodológica 0.3, ago/2026").

**E11. Alertas sem hierarquia.** 16 de 21 alertas sem nível; 14 de 21 da família operacional. A justificativa ("atribuir nível seria criar informação que o dado não tem") é correta para o SCR, mas as flags operacionais têm limiar declarado (30%, 15%) e poderiam ter nível por construção. A Central abre com "21 alertas ativos" e o crachá vermelho do menu mostra 21.

**R11.** Nível por regra para a família operacional (flag de FRE ausente = informativo; queda real de rede acima do limiar = atenção). Crachá do menu conta só atenção ou acima. Flags de "−100%" por não entrega do FRE viram uma linha única "3 companhias sem FRE 2025", não três alertas.

**E12. "O que mudou" mistura universos.** Liquidações de DTVMs e administradoras de consórcio ocupam 4 de 6 vagas e apontam para a aba Pulso.

**R12.** Filtro por tipo de instituição relevante ao crédito (bancos, financeiras, cooperativas, IPs com crédito, SCDs) e link para a seção de regimes em Instituições. Vaga reservada por família (regime, guidance, recorde, alerta) para que nenhuma domine.

**E13. Sinais Antecedentes com um componente.** O subíndice FIDC (+3,33σ, 1/1 componente) é o maior número da página e o único "subindo"; a tabela de defasagens o classifica como amostra insuficiente; o IAEC não é calculado. A página se chama "Sinais Antecedentes" e conclui que não há alerta.

**R13.** Subíndice com um componente e amostra insuficiente não deveria ser exibido no mesmo tamanho dos demais: rebaixar para "em construção" até ter dois componentes (ver §6, crédito ampliado e ofertas CVM, que resolvem exatamente isso).

**E14. RJ com fichas fictícias** (item 4 da síntese). A série real do DataJud mostra 37 RJs em 07/2026 contra média visual de ~130 e projeta 45 com banda [21–76].

**I14.** A queda de 65,7% a/a com a projeção em cima é assinatura de latência de carga do DataJud nos últimos meses, não de fenômeno. O leitor comum não sabe disso.

**R14.** Separar em duas rotas: `/recoveries` só com o que é real (DataJud + funil TPU) e as fichas demonstrativas fora da navegação pública, ou remover as fichas até o DJEN voltar. Marcar os últimos 3 meses do DataJud como "cobertura parcial" e excluir da projeção.

**E15. Texto de método repetido.** O parágrafo "Plataforma acadêmica e analítica. Scores e projeções não constituem rating..." aparece no cabeçalho de Instituições, no rodapé de todas as páginas e em Mercado. A descrição de método de Instituições tem 165 palavras.

**R15.** Disclaimer uma vez (rodapé). Método em resumo de uma linha com `<details>`.

---

## 5. Reorganização proposta

**E.** Menu atual: 7 grupos, 31 itens. "Monitoramento" tem 8 itens que misturam macro (Pulso), território (Penetração, Moradia, Consignado) e sinais (Antecedentes, Tendências). "Riscos emergentes" abriga Dívida Ativa e Ações judiciais, que não são emergentes. "Ecossistema" tem 2 itens. "Análise" junta Cenários, Alertas, Regulação e Perguntas rápidas, quatro coisas de natureza diferente. Regulação, Metodologia e Conceitos estão em grupos distintos apesar de serem referência.

**I.** O menu reflete a ordem em que as abas foram construídas, não a pergunta que o leitor traz. O leitor chega com uma de cinco perguntas: como está o crédito, onde está, quem empresta, quanto custa, e o que me preocupa.

**R. Seis grupos pela pergunta do leitor, 27 itens de primeiro nível:**

| Grupo | Abas | Observação |
|---|---|---|
| **Diagnóstico** (como está) | Visão geral · Alertas · Pulso do crédito · Cenários · Sinais antecedentes | Tendências de Busca vira seção de Sinais (já é "sinal complementar" por definição própria) |
| **Território** (onde está) | Panorama por UF · Penetração e gap · Moradia · Consignado e envelhecimento · Presença bancária municipal | Presença ganha entrada própria (hoje só por link) |
| **Instituições** (quem empresta) | Instituições · Comparador · Indicadores operacionais · Mercado & Valor | Regimes de resolução e Pilar 3 seguem como seções |
| **Produtos e preços** (quanto custa) | Produtos de crédito · Taxas de juros por IF · Pix e pagamentos · Open Finance | |
| **Riscos e temas** (o que preocupa) | Risco setorial · Recuperações e falências · Ações judiciais · Dívida Ativa · Desenrola · Bets · Fraudes | Novas abas de §6 entram aqui ou em Produtos |
| **Referência** | Regulação · Metodologia e fontes · Conceitos · Sobre | Sugestões e Perguntas rápidas saem do menu |

Complementos:
- **Busca global** no topo (o `navQ` atual só filtra nomes de aba): índice de abas, seções ancoradas, conceitos, instituições, produtos e municípios, que hoje exigem entrar na aba certa para buscar. As "8 intenções" das Perguntas rápidas viram sugestões dessa busca.
- **Rodapé de cada aba com "continue por"**: as pontes já existem em 5 lugares; padronizar em todas (Produto → Juros da modalidade → Instituições que a oferecem, etc.).
- Ordem dentro de cada aba: **número, depois gráfico, depois método**, sem exceção. Hoje Desenrola, Penetração e Instituições invertem.

---

## 6. Novos painéis, por valor e esforço

Ordenados por valor para o leitor de crédito dividido pelo esforço. Todas as fontes abaixo são abertas, estruturadas e sem PDF, no padrão da Fase 0.

| # | Painel | Fonte primária | Granularidade | O que responde que hoje não se responde | Esforço |
|---|---|---|---|---|---|
| 1 | **Crédito rural** | BCB, Matriz de Dados do Crédito Rural (Sicor), OData, mensal desde 2013, licença ODbL | município × produto × fonte de recursos × programa × IF × porte × gênero | Onde e por quem o crédito rural é contratado; Pronaf × Pronamp × demais; custo por fonte (LCA, poupança rural, recursos livres); safra a safra | Médio: API pronta, 20 agregações JSON pré-calculadas; malha municipal já existe no projeto |
| 2 | **Crédito direcionado e BNDES** | BNDES dados abertos ("Operações de Financiamento" desde 2002, CSV, ODbL) + SGS (séries de crédito direcionado) | operação: UF, município, porte, CNAE, produto (Finame, indireto automático), valor, prazo | Quanto do crédito PJ é direcionado, para que setor e porte; desembolso regional; ponte com Risco setorial e Penetração | Baixo a médio: CSV estável |
| 3 | **Crédito ampliado e mercado de capitais** | SGS (família "crédito ampliado ao setor não financeiro": bancário, títulos de dívida, externo) + CVM Ofertas Públicas de Distribuição (Res. 160) + CVM securitizadoras (informe mensal CRI/CRA, Res. 60) + FIDC já coletado | mensal; oferta a oferta por emissor, tipo, valor | Desintermediação: quanto o PJ capta fora dos bancos; emissões de debêntures por setor; CRI e CRA como funding de moradia e agro; transforma o subíndice FIDC de um componente em família com quatro | Médio: três coletores CSV; resolve E13 |
| 4 | **Condições de crédito pela ótica do ofertante** | BCB, Pesquisa Trimestral de Condições de Crédito (indicadores de oferta e demanda por segmento, trimestral desde 2011) + Expectativas de mercado (Focus, API Olinda) | trimestral por segmento (grandes, PME, consumo, habitacional) | Aperto ou afrouxamento de oferta declarado pelos próprios bancos, antes de aparecer nas séries; Focus alimenta os presets de Cenários com expectativas em vez de choques arbitrários | Baixo: planilha oficial e API existentes |
| 5 | **Entrantes e saídas do SFN** | BCB, cadastro de instituições autorizadas (Unicad, já usado para agências) + regimes (já coletado) + IF.data por tipo | posição diária, série acumulada pelo pipeline | Quem entrou (SCDs, SEPs, IPs, cooperativas), quem saiu, quem virou banco; concentração por tipo; complementa "O que mudou" com o que importa para crédito | Médio |
| 6 | **Conduta e enforcement** | BCB processos administrativos sancionadores + CVM Processos Sancionadores + BCB ranking de reclamações e ouvidorias (já coletado) | processo a processo | Litigiosidade, reclamações e sanções por instituição, com a cautela "volume não é irregularidade" já usada em Judicial | Médio; regra editorial: nunca ranking |
| 7 | **Emprego setorial** (fecha o componente "capacidade financeira" hoje demonstrativo do score setorial) | Novo Caged (MTE, tabelas por CNAE e UF) | mensal por CNAE 2 dígitos | Remove o último componente demo de um score publicado | Médio: dados via PDET ou microdados |
| 8 | **Páginas por UF** | golds existentes (Panorama, Penetração, Juros, Presença, Pix, PGFN) | 27 rotas | SEO programático como o das 5.570 páginas municipais; a pergunta "como está o crédito no meu estado" hoje leva ao mapa, não a uma página | Baixo |
| 9 | **Funding e captação** | IF.data funding (já coletado) + SGS (poupança, LCI, LCA, CDB, LF) + CVM CDA de fundos (quem detém CDB e LF de quais bancos) | mensal / trimestral | De onde vem o dinheiro que os bancos emprestam; dependência de captação de mercado por banco; exposição de fundos a emissores bancários | Médio |
| 10 | **Consórcios** | BCB, Dados agregados do segmento de consórcios | mensal | Crédito adjacente relevante para veículos e imóveis | Baixo; prioridade baixa |

Painéis que **não** recomendo agora: Cadastro Positivo, Serasa e SPC (privados, sem fonte aberta); "endividamento por CPF" (não existe em fonte pública); qualquer coisa que dependa de PDF sem o gate da Fase 2.

---

## 7. Integrações CVM e demais fontes abertas

### 7.1 CVM (dados.cvm.gov.br, 54 conjuntos em 05/09/2026)

| Conjunto | Uso atual | Uso proposto |
|---|---|---|
| Cias abertas: DFP e ITR | P/L, P/VP, ROE da companhia, payout (Mercado) | Série trimestral completa de DRE e balanço (hoje só lucro e PL); despesas de PDD e provisões pelo plano IFRS, para reconciliar com IF.data |
| Cias abertas: FRE | empregados por região e posição; remuneração da administração | Item 7 (fatores de risco: texto, fora da Fase 0); item 12 (composição do conselho, independência, rodízio) é estruturado e entra sem PDF |
| Cias abertas: FCA | auditor vigente e histórico; cadastro do setor "Bancos" | Sem mudança |
| Cias abertas: IPE | descoberta de releases (Fase 2) | Feed de **fatos relevantes e comunicados** dos bancos listados para "O que mudou" (título, data, protocolo, link oficial), sem extração de conteúdo |
| FIDC: informe mensal | agregado do sistema (carteira, vencidos) | Abertura por **segmento do lastro** (consignado, cartão, duplicatas, veículos) e por classe de cota; o informe já traz os campos |
| **Ofertas Públicas de Distribuição** (Res. 160) | não usado | Emissões por tipo de ativo (debênture, nota comercial, CRI, CRA, FIDC), emissor, setor, valor, prazo, rito; base do painel 3 |
| **Securitizadoras: informe mensal CRI/CRA** (Res. 60) | não usado | Estoque, inadimplência do lastro e liquidação antecipada; funding de moradia (CRI) e agro (CRA) |
| **Fundos: Composição da carteira (CDA)** | não usado | Exposição de fundos a CDB, LF e debêntures por emissor bancário: quem financia cada banco pelo mercado; base do painel 9 |
| Fundos: Informe diário | não usado | Captação líquida de fundos de crédito privado como termômetro de apetite (mensal, agregado) |
| **Cias abertas: Valores mobiliários negociados por administradores (Res. 44)** | não usado | Compras e vendas líquidas de insiders por banco listado, em Mercado & Valor, com a cautela de que não é sinal |
| Cias abertas: Programa de recompra | não usado | Recompras anunciadas, em Mercado & Valor |
| Cias abertas: Informe de governança | não usado | Aderência ao Código Brasileiro de Governança, por prática, em Operacional |
| **Processos Sancionadores** | não usado | Painel 6 |
| Auditores: informação cadastral | não usado | Porte da firma de auditoria e rodízio, cruzando com o FCA |
| Plataformas de crowdfunding (Res. 88) | não usado | Marginal para crédito; registrar como fronteira |
| FII, FIAGRO: informes | não usado | FIAGRO complementa o painel rural pelo lado do funding; prioridade baixa |

### 7.2 BCB além do que já está

Pesquisa Trimestral de Condições de Crédito; família de séries de crédito ampliado; Matriz de Dados do Crédito Rural; Expectativas de mercado (Focus); cadastro de instituições autorizadas como série de entradas e saídas; processos administrativos sancionadores; dados agregados de consórcios; ouvidorias; estatística de cheques sem fundos (SGS). Todos abertos, estruturados, com API ou CSV.

### 7.3 Fora do BCB e da CVM

- **BNDES** (47 conjuntos abertos, ODbL): painel 2.
- **Novo Caged** (MTE): painel 7.
- **Receita Federal, cadastro CNPJ** (aberturas e baixas por CNAE e município, mensal): contexto para Risco setorial e RJ; esforço alto pelo volume (o arquivo completo passa de 5 GB), viável por agregação prévia.
- **CNJ DataJud**: além das classes 108 e 129 já usadas, as classes de execução de título extrajudicial, busca e apreensão em alienação fiduciária e ação monitória são o proxy público mais direto de **cobrança judicial de crédito**; mesma API, mesmo coletor.
- **SUSEP** (dados abertos de prêmios por ramo): seguro prestamista como camada do custo efetivo do crédito, em Juros.

---

## 8. Backlog priorizado

| Prio | Item | Seção | Esforço |
|---|---|---|---|
| P0 | Tirar fichas fictícias da rota pública de RJ; marcar cobertura parcial do DataJud nos últimos 3 meses | E14 | baixo |
| P2 | Histograma com viewBox e teste a 390 px para elemento fora de contêiner rolável (`.seg` já quebra linha) | E3 | baixo |
| P0 | Link "LinkedIn" na aba Sobre aponta para o literal `HREF_LINKEDIN` (404) | 2.2 | trivial |
| P1 | Vigília por vintage de fonte; faixa "fonte em pane" no cabeçalho | 2.1 | médio |
| P1 | Nível por regra nos alertas operacionais; consolidar flags de FRE ausente; crachá só com atenção ou acima | E11 | baixo |
| P1 | "O que mudou" filtrado por tipo de instituição e com link correto | E12 | baixo |
| P1 | Guia e `pageHead` em Juros, Bets, Fraudes, Regulação e nas rotas dinâmicas | E9 | baixo |
| P1 | Menu por pergunta do leitor (§5) e nome único por aba | E10 | médio |
| P1 | Método e disclaimer depois do primeiro número; barra de ações recolhida | E1, E15 | médio |
| P1 | Painel de crédito rural | §6 nº 1 | médio |
| P1 | Crédito ampliado + ofertas CVM + CRI/CRA (resolve E13) | §6 nº 3 | médio |
| P2 | Modo capítulo para dossiês acima de 8 mil px | E2 | médio |
| P2 | Eixos de gráfico a 10,5 px; gráfico de retorno em escala log com rótulos sem colisão | E4, E5 | baixo |
| P2 | Separar séries de resumos em `npl`, `market`, `juros`, `trends` | 2.2 | médio |
| P2 | Unificar metodologia, glossário e fontes entre Next e SPA; corrigir `fontes_reais`, rodapé e `og:description` | 2.3 | médio |
| P2 | BNDES, PTC e Focus, páginas por UF | §6 nº 2, 4, 8 | baixo a médio |
| P3 | Substituir `alert()`, `javascript:void(0)` e modularizar `app.js` em arquivos | 2.2 | alto, incremental |
| P3 | Entrantes e saídas do SFN; conduta e enforcement; emprego setorial; funding | §6 nº 5, 6, 7, 9 | médio |

---

## 9. O que não foi verificado

- Produção na Vercel (compressão, cache, tempo de resposta): avaliado só em servidor local sem compressão.
- Tema escuro e contraste: coberto pela auditoria de 03/08, não repetido.
- Fluxos de cadastro, login e boletim: fora do escopo dos painéis.
- Se o IF.data 2T26 já foi divulgado pelo BCB em 05/09/2026: não acessado; o vintage 2026-03 fica registrado como ponto a conferir.
- Existência de códigos SGS específicos da PTC e do crédito ampliado: as famílias existem no catálogo do BCB; os códigos devem ser confirmados no coletor.
- Reconciliação de números entre painéis: feita na auditoria de 04/08 com resultado limpo; não refeita.

---

## 10. Execução das correções (05/09/2026, v0.87.0)

Aplicado no mesmo dia, na branch desta avaliação, com a suíte de testes estendida (`src/tests/avaliacao-set26.test.ts`) para que nenhum item volte:

| Item | O que foi feito |
|---|---|
| P0 fichas fictícias em RJ | `renderRJ` publica só o DataJud, o funil TPU e as fichas nominais reais (quando o DJEN responde); nota de cobertura parcial dos meses recentes ao lado da projeção |
| P0 LinkedIn | URL injetada no `<head>` pelo route handler a partir de `src/lib/contato.ts`, lida pela SPA |
| P1 vigília por fonte | cheque `pane` em `scripts/vigilancia.py` (coletor essencial com zero chaves ok, vintage além do prazo da fonte), agendado no workflow; faixa "fonte em pane" no cabeçalho da aba via `VIEW_COLETORES` |
| P1 alertas | família operacional com nível pela regra declarada (queda de rede e variação de quadro = atenção; troca de auditor e FRE ausente = informativo); FRE não entregue consolidado numa linha por ano; crachá do menu conta só atenção ou acima. Central publicada: 21 → 16 alertas, crachá 21 → 9 |
| P1 "O que mudou" | até duas vagas por família na primeira rodada; regimes apontam para a seção de regimes em Instituições |
| P1 guia | `GUIA` para Bets, Fraudes, Regulação e as quatro rotas dinâmicas; renderizado em Juros, Bets, Fraudes, ficha de IF, produto e setor |
| P1 nomes e menu | um nome por aba (menu, catálogo, `VIEW_TITLES`, H2, telemetria); menu em seis grupos pela pergunta do leitor; Perguntas rápidas e Sugestões no rodapé e em Sobre |
| P1 número antes do método | barra de ações recolhida em menu "ações" em todas as abas; método de Instituições depois da tabela; disclaimer só no rodapé; aviso do Desenrola depois dos números oficiais; "Comece por aqui" só na primeira visita |
| P2 modo capítulo | `subnavFixa` ganha "ler por capítulos" (uma seção por tela, anterior e próximo, `?sec=` como permalink); ficha de IF passa a usar o mesmo componente |
| P2 gráficos | piso de 10,5 px renderizados dentro dos SVG (ajuste pela escala do viewBox, rótulos do eixo x rareados); Mercado com escala log automática acima de 4× de dispersão, três anotações em quatro faixas, título corrigido |
| P2 meta e Next | `fontes_reais` derivada do status da coleta (28 fontes, sem "demonstrativos"); rodapé e descrições sem "12 fontes"; `/metodologia` e `/fontes` redirecionam para a metodologia viva e as páginas genéricas saíram |
| P3 `alert()` e `javascript:void` | toast não bloqueante; 30 âncoras de navegação com a rota real no `href` |

**Não executado nesta rodada, e por quê:** painéis com fonte nova (crédito rural, BNDES, ofertas CVM, PTC, Focus, entrantes do SFN, conduta, emprego setorial, funding) exigem coletores e uma rodada do pipeline contra as fontes; separar séries de resumos em `npl`, `market`, `juros` e `trends` exige rodada do pipeline para materializar e validar; a modularização do `app.js` em arquivos é refatoração estrutural sem ganho para o leitor no curto prazo; a exclusão dos três meses parciais do DataJud na projeção fica registrada como mudança de pipeline (o forecast produz pontos por origem e horizonte, e a exclusão simples deslocaria as datas da projeção; o tratamento certo é na origem, no `forecast_series`).

## 11. Painel novo: crédito rural (05/09/2026, tarde)

Construído o painel nº 1 da lista da seção 6: coletor `pipeline/sources/sicor.py` (MDCR/Sicor, OData), builder `pipeline/rural.py` (`rural.json` e `rural_mun.json`), aba `/observatorio/rural-credit` no grupo "Produtos e preços", guia didático, ponte com o produto rural do IF.data (fluxo × estoque), vigília de pane, testes (`rural-data.test.ts`) e registro em FONTES_OPERACIONAL §42.

**Estado da fonte no dia:** a API respondeu em segundos pela manhã, passou horas devolvendo HTTP 504 à tarde e voltou à noite. A janela de 12 meses fechados (2025-08 a 2026-07) foi carregada nos cinco recursos e o gold real está publicado: R$ 344,4 bilhões em 2.538.458 contratos, custeio 53% do valor, PRONAF 21%, fontes com taxa controlada 60%, mulheres 38% das cédulas de pessoa física e 20% do valor, cooperativas 28% da originação, 5.487 municípios com contratação. A cauda histórica converge nas execuções diárias. Achado de universo registrado em FONTES_OPERACIONAL §42: o recurso RegiaoUF fica 2% a 8% abaixo do universo em todos os meses, e a aba passou a usar FonteRecursos e o municipal, que fecham com o recurso Faixa ao centavo.

## 12. Painel novo: crédito ampliado e mercado de capitais (05/09/2026, noite)

Segundo painel construído a partir da lista do §6 (nº 3, P1 no backlog). Resolve E13:
o subíndice "Crédito Não Bancário" do Sinais Antecedentes passa de um para quatro
componentes (FIDC, CRI, CRA e emissões de dívida corporativa), e o mês parcial dos
informes de FIDC, que puxava o índice a +3,33σ, deixa de entrar.

**Evidência.** Saldo ampliado de empresas e famílias em 2026-07: R$ 12,23 trilhões,
92% do PIB, dos quais 57% no SFN e 22% em títulos privados e securitização (BCB/SGS
28203 e família, consulta de 05/09/2026). Nas empresas o SFN responde por 33% e os
títulos privados por 21%; em dezembro de 2023 eram 36% e 17%. Ofertas públicas
encerradas entre 2025-09 e 2026-08: R$ 941 bilhões, R$ 423 bilhões em debêntures e
notas comerciais (CVM, base de 05/09/2026). Lastro de CRI em 2026-06: R$ 262 bilhões,
1,0% vencidos; CRA: R$ 189 bilhões, 0,8% vencidos (CVM, informes mensais).

**Inferência.** A desintermediação das empresas é mensurável e contínua desde 2023: três
pontos percentuais migraram do SFN para títulos privados em dois anos e meio. O crédito
às famílias segue quase inteiro no SFN (93%).

**O que foi construído.** Dois coletores (ofertas CVM; informes de securitizadoras),
26 séries do SGS, o builder `pipeline/ampliado.py`, a aba `/observatorio/broad-credit`
em cinco seções (saldo por credor, desintermediação das empresas, emissões, CRI e CRA,
método), a integração no Sinais Antecedentes e as travas de teste. Detalhe operacional,
achados de qualidade da fonte e pendências: FONTES_OPERACIONAL §43.

**Correções de dado que a construção exigiu.** Registros de fundos abertos (ICVM 555)
fora dos totais; só ofertas encerradas na Res. 160; certificados com erro de unidade ou
informe inconsistente excluídos do mês; meses com entrega parcial marcados e fora de KPI.

## 13. Painel novo: crédito direcionado e BNDES (05/09/2026, noite)

Terceiro painel da lista do §6 (nº 2). Fecha a pergunta "quanto do crédito PJ é
direcionado, para que setor e porte, e onde", com ponte para Crédito rural.

**Evidência.** Desembolsos do Sistema BNDES entre 2025-04 e 2026-03: R$ 181 bilhões,
33% acima dos 12 meses anteriores; 41% para micro, pequenas e médias, 33% para
infraestrutura, 22% para agropecuária; 58% via agentes financeiros em 2025, com HHI de
863 entre 60 agentes (BNDES dados abertos, consulta de 05/09/2026). Operações não
automáticas entre 2025-07 e 2026-06: 1.484 contratos, R$ 83,8 bilhões, juros médio
ponderado de 3,0% ao ano sobre o custo financeiro, TLP em 51% do valor. Passivo do BNDES
em 2025-12: FAT 50%, patrimônio líquido 18%, fundos 14%, Tesouro 4%.

**Inferência.** O crédito do BNDES voltou a crescer em ritmo de dois dígitos, puxado por
grandes empresas (52% em 12 meses) e infraestrutura; o Sul recebe mais por habitante que
o Sudeste porque máquinas agrícolas e cooperativas de crédito como agentes pesam.

**O que foi construído.** Um coletor (18 tabelas do catálogo CKAN e as operações não
automáticas), 19 séries do SGS, o builder `pipeline/bndes.py`, a aba
`/observatorio/directed-credit-bndes` em sete seções (saldo direcionado, desembolsos e
funil, para quem e para quê, onde, agentes e funding, contratos, método) e as travas.
Detalhe operacional e achados: FONTES_OPERACIONAL §44.

**O que ficou declarado em vez de resolvido.** O bloco de saldo direcionado depende de
19 séries do SGS que a API do BCB não serviu em 05/09 (HTTP 502 por horas); o pipeline
diário as coleta e a seção abre sozinha. Não há mapa municipal: dois terços do valor das
operações não automáticas não têm município único, e as automáticas ficam fora da base.

## 14. Páginas por UF (05/09/2026, noite)

Painel nº 8 do §6, construído enquanto o BCB estava fora do ar (HTTP 502 em SGS, Olinda
e dados abertos durante toda a tarde e a noite de 05/09), o que bloqueou o nº 4
(condições de crédito pela ótica do ofertante e Focus), que depende inteiramente do BCB.

**O que foi construído.** Sem coleta nova: o builder `pipeline/ufs.py` reúne o recorte
estadual de nove painéis em `ufs.json`, com posição entre as 27 UFs em cada régua e uma
síntese determinística por estado. Índice em `/observatorio/states` (aba "Estados" no
grupo Território) e uma página por UF em `/observatorio/states/{SIGLA}`, com título e
description gerados do gold, sitemap com as 27 rotas e ponte do Panorama para a página.

**Evidência** (golds publicados em 05/09/2026). São Paulo: R$ 2.273 bilhões de carteira
em 2026-07, 30,0% do Brasil, R$ 49.326 por habitante (4º), inadimplência de 3,76% (25º),
penetração de 306% da renda anual (2º), 416 de 645 municípios com agência.

**Próximo passo.** O painel nº 4 volta à fila assim que o BCB responder: a pesquisa
trimestral de condições de crédito e o Focus (Olinda) entram como cenários com
expectativas em vez de choques arbitrários.

## 15. Painel nº 4, metade estruturada: Focus nos Cenários (05/09/2026, noite)

O BCB voltou às 21h40 UTC e as 19 séries de crédito direcionado entraram no painel BNDES
(bloco de saldo aberto: R$ 3,22 trilhões direcionados em 2026-07, 44% da carteira; BNDES
com 18% de todo o crédito PJ). Na sequência, a metade estruturada do painel nº 4.

**O que foi construído.** Coletor do Focus (API Olinda), builder `pipeline/expectativas.py`
e o cartão "Expectativas de mercado (Focus)" na aba Cenários, com dois presets novos,
`focus_2026` e `focus_2027`, calculados como a distância entre a mediana do consenso e
o observado hoje, aplicados ao mesmo modelo de elasticidades. É a resposta ao item da
avaliação "Focus alimenta os presets de Cenários com expectativas em vez de choques
arbitrários".

**Evidência** (Focus de 2026-08-28; SGS de 05/09/2026). Selic esperada 13,75% (2026) e
12,00% (2027) contra meta de 14,00%; desocupação 5,4% e 5,9% contra 5,3%; câmbio R$ 5,20
e R$ 5,30 contra PTAX de R$ 5,15.

**O que ficou fora, e por quê.** A Pesquisa Trimestral de Condições de Crédito só existe
em PDF; a própria avaliação (§6) exclui qualquer fonte que dependa de PDF sem o gate da
Fase 2. A ótica do ofertante entra quando o BCB publicar a série estruturada.

## 16. Painel nº 5: entrantes e saídas do SFN (05/09/2026, noite)

**O que foi construído.** Coletor do cadastro de instituições em funcionamento (Unicad,
quatro relações), com histórico próprio de entradas, saídas e conversões a partir da
primeira coleta; builder que lê a presença trimestral no IF.data já coletado desde 2015
para entradas, saídas e conversões nominais; aba
`/observatorio/sfn-entries-exits` no grupo Instituições, em cinco seções (cadastro,
IF.data, nome a nome, regimes, método).

**Evidência** (BCB/Unicad, posição de 05/09/2026). 1.743 sedes autorizadas: 166 bancos,
752 cooperativas de crédito, 194 instituições de pagamento, 148 fintechs de crédito (136
SCD e 12 SEP), 130 administradoras de consórcio. IF.data (45 trimestres desde 2015-03):
1.430 reportantes em 2025-12, 92 entradas e 77 saídas nos quatro trimestres fechados;
cooperativas singulares são 51% dos reportantes.

**O que ficou declarado.** O cadastro não tem data de início; a história com nomes
nasce agora. Saída do IF.data não é quebra. As séries SGS de quantidade de sedes por
segmento param em 2022 e ficaram de fora.

## 17. Painel nº 6: conduta e enforcement (05/09/2026, noite)

**O que foi construído.** Dois coletores (quadros de PAS do BCB pela API Olinda;
processos sancionadores da CVM), o builder `pipeline/conduta.py` e a aba
`/observatorio/conduct-enforcement` no grupo Riscos e temas, em cinco seções (BCB, CVM,
recentes em ordem cronológica, reclamações, método). A regra editorial do §6, "nunca
ranking", virou trava de teste: a página não ordena instituições por multa, processo ou
reclamação, e as listas nominais são cronológicas.

**Evidência** (BCB/Gepad e CVM, consultas de 05/09/2026). BCB, 12 meses: 1.295 processos
decididos, 94% com multa, mediana de R$ 25 mil, R$ 75,8 milhões no total, 6
inabilitações, 389 inabilitados vigentes; 89% das multas do acervo pagas. Tempo mediano
entre citação e decisão: 2,8 meses, p90 de 29 meses. CVM: 68 processos abertos em 12
meses, 251 em curso com idade mediana de 23 meses.

**Inferência.** O enforcement do BCB é de alto volume e baixo valor unitário: a multa
padrão por atraso de remessa domina a distribuição (mediana e p90 iguais). O rito da CVM
é lento: quase um em quatro processos em curso passa de três anos.

## 18. Painel nº 7: emprego formal setorial (05/09/2026, madrugada)

**O que foi construído.** Um coletor novo (admissões e desligamentos por UF, Ipeadata),
42 séries novas do SGS (estoque do Novo Caged por seção CNAE, com e sem ajuste
sazonal), o builder `pipeline/emprego.py`, a aba `/observatorio/formal-employment` no
grupo Riscos e temas (Brasil, seções, UFs, score, método), o bloco de emprego nas 27
páginas por UF e, o que motivou o painel, a troca do componente "capacidade financeira"
do Risco setorial de demonstrativo (peso zero) para observado (peso 0,19, renormalizado
do 0,15 original). O portal do MTE não responde deste ambiente; as duas republicações
oficiais (BCB e Ipea) fecham entre si ao vínculo no Brasil, e a diferença é publicada.

**Evidência** (BCB/SGS e Ipeadata, consultas de 05/09/2026; dados até 2026-07,
preliminares). 48.082.866 vínculos formais; +880.717 em 12 meses (+1,87% a/a) contra
+1.537.837 nos 12 meses anteriores; +58.568 no mês (+29.068 com ajuste). Contra a
própria história desde 2013: agropecuária z −0,84 (−0,8% a/a), transformação z −0,03
(+0,2%), comércio z −0,33 (+1,1%), eletricidade e gás z +2,1 (+5,1%). Efeito no score
setorial: variação média de 2,0 pontos, máxima de 5,7; 21 atividades em "elevado" e 22
em "atenção" (antes 23 e 20).

**Inferência.** O mercado de trabalho formal desacelera pela metade em um ano, mas
segue positivo em quase todas as seções; contra a própria história, nada está em
contração salvo a agropecuária, que perde vínculos. Uma janela de z desde 2022 diria o
oposto (quase tudo "contração"), porque compararia o presente com o rebote
pós-pandemia; por isso a régua é a história completa, a mesma dos demais componentes.

**Recomendação.** Ler o componente de emprego como corte por seção, não por divisão: as
24 divisões da transformação recebem o mesmo z até que os microdados do MTE sejam
acessíveis. A massa salarial (salário de admissão) é a próxima régua útil e não tem
republicação pública por seção.

**Estado do §6 depois desta etapa.** Construídos: nº 1, 2, 3, 4 (metade Focus), 5, 6, 7
e 8. Restam nº 9 (funding e captação) e nº 10 (consórcios, prioridade baixa); a PTC
(outra metade do nº 4) espera dado estruturado do BCB.

## 19. Painel nº 9: funding e captação (06/09/2026, madrugada)

**O que foi construído.** Dois coletores novos (relatório Passivo do IF.data por instituição,
com 45 trimestres de história; bloco 5 do CDA da CVM, agregado por emissor), dezesseis
séries do SGS (meios de pagamento amplos), o builder `pipeline/funding.py` e a aba
`/observatorio/funding` no grupo Instituições, em quatro seções (sistema, bancos, fundos,
método). Três réguas declaradas e nunca somadas: o que o público tem aplicado, como cada
banco se financia (varejo, mercado, repasses) e quem, nos fundos, carrega o papel de cada
banco.

**Evidência** (BCB/SGS, BCB/IF.data e CVM, consultas de 05 e 06/09/2026). M4 de R$ 15,82
trilhões em 2026-07, +12,0% em 12 meses. IF.data 2026-03: R$ 13,96 trilhões captados por
1.046 instituições, 53% em varejo, 34% em mercado e 13% em repasses; cinco maiores com 64%;
S2 com 59% de mercado, S5 com 1%. CDA 2026-05: R$ 898,0 bilhões de papel bancário nos
fundos, 80% em letras financeiras, 16% em emissor ligado ao gestor, 42% vencendo em 12
meses; Bradesco R$ 160,9 bilhões (18%), Caixa R$ 88,0 bilhões, BTG R$ 82,2 bilhões. Em
2026-07, R$ 442,7 bilhões do bloco estavam sob sigilo, sem emissor, com liberação até
2027-01-27.

**Inferência.** O funding de mercado dos grandes bancos passa pelos fundos: para Santander,
BB, Votorantim e Daycoval, as letras financeiras em fundos equivalem a 70% a 96% do estoque
de LF mais dívida elegível a capital do balanço; para a Caixa, 32%. O sigilo de 90 dias
tira dois a três meses de visibilidade do CDA, e um painel que ignorasse isso mostraria
uma queda de metade do estoque em junho de 2026 que não existe.

**Recomendação.** Ler a dependência de mercado por segmento e modelo de negócio, não como
fragilidade em si. A próxima régua útil, custo de captação por instrumento e instituição,
não existe em fonte aberta; fica registrada como lacuna, não como estimativa.

**Estado do §6 depois desta etapa.** Construídos: nº 1, 2, 3, 4 (metade Focus), 5, 6, 7, 8
e 9. Resta o nº 10 (consórcios, prioridade baixa); a PTC (outra metade do nº 4) espera dado
estruturado do BCB.

