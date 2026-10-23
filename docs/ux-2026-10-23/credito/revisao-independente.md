# Revisão independente da rubrica: Crédito 2 (tipografia, números, selos, datas e tokens)

Data: 23/10/2026. Revisor: sessão separada da que implementou o PR (subagente de revisão, sem participação no código).
Branch avaliada: `claude/new-session-x7bxqf`, commits `5b4079e88`, `d7acb55db` e `6b41c3ea0` sobre `origin/main`.

## Escopo

Cinco rotas exigidas pelo critério de aceite da Iniciativa 2 (prompt, seção 7): `/observatorio/credit`,
`/observatorio/payroll-lending-aging`, `/observatorio/pix`, `/observatorio/sectors` e `/observatorio/subnational-credit`, com
sessão, a 390 e a 1440 px. Rubrica: seção 10 de `.claude/skills/observatorio-layout/SKILL.md`, com os anexos
`identidade-visual.md` (tipografia, números e datas) e `componentes-e-graficos.md` (número de destaque, tabela, rótulos de medida).

## Método

1. Leitura do núcleo da skill, dos dois anexos e das seções 4.3, 4.4 e 7 do prompt da iniciativa.
2. Leitura de todas as capturas de página inteira e de primeira tela em `docs/ux-2026-10-23/credito/pr2/`, cortadas em faixas
   para leitura sem redução, e comparação com as do PR 1 em `docs/ux-2026-10-23/credito/` (mesmas rotas e larguras).
3. Leitura de `pr2/evidencias.md` (cromo, axe, console, login).
4. Leitura do diff `origin/main...HEAD` em `public/obs`, `src/app/globals.css` e `public/observatorios.css`, e dos pontos do
   `app.js` e de `pipeline/pix.py` que produzem os textos citados.

Limites: não houve navegador nesta revisão; teclado, toque, foco e leitor de tela não foram testados à mão. A nota de
"Interação e acessibilidade" se apoia só no axe e no console e por isso não passa de 8. Sem sessão não foi avaliado (as rotas
exigem conta).

## O que melhorou em relação ao PR 1 (evidência: capturas pareadas)

- Datas na tela: "Dados até ago/2026" no lugar de "2026-08"; "processado em … UTC" saiu da abertura e foi para "Fontes, datas e
  siglas" no horário de Brasília (`linhaRecorte` em `public/obs/app.js`).
- Cor de julgamento: setas e variações verdes e vermelhas saíram (`.up, .down, .neutral { color: var(--text-2) }`,
  `public/obs/styles.css:235`); classes `good` fora.
- Selos: "DADO OBSERVADO" em verde virou "● Observado" neutro, com definição no `title` (`seloHtml`, `NATUREZA_SELO`).
- Escala: `--fs-*` e tamanhos soltos saíram; tudo lê `--tipo-*` de `globals.css` pelo `tokens.css` derivado; `--cor-credito-*`
  e tema escuro saíram.
- Leads sem seta nem travessão.

## Tabela de notas (0 a 10; aceite exige no mínimo 8 em cada célula)

| Critério | credit | payroll-lending-aging | pix | sectors | subnational-credit |
|---|---|---|---|---|---|
| Direção de arte | 7 | 7 | 6 | 7 | 7 |
| Hierarquia | 7 | 7 | 6 | 7 | 6 |
| Tipografia e acabamento | 5 | 6 | 4 | 5 | 6 |
| Densidade e profundidade | 7 | 8 | 6 | 8 | 7 |
| Didática visual | 7 | 8 | 6 | 6 | 7 |
| Comparabilidade | 7 | 7 | 5 | 7 | 7 |
| Interação e acessibilidade | 8 (manual não verificado) | 8 (manual não verificado) | 5 | 8 (manual não verificado) | 8 (manual não verificado) |
| Responsividade | 6 | 6 | 6 | 5 | 7 |

Células abaixo de 8: 32 de 40. Nenhuma rota atinge o aceite.

## Achados por gravidade

Legenda: **E** evidência, **I** inferência, **R** recomendação. "Anterior" quer dizer presente também nas capturas do PR 1; conta
na nota porque a rubrica avalia a página como está.

### Gravidade 1: itens de reprovação da seção 10 (valor ilegível, perda de valores, sobreposição)

1. **Números em formato inglês na tela, inclusive na primeira tela do Pix.**
   E: `pr2/observatorio_pix-1440-com-sessao-primeira-tela.jpg`, síntese: "7.89 bilhões", "+15.3%", "R$ 3.81 trilhões", "+19.9%",
   "56.1%", "90.8%"; "2026-T2" em síntese, faixa e títulos. Origem: `pipeline/pix.py:377` (`{qtd0/1e9:.2f}`, `{yoy_q:.1f}`).
   Também "mínimo normativo: 99.9%" (pix 390), "ganho vs. ingênuo (h=12): 59.3%" e "qualidade 72.2" (credit 1440, cartões de
   Oferta), scores "69.2", "63.7" e "22.6%", "90.6% da própria carteira PJ" (sectors 1440), "IF.data 202606" (sectors).
   I: o PR 2 converteu datas, mas não números vindos de texto pronto da gold ou de `toFixed`. R: formatar no pipeline com vírgula
   decimal (ou passar números, não frases, para o `fmt.n`); trocar "2026-T2" por "2º tri/2026"; teste novo que reprove
   `\d\.\d` seguido de `%`, `bi`, `tri` ou fim de número em texto visível das cinco rotas.

2. **Rótulos de eixo cortados e sobrepostos (anterior).**
   E: credit 1440, Concessões: eixo "93.955", "66.076", "82.440" sem o primeiro dígito; "início da p" cortado em todos os
   gráficos com projeção; composição e contexto macro: ticks de minigráficos empilhados e ilegíveis ("3,6 1,9 0,2 8,6 6,9").
   Credit 390: eixo de Comparar séries mostra "25, 91, 57, 24, 90" no lugar de 225, 191, 157, 124, 90. Payroll 1440, "Saldo
   por vínculo do tomador": anotações de norma sobrepostas ("Nova elevaçãLei nº 15.179/2025", "MaMPnº 1.292/2025"). Pix 1440:
   "marjun/26" no eixo. Subnational 1440: "DCL ÷ RCL, 2" cortado. R: margem esquerda do SVG calculada pelo maior rótulo;
   no máximo 3 ticks em minigráfico; anotações de marco com rótulo numerado e legenda abaixo quando houver colisão.

3. **Perda silenciosa de valores a 390 px no dot plot de Risco setorial (anterior).**
   E: `pr2/observatorio_sectors-390-com-sessao.jpg` e captura do PR 1: eixo vai só de 30 a 40 e mostra 4 dos 43 pontos; não há
   indicação de rolagem. R: recalcular a escala para a largura do contêiner (30 a 70 cabem em 340 px) ou reduzir o domínio ao
   intervalo observado.

4. **Contraste no mapa de calor do Pix (anterior, conhecido).** E: axe `color-contrast` (10 nós) a 390 e 1440. Pix 390: números
   do mapa em teal sobre teal ilegíveis. R: texto da célula em tinta ou papel conforme a luminância do fundo.

### Gravidade 2: o contrato do PR 2 (números e selos) não foi cumprido nas capturas

5. **Algarismos de estilo antigo nos números de destaque.** E: zoom da faixa de `/observatorio/credit` a 1440: "7.397,7" e "5,04"
   com algarismos que descem da linha de base; o mesmo em payroll ("116.291"), pix e subnational. O CSS pede
   `font-variant-numeric: lining-nums tabular-nums` (`public/obs/styles.css`, bloco "Números na forma do NumeroIndicador").
   I: o arquivo `public/obs/fonts/playfair-display.woff2` não traz a feição `lnum` ou a regra não alcança o elemento.
   R: conferir as feições do arquivo (fontTools) e servir o mesmo arquivo de fonte das páginas Next; teste de navegador que
   compare a altura de "1" e "7" no valor.

6. **Um mesmo número em três ou quatro formas na mesma página.** E: credit 1440: "R$ 7.397,7 bi" (faixa), "R$ 7,40 tri"
   (cartão), "7.397.669" (rótulo do gráfico) e eixo em R$ milhões ("801.555"); "+9,20% a/a" na faixa e "▲ 9,2% a/a" no cartão.
   Sectors: "69,2" na síntese e "69.2" na tabela. R: uma unidade por medida na página (bi com uma casa), eixo na mesma unidade do
   valor; precisão única por medida.

7. **Duas formas de selo convivem, e selos em lugar errado.** E: faixa de números com "● Observado" em texto; cartões e títulos com
   caixa "● OBSERVADO" em caixa alta; selos ao lado do H1 em pix e subnational (natureza da página, não de um número); selo
   inserido no meio da frase em payroll ("As marcas indicam … [● OBSERVADO] Coincidência no tempo não é efeito"). Selo ausente
   em parte da faixa (pix: 1 de 5 números; payroll, segunda faixa: 3 de 5). R: uma forma só (a do SeloNatureza), sempre na
   linha do número; tirar selo do H1; todo número de destaque com selo.

8. **Variação ainda em símbolo, não em palavras com base.** E: "▲ 0,39 p.p. em 12 meses", "+9,20% a/a" (credit). O prompt 4.4
   pede "alta de 9,2% sobre ago/2025". A separação em linhas próprias é da etapa 2, mas a palavra e a base não dependem dela.
   Efeito na nota: quebra de linha desigual na faixa (credit 1440: colunas 3 e 4 com "ago/2026" em outra linha e o selo 20 px
   abaixo das colunas 1 e 2).

9. **Data de referência mensal escrita como dia.** E: payroll 1440, primeiro número: "SGS · 01/08/2026" para série mensal (deveria
   ser ago/2026). Subnational: série anual com eixo "jul/2008 … jul/2023" (anterior; antes "07/2008"). Sectors: "Dados até
   jun/2026" na abertura e "IBGE até ago/2026" nos números e no gráfico. R: `dataTela` deve receber a periodicidade; série
   anual com rótulo "2008"; "Dados até" igual à data dos números exibidos ou com a ressalva de qual fonte é a mais antiga.

### Gravidade 3: acabamento, didática e densidade

10. **Nomes sem acento e cortados.** E: pix "Comercio, reparacao de veiculos…", "Nao disponivel", "Pessoa Fisica"; sectors
    "BANCO NACIONAL DE", "MERCADO PAGO INSTI", "Comercio reparacao de veiculos automotores e m" (corte no meio da palavra);
    subnational "Banco Nacional de Desenvolviment…". R: tabela de rótulos com acento e nome curto oficial (BNDES), nome completo
    no `title` e na tabela de dados.
11. **Frase ambígua na síntese de Risco setorial.** E: "O maior score é de 3.12 Fabricação de produtos do fumo (69,2, …)": o leigo
    lê score 3.12. R: "A atividade com maior score é Fabricação de produtos do fumo (CNAE 3.12): 69,2".
12. **Precisão espúria e zero aparente.** E: "367.453,00 toneladas" (credit); "0,00 bi" e "0,0%" para fluxos que existem (pix,
    Governo → Pessoa, Pix Troco "0,0 mi"). R: casas pela grandeza; "menos de 0,01 bi" quando o valor não é zero.
13. **Cor igual para séries distintas.** E: pix 1440, "Participação na quantidade": Pix e Cartão de débito no mesmo teal. R:
    `--serie-*` distintos e rótulo direto.
14. **Tabelas com números quebrados ou à esquerda.** E: subnational "R$ 225,1 bi" em três linhas e "R$ 26,8 / bi"; sectors coluna
    Score e Volume alinhadas à esquerda. R: `white-space: nowrap` nas células numéricas e `td.num` em todas.
15. **Abertura com espaço morto e competição.** E: "Fontes, datas e siglas" e "ações ▾" em linhas separadas, "ações" a 1.160 px
    do texto (credit 1440); a 390 o primeiro número cai abaixo da dobra. Síntese em serifa de 20 px com 9 linhas em subnational
    compete com o H1. R: "Fontes, datas e siglas" e "ações" na mesma linha; síntese em `.t-lead` sans ou limitada a 3 linhas.
16. **Duplicação de proveniência nos cartões do Pulso** (linha "Fonte: … Atualizado …" e linha "BCB/SGS · série … coletado …").
    R: uma linha.
17. **Linhas de tabela com centenas de pixels vazios a 390 px** (payroll, "Candidato a mecanismo"; anterior). R: tirar a altura
    fixa herdada da versão em cartões.

### Observação fora das cinco rotas

- `public/obs/atlas.css`, regra `@media(max-width:650px)`: tamanhos de 12 e 14 px (nome e número da etapa, `small`, `span`) e 27 px
  do `h4` viraram todos `var(--tipo-numero-m)` (28 px); o número da etapa fica com 28 px num círculo de 26 px. Afeta
  `/observatorio/map` no celular. R: mapear 12 px para `--tipo-rotulo`, 14 px para `--tipo-tabela`, 27 px para `--tipo-h2`.
- `pr2/observatorio_institutions-390-com-sessao.jpg` tem 0 byte (evidência perdida).

## Veredito

**Não atinge o aceite.** Nenhuma das cinco rotas tem nota 8 em todos os critérios; Tipografia e acabamento fica entre 4 e 6 em
todas, e há itens de reprovação da seção 10 (valores ilegíveis por corte e sobreposição, perda de valores a 390 px em sectors,
números em formato inglês, contraste no pix). O PR 2 entregou a parte de tokens, datas da abertura, cor de julgamento e escala,
mas o contrato de número (algarismos alinhados, forma única, selo único na linha do número, padrão brasileiro) não aparece nas
capturas. Prioridade para a próxima rodada: itens 1, 5, 6 e 7 (escopo do próprio PR 2), depois 2, 3 e 9; depois refazer as
evidências e uma nova revisão independente.
