### Evidências de página (2026-10-23)

Build sQkjwruR6DBV5LyLyiEJ1, `next start` local com banco temporário e sessão de teste. Máquina: 4 vCPU, 16 GB. Comando: `npm run evidencias -- --rotas / /observatorio-do-credito /saneamento/municipio /perguntas/familias /buscar /setor-eletrico/conta-de-luz --saida docs/ux-2026-10-23/evidencias --larguras 390,1440 --modos sem,com`. Tempo: 1 min 16 s.

Cromo: do topo da barra comum ao início do conteúdo, em px, com o orçamento da Iniciativa 2 a 390 e 1440 px. Axe: violações WCAG 2.1 A e AA (regra e número de nós). Login: requisições feitas pela página (arquivos, dados, APIs) que caíram em /entrar; o redirecionamento da própria página aparece na coluna Endereço final.

| Rota | Sessão | Largura | HTTP | Endereço final | Cromo (px) | H1 na 1ª tela | Rolagem horizontal | Axe | Erros de console | Login | Captura |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | sem | 390 | 200 |  | 145 (até 200) | sim | não | 0 | **1** | **1** | [página](inicio-390-sem-sessao.jpg) · [1ª tela](inicio-390-sem-sessao-primeira-tela.jpg) |
| `/` | sem | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](inicio-1440-sem-sessao.jpg) · [1ª tela](inicio-1440-sem-sessao-primeira-tela.jpg) |
| `/` | com | 390 | 200 | `/app/observatorios` | 102 (até 200) | sim | não | 0 | 0 | 0 | [página](inicio-390-com-sessao.jpg) · [1ª tela](inicio-390-com-sessao-primeira-tela.jpg) |
| `/` | com | 1440 | 200 | `/app/observatorios` | 151 (até 230) | sim | não | 0 | 0 | 0 | [página](inicio-1440-com-sessao.jpg) · [1ª tela](inicio-1440-com-sessao-primeira-tela.jpg) |
| `/observatorio-do-credito` | sem | 390 | 200 |  | 158 (até 200) | sim | não | 0 | **1** | **1** | [página](observatorio_do_credito-390-sem-sessao.jpg) · [1ª tela](observatorio_do_credito-390-sem-sessao-primeira-tela.jpg) |
| `/observatorio-do-credito` | sem | 1440 | 200 |  | 163 (até 230) | sim | não | 0 | **1** | **1** | [página](observatorio_do_credito-1440-sem-sessao.jpg) · [1ª tela](observatorio_do_credito-1440-sem-sessao-primeira-tela.jpg) |
| `/observatorio-do-credito` | com | 390 | 200 |  | 158 (até 200) | sim | não | 0 | 0 | **1** | [página](observatorio_do_credito-390-com-sessao.jpg) · [1ª tela](observatorio_do_credito-390-com-sessao-primeira-tela.jpg) |
| `/observatorio-do-credito` | com | 1440 | 200 |  | 163 (até 230) | sim | não | 0 | 0 | **1** | [página](observatorio_do_credito-1440-com-sessao.jpg) · [1ª tela](observatorio_do_credito-1440-com-sessao-primeira-tela.jpg) |
| `/saneamento/municipio` | sem | 390 | 200 |  | 138 (até 200) | sim | não | 0 | 0 | 0 | [página](saneamento_municipio-390-sem-sessao.jpg) · [1ª tela](saneamento_municipio-390-sem-sessao-primeira-tela.jpg) |
| `/saneamento/municipio` | sem | 1440 | 200 |  | 187 (até 230) | sim | não | 0 | 0 | 0 | [página](saneamento_municipio-1440-sem-sessao.jpg) · [1ª tela](saneamento_municipio-1440-sem-sessao-primeira-tela.jpg) |
| `/saneamento/municipio` | com | 390 | 200 |  | 138 (até 200) | sim | não | 0 | 0 | 0 | [página](saneamento_municipio-390-com-sessao.jpg) · [1ª tela](saneamento_municipio-390-com-sessao-primeira-tela.jpg) |
| `/saneamento/municipio` | com | 1440 | 200 |  | 187 (até 230) | sim | não | 0 | 0 | 0 | [página](saneamento_municipio-1440-com-sessao.jpg) · [1ª tela](saneamento_municipio-1440-com-sessao-primeira-tela.jpg) |
| `/perguntas/familias` | sem | 390 | 200 |  | 101 (até 200) | sim | não | 0 | **2** | **1** | [página](perguntas_familias-390-sem-sessao.jpg) · [1ª tela](perguntas_familias-390-sem-sessao-primeira-tela.jpg) |
| `/perguntas/familias` | sem | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | **2** | **1** | [página](perguntas_familias-1440-sem-sessao.jpg) · [1ª tela](perguntas_familias-1440-sem-sessao-primeira-tela.jpg) |
| `/perguntas/familias` | com | 390 | 200 |  | 101 (até 200) | sim | não | 0 | 0 | **1** | [página](perguntas_familias-390-com-sessao.jpg) · [1ª tela](perguntas_familias-390-com-sessao-primeira-tela.jpg) |
| `/perguntas/familias` | com | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | 0 | **1** | [página](perguntas_familias-1440-com-sessao.jpg) · [1ª tela](perguntas_familias-1440-com-sessao-primeira-tela.jpg) |
| `/buscar` | sem | 390 | 200 |  | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar-390-sem-sessao.jpg) · [1ª tela](buscar-390-sem-sessao-primeira-tela.jpg) |
| `/buscar` | sem | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar-1440-sem-sessao.jpg) · [1ª tela](buscar-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar` | com | 390 | 200 |  | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar-390-com-sessao.jpg) · [1ª tela](buscar-390-com-sessao-primeira-tela.jpg) |
| `/buscar` | com | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar-1440-com-sessao.jpg) · [1ª tela](buscar-1440-com-sessao-primeira-tela.jpg) |
| `/setor-eletrico/conta-de-luz` | sem | 390 | 200 |  | 138 (até 200) | sim | não | 0 | 0 | 0 | [página](setor_eletrico_conta_de_luz-390-sem-sessao.jpg) · [1ª tela](setor_eletrico_conta_de_luz-390-sem-sessao-primeira-tela.jpg) |
| `/setor-eletrico/conta-de-luz` | sem | 1440 | 200 |  | 187 (até 230) | sim | não | 0 | 0 | 0 | [página](setor_eletrico_conta_de_luz-1440-sem-sessao.jpg) · [1ª tela](setor_eletrico_conta_de_luz-1440-sem-sessao-primeira-tela.jpg) |
| `/setor-eletrico/conta-de-luz` | com | 390 | 200 |  | 138 (até 200) | sim | não | 0 | 0 | 0 | [página](setor_eletrico_conta_de_luz-390-com-sessao.jpg) · [1ª tela](setor_eletrico_conta_de_luz-390-com-sessao-primeira-tela.jpg) |
| `/setor-eletrico/conta-de-luz` | com | 1440 | 200 |  | 187 (até 230) | sim | não | 0 | 0 | 0 | [página](setor_eletrico_conta_de_luz-1440-com-sessao.jpg) · [1ª tela](setor_eletrico_conta_de_luz-1440-com-sessao-primeira-tela.jpg) |

**/**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=19zvn`

**/**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=19zvn`

**/observatorio-do-credito**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=60y23`

**/observatorio-do-credito**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=60y23`

**/observatorio-do-credito**, com sessão, 390 px:
- caiu no login: `/entrar?_rsc=60y23`

**/observatorio-do-credito**, com sessão, 1440 px:
- caiu no login: `/entrar?_rsc=60y23`

**/perguntas/familias**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=18gtu`

**/perguntas/familias**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=18gtu`

**/perguntas/familias**, com sessão, 390 px:
- caiu no login: `/entrar?_rsc=18gtu`

**/perguntas/familias**, com sessão, 1440 px:
- caiu no login: `/entrar?_rsc=18gtu`

**/buscar**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`
