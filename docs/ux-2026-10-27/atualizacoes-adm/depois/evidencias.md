### Evidências de página (2026-10-27)

Conta local adm. Build mXMizLsighsc8Sf0SmbFi, `next start` local com banco temporário e sessão de teste. Máquina: 5 vCPU, 33 GB. Comando: `npm run evidencias -- --rotas /app/admin /app/admin/atualizacoes --conta adm --estado-operacoes docs/ux-2026-10-27/atualizacoes-adm/estado-observado.json --larguras 320,390,768,1440 --saida /workspace/adm-consolidado/depois`. Tempo: 1 min 42 s.

Cromo: do topo da barra comum ao início do conteúdo, em px, com o orçamento da Iniciativa 2 a 390 e 1440 px. Axe: violações WCAG 2.1 A e AA (regra e número de nós). Login: requisições feitas pela página (arquivos, dados, APIs) que caíram em /entrar; o redirecionamento da própria página aparece na coluna Endereço final.

| Rota | Sessão | Largura | HTTP | Endereço final | Cromo (px) | H1 na 1ª tela | Rolagem horizontal | Axe | Erros de console | Login | Captura |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/app/admin` | sem | 320 | 200 | `/entrar?de=%2Fapp%2Fadmin` | sem barra comum | sim | não | 0 | 0 | 0 | [página](app_admin-320-sem-sessao.jpg) · [1ª tela](app_admin-320-sem-sessao-primeira-tela.jpg) |
| `/app/admin` | sem | 390 | 200 | `/entrar?de=%2Fapp%2Fadmin` | sem barra comum | sim | não | 0 | 0 | 0 | [página](app_admin-390-sem-sessao.jpg) · [1ª tela](app_admin-390-sem-sessao-primeira-tela.jpg) |
| `/app/admin` | sem | 768 | 200 | `/entrar?de=%2Fapp%2Fadmin` | sem barra comum | sim | não | 0 | 0 | 0 | [página](app_admin-768-sem-sessao.jpg) · [1ª tela](app_admin-768-sem-sessao-primeira-tela.jpg) |
| `/app/admin` | sem | 1440 | 200 | `/entrar?de=%2Fapp%2Fadmin` | sem barra comum | sim | não | 0 | 0 | 0 | [página](app_admin-1440-sem-sessao.jpg) · [1ª tela](app_admin-1440-sem-sessao-primeira-tela.jpg) |
| `/app/admin` | com | 320 | 200 |  | 102 | sim | não | 0 | 0 | 0 | [página](app_admin-320-com-sessao.jpg) · [1ª tela](app_admin-320-com-sessao-primeira-tela.jpg) |
| `/app/admin` | com | 390 | 200 |  | 102 (até 200) | sim | não | 0 | 0 | 0 | [página](app_admin-390-com-sessao.jpg) · [1ª tela](app_admin-390-com-sessao-primeira-tela.jpg) |
| `/app/admin` | com | 768 | 200 |  | 195 | sim | não | 0 | 0 | 0 | [página](app_admin-768-com-sessao.jpg) · [1ª tela](app_admin-768-com-sessao-primeira-tela.jpg) |
| `/app/admin` | com | 1440 | 200 |  | 151 (até 230) | sim | não | 0 | 0 | 0 | [página](app_admin-1440-com-sessao.jpg) · [1ª tela](app_admin-1440-com-sessao-primeira-tela.jpg) |
| `/app/admin/atualizacoes` | sem | 320 | 200 | `/entrar?de=%2Fapp%2Fadmin%2Fatualizacoes` | sem barra comum | sim | não | 0 | 0 | 0 | [página](app_admin_atualizacoes-320-sem-sessao.jpg) · [1ª tela](app_admin_atualizacoes-320-sem-sessao-primeira-tela.jpg) |
| `/app/admin/atualizacoes` | sem | 390 | 200 | `/entrar?de=%2Fapp%2Fadmin%2Fatualizacoes` | sem barra comum | sim | não | 0 | 0 | 0 | [página](app_admin_atualizacoes-390-sem-sessao.jpg) · [1ª tela](app_admin_atualizacoes-390-sem-sessao-primeira-tela.jpg) |
| `/app/admin/atualizacoes` | sem | 768 | 200 | `/entrar?de=%2Fapp%2Fadmin%2Fatualizacoes` | sem barra comum | sim | não | 0 | 0 | 0 | [página](app_admin_atualizacoes-768-sem-sessao.jpg) · [1ª tela](app_admin_atualizacoes-768-sem-sessao-primeira-tela.jpg) |
| `/app/admin/atualizacoes` | sem | 1440 | 200 | `/entrar?de=%2Fapp%2Fadmin%2Fatualizacoes` | sem barra comum | sim | não | 0 | 0 | 0 | [página](app_admin_atualizacoes-1440-sem-sessao.jpg) · [1ª tela](app_admin_atualizacoes-1440-sem-sessao-primeira-tela.jpg) |
| `/app/admin/atualizacoes` | com | 320 | 200 |  | 102 | sim | não | 0 | 0 | 0 | [página](app_admin_atualizacoes-320-com-sessao.jpg) · [1ª tela](app_admin_atualizacoes-320-com-sessao-primeira-tela.jpg) |
| `/app/admin/atualizacoes` | com | 390 | 200 |  | 102 (até 200) | sim | não | 0 | 0 | 0 | [página](app_admin_atualizacoes-390-com-sessao.jpg) · [1ª tela](app_admin_atualizacoes-390-com-sessao-primeira-tela.jpg) |
| `/app/admin/atualizacoes` | com | 768 | 200 |  | 195 | sim | não | 0 | 0 | 0 | [página](app_admin_atualizacoes-768-com-sessao.jpg) · [1ª tela](app_admin_atualizacoes-768-com-sessao-primeira-tela.jpg) |
| `/app/admin/atualizacoes` | com | 1440 | 200 |  | 151 (até 230) | sim | não | 0 | 0 | 0 | [página](app_admin_atualizacoes-1440-com-sessao.jpg) · [1ª tela](app_admin_atualizacoes-1440-com-sessao-primeira-tela.jpg) |
