# Saeb 2023: recorte urbano confirmado na fonte primária

Em 11/10/2026 foi obtido o pacote oficial `planilha_de_resultados_2023.rar`, indicado na página de resultados Saeb 2023 do Inep. Apesar do timeout da automação do navegador, o arquivo foi salvo e extraído integralmente. O bloqueio de aquisição registrado no lote anterior foi superado.

Fonte: https://download.inep.gov.br/saeb/resultados/planilha_de_resultados_2023.rar

Arquivo analisado: `Resultados_Saeb_2023_Brasil_Estados_Municipios.xlsb`, aba `Municípios`. Dicionário e cabeçalhos inspecionados. A aba tem 113 colunas, com proficiências e distribuições por nível. Não contém participantes, população elegível ou percentual de participação. Os arquivos auxiliares de erros amostrais não devem ser atribuídos às capitais: a planilha de 5º ano inspecionada apresenta agregações Brasil, regiões e UFs.

## Resultado da conciliação

Foram extraídas 52 linhas: 26 capitais × localizações Urbana e Total, todas de dependência Municipal e edição 2023. Comparação de português/matemática, 5º/9º anos, tolerância de 0,0051 ponto para representação numérica da fonte com duas casas decimais.

| Comparação com a base integrada | Urbana | Total urbano + rural |
|---|---:|---:|
| Valores numéricos coincidentes | 96 | 49 |
| Valores numéricos diferentes | 0 | 47 |
| Disponibilidade diferente | 0 | 2 |
| Ausentes nas duas fontes | 8 | 6 |
| Posições comparadas | 104 | 104 |

Os valores integrados são numericamente consistentes com o recorte **Urbana** em todas as 104 posições. Essa evidência fundamenta a correção do universo na homepage para “escolas urbanas da rede municipal”. Não se conclui que 47 números estejam errados: eles correspondem a outro recorte. A hipótese de cobertura municipal total era inadequada.

Exemplos rastreáveis na aba Municípios:

| Município e medida | Urbano | Total | Linhas Total/Urbana |
|---|---:|---:|---|
| Porto Velho, português, 5º ano | 199,20 | 196,96 | 232 / 233 |
| Porto Velho, português, 9º ano | Ausente | 229,55 | 232 / 233 |
| Florianópolis, português, 5º ano | 209,25 | 209,95 | 55319 / 55320 |
| Recife, português, 5º ano | 199,90 | 199,90 | 21348 / 21349 |

Colunas correspondentes: `MEDIA_5_LP`, `MEDIA_5_MT`, `MEDIA_9_LP`, `MEDIA_9_MT`. Coincidência de células vazias não valida os motivos `NAO_APLICAVEL` ou `NAO_DIVULGADO` da base anterior; esses motivos continuam exigindo revisão própria.

## Alterações entregues

- Universo da homepage e gerador passam a explicitar escolas urbanas para Saeb 2023.
- Auditoria registra `school_location: Urbana`; outras edições ficam com localização não auditada.
- Conciliador de participação exige localização escolar compatível, além de município, edição, rede e disciplina. Uma participação “Total” não pode ser anexada à nota urbana.
- Extração primária, cabeçalhos, linhas de origem, hashes e conciliação ficam versionados. Valores públicos não foram substituídos por outro universo.

## Reprodução

Dependência adicional apenas para ler novamente o XLSB: `pyxlsb` (leitura usada nesta execução: versão 1.0.11, código do repositório willtrnr/pyxlsb). A conciliação do snapshot versionado usa somente biblioteca padrão.

```sh
python3 -m pipeline.eficiencia_escores.auditoria_fonte
python3 -m pipeline.eficiencia_escores.auditoria_fonte --workbook /caminho/Resultados_Saeb_2023_Brasil_Estados_Municipios.xlsb --archive /caminho/planilha_de_resultados_2023.rar
python3 -m unittest pipeline.eficiencia_escores.test_auditoria_fonte pipeline.eficiencia_escores.test_participacao pipeline.eficiencia_escores.test_cobertura pipeline.eficiencia_escores.test_fundacao -v
python3 scripts/eficiencia/test_atlas.py
```

25 testes de dados e três testes do Atlas aprovados localmente. Não houve nova verificação visual da homepage nesta entrega. O PR continua em rascunho; não houve merge ou publicação em produção.

## Pendências concretas

Participação e denominadores do recorte urbano continuam ausentes. Próxima fonte a inspecionar: microdados Saeb 2023 e respectivo dicionário, disponíveis no mesmo portal. Não inferir participação a partir da distribuição por nível, nem substituir população avaliada por matrícula total. Referências OBEE, representatividade e demais pilares continuam pendentes; nenhum escore foi liberado.
