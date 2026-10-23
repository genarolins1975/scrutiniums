### Evidências de página (2026-10-23)

Build bKGc72m2DpDag45BDj08Q, `next start` local com banco temporário e sessão de teste. Máquina: 4 vCPU, 16 GB. Comando: `npm run evidencias -- --rotas /buscar?q=autonomia financeira /buscar?q=xyzabc /buscar?q=avaliação /setor-eletrico --saida docs/ux-2026-10-23/busca-pr4 --larguras 390,1440`. Tempo: 0 min 58 s.

Cromo: do topo da barra comum ao início do conteúdo, em px, com o orçamento da Iniciativa 2 a 390 e 1440 px. Axe: violações WCAG 2.1 A e AA (regra e número de nós). Login: requisições feitas pela página (arquivos, dados, APIs) que caíram em /entrar; o redirecionamento da própria página aparece na coluna Endereço final.

| Rota | Sessão | Largura | HTTP | Endereço final | Cromo (px) | H1 na 1ª tela | Rolagem horizontal | Axe | Erros de console | Login | Captura |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/buscar?q=autonomia financeira` | sem | 390 | 200 | `/buscar?q=autonomia%20financeira` | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_autonomia_financeira-390-sem-sessao.jpg) · [1ª tela](buscar_q_autonomia_financeira-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=autonomia financeira` | sem | 1440 | 200 | `/buscar?q=autonomia%20financeira` | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_autonomia_financeira-1440-sem-sessao.jpg) · [1ª tela](buscar_q_autonomia_financeira-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=autonomia financeira` | com | 390 | 200 | `/buscar?q=autonomia%20financeira` | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_autonomia_financeira-390-com-sessao.jpg) · [1ª tela](buscar_q_autonomia_financeira-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=autonomia financeira` | com | 1440 | 200 | `/buscar?q=autonomia%20financeira` | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar_q_autonomia_financeira-1440-com-sessao.jpg) · [1ª tela](buscar_q_autonomia_financeira-1440-com-sessao-primeira-tela.jpg) |
| `/buscar?q=xyzabc` | sem | 390 | 200 |  | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_xyzabc-390-sem-sessao.jpg) · [1ª tela](buscar_q_xyzabc-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=xyzabc` | sem | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_xyzabc-1440-sem-sessao.jpg) · [1ª tela](buscar_q_xyzabc-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=xyzabc` | com | 390 | 200 |  | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_xyzabc-390-com-sessao.jpg) · [1ª tela](buscar_q_xyzabc-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=xyzabc` | com | 1440 | 200 |  | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar_q_xyzabc-1440-com-sessao.jpg) · [1ª tela](buscar_q_xyzabc-1440-com-sessao-primeira-tela.jpg) |
| `/buscar?q=avaliação` | sem | 390 | 200 | `/buscar?q=avalia%C3%A7%C3%A3o` | 101 (até 200) | sim | não | 0 | **1** | **1** | [página](buscar_q_avalia_o-390-sem-sessao.jpg) · [1ª tela](buscar_q_avalia_o-390-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=avaliação` | sem | 1440 | 200 | `/buscar?q=avalia%C3%A7%C3%A3o` | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](buscar_q_avalia_o-1440-sem-sessao.jpg) · [1ª tela](buscar_q_avalia_o-1440-sem-sessao-primeira-tela.jpg) |
| `/buscar?q=avaliação` | com | 390 | 200 | `/buscar?q=avalia%C3%A7%C3%A3o` | 101 (até 200) | sim | não | 0 | 0 | 0 | [página](buscar_q_avalia_o-390-com-sessao.jpg) · [1ª tela](buscar_q_avalia_o-390-com-sessao-primeira-tela.jpg) |
| `/buscar?q=avaliação` | com | 1440 | 200 | `/buscar?q=avalia%C3%A7%C3%A3o` | 106 (até 230) | sim | não | 0 | 0 | 0 | [página](buscar_q_avalia_o-1440-com-sessao.jpg) · [1ª tela](buscar_q_avalia_o-1440-com-sessao-primeira-tela.jpg) |
| `/setor-eletrico` | sem | 390 | 200 | `/entrar?de=%2Fsetor-eletrico` | sem barra comum | sim | não | 0 | 0 | 0 | [página](setor_eletrico-390-sem-sessao.jpg) · [1ª tela](setor_eletrico-390-sem-sessao-primeira-tela.jpg) |
| `/setor-eletrico` | sem | 1440 | 200 | `/entrar?de=%2Fsetor-eletrico` | sem barra comum | sim | não | 0 | 0 | 0 | [página](setor_eletrico-1440-sem-sessao.jpg) · [1ª tela](setor_eletrico-1440-sem-sessao-primeira-tela.jpg) |
| `/setor-eletrico` | com | 390 | 200 |  | 195 (até 200) | sim | não | 0 | 0 | 0 | [página](setor_eletrico-390-com-sessao.jpg) · [1ª tela](setor_eletrico-390-com-sessao-primeira-tela.jpg) |
| `/setor-eletrico` | com | 1440 | 200 |  | 222 (até 230) | sim | não | 0 | 0 | 0 | [página](setor_eletrico-1440-com-sessao.jpg) · [1ª tela](setor_eletrico-1440-com-sessao-primeira-tela.jpg) |

**/buscar?q=autonomia financeira**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=autonomia financeira**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=xyzabc**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=xyzabc**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=avaliação**, sem sessão, 390 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`

**/buscar?q=avaliação**, sem sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- caiu no login: `/entrar?_rsc=e97is`
