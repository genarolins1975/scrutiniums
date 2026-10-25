### Evidências de página (2026-10-25)

Build -LZ0-TcyTMT-umqSvuZcs, `next start` local com banco temporário e sessão de teste. Máquina: 5 vCPU, 33 GB. Comando: `npm run evidencias -- --rotas /saneamento /perguntas/energia-e-infraestrutura --larguras 390,1440 --saida docs/ux-2026-10-25/saneamento-s1-c`. Tempo: 0 min 42 s.

Cromo: do topo da barra comum ao início do conteúdo, em px, com o orçamento da Iniciativa 2 a 390 e 1440 px. Axe: violações WCAG 2.1 A e AA (regra e número de nós). Login: requisições feitas pela página (arquivos, dados, APIs) que caíram em /entrar; o redirecionamento da própria página aparece na coluna Endereço final.

| Rota | Sessão | Largura | HTTP | Endereço final | Cromo (px) | H1 na 1ª tela | Rolagem horizontal | Axe | Erros de console | Login | Captura |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/saneamento` | sem | 390 | 200 | `/entrar?de=%2Fsaneamento` | sem barra comum | sim | não | 0 | 0 | 0 | [página](saneamento-390-sem-sessao.jpg) · [1ª tela](saneamento-390-sem-sessao-primeira-tela.jpg) |
| `/saneamento` | sem | 1440 | 200 | `/entrar?de=%2Fsaneamento` | sem barra comum | sim | não | 0 | 0 | 0 | [página](saneamento-1440-sem-sessao.jpg) · [1ª tela](saneamento-1440-sem-sessao-primeira-tela.jpg) |
| `/saneamento` | com | 390 | 200 |  | 195 (até 200) | sim | não | 0 | 0 | 0 | [página](saneamento-390-com-sessao.jpg) · [1ª tela](saneamento-390-com-sessao-primeira-tela.jpg) |
| `/saneamento` | com | 1440 | 200 |  | 222 (até 230) | sim | não | 0 | 0 | 0 | [página](saneamento-1440-com-sessao.jpg) · [1ª tela](saneamento-1440-com-sessao-primeira-tela.jpg) |
| `/perguntas/energia-e-infraestrutura` | sem | 390 | 200 |  | 101 (até 200) | sim | não | 0 | **2** | **1** | [página](perguntas_energia_e_infraestrutura-390-sem-sessao.jpg) · [1ª tela](perguntas_energia_e_infraestrutura-390-sem-sessao-primeira-tela.jpg) |
| `/perguntas/energia-e-infraestrutura` | sem | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | **2** | **1** | [página](perguntas_energia_e_infraestrutura-1440-sem-sessao.jpg) · [1ª tela](perguntas_energia_e_infraestrutura-1440-sem-sessao-primeira-tela.jpg) |
| `/perguntas/energia-e-infraestrutura` | com | 390 | 200 |  | 101 (até 200) | sim | não | 0 | 0 | **1** | [página](perguntas_energia_e_infraestrutura-390-com-sessao.jpg) · [1ª tela](perguntas_energia_e_infraestrutura-390-com-sessao-primeira-tela.jpg) |
| `/perguntas/energia-e-infraestrutura` | com | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | 0 | **1** | [página](perguntas_energia_e_infraestrutura-1440-com-sessao.jpg) · [1ª tela](perguntas_energia_e_infraestrutura-1440-com-sessao-primeira-tela.jpg) |

**/perguntas/energia-e-infraestrutura**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=pl03w`

**/perguntas/energia-e-infraestrutura**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=pl03w`

**/perguntas/energia-e-infraestrutura**, com sessão, 390 px:
- caiu no login: `/entrar?_rsc=pl03w`

**/perguntas/energia-e-infraestrutura**, com sessão, 1440 px:
- caiu no login: `/entrar?_rsc=pl03w`
