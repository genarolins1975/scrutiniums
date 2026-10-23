# Iniciativa 1, PR 0: evidências das três páginas de prova

Capturas com sessão a 390 e 1440 px, primeira tela e página inteira, geradas por `npm run evidencias` sobre o build de produção local (4 vCPU, 16 GB), em 23/10/2026. `antes/`: `main` antes do kit. `depois/`: esta branch, depois da revisão visual. As tabelas completas, com os links das capturas, estão em `antes/evidencias.md` e `depois/evidencias.md`.

| Rota | Largura | Cromo antes | Cromo depois | Axe antes / depois | Rolagem horizontal | Erros de console | Requisições no login |
|---|---|---|---|---|---|---|---|
| `/setor-eletrico/pld` | 390 | 183 | 183 | 0 / 0 | não | 0 | 0 |
| `/setor-eletrico/pld` | 1440 | 228 | 228 | 0 / 0 | não | 0 | 0 |
| `/setor-eletrico/qualidade` | 390 | 183 | 183 | 0 / 0 | não | 0 | 0 |
| `/setor-eletrico/qualidade` | 1440 | 228 | 228 | 0 / 0 | não | 0 | 0 |
| `/setor-eletrico/conta-de-luz` | 390 | 138 | 138 | 0 / 0 | não | 0 | 0 |
| `/setor-eletrico/conta-de-luz` | 1440 | 187 | 187 | 0 / 0 | não | 0 | 0 |
| `/en/setor-eletrico/pld` | 390 e 1440 | não medido | 183 e 228 | não medido / 0 | não | 0 | 0 |

Orçamento de cromo: até 200 px a 390 e até 230 px a 1440.

HTML entregue pelo build (`stat .next/server/app/<rota>.html`, em bytes):

| Rota | main | branch | Teto de 500 KB |
|---|---|---|---|
| `/setor-eletrico/pld` | 720.121 | 813.497 | acima antes e depois: exceção declarada no PR até a Iniciativa 4 tratar o peso |
| `/setor-eletrico/qualidade` | 622.678 | 684.841 | idem |
| `/setor-eletrico/conta-de-luz` | 699.698 | 712.918 | idem |

O que a revisão visual mudou antes destas capturas: na primeira figura do PLD, as perguntas irmãs voltaram para depois das notas do gráfico; na conta de luz, a lista das 81 distribuidoras deixou de aparecer três vezes (a tabela equivalente passou a ser a do próprio gráfico).
