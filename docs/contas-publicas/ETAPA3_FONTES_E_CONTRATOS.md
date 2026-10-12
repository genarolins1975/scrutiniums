# Etapa 3 — restos a pagar e entregas físicas

Estado em 12/10/2026: bases lidas integralmente, conciliadas e integradas aos capítulos de restos a pagar e metas. A etapa acrescenta dois recortes observados ao catálogo, preservando como pendentes custos contábeis, impacto e pagamento de uma coorte inicial imutável de RAP.

## Fontes confirmadas

1. [Tesouro: base RAP 2026](https://www.tesourotransparente.gov.br/ckan/dataset/relatorio-de-avaliacao-dos-restos-a-pagar-base-de-dados/resource/60affecf-6165-4d7d-bcb9-040913d17752). Arquivo XLSX de 13,9 MiB, publicado/atualizado em 29/01/2026, licença ODbL. [Download oficial](https://www.tesourotransparente.gov.br/ckan/dataset/5eba054b-84d7-4eff-9bd7-e8cabbf940e5/resource/60affecf-6165-4d7d-bcb9-040913d17752/download/dadosrelatoriorap2026.xlsx).
2. [Relatório RAP 2026](https://www.tesourotransparente.gov.br/publicacoes/relatorio-de-avaliacao-dos-restos-a-pagar/2026/114), publicado em 29/01/2026. Dez totais conciliados com a tabela 2 do relatório (páginas 9–10). Travessões de fluxos na abertura não foram tratados como observações anuais iguais a zero.
3. [SIOP: recursos abertos](https://www1.siop.planejamento.gov.br/siopdoc/doku.php/acesso_publico:dados_abertos). [ZIP AFFO 2025](https://www1.siop.planejamento.gov.br/siopdoc/lib/exe/fetch.php/acesso_publico:dados_abertos:acompanhamentoorcamentario_2025jandez_20260522_ascii.zip): captação final janeiro–dezembro/2025, edição identificada no nome de 22/05/2026; a data de publicação não foi confirmada separadamente.
4. [Dicionário AFFO 2025](https://www1.siop.planejamento.gov.br/siopdoc/lib/exe/fetch.php/acesso_publico:dados_abertos:dicionario_de_dados_affo_2025_final_v22-05-2026.pdf), atualizado em 22/05/2026.
5. [Orientador SIOP](https://www1.siop.planejamento.gov.br/siopdoc/doku.php/acompanhamento_orcamentario:orientador_acompanhamento_orcamentario), versão consultada atualizada em 16/06/2026. Seção 7 define ECLOA e EFLOA. Confirmar eventuais diferenças para o orientador de 2025 antes de homologar valores retrospectivos.

## Cobertura verificada

RAP: 67.456 registros de origem, agregados em 3.128 combinações de posição, órgão, exercício de origem e tipo. Posições disponíveis: abertura de 2026 e encerramentos de 2024 e 2025. O saldo da abertura de 2026 é R$ 391.549.400.458,85. As pontes inscrições + reinscrições − pagamentos − cancelamentos = saldo foram conciliadas, com tolerância inferior a R$ 1 nos agregados após arredondamento a centavos.

A base de 2025 desta edição é ajustada por aproximadamente R$ 1,9 bilhão de revalidações: R$ 312,5 bilhões, frente aos R$ 310,6 bilhões originalmente publicados na abertura. Não se calcula taxa de pagamento de uma coorte inicial imutável. A posição 000/2026 não representa execução mensal nem posição corrente de outubro. Não processados é uma classificação na inscrição; parte pode ter sido liquidada depois.

AFFO: 21.249 linhas no CSV físico-financeiro, das quais 7.392 localizadores e 13.857 planos orçamentários. A interface usa somente localizadores, com chave única exercício/esfera/órgão/UO/programa/ação/localizador. As outras três tabelas do ZIP não são juntadas.

| Condição, aplicada nesta ordem | Registros |
| --- | ---: |
| Sem produto ou unidade | 3.144 |
| Meta ou realizado ausente, entre os demais | 102 |
| Meta/realizado inelegível, entre os demais | 78 |
| Razão calculável com data de apuração | 4.068 |
| Total preservado | 7.392 |

Há 3.246 realizações ausentes, 1.024 realizações explicitamente iguais a zero e quatro metas atuais negativas, preservadas sem gerar razão. Essas contagens de campos não são categorias exclusivas da tabela acima. Nenhuma média de cumprimento entre produtos é publicada.

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

O módulo `src/lib/contas-publicas/entregas.ts` define:
- cumprimento físico com a meta escolhida; zero observado distinto de ausência e de meta zero;
- EFLOA conforme fórmula do orientador, com limites explícitos: índice físico-financeiro relativo ao plano, sem inferência de eficiência econômica, custo, qualidade ou impacto;
- identificação completa e bloqueio de duplicatas ou mistura de localizadores com POs;
- leitura numérica estrita do CSV brasileiro.

O cumprimento físico é usado na interface para as metas original e atualizada, mantendo o realizado LOA separado do RAP. A EFLOA permanece apenas como contrato testado: não há publicação de índice de eficiência econômica, custo unitário, qualidade ou impacto. Valores acima de 100% são preservados.

## Implementação e reprodução

- Importador: `python scripts/contas-publicas/importar-etapa3.py`, com Python 3, requests e openpyxl. `--cache DIRETORIO` reutiliza os dois arquivos oficiais. Extração manual fora do build; alterações de esquema/universo falham para revisão humana.
- Snapshots: `src/lib/contas-publicas/snapshots/rap.json` e `metas.json`, com URLs, hashes SHA-256, captura, edição e controles. A data de publicação AFFO continua nula, sem ser inferida do nome do arquivo.
- RAP: filtro de posição/órgão/tipo, saldo por origem, composição e valores exatos. Download da base completa em `/contas-publicas/rap.json`.
- Metas: busca sem distinção de acentos, órgão e condição dos campos; aplicação explícita dos filtros, páginas de 25 registros, ficha individual e exportação integral do recorte. Ordem por autorização, explicitamente sem interpretação de desempenho.
- A base AFFO completa fica no servidor; a página recebe somente metadados e 25 registros. Download em `/contas-publicas/metas-dados.json?estado=todos&download=1`.
- Testes verificam controles externos RAP, pontes por posição/órgão, unicidade e cobertura AFFO, ausência versus zero, metas negativas, paginação, busca e exportação.

Custos contábeis, qualidade, impacto, séries físicas interanuais comparáveis e acompanhamento de coortes RAP exigem integrações próprias. A execução orçamentária não é apresentada como custo.
