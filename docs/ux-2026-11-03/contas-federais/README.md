# Contas Federais: edição de setembro de 2026 do RTN e acessibilidade do fluxo

03/11/2026. Item 4 da auditoria de painéis (issue #304).

## Dados

| O quê | Antes | Depois | Fonte |
|---|---|---|---|
| RTN integrado | julho de 2026 (CKAN, `seriehistoricajul26.xlsx`) | setembro de 2026 (anexo do boletim, `serie_historica_set26.xlsx`, sha256 `8eb4abf0…aaab4`) | Tesouro Transparente, boletim 2026/9, consultado em 03/11/2026 |
| Meses do RTN | 79 | 81 (agosto e setembro novos; fevereiro a julho de 2026 revisados pela fonte) | idem |
| IPCA, base de preços | julho de 2026, 43 meses | setembro de 2026, 45 meses (7.695,82) | IBGE, SIDRA 1737, variável 2266, captura 03/11/2026 13h12 UTC |
| Fluxo do dinheiro 2025 (tabela 2.2) | edição de julho | edição de setembro, valores de 2025 inalterados | idem RTN |
| SIOP | mantido (mesmos bytes; `capturaSIOP` de 27/10/2026 preservada) | | |

O CKAN do Tesouro ainda servia julho em 03/11/2026, com o boletim de setembro publicado. A API v3 do IBGE recusou conexão do
ambiente de captura; a API de valores do SIDRA respondeu, e os 43 meses comuns conferiram iguais aos de 12/10/2026.

## Interface

- `/contas-publicas/panorama`, diagrama do fluxo (componente compartilhado com Contas Estaduais): o SVG era `role="img"` com
  blocos focáveis dentro (axe `nested-interactive`, 1440 px); passou a `role="group"` com o resumo como descrição. Os
  títulos das etapas pulavam de h2 para h4 (axe `heading-order`, 390 px); agora ficam um nível abaixo do título.
- `/contas-publicas/metas` a 390 px: cartão de cada programação de 454 para 396 px; página de 15.949 para 14.340 px.
  Nenhum dado removido.

axe com sessão, 390 e 1440 px: 0 violações em `/contas-publicas`, `/panorama`, `/metas` e `/contas-publicas-estaduais`.

## Limites

- O aviso "Há uma edição mais recente na fonte" é editorial e escrito à mão; com a edição integrada ele some. Não foi
  generalizado.
- Leitor de tela e aparelho físico não verificados.
- `/metas` continua longa no celular: são 25 programações por página, com paginação.
