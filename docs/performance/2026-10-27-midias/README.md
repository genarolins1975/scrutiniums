# Iniciativa 1 — mídia da primeira tela

Implementação e medição local de 27/10/2026, sobre `bd7a6fd0cda885308940553fe3b33b7abe149629`.

## Mudanças

- Home: as oito lâminas do índice recolhido usam carregamento adiado, preservando dimensões e texto. O navegador não faz suas requisições enquanto a seção está fechada; ao abrir e percorrer o índice, todas continuam disponíveis.
- Fontes: Playfair Display, Inter e Archivo Narrow continuam locais. Apenas os três subsets latinos entram no preload; os arquivos latin-ext originais são carregados por faixa Unicode quando necessários. Acentos portugueses, números e símbolos correntes foram conferidos no Chromium; caracteres estendidos também foram testados com inspeção das fontes efetivamente usadas.
- Crédito: a gravura principal tem variantes WebP de 480, 800 e 1200 px, além do original de 1600 px, com `srcset`, `sizes` e prioridade alta. As cenas inferiores são arquivos individuais de 240/440 px com carregamento adiado.
- Energia: as quatro cenas têm arquivos individuais de 300/600 px. O tamanho declarado acompanha o uso em cartões ou no percurso visual. As cenas reservam espaço e preservam o recorte original.
- Os originais foram mantidos. As variantes são versionadas; não há processamento de imagem na primeira requisição nem nova dependência de runtime. Regeneração opcional: `python3 scripts/performance/gerar-gravuras.py`, Python 3.12 e Pillow 12.3.0.
- A revisão de prefetch não justificou alterar o comportamento nesta iniciativa: o ganho principal vem de mídia e fontes. A cascata de inicialização do Crédito e a renderização dinâmica da home continuam como iniciativas separadas.

## Método

Build de produção, Node 22.23.4 / Next 14.2.35 / Chromium via Playwright. Três visitas por rota, navegador sem cache em cada visita, viewport 390 × 844, DPR 1, CPU 4× mais lenta, rede de 200.000 B/s de download, 93.750 B/s de upload e 150 ms de latência. Medianas locais, não p75 de produção. Servidor reaproveitado; autenticação com usuário fictício e PGlite local.

A janela de coleta termina cinco segundos após `load`. Bytes são corpos codificados do documento e dos recursos, incluindo prefetch, sem cabeçalhos (kB decimais). LCP mede o maior elemento visível; `load` não mede prontidão da SPA. No Crédito, conteúdo assíncrono pode aparecer depois de `load`.

Produção não foi medida: o proxy negou acesso a scrutiniums.com. Região do banco, CDN, cold starts e dados reais de usuários não estão cobertos.

## Resultados

| Rota | LCP antes → depois | Load antes → depois | Transferência antes → depois |
|---|---:|---:|---:|
| `/` | 1.88 → 1.16 s | 4.98 → 2.07 s | 936 → 364 kB |
| `/perguntas/familias` | 1.41 → 1.11 s | 2.56 → 1.95 s | 446 → 324 kB |
| `/perguntas/energia-e-infraestrutura` | 1.18 → 1.08 s | 2.59 → 1.94 s | 446 → 324 kB |
| `/observatorio-do-credito` | 1.18 → 1.09 s | 2.61 → 2.00 s | 472 → 349 kB |
| `/app/observatorios` | 1.69 → 1.14 s | 2.76 → 2.15 s | 659 → 537 kB |
| `/setor-eletrico` | 1.90 → 1.23 s | 6.92 → 3.04 s | 1255 → 824 kB |
| `/observatorio` | 7.38 → 3.78 s | 2.45 → 2.46 s | 1281 → 554 kB |

## Validação

- `npm run build`: passou, incluindo compilação, lint, tipos e geração das páginas.
- `npm run verificar:rapido`: passou integralmente na rodada final; 217 arquivos, 6.887 testes aprovados, 12 ignorados e um `todo` (6.900 casos declarados). A suíte completa de CI e os pipelines Python não foram executados nesta alteração de mídia.
- `midias-iniciais.test.ts`: regressão real no Chromium para `/` e `/en`, ausência de downloads das lâminas fechadas, carregamento após expansão, ausência de fontes estendidas desnecessárias e renderização de caracteres portugueses/estendidos com fontes locais.
- Inspeção visual em 390, 768 e 1440 px da home anônima e das entradas de Energia e Crédito com conta local: sem erros JavaScript ou overflow horizontal. `visual.json` registra as variantes escolhidas e as dimensões observadas; imagens fora da área próxima à tela podem estar intencionalmente sem download por lazy loading.

## Estado da entrega

Implementado e validado no checkout local. PR e deploy não publicados: a API do GitHub respondeu `Forbidden`, embora a leitura Git pelo proxy funcione. Nenhum merge foi realizado. Medidas de produção precisam ser repetidas após publicação; a melhoria de mídia não elimina a cascata de inicialização do Crédito nem o custo de sessão/renderização dinâmica.

Os resultados por visita estão em `medicoes.json`. A home transferiu **61% menos bytes** e seu LCP caiu **38%**; o LCP do painel de Crédito caiu **49%**. O evento `load` do Crédito ficou praticamente igual, confirmando que esse evento sozinho não acompanha a melhora da abertura assíncrona.

`layout_shift_sum` registra a soma de deslocamentos sem interação durante a janela, apenas na versão final; não é o CLS oficial por janelas de sessão nem uma comparação antes/depois. A home registrou zero. A investigação das rotas de Energia e do aperitivo de Crédito atribuiu deslocamentos à hidratação dos controles da conta e da faixa “Fontes e referência”, depois de terminarem os downloads das fontes. A estabilidade da abertura assíncrona do Crédito e desses controles permanece para as próximas iniciativas.
