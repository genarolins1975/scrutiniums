# Etapa 2 — dados oficiais e painéis

Integração de recortes estáticos, sem atualização automática no build. A interface oferece seleção de exercício SIOP, estágio da composição e período RTN. Não atribui nota de gestão.

## Cobertura

| Fonte | Perímetro | Recorte | Unidade |
| --- | --- | --- | --- |
| SIOP | Orçamento Fiscal e da Seguridade Social, esferas 10 e 20 | 2025 encerrado, base atualizada em 24/01/2026; 2026 em curso, atualização em 10/10/2026 | Reais correntes |
| RTN, edição julho/2026 | Governo Central, acima da linha | Meses de janeiro/2020 a julho/2026; anos completos 2020–2025 | Milhões de reais correntes |

Datas de atualização do SIOP indicam atualização da base, não garantem competência completa até esse dia. A interface não compara o acumulado corrente do SIOP com o encerramento anterior. O RTN usa a mesma edição para todo o histórico e compara janeiro–julho/2026 apenas com janeiro–julho/2025. Valores sujeitos a revisão.

## Proveniência e reprodução

- `src/lib/contas-publicas/snapshots/dados.json`: valores, unidade, captura UTC, URLs oficiais, SHA-256 de cada arquivo de origem, linhas/colunas do RTN, datas SIOP e resíduos de conciliação.
- `data/contas-publicas/fontes/`: respostas originais de quatro consultas SIOP; preservar bytes para conferir os hashes.
- `scripts/contas-publicas/{esferas,gnd}.rq`: consultas completas. A consulta de GND valida presença de todos os valores e ausência de multiplicação de itens nos joins.
- `scripts/contas-publicas/importar.py`: extrator validado. Dependências Python externas ao aplicativo: requests e openpyxl. Executar `python3 scripts/contas-publicas/importar.py`; não adicionar a prebuild. A planilha RTN é baixada da URL versionada de julho/2026, sem necessidade de credenciais.
- O XLSX original não está versionado no Git. Sua URL e hash permitem recuperação e verificação se o servidor mantiver a edição; os dados extraídos ficam no snapshot. Se o arquivo remoto for revisado, o hash mudará: revisar a mudança antes de publicar.
- Download público `/contas-publicas/serie.json`. Catálogo metodológico permanece separado em `/contas-publicas/catalogo.json`.
- A data de publicação do arquivo RTN não foi identificada com precisão e permanece nula, sem substituição pela data de captura.

## Conciliação

RTN: receita total menos transferências = receita líquida; receita líquida menos despesa = resultado acima da linha; quatro componentes exclusivos somam a despesa. Soma de 12 meses conferida contra tabela anual 2.1, não apenas contra um total recalculado da mesma tabela. Tolerância de extração: R$ 0,01 milhão, com identidades verificadas em precisão maior nos testes.

SIOP: totais da consulta por esfera conferidos contra consulta independente por GND. A resposta devolve os agregados em reais inteiros. Resíduos observados: em 2025, liquidação +R$ 1; em 2026, liquidação e pagamento −R$ 1; demais campos zero. Não se presume causa sem evidência. Tolerância explícita e conservadora: R$ 5, sem modificar valores para forçar igualdade. Resíduos registrados no snapshot e na interface. Nenhuma etapa aceita valor ausente como zero.

## Limites e próximos dados

- Pago no SIOP refere-se ao orçamento do exercício. Pagamentos de restos a pagar não integram esse campo.
- Juros e amortização ficam identificados. Refinanciamento ainda não foi desagregado dentro da amortização. Não denominar o total OFSS de gasto em serviços; não calcular gasto primário apenas excluindo GND 2 e 6.
- RTN acima da linha não comprova cumprimento de meta fiscal. Isso depende da apuração abaixo da linha e dos ajustes/exclusões aplicáveis.
- Eficiência requer custo e produto comparável; eficácia requer metas e entregas. Nenhuma delas é inferida da taxa de execução.
- Resultado primário e execução liquidada estão marcados como integração parcial. PIB, metas fiscais, séries mensais SIOP, RAP, custos, metas físicas e avaliações ainda pendentes.

## Validação desta etapa

- Extração RTN e consultas SIOP conciliadas antes da geração do snapshot.
- TypeScript restrito ao domínio e testes de integridade/calculadora.
- Renderização SSR dos componentes reais. Não substitui revisão visual e interação em navegador hidratado.
- O build integral e a revisão em preview continuam como gates antes de merge. Ambiente local incompleto para o build de todo o repositório; a etapa anterior registrou bloqueio do servidor e da abertura de HTML local.
