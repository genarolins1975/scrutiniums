# Etapa 3 — restos a pagar e entregas físicas

Estado em 12/10/2026: fontes identificadas e arquivos baixados; leitura integral, conciliação e painéis desta etapa ainda pendentes. O ambiente local perdeu a conexão durante a análise. Nenhuma observação desta etapa foi publicada e nenhum indicador teve seu estado de integração alterado.

## Fontes confirmadas

1. [Tesouro: base RAP 2026](https://www.tesourotransparente.gov.br/ckan/dataset/relatorio-de-avaliacao-dos-restos-a-pagar-base-de-dados/resource/60affecf-6165-4d7d-bcb9-040913d17752). Arquivo XLSX de 13,9 MiB, publicado/atualizado em 29/01/2026, licença ODbL. [Download oficial](https://www.tesourotransparente.gov.br/ckan/dataset/5eba054b-84d7-4eff-9bd7-e8cabbf940e5/resource/60affecf-6165-4d7d-bcb9-040913d17752/download/dadosrelatoriorap2026.xlsx).
2. [Relatório RAP 2026](https://www.tesourotransparente.gov.br/publicacoes/relatorio-de-avaliacao-dos-restos-a-pagar/2026/114), publicado em 29/01/2026. Conciliação com tabelas oficiais ainda necessária.
3. [SIOP: recursos abertos](https://www1.siop.planejamento.gov.br/siopdoc/doku.php/acesso_publico:dados_abertos). [ZIP AFFO 2025](https://www1.siop.planejamento.gov.br/siopdoc/lib/exe/fetch.php/acesso_publico:dados_abertos:acompanhamentoorcamentario_2025jandez_20260522_ascii.zip): captação final janeiro–dezembro/2025, edição identificada no nome de 22/05/2026; a data de publicação não foi confirmada separadamente.
4. [Dicionário AFFO 2025](https://www1.siop.planejamento.gov.br/siopdoc/lib/exe/fetch.php/acesso_publico:dados_abertos:dicionario_de_dados_affo_2025_final_v22-05-2026.pdf), atualizado em 22/05/2026.
5. [Orientador SIOP](https://www1.siop.planejamento.gov.br/siopdoc/doku.php/acompanhamento_orcamentario:orientador_acompanhamento_orcamentario), versão consultada atualizada em 16/06/2026. Seção 7 define ECLOA e EFLOA. Confirmar eventuais diferenças para o orientador de 2025 antes de homologar valores retrospectivos.

## O que já foi inspecionado

O XLSX RAP contém duas abas: “Descrição das variáveis” (65 linhas, 3 colunas) e “Base Geral” (67.457 linhas, incluindo cabeçalho, 46 colunas). As primeiras linhas da base têm MES_LANCAMENTO = 000/2026 e NE_CCOR representando ano do empenho. Isso é posição de abertura; não significa fluxo realizado em janeiro nem posição corrente de outubro. Os demais períodos e os campos monetários ainda precisam ser inventariados. Não inferir total, inscrição, reinscrição, pagamento ou cancelamento a partir das primeiras linhas.

O ZIP AFFO possui quatro CSVs: FisicoFinanceiro, Regionalizacao, Agendas e PerguntasEstruturadas. A exploração inicial confirmou campos e exemplos, mas não estabeleceu universo completo ou totais. A fonte mistura localizadores e planos orçamentários; selecionar um nível por vista antes de agregar. Não juntar as quatro tabelas sem validar cardinalidade, pois agendas e regionalizações podem multiplicar programações.

## Contrato físico-financeiro

| Campo de origem | Uso previsto | Limite |
| --- | --- | --- |
| qtdemetaloa | Meta física original | Não substituir pela revisão |
| qtdemetaatual | Meta LOA + créditos | Base de ECLOA/EFLOA |
| reprogramadofisico | Meta gerencial reprogramada | Exibir em coluna própria |
| realizadoloa | Produção informada no período | Manter data de apuração; não chamar de impacto |
| dataapuracaorealizadoloa | Data de apuração física | Não substituir pela captura |
| realizadorap | Produção com recursos RAP | Separada da produção LOA |
| autorizado | Dotação atualizada | Não é custo contábil |
| liquidado | Liquidação do exercício no AFFO | Não somar RAP silenciosamente |
| liquidadorap | Liquidação de RAP não processados | Não confundir com pagamento |

A descrição de elementosemcaptacao no dicionário parece exigir esclarecimento frente ao nome do campo e aos exemplos: não usar esse sinalizador como filtro até validar sua semântica. Produto, unidade, nível, período e dados ausentes devem ser preservados.

O módulo `src/lib/contas-publicas/entregas.ts` prepara:
- cumprimento físico com a meta escolhida; zero observado distinto de ausência e de meta zero;
- EFLOA conforme fórmula do orientador, com limites explícitos: índice físico-financeiro relativo ao plano, sem inferência de eficiência econômica, custo, qualidade ou impacto;
- identificação completa e bloqueio de duplicatas ou mistura de localizadores com POs;
- leitura numérica estrita do CSV brasileiro.

O módulo ainda não é usado para publicar resultados. Não há escore agregado nem média entre produtos diferentes. A futura interface mostrará meta original, atualizada, reprogramada e realizado lado a lado. Valores acima de 100% permanecem visíveis. Um índice superior a 100% não comprova excelência.

## Sequência de conclusão

1. Retomar ambiente, ler integralmente dicionários e arquivos; registrar hashes SHA-256, codificação e contagem por nível/cobertura.
2. RAP: identificar campos monetários, inscrição/reinscrição, tipos processados e não processados, origem e períodos. Conferir totais com relatório antes de publicar.
3. AFFO: validar chaves e semântica das lacunas; produzir relatório de cobertura, mantendo todos os registros e motivos de inelegibilidade. Não transformar campo vazio em zero.
4. Implementar duas páginas: RAP com estoque por origem e tipo; entregas com busca por ação/órgão e ficha individual. Não misturar estoques RAP com fluxos, nem somar produtos em unidades diferentes.
5. Validar importador e cálculos, testar filtros e downloads, revisar 320/390/768/1440 px e submeter o novo preview. Custos contábeis permanecem uma integração própria.

## Continuidade local

Downloads desta investigação ficaram temporariamente em `/tmp/contas-etapa3/`: rap2026.xlsx, metas.zip, metas.csv e dicionario.pdf. Esses arquivos temporários não são a entrega persistida; recuperar pelas URLs acima caso não estejam mais disponíveis. O CSV temporário metas.csv corresponde ao último membro extraído, FisicoFinanceiro; não o tratar como união das quatro tabelas.
