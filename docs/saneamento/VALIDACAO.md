# Validação da primeira entrega

Data: 14/10/2026. Todas as notas abaixo são **autoavaliação do autor da entrega, não revisão independente**. "Não verificado" significa que o teste não foi feito.

## Evidências automatizadas

| Verificação | Comando | Resultado |
|---|---|---|
| Gold reproduzível byte a byte a partir do seed; conferências zeradas; ausência não vira zero | `python3 -m unittest pipeline.tests.test_observatorio_saneamento` | 4 testes, todos passam |
| Somas municipais reproduzem IBGE e consolidado SINISA; 429 valores iguais aos da Eficiência Estatal; agregação por soma; zero e ausência; capítulos sem promessa; sem travessão | `npx vitest run src/tests/saneamento-gold.test.ts` | 13 testes, todos passam |
| Simulador: exemplos dos reguladores ao centavo, limites de faixa, municípios associados | `npx vitest run src/tests/saneamento-conta.test.ts` | 11 testes, todos passam |
| Registro de domínios (seis observatórios), rotas públicas, sitemap | `npx vitest run src/tests/dois-observatorios.test.ts src/tests/rotas-publicas.test.ts` | passam |
| Suíte completa da plataforma | `npx vitest run` | 4.932 passam; 1 falha por tempo limite em `trabalho-renda-dados.test.ts` sob carga, que passa isolado (6 de 6) e não toca o saneamento |
| Tipos e lint | `npx tsc --noEmit`, `npx next lint` | sem erros |
| Build de produção | `npm run build` | concluído; 23 rotas do saneamento geradas (2 dinâmicas: fichas de município e de prestador) |

## Inspeção em navegador (build de produção, Playwright/Chromium)

Script: `scripts/saneamento/verificacao.mjs`, sessão de auditoria local. 24 rotas × larguras 320, 390, 768 e 1440 px = 96 medições: HTTP 200, exatamente um H1, nenhuma rolagem horizontal da página e nenhum erro de JavaScript em todas. Capturas de página inteira revisadas a olho por amostra: esgoto, planejamento, investimento, tarifa social e ficha da SABESP em 1440 px; comparador de prestadores e ficha de Alta Floresta D'Oeste em 390 px; tarifa social em 320 px; páginas do capítulo 5 em 390 e 1440 px. As demais capturas existem e não foram lidas uma a uma.

Não verificado: leitor de tela real, zoom de texto a 200%, contraste por ferramenta automatizada (axe), navegação só por teclado de ponta a ponta, desempenho de campo e rede lenta.

## Rubrica por página (autoavaliação)

Critérios: dado real com fonte e período (D), método e ressalvas visíveis (M), comportamento técnico verificado (T), resposta à pergunta do capítulo (R). Nota de 0 a 10.

| Rota | D | M | T | R | Nota | Observação |
|---|---|---|---|---|---|---|
| `/saneamento` | sim | sim | sim | sim | 9 | Índice dos eixos com situação de cada capítulo |
| `/saneamento/acesso` | sim | sim | sim | sim | 9 | Atlas, pessoas e proporção, composição das fontes, evolução |
| `/saneamento/continuidade` | sim | sim | sim | parcial | 7 | Sem qualidade da água (SISAGUA) |
| `/saneamento/esgoto` | sim | sim | sim | sim | 9 | Mapa de estações não publicado por coordenadas inconsistentes |
| `/saneamento/preco-regulado` e 5.1 a 5.5 | sim | sim | sim | parcial | 8 | Amostra de cinco prestadores; série da conta contra inflação ausente |
| `/saneamento/tarifa-social` | sim | sim | sim | parcial | 8 | Economias com tarifa social por 100 famílias elegíveis do CadÚnico; famílias beneficiadas não publicadas |
| `/saneamento/prestadores` e fichas | sim | sim | sim | parcial | 8 | Sem controle societário |
| `/saneamento/prestadores/comparar` | sim | sim | sim | parcial | 8 | Sem seleção automática de pares |
| `/saneamento/investimento` | sim | sim | sim | parcial | 8 | Sem ligação a obras |
| `/saneamento/financiamento` | sim | sim | sim | parcial | 7 | Sem BNDES, CAIXA e Transferegov |
| `/saneamento/planejamento` | sim | sim | sim | sim | 9 | Não declara cumprimento de meta, por falta de ICA, ICE e soluções alternativas |
| `/saneamento/responsaveis` | sim | sim | sim | parcial | 7 | Sem fiscalizações e sanções |
| `/saneamento/resiliencia` | sim | sim | sim | parcial | 7 | Sem mananciais e eventos extremos |
| `/saneamento/municipio` e fichas | sim | sim | sim | sim | 9 | Busca, comparação com UF, Brasil e pares |
| `/saneamento/comparar` | sim | sim | sim | sim | 8 | Até quatro municípios, link e CSV |
| `/saneamento/metodologia` (pública) | sim | sim | sim | sim | 9 | Fontes com sha256, matriz, conferências, downloads |

Páginas abaixo de 9 ficam abaixo por lacuna de dado declarada, não por defeito conhecido de interface. Capítulos 2 (desigualdades) e 13 (saúde e ambiente), comparação internacional (JMP) e explorador de prioridades não têm página.

## Recomendação

Antes de abrir o domínio ao público, revisão em contexto limpo por pessoa ou agente sem participação na construção, cobrindo: conferência amostral dos números da ficha municipal contra as planilhas do SINISA, leitura dos estudos de caso tarifários contra as notas técnicas, e acessibilidade com leitor de tela.

## Integração do CadÚnico (14/10/2026)

- Fonte: MDS, SAGI, API MI Social, meses 202412 e 202609, sha256 de cada consulta em `meta.json`.
- Conferência: até meio salário-mínimo + acima = total de famílias em 11.141 de 11.141 registros municipais; um município sem dado em dez/2024 (510183, instalado depois).
- Testes: `saneamento-gold.test.ts` passa a exigir que a soma municipal reproduza o total do Brasil, que a razão seja razão de somas no mesmo universo, que "não oferece" conte zero e que "sem resposta" fique sem dado.
- Navegador (servidor de desenvolvimento): tarifa social, ficha de Recife, metodologia e investimento em 320, 390 e 1440 px, HTTP 200, um H1, sem transbordo, sem erro de JavaScript.
- Não verificado: número oficial independente do total de dezembro de 2024 (o total vem da própria base do MDS).
