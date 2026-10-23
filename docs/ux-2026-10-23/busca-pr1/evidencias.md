### Evidências de página (2026-10-23)

Build ZlWOAOLLkn_MabrdFyCNw, `next start` local com banco temporário e sessão de teste. Máquina: 4 vCPU, 16 GB. Comando: `npm run evidencias -- --rotas /buscar?q=hospitais /buscar?q=juros do cartão /buscar?q=saneamneto /buscar?q=agências reguladoras --saida docs/ux-2026-10-23/busca-pr1 --larguras 390,1440`. Tempo: 0 min 49 s.

Cromo: do topo da barra comum ao início do conteúdo, em px, com o orçamento da Iniciativa 2 a 390 e 1440 px. Axe: violações WCAG 2.1 A e AA (regra e número de nós). Login: requisições feitas pela página (arquivos, dados, APIs) que caíram em /entrar; o redirecionamento da própria página aparece na coluna Endereço final.

| Rota | Sessão | Largura | HTTP | Endereço final | Cromo (px) | H1 na 1ª tela | Rolagem horizontal | Axe | Erros de console | Login | Captura |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/buscar?q=hospitais` | sem | 390 | 200 |  | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_hospitais-390-sem-sessao.jpg) · [1ª tela](buscar_q_hospitais-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=hospitais` | sem | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_hospitais-1440-sem-sessao.jpg) · [1ª tela](buscar_q_hospitais-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=hospitais` | com | 390 | 200 |  | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_hospitais-390-com-sessao.jpg) · [1ª tela](buscar_q_hospitais-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=hospitais` | com | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar_q_hospitais-1440-com-sessao.jpg) · [1ª tela](buscar_q_hospitais-1440-com-sessao-primeira-tela.jpg) |
| `/buscar?q=juros do cartão` | sem | 390 | 200 | `/buscar?q=juros%20do%20cart%C3%A3o` | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_juros_do_cart_o-390-sem-sessao.jpg) · [1ª tela](buscar_q_juros_do_cart_o-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=juros do cartão` | sem | 1440 | 200 | `/buscar?q=juros%20do%20cart%C3%A3o` | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_juros_do_cart_o-1440-sem-sessao.jpg) · [1ª tela](buscar_q_juros_do_cart_o-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=juros do cartão` | com | 390 | 200 | `/buscar?q=juros%20do%20cart%C3%A3o` | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_juros_do_cart_o-390-com-sessao.jpg) · [1ª tela](buscar_q_juros_do_cart_o-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=juros do cartão` | com | 1440 | 200 | `/buscar?q=juros%20do%20cart%C3%A3o` | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar_q_juros_do_cart_o-1440-com-sessao.jpg) · [1ª tela](buscar_q_juros_do_cart_o-1440-com-sessao-primeira-tela.jpg) |
| `/buscar?q=saneamneto` | sem | 390 | 200 |  | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_saneamneto-390-sem-sessao.jpg) · [1ª tela](buscar_q_saneamneto-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=saneamneto` | sem | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_saneamneto-1440-sem-sessao.jpg) · [1ª tela](buscar_q_saneamneto-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=saneamneto` | com | 390 | 200 |  | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_saneamneto-390-com-sessao.jpg) · [1ª tela](buscar_q_saneamneto-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=saneamneto` | com | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar_q_saneamneto-1440-com-sessao.jpg) · [1ª tela](buscar_q_saneamneto-1440-com-sessao-primeira-tela.jpg) |
| `/buscar?q=agências reguladoras` | sem | 390 | 200 | `/buscar?q=ag%C3%AAncias%20reguladoras` | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_ag_ncias_reguladoras-390-sem-sessao.jpg) · [1ª tela](buscar_q_ag_ncias_reguladoras-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=agências reguladoras` | sem | 1440 | 200 | `/buscar?q=ag%C3%AAncias%20reguladoras` | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_ag_ncias_reguladoras-1440-sem-sessao.jpg) · [1ª tela](buscar_q_ag_ncias_reguladoras-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=agências reguladoras` | com | 390 | 200 | `/buscar?q=ag%C3%AAncias%20reguladoras` | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_ag_ncias_reguladoras-390-com-sessao.jpg) · [1ª tela](buscar_q_ag_ncias_reguladoras-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=agências reguladoras` | com | 1440 | 200 | `/buscar?q=ag%C3%AAncias%20reguladoras` | 106 (até 230) | sim | não | 0 | 0 | **1** | [página](buscar_q_ag_ncias_reguladoras-1440-com-sessao.jpg) · [1ª tela](buscar_q_ag_ncias_reguladoras-1440-com-sessao-primeira-tela.jpg) |

**/buscar?q=hospitais**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=hospitais**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=juros do cartão**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=juros do cartão**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=saneamneto**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=saneamneto**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=agências reguladoras**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=agências reguladoras**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=agências reguladoras**, com sessão, 1440 px:
- caiu no login: `/entrar?_rsc=e97is`
