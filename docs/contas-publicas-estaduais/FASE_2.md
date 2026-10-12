> Registro histórico do piloto. A cobertura atual está descrita em [FASE_3.md](FASE_3.md).

# Piloto de execução orçamentária e dívida — v0.2.0

A ficha passa a apresentar execução orçamentária, além da condição fiscal. A referência inicial é 2025, último exercício anual completo do piloto; 2026 continua disponível como período parcial da dívida.

## Evidências arquivadas

Foram recuperados os bytes do artefato `contas-estaduais-respostas-primarias`, run [38227263423](https://github.com/genarolins1975/scrutiniums/actions/runs/38227263423), artefato 11736549802. SHA-256 do ZIP: `1054a8785cb3eeb4693465c9820f9620a0e47d7b1069e22d90d2a5a97893ad2e`.

As 18 respostas e os dois manifestos da captura estão em `public/contas-estaduais/evidencias/20261012/`. O acervo não depende da retenção temporária do GitHub Actions. Os manifestos conservam o estado da captura original, inclusive o mapeamento candidato então pendente; a conferência posterior é reproduzida por `pipeline.contas_estaduais.consolidar` e publicada em `primarios.json`.

A conferência verifica SHA-256, paginação, quantidade de linhas, UF, código IBGE, esfera, anexo, período, periodicidade e poder (RGF). Duplicatas, campos ausentes, valores inválidos e denominadores não positivos bloqueiam a consolidação. Não há substituição da RCL ajustada pela RCL sem ajuste.

**Conferido na resposta original** significa identidade, campos e aritmética verificados. Não significa auditoria, certificação do Tesouro, confronto com a LOA ou comparabilidade integral entre estados. Os arquivos de outubro de 2026 podem incorporar retificações posteriores ao exercício de 2025.

## Indicadores disponíveis

| Indicador | Fórmula | Janela | Cobertura |
|---|---|---|---|
| CE-01 — Erro da receita | 100 × (arrecadada / previsão inicial − 1), com erro absoluto | 2025, acumulado do 6º bimestre | PE, SP, MG, RS, AM, DF |
| CE-04 — Execução atualizada | 100 × liquidada / dotação atualizada | mesma janela | mesmas UFs |
| CE-05 — Liquidação de empenhos | 100 × liquidada / empenhada | mesma janela | mesmas UFs |
| CE-06 — Pagamento do exercício | 100 × paga / liquidada | mesma janela | mesmas UFs |
| CE-11 — Dívida líquida / RCL ajustada | percentual declarado, reconciliado com 100 × DCL / RCL ajustada | 2025 Q3 e 2026 Q1 | mesmas UFs |

São 36 observações: 24 de execução e 12 de dívida. A matriz de 2025 tem 30 observações conferidas; a de 2026 tem seis. A conferência não é propagada a outras UFs, anos ou indicadores.

No RREO são usadas as linhas `ReceitasExcetoIntraOrcamentarias` e `DespesasExcetoIntraOrcamentarias`, sem somar linhas intra, totais com déficit/superávit ou refinanciamento destacado. As colunas exatas são publicadas no JSON. Pagamentos de restos de exercícios anteriores não entram na coluna de despesa paga do exercício. Dotação inicial também é preservada, mas CE-02 permanece sem observação: o contrato exige separação dos encargos da dívida.

No RGF são preservadas as duas casas decimais declaradas. A diferença entre razão calculada e declaração deve ser de até 0,005 p.p. No Amazonas, o original declara 20,65% em 2026 Q1 e os valores monetários resultam em 20,6532%; a gold herdada trazia 20,6%. O novo dado tem fonte própria, sem reescrever o snapshot histórico. TO permanece pendente de conferência primária.

## Interface

- Barras horizontais com base zero e escala monetária comum para autorização, empenho, liquidação e pagamento; sem truncar ou reescalar cada etapa.
- Quatro indicadores com fórmula e interpretação, sem transformar taxa de execução em nota de eficiência.
- A ficha de dívida distingue fonte original conferida de evidência herdada; a série anual identifica a origem por observação.
- Arquivos originais, consulta reproduzível e SHA-256 disponíveis junto aos números.
- CSV de cobertura mantém as 27 UFs × 48 contratos e distingue falta de sondagem de falta de registro no snapshot.
- Distrito Federal mantém a ressalva sobre competências estaduais e municipais.

## Referências de interpretação

- [MDF — Tesouro Nacional, índice das edições](https://www.gov.br/tesouronacional/pt-br/contabilidade-e-custos/manuais/manual-de-demonstrativos-fiscais-mdf), consultado em 12/10/2026. O índice identifica a 14ª edição atualizada em 18/11/2025 e a 15ª edição atualizada em 23/09/2026. O contrato desta versão se ancora nos códigos e colunas das respostas arquivadas, sem presumir que o ano da captura seja o ano de vigência do demonstrativo.
- [Balanço Orçamentário — instruções de preenchimento do Tesouro](https://conteudo.tesouro.gov.br/manuais/index.php?Itemid=675&catid=609&id=1200:03-01-05-01-tabela-1-balanco-orcamentario&option=com_content&view=article), referência conceitual histórica dos estágios e do refinanciamento destacado.
- [PEFA — PI-1, aggregate expenditure outturn](https://www.pefa.org/node/4762), referência internacional de credibilidade do orçamento. As razões do piloto não são uma nota PEFA.

## Verificação

- 14 testes Python: coleta, integridade, identidade/perímetro, ausência, duplicação, denominadores, zero, separação das intra e coerência dos estágios.
- 10 testes TypeScript: cobertura por UF/ano/indicador, fonte prioritária, reprodução de razões, dívida negativa, sinais e exportação.
- Tipos e lint do módulo aprovados localmente.
- `python3 -m pipeline.contas_estaduais.consolidar --check` reproduz integralmente o JSON publicado sem rede.
- O CI completo da fase anterior (commit `1071f3f4a3111eff33c06aa1483a977c31b6b678`, run 38228059794) concluiu com sucesso. Build, CI completo e inspeção visual da v0.2.0 serão conferidos no preview deste commit.

## Próximo vínculo analítico

Educação estadual: compatibilizar gasto, matrículas, etapa, rede e aprendizagem, antes de estimar custo por entrega e cumprimento de metas. Sem esse vínculo, o piloto descreve execução e condição fiscal; não sustenta ranking de eficiência ou eficácia. Expandir a cobertura primária para as outras UFs também permanece uma etapa futura explícita.
