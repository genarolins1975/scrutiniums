### Evidências de página (2026-10-24)

Build tnEt0wD5K5bo3Ayunr8ee, `next start` local com banco temporário e sessão de teste. Máquina: 5 vCPU, 33 GB. Comando: `npm run evidencias -- --rotas /observatorio,/setor-eletrico,/eficiencia-estatal --saida /tmp/pr365-definitivo/referencias --larguras 1440 --modos com --conta nova`. Tempo: 0 min 06 s.

Cromo: do topo da barra comum ao início do conteúdo, em px, com o orçamento da Iniciativa 2 a 390 e 1440 px. Axe: violações WCAG 2.1 A e AA (regra e número de nós). Login: requisições feitas pela página (arquivos, dados, APIs) que caíram em /entrar; o redirecionamento da própria página aparece na coluna Endereço final.

| Rota | Sessão | Largura | HTTP | Endereço final | Cromo (px) | H1 na 1ª tela | Rolagem horizontal | Axe | Erros de console | Login | Captura |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/observatorio,/setor-eletrico,/eficiencia-estatal` | com | 1440 | 404 |  | 106 (até 230) | sim | não | 0 | **1** | **1** | [página](observatorio_setor_eletrico_eficiencia_estatal-1440-com-sessao.jpg) · [1ª tela](observatorio_setor_eletrico_eficiencia_estatal-1440-com-sessao-primeira-tela.jpg) |

**/observatorio,/setor-eletrico,/eficiencia-estatal**, com sessão, 1440 px:
- console: Failed to load resource: the server responded with a status of 404 (Not Found)
- caiu no login: `/entrar?_rsc=77yha`
