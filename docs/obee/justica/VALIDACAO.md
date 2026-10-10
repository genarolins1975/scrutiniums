# Validação de Acesso à Justiça

Implementação de 10/10/2026 sobre `909e42c`. O capítulo foi reconstruído a partir dos originais; não havia implementação anterior recuperável.

## Dados e testes

- Conferência com mecanismo separado (openpyxl versus XML da biblioteca padrão): 2.563 comarcas e 108 registros administrativos, sem divergência. Não é auditoria independente de terceiros.
- Figuras CNJ 190 e 285 inspecionadas no PDF renderizado.
- Reprodução dos cinco arquivos públicos: igualdade byte a byte, coberta por teste Python.
- Suíte JavaScript completa: 4.408 aprovados e um ignorado; 181 arquivos. Inclui verificação obrigatória do HTML do build.
- Pipeline Python: 1.571 testes executados, seis ignorados. Pesquisa: 69 testes executados. Ambas as suítes aprovadas, com pyarrow instalado no ambiente isolado.
- Build de produção inclui lint e verificação de tipos.

## Revisão no navegador

Script reproduzível: `scripts/obee/justica-verificacao.mjs`, usando Chromium/Playwright e axe-core. Define-se `JUSTICA_PLAYWRIGHT` para a instalação de Playwright e, opcionalmente, `JUSTICA_URL` para o deployment. A execução sem URL inicia o build local. Capturas e relatório ficam em `JUSTICA_QA_DIR` (padrão `/tmp/justica-qa`).

Seis páginas × 320, 390, 768 e 1440 px. Verifica HTTP 200, um H1, ausência de transbordamento horizontal da página e regras automatizadas WCAG A/AA no conteúdo principal. Capturas completas em 390 e 1440 px foram inspecionadas. Tabelas possuem rolagem própria e cabeçalhos semânticos.

Interações exercitadas: filtros, ordenação, consulta de comarca, resultado vazio, paginação, persistência em URL e recarga, histórico do navegador, limpar seleção por teclado, tabelas expandidas, CSV do recorte completo, arquivos integrais, sitemap, navegação a partir do OBEE, rota inexistente e ampliação de texto a 200%. O extremo de Minas Gerais continua visível quando a escala alternativa está ativa. Pará ausente e Roraima zero permanecem distintos.

Correções da revisão: unidade do eixo monetário; geometria mobile da série; nomes acessíveis dos seletores; opção de escala ampliada; texto único no título SVG para evitar erro de hidratação; reflow do rodapé compartilhado com texto ampliado.

## Autoavaliação por página

Notas editoriais, não certificação. Critérios: direção de arte (DA), hierarquia (H), tipografia/acabamento (T), densidade/profundidade (D), didática (V), comparabilidade (C), interação/acessibilidade (I), responsividade (R).

| Rota final | DA | H | T | D | V | C | I | R | Evidência e limite |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `/acesso-justica` | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 | Panorama, escopos distintos e caminhos temáticos; revisão visual e automatizada. |
| `/acesso-justica/cobertura` | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 | 27 UFs, dois denominadores, consulta paginada e exportação integral. |
| `/acesso-justica/tempo-resposta` | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 | 27 tribunais, meses publicados, referência estadual compatível. |
| `/acesso-justica/conciliacao` | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 | Série, estrutura e acordos separados; extremo preservado e escala alternativa. |
| `/acesso-justica/recursos` | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 | Total, per capita e defensores; unidade e denominadores próximos ao gráfico. |
| `/acesso-justica/dados` | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 | Fontes, arquivos, localizadores e limites de reprodução reunidos. |

Todas as rotas têm prefixo `/eficiencia-estatal`. A nota 8 em interação/acessibilidade registra o limite de evidência: não houve sessão com leitor de tela real, aparelho físico de toque ou auditor independente. Ampliação CSS de texto não substitui teste de zoom nativo. Não se declara conformidade integral com WCAG.

## Publicação

PR #137. O estado de publicação é confirmado pelo deployment e pela consulta das URLs públicas após o merge, não apenas pelo build local.
