# PR #365 — homologação do Mapa da Conta

Estado técnico: **homologação local concluída: suíte completa, filtro rápido e revisão independente de UX aprovados**. A situação remota atualizada está na descrição e nos checks do PR. Não foi realizado merge nem publicação em produção.

PR: https://github.com/genarolins1975/scrutiniums/pull/365

## Resultado para o usuário

A abertura mostra título, busca e os seis observatórios também para quem retorna. As 28 coleções continuam disponíveis por links diretos, com páginas/ capítulos expansíveis, estados de disponibilidade e referência dos dados. Busca e expansões são restauradas na URL; o retorno de uma página mantém esse estado. “Continuar em” acompanha a navegação Next e a SPA do Crédito, inclusive voltar/avançar, sem confundir prefetch com visita.

Na conta recorrente, o H1 passou de 633 para 134 px no celular e de 479 para 183 px no desktop. Os seis destinos cabem na primeira tela. Links curtos e links de método agora têm alvo mínimo de 44 × 44 px. As setas do índice permanecem junto ao rótulo no móvel.

A continuidade usa o mesmo cookie HttpOnly, com a mesma duração e escopo. O endpoint exige origem e sessão válidas; a fila mantém a ordem das visitas, e a gravação tem prazo de 2,5 segundos. Não cria a tabela de páginas recentes de M2 nem altera a UF do perfil.

## Integração e conflitos

- PR recebido: `1323ea67de32672038be787ea7deef5ee9d77235`.
- Main integrada: `9a12b64b6394644229679f8f9d5b602a27ae6a9b`.
- [Commit de integração](https://github.com/genarolins1975/scrutiniums/commit/28ce5999ec5e402b256ea723cfd6e6fef5a61cae), com os dois pais preservados.
- [Commit de implementação e testes](https://github.com/genarolins1975/scrutiniums/commit/472746bfa16a938e1c6cc8a9ae11f97b04c952fb).
- [Compatibilidade de origem atrás de proxy](https://github.com/genarolins1975/scrutiniums/commit/00f9a3838221be975718c3e1af67ef95fc096e48).
- Build final avaliado: `TTwbz4-734bV6VVI1HyWJ`, commit `00f9a3838221be975718c3e1af67ef95fc096e48`. As oito capturas são idênticas às da versão visual anterior; [comparação por hash](depois/comparacao-capturas.json).

| Conflito | Decisão | Justificativa técnica |
|---|---|---|
| `src/components/busca/BuscaPlataforma.tsx` | Preservar autocorreção, busca exata, sugestões, aviso de cobertura, versão aberta e navegação por teclado da main; incorporar `rotuloVisivel` do mapa. | Reúne o rótulo acessível do PR com os comportamentos recentes da busca global. A persistência de consulta é opcional e ativada somente no mapa. |
| `src/lib/telemetry.ts` | Manter a allowlist dinâmica das coleções do mapa, incorporar o rótulo “Início do painel” da main e separar a tipagem das seções estáticas da resolução dinâmica. | Conserva os eventos válidos das 28 coleções e a terminologia atual do Crédito, sem ampliar o conteúdo coletado. |

Foram os únicos dois conflitos textuais. As mudanças da main em navegação única, tokens, painéis, Crédito e OBEE foram incorporadas. A revisão independente conferiu ambas as resoluções. Não houve force push. As alterações de dados presentes na integração pertencem à main; esta homologação não modificou fórmulas, fontes, vintages, metodologias, autenticação, política de privacidade ou dados publicados.

## Avaliação independente

[Parecer completo](revisao-independente.md), produzido por revisor separado da implementação, com inspeção das quatro configurações do mapa e três referências atuais.

| Dimensão | Anterior | Final | Meta |
|---|---:|---:|---:|
| Direção de arte | 8 | 8 | ≥ 8 |
| Hierarquia visual | 8 | 9 | ≥ 9 |
| Tipografia | 7 | 8 | ≥ 8 |
| Densidade informacional | 8 | 8 | ≥ 8 |
| Didática | 7 | 8 | ≥ 8 |
| Comparabilidade | 8 | 8 | ≥ 8 |
| Interação e acessibilidade | 8 | 9 | ≥ 9 |
| Responsividade | 8 | 9 | ≥ 9 |

As notas são julgamento independente fundamentado em imagens e tarefas, não pontuações calculadas por axe. A rodada intermediária manteve responsividade em 8 até corrigir e recapturar a quebra das setas do índice. O parecer final não encontrou pendência visual bloqueante.

## Capturas antes e depois

“Antes” é o PR já integrado à main atual, antes das melhorias desta homologação, build `n5jnelc85mcfTIBM_YejT`. “Depois” é o commit `00f9a3838`, build `TTwbz4-734bV6VVI1HyWJ`. Todas as imagens usam contas sintéticas oficiais, com sessão real em banco temporário; não usam contas ou dados de perfil de produção.

| Conta / largura | Antes — primeira tela | Depois — primeira tela | Página inteira antes / depois |
|---|---|---|---|
| Nova / 390 | [Antes](antes/nova/app_observatorios-390-com-sessao-primeira-tela.jpg) | [Depois](depois/nova/app_observatorios-390-com-sessao-primeira-tela.jpg) | [Antes](antes/nova/app_observatorios-390-com-sessao.jpg) / [Depois](depois/nova/app_observatorios-390-com-sessao.jpg) |
| Nova / 1440 | [Antes](antes/nova/app_observatorios-1440-com-sessao-primeira-tela.jpg) | [Depois](depois/nova/app_observatorios-1440-com-sessao-primeira-tela.jpg) | [Antes](antes/nova/app_observatorios-1440-com-sessao.jpg) / [Depois](depois/nova/app_observatorios-1440-com-sessao.jpg) |
| Recorrente / 390 | [Antes](antes/volta/app_observatorios-390-com-sessao-primeira-tela.jpg) | [Depois](depois/volta/app_observatorios-390-com-sessao-primeira-tela.jpg) | [Antes](antes/volta/app_observatorios-390-com-sessao.jpg) / [Depois](depois/volta/app_observatorios-390-com-sessao.jpg) |
| Recorrente / 1440 | [Antes](antes/volta/app_observatorios-1440-com-sessao-primeira-tela.jpg) | [Depois](depois/volta/app_observatorios-1440-com-sessao-primeira-tela.jpg) | [Antes](antes/volta/app_observatorios-1440-com-sessao.jpg) / [Depois](depois/volta/app_observatorios-1440-com-sessao.jpg) |

Altura total, medida pelas capturas: conta nova 5.488 → 5.687 px (390) e 3.093 → 3.202 px (1440); recorrente 5.987 → 6.185 px e 3.388 → 3.497 px. O índice acrescenta altura, mas torna os seis destinos acessíveis antes das recomendações e mantém os orçamentos vigentes.

Mais evidências: [estados expandidos e resultado funcional](depois/funcional/resultado.json), [34 navegações reais](depois/navegacao/resultado.json), [rede lenta](depois/rede-lenta/resultado.json), [referências atuais de Crédito, Energia e OBEE](depois/referencias/evidencias.md). As referências foram capturadas no build `tnEt0wD5K5bo3Ayunr8ee`; a alteração posterior envolve somente endpoint e testes de origem, com interface idêntica. Os sete casos oficiais — quatro do mapa e três referências — tiveram HTTP 200, axe 0, console 0 e nenhuma rolagem horizontal ou passagem indevida pelo login.

## Testes e reprodução

Ambiente: Node 22.23.3, Python em ambiente virtual com pyarrow 26.0.0, Chromium 154 em `/usr/bin/chromium`. `bash scripts/preparar-sessao.sh` foi executado antes dos testes. São usados os materializadores oficiais com verificação de hash e o helper `scripts/servidor-local.mjs` para bancos/sessões temporários.

```sh
export PATH=/workspace/.venv-pr365/bin:/workspace/.onboarding-tools/node_modules/.bin:$PATH
export I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium
export NODE_OPTIONS=--max-old-space-size=4096
bash scripts/preparar-sessao.sh
npm run verificar:pr
npm run verificar:rapido
node scripts/mapa-conta-verificacao.mjs /tmp/pr365-publicacao/funcional
node scripts/mapa-conta-navegacao.mjs /tmp/pr365-publicacao/navegacao
node scripts/mapa-conta-rede-lenta.mjs /tmp/pr365-publicacao/rede-lenta
node scripts/mapa-conta-origem-proxy.mjs /tmp/pr365-publicacao/proxy-versionado
npm run evidencias -- --rotas /app/observatorios --saida /tmp/pr365-publicacao/nova --larguras 390,1440 --modos com --conta nova
npm run evidencias -- --rotas /app/observatorios --saida /tmp/pr365-publicacao/volta --larguras 390,1440 --modos com --conta volta
npm run evidencias -- --rotas /observatorio /setor-eletrico /eficiencia-estatal --saida /tmp/pr365-definitivo/referencias --larguras 1440 --modos com --conta nova
```

O build e os testes não devem rodar junto com o servidor de desenvolvimento, que também usa `.next`. Não editar a árvore durante os runners oficiais. Na máquina de homologação, o checkout final foi `/workspace/scrutiniums-pr365-final`; os arquivos anteriores do usuário permaneceram no checkout original.

| Verificação | Resultado definitivo | Evidência |
|---|---|---|
| `npm run verificar:pr` | Aprovado em 17 min 27 s, código 0; árvore versionada preservada | [Log completo](logs/verificar-pr.txt) |
| Lint e TypeScript | Aprovados | Log oficial |
| Python | Pipeline: 2.400 casos, 11 ignorados; pesquisa: 73; Eficiência: 66; gold: 28; suítes OBEE complementares: 9, 11, 7, 4 e 15. Todas aprovadas. | Log oficial, resultados finais de cada runner |
| Reconciliação, precisão e índice OBEE v4 | Aprovados | Log oficial |
| Build de produção | Aprovado; build `TTwbz4-734bV6VVI1HyWJ` | Log oficial |
| Judiciário | 68 telas, 224 checagens, nenhum erro | Log oficial e `judiciario-resultado.json` |
| Vitest | 384 arquivos aprovados; 9.506 testes aprovados, 12 ignorados e 1 todo pré-existentes | Log oficial |
| `npm run verificar:rapido` | Aprovado em 3 min 44 s; lint, tipos, derivados, cobertura bilíngue e 263 arquivos / 7.017 testes aprovados (12 ignorados, 1 todo) | [Log rápido](logs/verificar-rapido.txt) |
| Mapa: busca, teclado, URL, reload, voltar/avançar, ida e retorno de página | Duas larguras aprovadas; 179 links internos HTTP 200; console/axe/overflow 0; piso 12 px; nenhum alvo menor que 44 × 44 px | JSON funcional |
| Navegação real das 28 coleções e 6 observatórios | 34/34 aprovados, H1 presente, HTTP 200, console/pageerror/overflow 0, sem login. Crédito normaliza `/observatorio` para `/observatorio/map`. | JSON de navegação |
| Continuidade | Next sem documento adicional, prefetch neutro e SPA Crédito/Pix/voltar/avançar/retorno aprovados | JSON funcional |
| Origem e proxy HTTP | 13/13 casos aprovados; origens válidas 204, recusas esperadas 403/401/400; cookie seguro e no-store | [JSON independente](depois/proxy/resultado.json) |
| Rede lenta | 5/5 aprovados; saída extrema em 2.420 ms; respostas antigas não sobrescreveram a visita seguinte | JSON independente |

## Falhas diagnosticadas e limites

- A validação final de origem identificou diferença comprovada em `next start` atrás de proxy: uma origem canônica era recusada pelo endpoint novo e aceita pela rota legada. O endpoint foi alinhado aos hosts já permitidos no repositório, preservando Origin obrigatório, sessão e rejeição de origens externas; forwarded só é confiável com `VERCEL=1` ou `TRUST_PROXY=1`. Não foi demonstrada falha na Vercel padrão. A ratificação HTTP e a nova suíte estão registradas nas evidências finais. [Diagnóstico](historico/origem-proxy-parecer.md).

- Preparação inicial do pyarrow tentou escrever fora da área permitida. Resolvida com o ambiente virtual em `/workspace`, sem alterar dependências ou lockfile. A configuração reutilizável foi salva no rascunho do ambiente.
- A primeira verificação rápida do clone não encontrou `origin/main`. A referência foi obtida por fetch; lint/tipos já haviam passado. Esse ensaio não foi contado como aprovação final.
- A primeira rodada completa das melhorias teve uma falha em `credito-casca.test.ts`: sua busca lexical encontrou o novo manipulador auxiliar antes do roteador original. O manipulador foi movido após o roteador; o teste original permaneceu intacto. A rodada focada seguinte passou 100/100 testes. [Log da falha](historico/verificar-rodada-1.txt).
- Os primeiros scripts de evidência precisaram corrigir a leitura de cookie percent-encoded e abrir o seletor antes de clicar um link oculto; uma chamada de referências recebeu rotas com separador incorreto. Os scripts e comandos corrigidos foram efetivamente reexecutados. Isso não exigiu contornar verificações do produto.
- Uma navegação sintética em rajada acionou o limite existente de 40 eventos de telemetria por usuário/minuto e gerou 429. A navegação normal foi repetida com intervalo de 5 segundos, sem alterar a política: 34/34 destinos aprovados. A rajada não é apresentada como teste de carga aprovado. [Resultado da rajada](historico/navegacao-rajada.json).
- Se a gravação auxiliar de continuidade falha ou excede o prazo, o cookie anterior pode permanecer. A saída do usuário é liberada; não há garantia de continuidade offline.
- As evidências visuais cobrem Chromium, contas sintéticas e os tamanhos declarados. Axe e tarefas de teclado não substituem todas as tecnologias assistivas. Testes ignorados/todo do repositório são reportados separadamente; não foram declarados como executados.

## Pendências e integridade

A suíte completa, o filtro rápido e a revisão independente estão concluídos. Não permanece pendência local bloqueante; a confirmação de atualização da branch, ausência de conflitos e checks remotos consta no PR. A revisão independente não identificou pendência visual bloqueante. As decisões de produto sobre UF do perfil e futuras perguntas individuais das coleções foram preservadas; não são pré-requisitos desta homologação nem foram tomadas em nome do dono. M2 permanece separado.
