# Iniciativa 1, PR 2a (Grupo 2, Eficiência Estatal): evidências das 18 páginas

Capturas com sessão a 390 e 1440 px, primeira tela e página inteira, geradas por `npm run evidencias` sobre o build de produção local (4 vCPU, 16 GB), em 23/10/2026. `antes/`: build do `main` depois do PR 1, com as 57 rotas do Grupo 2. `depois-2a/`: esta branch, no commit `a7c63f2b2`, com as 18 rotas do PR 2a. As tabelas completas, com os links das capturas, estão em `antes/evidencias.md` e `depois-2a/evidencias.md`.

Resumo: axe 0 nas 36 capturas depois (antes também 0); nenhuma rolagem horizontal; cromo dentro do orçamento em todas (até 200 px a 390 e 230 px a 1440); nenhum erro de console; nenhuma requisição caiu no login.

| Rota | Molde (`painel-molde.test.ts`) | Axe a 390 e 1440 | Rolagem horizontal | Cromo a 1440 e 390 (px) | HTML |
|---|---|---|---|---|---|
| [`/eficiencia-estatal/habitacao`](https://scrutiniums.com/eficiencia-estatal/habitacao) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 162 KB (main: 138 KB) |
| [`/eficiencia-estatal/habitacao/aluguel-renda`](https://scrutiniums.com/eficiencia-estatal/habitacao/aluguel-renda) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 264 KB (main: 234 KB) |
| [`/eficiencia-estatal/habitacao/inadequacao`](https://scrutiniums.com/eficiencia-estatal/habitacao/inadequacao) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 271 KB (main: 235 KB) |
| [`/eficiencia-estatal/cultura`](https://scrutiniums.com/eficiencia-estatal/cultura) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 177 KB (main: 147 KB) |
| [`/eficiencia-estatal/cultura/recursos`](https://scrutiniums.com/eficiencia-estatal/cultura/recursos) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 174 KB (main: 142 KB) |
| [`/eficiencia-estatal/trabalho-renda`](https://scrutiniums.com/eficiencia-estatal/trabalho-renda) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 533 KB (main: 985 KB), exceção |
| [`/eficiencia-estatal/trabalho-renda/qualificacao`](https://scrutiniums.com/eficiencia-estatal/trabalho-renda/qualificacao) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | renderizada a pedido (main: renderizada a pedido) |
| [`/eficiencia-estatal/trabalho-renda/recursos`](https://scrutiniums.com/eficiencia-estatal/trabalho-renda/recursos) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 400 KB (main: 363 KB) |
| [`/eficiencia-estatal/assistencia-social`](https://scrutiniums.com/eficiencia-estatal/assistencia-social) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 233 KB (main: 194 KB) |
| [`/eficiencia-estatal/assistencia-social/acesso`](https://scrutiniums.com/eficiencia-estatal/assistencia-social/acesso) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 257 KB (main: 206 KB) |
| [`/eficiencia-estatal/assistencia-social/acompanhamento`](https://scrutiniums.com/eficiencia-estatal/assistencia-social/acompanhamento) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 339 KB (main: 272 KB) |
| [`/eficiencia-estatal/assistencia-social/cuidado`](https://scrutiniums.com/eficiencia-estatal/assistencia-social/cuidado) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 242 KB (main: 191 KB) |
| [`/eficiencia-estatal/assistencia-social/recursos`](https://scrutiniums.com/eficiencia-estatal/assistencia-social/recursos) | sim | 0 e 0 (antes: 0 e 0) | 0 | 187 e 138 | 230 KB (main: 189 KB) |
| [`/eficiencia-estatal/seguranca-alimentar`](https://scrutiniums.com/eficiencia-estatal/seguranca-alimentar) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 174 KB (main: 148 KB) |
| [`/eficiencia-estatal/seguranca-alimentar/acesso`](https://scrutiniums.com/eficiencia-estatal/seguranca-alimentar/acesso) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 297 KB (main: 259 KB) |
| [`/eficiencia-estatal/seguranca-alimentar/necessidades`](https://scrutiniums.com/eficiencia-estatal/seguranca-alimentar/necessidades) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 563 KB (main: 487 KB), exceção |
| [`/eficiencia-estatal/seguranca-alimentar/qualidade`](https://scrutiniums.com/eficiencia-estatal/seguranca-alimentar/qualidade) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 178 KB (main: 146 KB) |
| [`/eficiencia-estatal/seguranca-alimentar/recursos`](https://scrutiniums.com/eficiencia-estatal/seguranca-alimentar/recursos) | sim | 0 e 0 (antes: 0 e 0) | 0 | 228 e 183 | 277 KB (main: 249 KB) |

HTML: tamanho de `.next/server/app/<rota>.html`. "Renderizada a pedido" é rota que lê o recorte da URL no servidor e não tem HTML estático no build. Acima de 500 KB, exceção declarada até a Iniciativa 4 tratar o peso.
