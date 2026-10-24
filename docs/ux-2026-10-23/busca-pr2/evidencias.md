### Evidências de página (2026-10-23)

Build _IdhPLVpNYDCc5e6oURMY, `next start` local com banco temporário e sessão de teste. Máquina: 4 vCPU, 16 GB. Comando: `npm run evidencias -- --rotas /buscar?q=Amazônia /buscar?q=Celpe /buscar?q=agências reguladoras /buscar?q=LOA --saida docs/ux-2026-10-23/busca-pr2 --larguras 390,1440`. Tempo: 0 min 47 s.

Cromo: do topo da barra comum ao início do conteúdo, em px, com o orçamento da Iniciativa 2 a 390 e 1440 px. Axe: violações WCAG 2.1 A e AA (regra e número de nós). Login: requisições feitas pela página (arquivos, dados, APIs) que caíram em /entrar; o redirecionamento da própria página aparece na coluna Endereço final.

| Rota | Sessão | Largura | HTTP | Endereço final | Cromo (px) | H1 na 1ª tela | Rolagem horizontal | Axe | Erros de console | Login | Captura |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/buscar?q=Amazônia` | sem | 390 | 200 | `/buscar?q=Amaz%C3%B4nia` | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_Amaz_nia-390-sem-sessao.jpg) · [1ª tela](buscar_q_Amaz_nia-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=Amazônia` | sem | 1440 | 200 | `/buscar?q=Amaz%C3%B4nia` | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_Amaz_nia-1440-sem-sessao.jpg) · [1ª tela](buscar_q_Amaz_nia-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=Amazônia` | com | 390 | 200 | `/buscar?q=Amaz%C3%B4nia` | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_Amaz_nia-390-com-sessao.jpg) · [1ª tela](buscar_q_Amaz_nia-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=Amazônia` | com | 1440 | 200 | `/buscar?q=Amaz%C3%B4nia` | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar_q_Amaz_nia-1440-com-sessao.jpg) · [1ª tela](buscar_q_Amaz_nia-1440-com-sessao-primeira-tela.jpg) |
| `/buscar?q=Celpe` | sem | 390 | 200 |  | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_Celpe-390-sem-sessao.jpg) · [1ª tela](buscar_q_Celpe-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=Celpe` | sem | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_Celpe-1440-sem-sessao.jpg) · [1ª tela](buscar_q_Celpe-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=Celpe` | com | 390 | 200 |  | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_Celpe-390-com-sessao.jpg) · [1ª tela](buscar_q_Celpe-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=Celpe` | com | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar_q_Celpe-1440-com-sessao.jpg) · [1ª tela](buscar_q_Celpe-1440-com-sessao-primeira-tela.jpg) |
| `/buscar?q=agências reguladoras` | sem | 390 | 200 | `/buscar?q=ag%C3%AAncias%20reguladoras` | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_ag_ncias_reguladoras-390-sem-sessao.jpg) · [1ª tela](buscar_q_ag_ncias_reguladoras-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=agências reguladoras` | sem | 1440 | 200 | `/buscar?q=ag%C3%AAncias%20reguladoras` | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_ag_ncias_reguladoras-1440-sem-sessao.jpg) · [1ª tela](buscar_q_ag_ncias_reguladoras-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=agências reguladoras` | com | 390 | 200 | `/buscar?q=ag%C3%AAncias%20reguladoras` | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_ag_ncias_reguladoras-390-com-sessao.jpg) · [1ª tela](buscar_q_ag_ncias_reguladoras-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=agências reguladoras` | com | 1440 | 200 | `/buscar?q=ag%C3%AAncias%20reguladoras` | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar_q_ag_ncias_reguladoras-1440-com-sessao.jpg) · [1ª tela](buscar_q_ag_ncias_reguladoras-1440-com-sessao-primeira-tela.jpg) |
| `/buscar?q=LOA` | sem | 390 | 200 |  | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_LOA-390-sem-sessao.jpg) · [1ª tela](buscar_q_LOA-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=LOA` | sem | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_LOA-1440-sem-sessao.jpg) · [1ª tela](buscar_q_LOA-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=LOA` | com | 390 | 200 |  | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_LOA-390-com-sessao.jpg) · [1ª tela](buscar_q_LOA-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=LOA` | com | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar_q_LOA-1440-com-sessao.jpg) · [1ª tela](buscar_q_LOA-1440-com-sessao-primeira-tela.jpg) |

**/buscar?q=Amazônia**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=Amazônia**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=Celpe**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=Celpe**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=agências reguladoras**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=agências reguladoras**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=LOA**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=LOA**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`
