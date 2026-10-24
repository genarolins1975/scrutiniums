# Iniciativa 1, PR 1 (Grupo 1): evidências das 30 páginas

Capturas com sessão a 390 e 1440 px, primeira tela e página inteira, geradas por `npm run evidencias` sobre o build de produção local (4 vCPU, 16 GB), em 23/10/2026. `antes/`: build do `main` com o kit (PR 0). `depois/`: esta branch, no commit `de9402356`, com a irmã inglesa da Tarifa Social de energia. As tabelas completas, com os links das capturas, estão em `antes/evidencias.md` e `depois/evidencias.md`.

Resumo: axe 0 nas 62 capturas depois (antes: 5 nós `scrollable-region-focusable` em assistência social, desastres e queimadas, resolvidos pela tabela do kit); nenhuma rolagem horizontal; cromo dentro do orçamento em todas (até 200 px a 390 e 230 px a 1440); nenhum erro de console; nenhuma requisição caiu no login.

| Rota | Molde (`painel-molde.test.ts`) | Axe a 390 e 1440 | Rolagem horizontal | Cromo a 1440 e 390 (px) | HTML |
|---|---|---|---|---|---|
| [`/agronegocio/atlas`](https://scrutiniums.com/agronegocio/atlas) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | renderizada a pedido (main: 695 KB) |
| [`/agronegocio/clima-ambiente`](https://scrutiniums.com/agronegocio/clima-ambiente) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 169 KB (main: 152 KB) |
| [`/agronegocio/prato`](https://scrutiniums.com/agronegocio/prato) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 417 KB (main: 529 KB) |
| [`/agronegocio/tamanho`](https://scrutiniums.com/agronegocio/tamanho) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 293 KB (main: 293 KB) |
| [`/combustiveis/no-meu-estado`](https://scrutiniums.com/combustiveis/no-meu-estado) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 212 KB (main: 156 KB) |
| [`/contas-publicas/metas`](https://scrutiniums.com/contas-publicas/metas) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 235 KB (main: 218 KB) |
| [`/contas-publicas/por-area`](https://scrutiniums.com/contas-publicas/por-area) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | renderizada a pedido (main: renderizada a pedido) |
| [`/eficiencia-estatal/assistencia-social/necessidades`](https://scrutiniums.com/eficiencia-estatal/assistencia-social/necessidades) | sim | 0 e 0 (antes: 1 e 0) | 0 | 187 e 138 | 197 KB (main: 156 KB) |
| [`/eficiencia-estatal/cultura/rede`](https://scrutiniums.com/eficiencia-estatal/cultura/rede) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 157 KB (main: 136 KB) |
| [`/eficiencia-estatal/educacao-municipal-capitais`](https://scrutiniums.com/eficiencia-estatal/educacao-municipal-capitais) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 313 KB (main: 268 KB) |
| [`/eficiencia-estatal/energia-conectividade`](https://scrutiniums.com/eficiencia-estatal/energia-conectividade) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 190 KB (main: 141 KB) |
| [`/eficiencia-estatal/habitacao/deficit`](https://scrutiniums.com/eficiencia-estatal/habitacao/deficit) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 251 KB (main: 222 KB) |
| [`/eficiencia-estatal/indice-de-resultados`](https://scrutiniums.com/eficiencia-estatal/indice-de-resultados) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 339 KB (main: 295 KB) |
| [`/eficiencia-estatal/judiciario/panorama`](https://scrutiniums.com/eficiencia-estatal/judiciario/panorama) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 167 KB (main: 142 KB) |
| [`/eficiencia-estatal/meio-ambiente-clima/riscos`](https://scrutiniums.com/eficiencia-estatal/meio-ambiente-clima/riscos) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 174 KB (main: 145 KB) |
| [`/eficiencia-estatal/mobilidade-transporte/tempo`](https://scrutiniums.com/eficiencia-estatal/mobilidade-transporte/tempo) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | renderizada a pedido (main: renderizada a pedido) |
| [`/eficiencia-estatal/saude-capitais`](https://scrutiniums.com/eficiencia-estatal/saude-capitais) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 600 KB (main: 517 KB), exceção |
| [`/eficiencia-estatal/saude-capitais/gastos`](https://scrutiniums.com/eficiencia-estatal/saude-capitais/gastos) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 656 KB (main: 576 KB), exceção |
| [`/eficiencia-estatal/seguranca-publica/estados`](https://scrutiniums.com/eficiencia-estatal/seguranca-publica/estados) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 604 KB (main: 571 KB), exceção |
| [`/eficiencia-estatal/trabalho-renda/acesso-ao-trabalho`](https://scrutiniums.com/eficiencia-estatal/trabalho-renda/acesso-ao-trabalho) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 1.793 KB (main: 1.743 KB), exceção |
| [`/gas-natural/gas-de-cozinha`](https://scrutiniums.com/gas-natural/gas-de-cozinha) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 760 KB (main: 423 KB), exceção |
| [`/gas-natural/gnv-e-gas-encanado`](https://scrutiniums.com/gas-natural/gnv-e-gas-encanado) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 484 KB (main: 337 KB) |
| [`/observatorio-do-credito/quanto-meu-banco-cobra`](https://scrutiniums.com/observatorio-do-credito/quanto-meu-banco-cobra) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | renderizada a pedido (main: renderizada a pedido) |
| [`/observatorio-do-credito/simulador-da-parcela`](https://scrutiniums.com/observatorio-do-credito/simulador-da-parcela) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | renderizada a pedido (main: renderizada a pedido) |
| [`/saneamento/municipio`](https://scrutiniums.com/saneamento/municipio) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 169 KB (main: 153 KB) |
| [`/saneamento/preco-regulado/simulador`](https://scrutiniums.com/saneamento/preco-regulado/simulador) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 509 KB (main: 387 KB), exceção |
| [`/saneamento/tarifa-social`](https://scrutiniums.com/saneamento/tarifa-social) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 1.284 KB (main: 1.268 KB), exceção |
| [`/setor-eletrico/inclusao-energetica/tarifa-social`](https://scrutiniums.com/setor-eletrico/inclusao-energetica/tarifa-social) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 635 KB (main: 631 KB), exceção |
| [`/territorio/desastres`](https://scrutiniums.com/territorio/desastres) | sim | 0 e 0 (antes: 2 e 0) | 0 | 187 e 138 | 301 KB (main: 353 KB) |
| [`/territorio/queimadas`](https://scrutiniums.com/territorio/queimadas) | sim | 0 e 0 (antes: 2 e 0) | 0 | 187 e 138 | 407 KB (main: 374 KB) |

HTML: tamanho de `.next/server/app/<rota>.html`. "Renderizada a pedido" é rota que lê o recorte da URL no servidor e não tem HTML estático no build. Acima de 500 KB, exceção declarada até a Iniciativa 4 tratar o peso.
