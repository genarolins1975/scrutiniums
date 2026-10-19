# Avaliação das páginas: acessibilidade e responsividade

Registro exigido pelo `PLANO_IMPLEMENTACAO.md` (notas abaixo de 9 e verificações por página). Primeira rodada: 19/10/2026, Onda 1 da banca (`docs/BANCA_2026-10-19.md`).

## Como foi medido

- Aplicativo local (`next dev`) no branch da Onda 1, com sessão de desenvolvimento nas páginas com conta e sem sessão nas abertas.
- **axe-core 4.12** com as regras WCAG 2.0 e 2.1, níveis A e AA, na tela de 1440 px.
- **Teclado:** 40 tabulações a partir do topo; para cada foco, conferido se há indicação visível (contorno, sombra ou sublinhado) e se o foco avança sem armadilha.
- **Reflow e zoom de 200%:** rolagem horizontal medida a 1440 px, a 720 px com fator de escala 2 (equivalente a 200% em 1440) e a 390 px.
- **Não verificado nesta rodada:** leitor de tela (NVDA, VoiceOver ou TalkBack) e ampliação de texto isolada. A verificação automática não comprova conformidade integral.

## Resultado

| Página | Acesso | axe (violações) | Rolagem horizontal 1440 / 200% / 390 | Foco visível nas 40 tabulações |
|---|---|---|---|---|
| `/` | aberta | 0 | 0 / 0 / 0 | sim |
| `/perguntas/familias` | aberta | 0 | 0 / 0 / 0 | sim |
| `/observatorio-do-credito` | aberta | 0 (8 de contraste corrigidas nesta rodada) | 0 / 0 / 0 | sim |
| `/setor-eletrico/conta-de-luz` | aberta | 0 | 0 / 0 / 0 | sim |
| `/saneamento/municipio/2611606` | aberta | 0 | 0 / 0 / 0 | sim |
| `/saneamento/preco-regulado/simulador` | aberta | 0 | 0 / 0 / 0 | sim |
| `/eficiencia-estatal` | aberta | 0 | 0 / 0 / 0 | sim |
| `/gas-natural/gas-de-cozinha` | aberta | 0 | 0 / 0 / 0 | sim |
| `/territorio/metodologia` | aberta | 0 | 0 / 0 / 0 | sim |
| `/setor-eletrico` | com conta | 0 | 0 / 0 / 0 | sim |
| `/gas-natural` | com conta | 0 | 0 / 0 / 0 | sim |
| `/saneamento` | com conta | 0 | 0 / 0 / 0 | sim |
| `/contas-publicas` | com conta | 0 | 0 / 0 / 0 | sim |
| `/agronegocio` | com conta | 0 | 0 / 0 / 0 | sim |
| `/territorio` | com conta | 0 | 0 / 0 / 0 | sim |
| `/observatorio/map` (Crédito) | com conta | 0 | 0 / 0 / 0 | sim |
| `/eficiencia-estatal/indice-de-resultados` | com conta | 0 | 0 / 0 / 0 | sim |
| `/territorio/queimadas` | com conta | 0 | 0 / 0 / 0 | sim |

Correção feita: os rótulos das áreas na página aberta do Crédito e as categorias de sugestão no admin usavam bronze (`#966B48`) em texto pequeno sobre papel, abaixo de 4,5:1; passaram a bronze escuro (`#7C5638`).

## Pendências

- Teste com leitor de tela nas seis entradas e nas cinco consultas abertas.
- Ampliação de texto a 200% sem zoom de página (reflow de texto).
- Repetir a rodada a cada onda e acrescentar as páginas novas.
