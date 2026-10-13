# Cultura · OBEE

## Escopo

Sete rotas em `/eficiencia-estatal/cultura`: panorama, rede, acesso, atividades, acervos, recursos e métodos. A publicação não calcula escore ou infere eficiência. Bibliotecas, museus, arquivos, teatros, cinemas, bens tombados e pontos de cultura têm universos próprios; os indicadores TIC incluem equipamentos públicos e privados.

## Fontes e reprodução

- Cetic.br/NIC.br, TIC Cultura 2024, tabelas v1.0 publicadas em 07/10/2025: https://cetic.br/media/microdados/942/tic_cultura_2024_tabelas_xlsx_v1.0.zip
- Relatório metodológico, publicado em 14/11/2025: https://cetic.br/media/microdados/990/tic_cultura_2024_relatorio_metodologico_v1.0.pdf
- IBGE, SIIC 2013–2024, gastos da administração pública, tabelas 3.1, 3.2 e 3.7, arquivo revisto em 10/03/2026: https://ftp.ibge.gov.br/Indicadores_Sociais/Sistema_de_Informacoes_e_Indicadores_Culturais/2024/xlsx/3_gastos_da_administracao_publica_20260310.xlsx

Captura em 11/10/2026. SHA-256 dos arquivos originais e do recorte em `pipeline/cultura/seed/manifesto.json`. Os arquivos grandes não entram no git; as células extraídas preservam aba, linha e coluna (índices 1-based, incluindo cabeçalhos). Margem e proporção vêm da mesma célula nos dois arquivos TIC. O manifesto identifica o hash do ZIP original, que contém ambos. Recorte sem inferência de respostas não selecionadas.

```sh
python -m pipeline.cultura.coleta --tic /caminho/tic.zip --ibge /caminho/gastos.xlsx
python -m pipeline.cultura.run
python -m unittest pipeline.tests.test_cultura
npx vitest run src/tests/obee-cultura.test.ts src/tests/obee-mapa-servicos.test.ts
```

`coleta` é uma extração explícita dos arquivos já baixados, não faz atualização automática. Para nova captura, atualizar a data e verificar o contrato de tabelas antes da promoção. `run` valida o hash do seed, valores e margens, unicidade, composições, cobertura dos onze anos e reconciliação por esfera/UF, antes de gravar a publicação. Nenhum serviço externo é exigido na reprodução offline.

## Contrato estatístico

210 estimativas TIC: A3 (cinco regiões), A4 (sete naturezas jurídicas), B3C, B5, B10, C3, C11 (dez atividades), D1, D2, D4B e D8, para sete tipos. As respostas Sim são transcritas dos indicadores binários; não se calcula Não como complemento. A3/A4 preservam todas as categorias, incluindo não sabe/não respondeu. C11 permite múltiplas atividades, não somáveis.

O relatório metodológico descreve amostragem estratificada por região/tipo e estratos censitários (pp. 33–34), com margens a 95% (p. 37). A página de metadados chama a operação de não probabilística, mas o documento detalhado descreve seleção aleatória e pesos; o painel segue o relatório e as margens efetivamente publicadas. Não afirma amostragem da população de cidadãos ou cobertura de todos os equipamentos existentes. Intervalo visual = estimativa ± margem, truncado a 0–100%; tabela e CSV preservam margem original. Não se declara significância pela distância visual.

44 registros de gastos por esfera e 297 registros estaduais/distrital, referência 2013–2023. Valores de origem em mil reais multiplicados por 1.000; a Tabela 3.2 armazena proporção decimal apesar do cabeçalho %, verificada contra cultura/total antes de multiplicar por 100. Somas das três esferas e das 27 UFs conferidas, tolerância absoluta de R$ 0,01, nos onze anos. Não se soma o total às esferas. Tabela 3.7 não inclui gastos das prefeituras na UF. DF tem competências distintas. Classificação e consolidação mantidas da origem; não se atribui estágio empenhado/liquidado/pago sem suporte.

Sem deflator, per capita, renúncia fiscal, captação incentivada ou união instituição-despesa. Não usa Tabela 3.6 (per capita) sem reconciliação própria do denominador. Fonte financeira de 2023 não é contemporânea à pesquisa de instituições de 2024.

## Interface e exportação

Filtros por indicador/categoria, busca sem acentos e ordenação explícita. Gráficos de estimativa com margem, escala fixa 0–100%; tabela equivalente com precisão e célula. Finanças: escolha de ano/esfera, barras anuais com zero, tabela anual expandível, composição reconciliada e tabela de 27 governos. CSV TIC exporta somente os tipos do recorte com universo e margem; CSV financeiro exporta quatro esferas do ano e UFs filtradas, preservando os perímetros. Série completa, células e fichas disponíveis no JSON/CSV integral em Dados e métodos.

Limitações: sem recorte de capitais, frequência individual, satisfação, demanda não atendida, acesso físico, preço/tempo de deslocamento ou avaliação de serviço. Comparações internacionais não foram forçadas sobre conceitos incompatíveis.
