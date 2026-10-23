### Evidências de página (2026-10-23)

Build q9BCXnIDIQuXzSlcIvVni, `next start` local com banco temporário e sessão de teste. Máquina: 2 vCPU, 8 GB. Comando: `npm run evidencias -- --rotas /app/observatorios --saida docs/ux-2026-10-23/mapa/depois-conta-que-volta --larguras 390,1440 --modos com --conta volta`. Tempo: 0 min 09 s.

Cromo: do topo da barra comum ao início do conteúdo, em px, com o orçamento da Iniciativa 2 a 390 e 1440 px. Axe: violações WCAG 2.1 A e AA (regra e número de nós). Login: requisições feitas pela página (arquivos, dados, APIs) que caíram em /entrar; o redirecionamento da própria página aparece na coluna Endereço final.

| Rota | Sessão | Largura | HTTP | Endereço final | Cromo (px) | H1 na 1ª tela | Rolagem horizontal | Axe | Erros de console | Login | Captura |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/app/observatorios` | com | 390 | 200 |  | 102 (até 200) | sim | não | 0 | 0 | 0 | [página](app_observatorios-390-com-sessao.jpg) · [1ª tela](app_observatorios-390-com-sessao-primeira-tela.jpg) |
| `/app/observatorios` | com | 1440 | 200 |  | 151 (até 230) | sim | não | 0 | 0 | 0 | [página](app_observatorios-1440-com-sessao.jpg) · [1ª tela](app_observatorios-1440-com-sessao-primeira-tela.jpg) |
