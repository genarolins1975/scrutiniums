# Mapa da conta (/app/observatorios): evidências da Iniciativa M1

Data: 23/10/2026. Build de produção local, `next start` com banco temporário e sessão de teste (`npm run evidencias`). Antes: `main` em `b825eb9e3` (capturas do parecer de UX de 23/10/2026, `docs/ux-2026-10-23/evidencias/`). Depois: branch `claude/mapa-1-arquitetura`.

## Medidas, antes e depois

| Medida | Antes | Depois, conta nova | Depois, conta que volta (4 recortes, 2 avisos, último acesso) | Exigido |
|---|---|---|---|---|
| Altura a 1440 px | 2.256 px | 3.093 px | 3.388 px | até 3.500 |
| Altura a 390 px | 5.631 px | 5.488 px | 5.987 px | até 7.000 |
| Cromo a 1440 / 390 px | 151 / 102 | 151 / 102 | 151 / 102 | até 230 / 200 |
| Axe (WCAG 2.1 A e AA) a 1440 e 390 | 0 | 0 | 0 | 0 |
| Rolagem horizontal | 0 | 0 | 0 | 0 |
| Erros de console | não registrado no parecer | 0 | 0 | 0 |
| Formulários POST na página | 43 | 0 | 0 | 0 |
| Coleções com link direto no diretório | 0 de 28 (botões em formulário) | 28 de 28 | 28 de 28 | 28 |
| Observatório quebrado entre colunas | 1 (Energia e Infraestrutura) | 0 (grade) | 0 | 0 |
| Estados vazios na primeira tela | 3 | 0 | 0 | 0 |
| `font-size` fora da escala no CSS da página | corpos de 12,5, 13, 13,5, 14, 15,5, 20 e 22 px | nenhum (`MapaDaConta.module.css` sem `font-size`) | idem | nenhum |
| Primeiro item do "Para você" a 1440 | não havia | acima de 900 px (`ux-orcamentos-comprimento`, verde) | primeira linha (o estado) a cerca de 800 px, ainda na primeira tela (captura) | acima de 900 px |

A altura cresceu a 1440 porque o diretório passou de três colunas de texto de 12,5 px, com as páginas inline, para duas colunas de seções inteiras com linhas de 44 px; as páginas de cada coleção ficaram recolhidas num `<details>`. Ficou abaixo do orçamento das portas, que é o do mapa.

Tabelas completas por largura: [conta nova](depois-conta-nova/evidencias.md) e [conta que volta](depois-conta-que-volta/evidencias.md). Capturas: [antes](antes/), [depois, conta nova](depois-conta-nova/), [depois, conta que volta](depois-conta-que-volta/).

## Teclado e alvos de toque (conferência registrada, build final, Playwright)

- Alvos abaixo de 44 px entre todos os links e `summary` visíveis do mapa: nenhum a 1440, nenhum a 390.
- Ordem do Tab a partir do H1, a 1440: busca; as quatro perguntas do estado; as oito da cidade; para cada observatório, o título e, em cada coleção, o link e o abridor das páginas, na ordem de leitura (Famílias, Serviços Públicos, Contas Públicas, Energia e Infraestrutura, Economia, Território e Clima). Foco visível em todos: contorno sólido de 2 px na lista do "Para você" e de 3 px na cor de destaque no diretório.
- Enter no abridor do Setor Elétrico abre a lista de páginas; Enter de novo fecha.
- A coleção Justiça abre pelo teclado a partir do mapa e o último acesso fica gravado (`scripts/obee/judiciario-verificacao.mjs`, a 320, 390, 768 e 1440 px, com axe 0).

Não verificado: leitor de tela, zoom de 200 %, 768 px nas capturas do mapa (a verificação do Judiciário passa a 768 sem rolagem e sem violação), conta com UF ligada (`PARA_VOCE_POR_UF = false`, decisão pendente do dono), produção.

## Verificação do repositório

`npm run verificar:pr` verde em 23/10/2026: lint, tipos, testes Python, build, fluxos do Judiciário, cobertura bilíngue e Vitest (374 arquivos, 9.169 testes, 12 ignorados), sobre o `main` com o PR #364, árvore versionada igual à do início.
