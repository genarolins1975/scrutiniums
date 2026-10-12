# Entrega de didática e coerência

Verificação em 12/10/2026. Código local validado: `a686ecb`. Escopo exclusivo de Contas Públicas Federais. O relatório inicial permanece em `RELATORIO.md` como diagnóstico, não como descrição da versão entregue.

## O que mudou

- Fase 1: escala monetária automática, sinal tipográfico, participações com uma casa decimal, cores semânticas, status conforme disponibilidade e alerta de dívida/refinanciamento.
- Fase 2: respostas iniciais (A0), régua de R$ 100 pagos (A1), escada da execução (A2), ponte fiscal (A3), ciclo e idade de RAP (A4), cumprimento por programação (A5), composição de custos (A6), proveniência (A8) e matriz de cobertura (A10).
- Fase 3: glossário com 15 termos e referências oficiais (A7), termos no ponto de uso, metas em linhas responsivas com detalhe próximo à seleção, catálogo filtrado inicialmente pelos indicadores observados, downloads ao final e comparação anual com opção explícita de reescala sem 2020.
- A9 não foi implementado: PIB e população exigem homologação prévia. Não foram criadas notas de eficiência, médias entre produtos heterogêneos ou novas fontes de dados quantitativos.

## Situação dos achados

| Achados | Situação | Evidência / limite |
|---|---|---|
| I1–I8 | Implementados | Respostas na abertura, dívida, escala, frase do déficit, alternância anual, espaçamento, retirada da duplicação integral e precisão fixa. |
| E1–E4 | Implementados | Status coerente, diferenças entre estágios, paleta semântica e definições acessíveis. |
| R1–R4 | Implementados | Origem do saldo substitui redundância; quatro faixas de idade; ciclo; partição no encerramento. Tabela exata preservada. |
| C1, C3, C4 | Implementados | Destaques coincidentes combinados; superfície clara; classificação revisada anotada diretamente. |
| C2 | Parcial | Definições dos grupos principais, com páginas do RFC. Nem toda subcategoria contábil tem definição própria. |
| M1–M6 | Implementados | Leitura visual sem tabela horizontal obrigatória, nomes dos locais, barras neutras, precisão e detalhe com fechamento/foco. Títulos oficiais completos preservados. |
| D1 | Parcial | Downloads reunidos em tabela final com conteúdo, formato e captura. Tamanho dos arquivos não foi incluído. |
| D2–D3 | Implementados | Matriz por capítulo e filtro; quatro indicadores observados e um painel complementar explicitados. |
| D4 | Parcial | Três exemplos concretos dos perímetros. Nem cada uma das oito regras recebeu exemplo individual. |

## Verificações executadas

| Verificação | Resultado |
|---|---|
| `npx vitest run src/tests/contas-publicas*.test.ts` | 6 arquivos, 41 testes aprovados. Identidades, arredondamento, formatação, metas e cobertura. |
| `npx tsc --noEmit` | Aprovado. |
| `npm run lint` | Sem avisos ou erros de ESLint. |
| `npm run build` | Build de produção concluído com sucesso. |
| axe-core 4.12.1, WCAG 2.0/2.1 A e AA | Nove rotas em 1440 e 390 px: zero violações automáticas, 18 resultados em `axe-rotas.json`. |
| Largura de página | Zero transbordamento horizontal em 320, 390, 768 e 1440 px. Evidência adicional em `responsividade-adicional.json`. |
| Metas por teclado | Enter abre e foca o detalhe; Escape fecha e devolve o foco ao botão. Em 390 px, detalhe no fluxo e topo a 24 px após rolagem. |
| Glossário por teclado | Enter abre a definição; Escape fecha e devolve o foco ao termo. Sem transbordamento móvel. |
| Comparação anual | Alternância exclui apenas 2020, recalcula escala e mostra aviso explícito. Anos 2021–2025 preservados. |
| Revisão visual | Capturas de página inteira em desktop e celular revisadas, incluindo topo, regiões intermediárias e detalhe de metas. |
| Integridade de escopo | Snapshots, importadores, contratos, dependências e outros observatórios não fazem parte da alteração. |

Os testes automáticos de acessibilidade não equivalem a conformidade completa. Leitor de tela e zoom de 200% não foram verificados. A captura do glossário é apenas posterior, pois a rota não existia na versão anterior. As capturas usam o build de produção local; a publicação deverá ser confirmada separadamente após o merge.

## Rubrica após a revisão

Autoavaliação, não avaliação independente. Notas de 0 a 10; 8 significa bom com limitações. A ausência de leitor de tela e zoom testados limita acessibilidade a 8. Os pontos parciais acima permanecem explícitos.

| Critério | Início | Panorama | Execução | RAP | Custos | Metas | Catálogo | Método | Glossário |
|---|---|---|---|---|---|---|---|---|---|
| Direção de arte | 9 | 9 | 9 | 9 | 9 | 8 | 8 | 8 | 8 |
| Hierarquia | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |
| Tipografia e acabamento | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 |
| Densidade e profundidade | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 8 | 8 |
| Didática visual | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 8 | 8 |
| Comparabilidade | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 |
| Interação e acessibilidade | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 |
| Responsividade | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 | 9 |

## Capturas comparáveis

Capturas de página inteira foram produzidas em 1440 e 390 px para as oito rotas preexistentes, antes e depois, e para a nova rota de glossário após a implementação. O detalhe móvel de metas também foi registrado. As capturas foram revisadas localmente e reduzidas para no máximo 1100 px de largura em JPEG.

O envio das imagens ao GitHub foi bloqueado pela revisão automática de aprovação. As capturas permanecem no workspace; esta entrega remota inclui somente código, relatório textual e resultados JSON. O diretório do diagnóstico inicial menciona capturas que não estão anexadas a este PR.
