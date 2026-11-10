# Agronegócio: método com porta de entrada por tarefa, páginas mais curtas e datas legíveis

03/11/2026. Item 5 da auditoria de painéis. Medidas com sessão local sobre o build, Chromium do Playwright.

## O que mudou para o leitor

- `/agronegocio/metodologia` (página aberta): a abertura passa a oferecer quatro tarefas, no padrão da porta de entrada do
  Setor Elétrico: conferir o que está medido, saber de onde vem um número, ler a regra de um indicador e reproduzir sem
  rede. A cobertura por capítulo e por cadeia e os downloads ficam à vista; o mapa de cobertura (T8), as 20 fontes, as
  regras de interpretação, o dicionário de 31 indicadores e a seção de utilidade ficam em blocos recolhidos (`Recolhido`,
  conteúdo inteiro no HTML). Os links `#fonte-<id>` das outras páginas continuam abrindo a fonte certa
  (`AbrirDestinoDaAncora`).
- `/agronegocio/panorama` e `/agronegocio/empresas-trabalho`: a tabela dos 36 meses do emprego formal da seção A fica
  recolhida, como já era a do crédito rural; a exportação em CSV continua ao lado.
- Datas cruas trocadas por texto em português em todo o Agro: data de processamento do snapshot do crédito
  ("24/09/2026"), janelas e referências de período ("ago. de 2025 a jul. de 2026"), eixos e legendas das séries,
  data e hora de captura das fontes no método ("17/10/2026, 18h03 UTC"), coluna de período na síntese para impressão e na
  ficha de cada cadeia, e o método da entrada. Os CSVs mantêm o formato ISO.

## Medidas (px, altura da página)

| Rota | 390 antes | 390 depois | 1440 antes | 1440 depois |
|---|---|---|---|---|
| /agronegocio/metodologia | 30.036 | 11.187 | 19.571 | 5.279 |
| /agronegocio/panorama | 22.095 | 8.232 | 12.470 | 6.268 |
| /agronegocio/empresas-trabalho | 22.859 | 8.995 | 12.248 | 6.046 |

"Antes" é a medição da auditoria de 03/11/2026 (mesmo build base, commit `caeb315`).

Datas cruas no texto visível (regra `DATA_CRUA` dos testes do Setor Elétrico), nas rotas conferidas: 0 em
`/agronegocio/metodologia`, `/panorama`, `/empresas-trabalho`, `/credito-protecao`, `/sintese`, `/cadeias/soja` e
`/politicas-inclusao`. Em `/conjuntura`, `/insumos` e na entrada, a regra ainda acusa "2024/25": é o ano-safra, notação
da fonte, mantida.

axe (wcag2a, wcag2aa, best-practice), 390 e 1440 px, com sessão: 0 violações nas nove rotas medidas.

## Limites

- `/agronegocio/aprenda` (19.666 px a 390) e `/agronegocio/glossario` (15.724 px) continuam longas: são o catálogo de
  tarefas e o glossário, listas de consulta. Não foram tocadas neste item.
- Leitor de tela e aparelho físico não verificados.
