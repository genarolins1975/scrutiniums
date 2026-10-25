# Prompt para o Codex: Educação, do painel correto ao painel que ensina

Repositório `genarolins1975/scrutiniums`, a partir da main. Escrito em 25/10/2026 a partir de `docs/ux-2026-10-25/educacao/ANALISE.md`; leia essa análise antes de começar. Responda e escreva tudo em português do Brasil.

## 1. Papel e regra de ouro

Você é diretor de arte editorial, designer de informação e engenheiro de front end da Scrutiniums. O leitor é leigo; o rigor é máximo. Prioridade do dono, nesta ordem: **clareza, narrativa, didatismo, credibilidade, quantidade de funcionalidades**.

Regra de ouro: **nenhum número, série, mapa ou artefato sem dado real da gold, com unidade, período, universo e fonte ao lado**. Ausência nunca vira zero nem estimativa. Nada planejado, incompleto ou simulado aparece como funcionalidade. Nenhuma frase ou cor sugere julgamento ("bom", "ruim", "eficiente"), causa ou ranking de gestão a partir de um indicador.

## 2. Leia antes de qualquer edição

1. `CLAUDE.md` e `AGENTS.md`.
2. `.claude/skills/observatorio-layout/SKILL.md` inteiro e os anexos `arquiteturas.md`, `componentes-e-graficos.md`, `acesso.md`, `navegacao.md`, `identidade-visual.md` e `tema-acessibilidade-exemplos.md`. Em conflito, esta skill prevalece.
3. As três skills de design obrigatórias: `.claude/skills/emil-design-eng/SKILL.md`, `.claude/skills/impeccable/SKILL.md` e `.claude/skills/design-taste-frontend/SKILL.md`, junto com o arquivo `references/app-screens.md` desta última. O painel é tela de trabalho, não landing page. O executável do impeccable não está no repositório; siga o caminho "Launcher unavailable" descrito no SKILL.md dele.
4. O código atual:
   * `src/components/educacao/` (`PainelEducacao.tsx`, `Graficos.tsx`, `LaboratorioIdeb.tsx`, `BuscaEducacao.tsx`, `educacao.css`);
   * `src/lib/educacao/` (`tipos.ts`, `dados.ts`, `paginas.ts`, `convite.ts`, `csv.ts`, `formato.ts`);
   * `src/app/educacao-municipal/` e `src/app/aperitivo/educacao-municipal/`;
   * `pipeline/educacao/` (`gold.py`, `validacoes.py`, `run.py`);
   * o painel das capitais em `src/app/eficiencia-estatal/educacao-municipal-capitais/` e `src/components/eficiencia/` (`PanoramaInterativo.tsx`, `ExploradorTema.tsx`, `ComparadorCapitais.tsx`).
5. Peças a reaproveitar, sem criar paralelas:
   * envelopes e moldes: `EntradaColecao`, `NumeroEscala`, `ModeloDidatico`, `Recolhido`, `SeloProntidao` e `RecursoResultado` (todos em `src/components/observatorios/`);
   * mapa: `MapaCoropletico` (`src/components/energia/`), com `URL_GEO` de `src/lib/energia/geo.ts`, como faz `src/components/saneamento/AtlasMunicipal.tsx`;
   * ficha de entidade: o padrão de `src/app/saneamento/municipio/[id]/page.tsx`.
6. Os testes que fixam o painel:
   * de Educação: `src/tests/educacao.test.ts`, `src/tests/obee-educacao.test.ts` e `pipeline/tests/test_educacao.py`;
   * de molde, comprimento e acesso: `src/tests/entrada-molde.test.ts`, `src/tests/ux-orcamentos-comprimento.test.ts` e `src/tests/aperitivo.test.ts`.

## 3. Estado atual (medido em 25/10/2026, main `954c9a2e`)

* A cidade escolhida (`?ibge=`) aparece por volta de 1.710 px a 1440, abaixo de quatro números nacionais e do "Para você".
* A página com município mede 8.837 px a 1440 e 14.380 px a 390. O teto da entrada é de 6.500 e 11.000.
* Duas tabelas de 11 linhas por 8 colunas (componentes do Ideb por ano) estão abertas no meio da leitura.
* O mecanismo N × P aparece três vezes: o bloco estático, o laboratório do município e o laboratório do Brasil.
* Não há mapa, série nacional, série por UF, distribuição do Brasil ou da UF, contagem de metas alcançadas nem composição das matrículas por dependência, embora tudo isso esteja na gold.
* Nas capitais, cada medida vira três barras pretas (menor valor, mediana e maior valor). As 26 capitais só aparecem em tabela recolhida, e um bloco de escores "Não calculável" e "Pendente" ocupa o fim do panorama.
* O que está bom e deve ser preservado:
  * axe 0 e console 0;
  * ausências com motivo, nota de 2021 e ressalva de creche e pré escola;
  * rede municipal separada da pública;
  * porte e posição na UF;
  * o aperitivo aberto, mínimo e dentro do orçamento.

## 4. Objetivo

Transformar o painel de Educação no melhor painel didático da plataforma, no nível do Crédito (referência de entrada didática), sem perder nenhuma análise existente. Critério de sucesso:

* nota de 9 ou mais em cada critério da rubrica (seção 10 da skill), em cada página alterada;
* orçamentos de comprimento cumpridos com e sem município;
* a cidade do leitor na primeira tela de quem a escolheu;
* pelo menos quatro artefatos novos feitos com dado real.

## 5. Entregas, em três PRs separados e nesta ordem

Cada PR traz descrição para o leitor, evidências antes e depois, testes e limitações. **Não faça merge.** O dono autoriza cada um.

### PR 1. Hierarquia, ficha do município e orçamento (sem dado novo)

1. **Ficha do município, com conta**, em `/educacao-municipal/municipio/[ibge]`, no padrão do Saneamento.
   * Sem sessão, ela volta para `/educacao-municipal?ibge=<id>` (aperitivo), e nenhum arquivo fechado vaza.
   * Atualize `src/lib/rotasPublicas.ts` apenas se o teste de acesso exigir; não abra nada novo.
   * Confira no navegador, com e sem sessão, que nenhuma requisição cai no login.
   * Conteúdo da ficha, nesta ordem:
     1. identidade da cidade (UF, porte, população, código IBGE);
     2. extrato das duas etapas, com a cidade, o estado e o Brasil;
     3. as séries;
     4. "do que o Ideb é feito";
     5. comparação com a UF e com cidades do mesmo porte;
     6. matrículas;
     7. tabelas completas recolhidas;
     8. downloads com conta;
     9. método.
2. **Entrada (`/educacao-municipal`)**: quando houver `?ibge=`, o extrato da cidade (duas etapas, com o estado e o Brasil ao lado) sobe para logo depois da abertura, antes dos números nacionais, com o link "Ficha completa da cidade".
   * Se o molde `EntradaColecao` impedir isso, proponha no PR a mudança mínima no molde (por exemplo, uma fatia "Seu município" entre abertura e escala, ligada ao `ParaVoce`) e atualize `entrada-molde.test.ts` de propósito, dizendo por quê.
   * Sem município, a entrada continua como está.
3. **Um laboratório só.** O bloco estático N × P e o laboratório do Brasil saem da entrada. O laboratório fica na ficha, com a cidade, e no artefato da entrada com o Brasil, uma vez cada. Ele ganha:
   * botões rápidos "Aprovação de todos (P = 1)" e "Valor publicado";
   * um texto vivo que diz quanto o Ideb mudaria;
   * o envelope `ModeloDidatico` com a lista "O que este modelo deixa de fora".
4. **Tabelas brutas** de componentes por ano vão para `Recolhido`, inteiras no HTML. No lugar delas, entram **pequenos múltiplos** de N, P, Saeb de matemática e Saeb de português ao longo das edições, com quebras visíveis (sem linha onde não há dado) e 2021 anotado.
5. **Gráficos de série maiores**: largura total da coluna a 1440. O eixo continua começando em zero (é escala de 0 a 10, não barra), mas com marcações que leiam bem entre 2 e 8. A meta passa a ser lida, não só desenhada: marca cheia quando o Ideb publicado alcançou a meta do INEP naquela edição e vazada quando não alcançou, explicadas na legenda.
6. **Orçamento**: 6.500 px a 1440 e 11.000 a 390, na entrada com e sem `?ibge=`; meça com `scripts/ux-medidas.mjs`. Cromo a 768 px: reduza o que for possível sem mudar a barra comum (registre a medida antes e depois).

### PR 2. Artefatos com os dados que já existem

Toda derivação nova nasce no pipeline (`pipeline/educacao/gold.py`) com validação em `validacoes.py` e teste em `pipeline/tests/test_educacao.py`. Nenhum número já publicado pode mudar: confira com o hash da gold anterior e documente a nova versão da gold. Arquivo novo em `public/educacao/gold/` continua fechado; confira que responde com login sem sessão.

1. **"Aprendeu mais ou reprovou menos?"**, a decomposição da variação, na ficha e com a cidade.
   * O leitor escolhe duas edições (padrão: 2019 e 2025, ou as duas mais próximas com Ideb publicado).
   * A página mostra quanto da mudança do Ideb veio da aprendizagem (N) e quanto do fluxo (P).
   * Conta, com N e P da gold sem arredondar e Î = N × P:
     * contribuição de N = (ln N₁ − ln N₀) / (ln Î₁ − ln Î₀) × (Î₁ − Î₀);
     * contribuição de P = (Î₁ − Î₀) − contribuição de N.
   * Quando |Î₁ − Î₀| < 0,05, mostre apenas os dois movimentos (N e P) sem dividir a variação.
   * Diga que Î difere do Ideb publicado pelo arredondamento do INEP.
   * Envelope `ModeloDidatico`; a lista do que fica de fora inclui:
     * não é causa;
     * N e P não são independentes;
     * a mudança de alunos entre edições não é controlada.
2. **Placar das metas do INEP (2007 a 2021)**.
   * Na ficha: uma linha de oito edições, com "alcançou", "não alcançou" e "sem Ideb, com o motivo".
   * Na entrada: quantas redes municipais alcançaram a meta em cada edição, contra quantas tinham meta e Ideb (derivação nova no pipeline).
   * Linguagem: "alcançou a meta projetada pelo INEP". Nunca "bateu", "fracassou" nem cor de semáforo.
   * 2023 e 2025 sem meta, ditos.
3. **Mapa dos 5.571 municípios**, com conta, numa página nova da coleção (`/educacao-municipal/mapa`, destino na navegação da coleção; siga `anexos/navegacao.md`).
   * Ideb 2025 da rede municipal, anos iniciais e anos finais, escolhidos por controle.
   * `MapaCoropletico` com a geometria municipal existente e um arquivo compacto novo da gold (id, Ideb das duas etapas, motivo de ausência).
   * Classes fixas de meio ponto, paleta sequencial única e neutra, e "Sem Ideb" com textura própria e legenda com contagem por motivo.
   * Zoom por UF, a cidade escolhida destacada e tabela equivalente por UF ao lado.
   * Ressalva fixa: o mapa mostra resultado, não causa; cidades pequenas oscilam mais entre edições.
4. **A década do Ideb**, na entrada, recolhida se o orçamento pedir.
   * A linha nacional de 2005 a 2025 para as duas etapas (rede municipal), com 2021 anotado.
   * Pequenos múltiplos das 27 UFs (rede pública), mesma escala, ordenados por nome, nunca por valor.
5. **Onde a cidade está na distribuição**, na ficha: o histograma do Brasil e o da UF (20 faixas, já na gold), com a faixa da cidade marcada, mediana e quartis, e o número de redes. Hoje só o do porte aparece.
6. **Quem atende os alunos da cidade**, na ficha: barras 100% empilhadas por etapa (municipal, estadual, federal e privada), com os campos do Censo que já estão na gold. Ressalva de creche e pré escola mantida.

### PR 3. Educação nas capitais

1. **As 26 capitais à vista.** Troque as três barras de cada medida por um gráfico de pontos com as 26 capitais (rótulo direto, a capital selecionada destacada e a mediana marcada). Mantenha a tabela equivalente e o CSV. Use a mesma paleta do painel dos municípios; nada de barras pretas grossas.
2. **Do recurso ao resultado, educação**: adapte `RecursoResultado` como artefato do panorama.
   * Despesa na função 12 por habitante → por matrícula (a ponte da razão) → alunos por turma → aprovação → Ideb, com os números da capital escolhida.
   * Cada elo traz o universo e o ano próprios, e a frase fixa de que não há relação causal.
   * Envelope `ModeloDidatico`.
3. **Ponte da razão em destaque**: o `PonteDaRazao` de `ExploradorTema` vira laboratório no panorama. O leitor vê por que gasto por habitante e gasto por matrícula ordenam as capitais de jeitos diferentes.
4. **Escores não calculáveis** ("Como avaliar este serviço?") saem do corpo do panorama e vão para o método, com `SeloProntidao` "em preparação", sem link. Peça a confirmação do dono no PR, porque muda o que o leitor vê.

### Em qualquer PR que acrescente recurso ao painel com conta

Atualize `src/lib/educacao/convite.ts` para que o `ConviteAperitivo` liste, em palavras de leigo e com números do dado, o que o painel completo oferece a mais. O aperitivo não ganha gráfico, tabela, laboratório nem CSV; o teste `educacao.test.ts` fixa isso.

## 6. Restrições inegociáveis

* **Acesso**: todos os painéis exigem conta. A única página aberta do tema é a do aperitivo. Arquivos e CSVs continuam fechados. Confira com e sem sessão, nas três larguras.
* **Contrato editorial**:
  * sem julgamento, causalidade ou ranking de gestão;
  * ordenação neutra por padrão (nome ou código), com a ordenação por valor só por escolha do leitor;
  * zero, ausência, "não divulgado" e "não aplicável" sempre distintos.
* **Texto exibido**: sem hífen nem travessão (há teste); sem ano escrito à mão no código (2021 é a exceção já documentada); siglas explicadas na primeira vez.
* **Testes**: nunca apague, pule ou enfraqueça teste. Teste que fixa o desenho antigo muda junto com o redesenho, preservando os invariantes (natureza, período e prova de cada número, links válidos, estrutura declarada). Texto literal em teste novo só para texto decidido pelo dono, com a decisão citada no comentário.
* **Sem bibliotecas novas** de gráfico, mapa ou animação; use os componentes do projeto.
* **Movimento**: `transform` e `opacity`, abaixo de 300 ms, `ease-out` forte, com `prefers-reduced-motion`. Nada de contador animado nem animação no que o leitor usa toda hora.
* **Acessibilidade**: alvos de 44 px; foco visível; sliders e controles por teclado; descrição textual de cada gráfico; contraste de 4,5:1 (há teste no OBEE).

## 7. Como verificar antes de cada push

```sh
bash scripts/preparar-sessao.sh
npm run verificar:rapido
npm run verificar:pr          # o que o CI roda; reproduz qualquer falha
python3 -m unittest pipeline.tests.test_educacao -v
npm run build
npm run evidencias -- --rotas /educacao-municipal "/educacao-municipal?ibge=2800100" "/educacao-municipal?ibge=2611606" /educacao-municipal/municipio/2800100 /educacao-municipal/mapa /eficiencia-estatal/educacao-municipal-capitais --saida docs/ux-2026-10-25/educacao/<pr>/depois
```

Gere também o "antes" no commit de partida, com o mesmo comando. Abra cada captura nas três larguras, não só a primeira tela. Pontue cada página pela rubrica da seção 10 da skill, com a evidência ao lado; marque "não verificado" o que faltar. Teste com teclado o laboratório, a decomposição e o mapa.

## 8. O que não fazer

* Não refazer a identidade visual da plataforma nem a barra comum.
* Não trocar framework, não migrar estilo e não criar componente paralelo a `NumeroEscala`, `ModeloDidatico` ou `Recolhido`.
* Não usar dado sintético nem exemplo em produção; não estimar o que o INEP não publica.
* Não colocar o painel inteiro na página aberta.
* Não mexer em Crédito, Energia ou outros temas, salvo componente compartilhado, e então com teste dos consumidores.

## 9. Relatório final de cada PR

Uma página com:

* o que mudou para o leitor;
* as rotas com links;
* a tabela da rubrica antes e depois;
* as medidas de comprimento e cromo antes e depois;
* os testes rodados com resultado;
* o que não foi verificado;
* as decisões que ficam para o dono.
