### Evidências de página (2026-10-23)

Crédito 1 (navegação e casca), Iniciativa 2 do parecer de UX de 23/10/2026. Antes, no mesmo build de referência do parecer
(capturas em `docs/ux-2026-10-23/evidencias/`): cromo de 727 px a 390 px em `/observatorio/credit` e
`/observatorio/payroll-lending-aging` (orçamento 200) e 142 px a 1440 (a barra lateral não entrava na medida), um erro 403 no
console em toda página e três violações `scrollable-region-focusable` em `payroll-lending-aging` a 390 px. Depois: tabela abaixo.
As 10 violações de contraste em `/observatorio/pix` estão no mapa de calor "quem paga × quem recebe" (`#px-natureza`), anterior a
esta mudança e fora da casca; ficam registradas como pendência.

Build gToq369OyjOw7dB9PiBEa, `next start` local com banco temporário e sessão de teste. Máquina: 4 vCPU, 16 GB. Comando: `npm run evidencias -- --rotas /observatorio/credit /observatorio/payroll-lending-aging /observatorio/pix /observatorio/sectors /observatorio/subnational-credit /observatorio/interest-rates /observatorio --saida docs/ux-2026-10-23/credito --larguras 390,1440 --modos com`. Tempo: 1 min 22 s.

Cromo: do topo da barra comum ao início do conteúdo, em px, com o orçamento da Iniciativa 2 a 390 e 1440 px. Axe: violações WCAG 2.1 A e AA (regra e número de nós). Login: requisições feitas pela página (arquivos, dados, APIs) que caíram em /entrar; o redirecionamento da própria página aparece na coluna Endereço final.

| Rota | Sessão | Largura | HTTP | Endereço final | Cromo (px) | H1 na 1ª tela | Rolagem horizontal | Axe | Erros de console | Login | Captura |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/observatorio/credit` | com | 390 | 200 |  | 183 (até 200) | sim | não | 0 | 0 | 0 | [página](observatorio_credit-390-com-sessao.jpg) · [1ª tela](observatorio_credit-390-com-sessao-primeira-tela.jpg) |
| `/observatorio/credit` | com | 1440 | 200 |  | 228 (até 230) | sim | não | 0 | 0 | 0 | [página](observatorio_credit-1440-com-sessao.jpg) · [1ª tela](observatorio_credit-1440-com-sessao-primeira-tela.jpg) |
| `/observatorio/payroll-lending-aging` | com | 390 | 200 |  | 138 (até 200) | sim | não | 0 | 0 | 0 | [página](observatorio_payroll_lending_aging-390-com-sessao.jpg) · [1ª tela](observatorio_payroll_lending_aging-390-com-sessao-primeira-tela.jpg) |
| `/observatorio/payroll-lending-aging` | com | 1440 | 200 |  | 187 (até 230) | sim | não | 0 | 0 | 0 | [página](observatorio_payroll_lending_aging-1440-com-sessao.jpg) · [1ª tela](observatorio_payroll_lending_aging-1440-com-sessao-primeira-tela.jpg) |
| `/observatorio/pix` | com | 390 | 200 |  | 138 (até 200) | sim | não | **color-contrast (10)** | 0 | 0 | [página](observatorio_pix-390-com-sessao.jpg) · [1ª tela](observatorio_pix-390-com-sessao-primeira-tela.jpg) |
| `/observatorio/pix` | com | 1440 | 200 |  | 187 (até 230) | sim | não | **color-contrast (10)** | 0 | 0 | [página](observatorio_pix-1440-com-sessao.jpg) · [1ª tela](observatorio_pix-1440-com-sessao-primeira-tela.jpg) |
| `/observatorio/sectors` | com | 390 | 200 |  | 138 (até 200) | sim | não | 0 | 0 | 0 | [página](observatorio_sectors-390-com-sessao.jpg) · [1ª tela](observatorio_sectors-390-com-sessao-primeira-tela.jpg) |
| `/observatorio/sectors` | com | 1440 | 200 |  | 187 (até 230) | sim | não | 0 | 0 | 0 | [página](observatorio_sectors-1440-com-sessao.jpg) · [1ª tela](observatorio_sectors-1440-com-sessao-primeira-tela.jpg) |
| `/observatorio/subnational-credit` | com | 390 | 200 |  | 138 (até 200) | sim | não | 0 | 0 | 0 | [página](observatorio_subnational_credit-390-com-sessao.jpg) · [1ª tela](observatorio_subnational_credit-390-com-sessao-primeira-tela.jpg) |
| `/observatorio/subnational-credit` | com | 1440 | 200 |  | 187 (até 230) | sim | não | 0 | 0 | 0 | [página](observatorio_subnational_credit-1440-com-sessao.jpg) · [1ª tela](observatorio_subnational_credit-1440-com-sessao-primeira-tela.jpg) |
| `/observatorio/interest-rates` | com | 390 | 200 |  | 183 (até 200) | sim | não | 0 | 0 | 0 | [página](observatorio_interest_rates-390-com-sessao.jpg) · [1ª tela](observatorio_interest_rates-390-com-sessao-primeira-tela.jpg) |
| `/observatorio/interest-rates` | com | 1440 | 200 |  | 228 (até 230) | sim | não | 0 | 0 | 0 | [página](observatorio_interest_rates-1440-com-sessao.jpg) · [1ª tela](observatorio_interest_rates-1440-com-sessao-primeira-tela.jpg) |
| `/observatorio` | com | 390 | 200 | `/observatorio/map` | 183 (até 200) | sim | não | 0 | 0 | 0 | [página](observatorio-390-com-sessao.jpg) · [1ª tela](observatorio-390-com-sessao-primeira-tela.jpg) |
| `/observatorio` | com | 1440 | 200 | `/observatorio/map` | 228 (até 230) | sim | não | 0 | 0 | 0 | [página](observatorio-1440-com-sessao.jpg) · [1ª tela](observatorio-1440-com-sessao-primeira-tela.jpg) |
