### Evidências de página (2026-11-10)

Conta local nova. Build 57UhU9cLie3VphqS27TAM, `next start` local com banco temporário e sessão de teste. Máquina: 4 vCPU, 16 GB. Comando: `npm run evidencias -- --larguras 390,1440 --modos sem --rotas / /perguntas/familias /perguntas/territorio-e-clima --saida docs/ux-2026-11-10/abertas`. Tempo: 0 min 19 s.

Cromo: do topo da barra comum ao início do conteúdo, em px, com o orçamento da Iniciativa 2 a 390 e 1440 px. Axe: violações WCAG 2.1 A e AA (regra e número de nós). Login: requisições feitas pela página (arquivos, dados, APIs) que caíram em /entrar; o redirecionamento da própria página aparece na coluna Endereço final.

| Rota | Sessão | Largura | HTTP | Endereço final | Cromo (px) | H1 na 1ª tela | Rolagem horizontal | Axe | Erros de console | Login | Captura |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | sem | 390 | 200 |  | 145 (até 200) | sim | não | 0 | 0 | 0 | [página](inicio-390-sem-sessao.jpg) · [1ª tela](inicio-390-sem-sessao-primeira-tela.jpg) |
| `/` | sem | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](inicio-1440-sem-sessao.jpg) · [1ª tela](inicio-1440-sem-sessao-primeira-tela.jpg) |
| `/perguntas/familias` | sem | 390 | 200 |  | 101 (até 200) | sim | não | 0 | **1** | 0 | [página](perguntas_familias-390-sem-sessao.jpg) · [1ª tela](perguntas_familias-390-sem-sessao-primeira-tela.jpg) |
| `/perguntas/familias` | sem | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | **1** | 0 | [página](perguntas_familias-1440-sem-sessao.jpg) · [1ª tela](perguntas_familias-1440-sem-sessao-primeira-tela.jpg) |
| `/perguntas/territorio-e-clima` | sem | 390 | 200 |  | 101 (até 200) | sim | não | 0 | **1** | 0 | [página](perguntas_territorio_e_clima-390-sem-sessao.jpg) · [1ª tela](perguntas_territorio_e_clima-390-sem-sessao-primeira-tela.jpg) |
| `/perguntas/territorio-e-clima` | sem | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | **1** | 0 | [página](perguntas_territorio_e_clima-1440-sem-sessao.jpg) · [1ª tela](perguntas_territorio_e_clima-1440-sem-sessao-primeira-tela.jpg) |

**/perguntas/familias**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)

**/perguntas/familias**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)

**/perguntas/territorio-e-clima**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)

**/perguntas/territorio-e-clima**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
