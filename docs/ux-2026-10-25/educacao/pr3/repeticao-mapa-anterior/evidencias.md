### Evidências de página (2026-10-25)

Build QdEQE89Q3AcugwG-WUe-N, `next start` local com banco temporário e sessão de teste. Máquina: 5 vCPU, 33 GB. Comando: `npm run evidencias -- --rotas /educacao-municipal/mapa --larguras 390,768 --modos com --saida /tmp/educacao-pr3-mapa-repeticao`. Tempo: 7 min 22 s.

Cromo: do topo da barra comum ao início do conteúdo, em px, com o orçamento da Iniciativa 2 a 390 e 1440 px. Axe: violações WCAG 2.1 A e AA (regra e número de nós). Login: requisições feitas pela página (arquivos, dados, APIs) que caíram em /entrar; o redirecionamento da própria página aparece na coluna Endereço final.

| Rota | Sessão | Largura | HTTP | Endereço final | Cromo (px) | H1 na 1ª tela | Rolagem horizontal | Axe | Erros de console | Login | Captura |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/educacao-municipal/mapa` | com | 390 | 200 |  | 138 (até 200) | sim | não | 0 | **1** | 0 | [página](educacao_municipal_mapa-390-com-sessao.jpg) · [1ª tela](educacao_municipal_mapa-390-com-sessao-primeira-tela.jpg) |
| `/educacao-municipal/mapa` | com | 768 | 200 |  | 231 | sim | não | 0 | 0 | 0 | [página](educacao_municipal_mapa-768-com-sessao.jpg) · [1ª tela](educacao_municipal_mapa-768-com-sessao-primeira-tela.jpg) |

**/educacao-municipal/mapa**, com sessão, 390 px:
- console: Failed to fetch RSC payload for http://localhost:44711/eficiencia-estatal/educacao-municipal-capitais/metodos. Falling back to browser navigation. ChunkLoadError: Loading chunk 70769 failed.
(timeout:
