### Evidências de página (2026-10-23)

Build lXx_riA24VBDBgmE4EQYp, `next start` local com banco temporário e sessão de teste. Máquina: 4 vCPU, 16 GB. Comando: `npm run evidencias -- --rotas /buscar?q=Importação /buscar?q=Regulação /buscar?q=superávit /buscar?q=SNIS --saida docs/ux-2026-10-23/busca-pr3 --larguras 390,1440`. Tempo: 0 min 47 s.

Cromo: do topo da barra comum ao início do conteúdo, em px, com o orçamento da Iniciativa 2 a 390 e 1440 px. Axe: violações WCAG 2.1 A e AA (regra e número de nós). Login: requisições feitas pela página (arquivos, dados, APIs) que caíram em /entrar; o redirecionamento da própria página aparece na coluna Endereço final.

| Rota | Sessão | Largura | HTTP | Endereço final | Cromo (px) | H1 na 1ª tela | Rolagem horizontal | Axe | Erros de console | Login | Captura |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/buscar?q=Importação` | sem | 390 | 200 | `/buscar?q=Importa%C3%A7%C3%A3o` | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_Importa_o-390-sem-sessao.jpg) · [1ª tela](buscar_q_Importa_o-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=Importação` | sem | 1440 | 200 | `/buscar?q=Importa%C3%A7%C3%A3o` | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_Importa_o-1440-sem-sessao.jpg) · [1ª tela](buscar_q_Importa_o-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=Importação` | com | 390 | 200 | `/buscar?q=Importa%C3%A7%C3%A3o` | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_Importa_o-390-com-sessao.jpg) · [1ª tela](buscar_q_Importa_o-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=Importação` | com | 1440 | 200 | `/buscar?q=Importa%C3%A7%C3%A3o` | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar_q_Importa_o-1440-com-sessao.jpg) · [1ª tela](buscar_q_Importa_o-1440-com-sessao-primeira-tela.jpg) |
| `/buscar?q=Regulação` | sem | 390 | 200 | `/buscar?q=Regula%C3%A7%C3%A3o` | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_Regula_o-390-sem-sessao.jpg) · [1ª tela](buscar_q_Regula_o-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=Regulação` | sem | 1440 | 200 | `/buscar?q=Regula%C3%A7%C3%A3o` | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_Regula_o-1440-sem-sessao.jpg) · [1ª tela](buscar_q_Regula_o-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=Regulação` | com | 390 | 200 | `/buscar?q=Regula%C3%A7%C3%A3o` | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_Regula_o-390-com-sessao.jpg) · [1ª tela](buscar_q_Regula_o-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=Regulação` | com | 1440 | 200 | `/buscar?q=Regula%C3%A7%C3%A3o` | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar_q_Regula_o-1440-com-sessao.jpg) · [1ª tela](buscar_q_Regula_o-1440-com-sessao-primeira-tela.jpg) |
| `/buscar?q=superávit` | sem | 390 | 200 | `/buscar?q=super%C3%A1vit` | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_super_vit-390-sem-sessao.jpg) · [1ª tela](buscar_q_super_vit-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=superávit` | sem | 1440 | 200 | `/buscar?q=super%C3%A1vit` | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_super_vit-1440-sem-sessao.jpg) · [1ª tela](buscar_q_super_vit-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=superávit` | com | 390 | 200 | `/buscar?q=super%C3%A1vit` | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_super_vit-390-com-sessao.jpg) · [1ª tela](buscar_q_super_vit-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=superávit` | com | 1440 | 200 | `/buscar?q=super%C3%A1vit` | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar_q_super_vit-1440-com-sessao.jpg) · [1ª tela](buscar_q_super_vit-1440-com-sessao-primeira-tela.jpg) |
| `/buscar?q=SNIS` | sem | 390 | 200 |  | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_SNIS-390-sem-sessao.jpg) · [1ª tela](buscar_q_SNIS-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=SNIS` | sem | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_SNIS-1440-sem-sessao.jpg) · [1ª tela](buscar_q_SNIS-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=SNIS` | com | 390 | 200 |  | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_SNIS-390-com-sessao.jpg) · [1ª tela](buscar_q_SNIS-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=SNIS` | com | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar_q_SNIS-1440-com-sessao.jpg) · [1ª tela](buscar_q_SNIS-1440-com-sessao-primeira-tela.jpg) |

**/buscar?q=Importação**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=Importação**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=Regulação**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=Regulação**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=superávit**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=superávit**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=SNIS**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=SNIS**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`
