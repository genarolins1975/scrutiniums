# Trabalho e Renda — contrato, cobertura e reprodução

O núcleo publica dados oficiais capturados, com consulta exata, referência temporal, universo, transformações e limitações. O arquivo `public/eficiencia/trabalho-renda/snapshot.json` contém os indicadores IBGE e BCB; `cadastro.json`, `recursos.json` e `cursos/indice.json` mantêm contratos próprios para Cadastro Único, execução municipal e cursos autorizados. As diferenças entre esses universos permanecem visíveis.

Não se calculam médias simples entre UFs, não se interpolam lacunas e não se atribui uma estimativa estadual a um município sem observação própria.

## Reprodução do núcleo IBGE e BCB

Executar, nesta ordem, a partir da raiz do repositório:

```sh
python3 scripts/eficiencia/capturar-trabalho-renda.py
python3 scripts/eficiencia/capturar-emprego-formal.py
python3 scripts/eficiencia/capturar-renda-anual.py
python3 scripts/eficiencia/capturar-distribuicao-renda.py
python3 scripts/eficiencia/capturar-ocupacoes-jornadas.py
```

O primeiro comando cria o snapshot; os seguintes acrescentam famílias de indicadores. Uma nova captura constitui uma nova versão dos dados e pode revisar valores antigos. Comparar resultados antes de substituir a publicação; não editar números manualmente. Os scripts usam a biblioteca padrão do Python. Erros da origem interrompem a captura, sem produzir dados simulados.

As respostas oficiais integrais e os metadados estão em `public/eficiencia/trabalho-renda/brutos/`. O SHA-256 do núcleo é calculado sobre os bytes da resposta preservada, após descompressão HTTP quando necessária. A consulta exata, o arquivo e o hash constam da respectiva fonte no snapshot.

## Cobertura do núcleo

| Fonte | Cobertura nesta entrega | Conceitos e limites |
|---|---|---|
| PNAD Contínua trimestral, tabelas 4093, 4099 e 5436 | Brasil e 27 UFs; 16 trimestres, até o segundo trimestre de 2026 | Desocupação, participação, nível de ocupação, informalidade, subutilização e rendimento habitual real de todos os trabalhos. Sexo disponível, exceto para subutilização. Estimativas pela residência. |
| Censo 2022, tabela 10295 | Brasil, UFs e 5.570 municípios; referência de 2022 | Renda nominal domiciliar per capita média e mediana. Sexo e cor ou raça apenas em Brasil e UF nesta captura. Resultados preliminares da amostra; exclusões de moradores conforme definição da tabela. |
| Novo Caged republicado pelo BCB, SGS 28763 | Brasil; 36 meses, até agosto de 2026 | Estoque de vínculos celetistas sem ajuste sazonal e variação mensal calculada pela diferença entre estoques consecutivos da mesma captura. Não equivale necessariamente ao saldo oficial de admissões menos desligamentos, devido a revisões, ajustes e mudanças da base de estoque. Vínculos não são pessoas únicas; a localização é do estabelecimento. Último mês preliminar. |
| PNAD Contínua anual, tabela 7435 | Brasil e UFs; 2012–2025 | Gini da renda domiciliar per capita, índice entre 0 e 1. Não mede pobreza nem nível absoluto de renda. |
| PNAD Contínua anual, tabela 7457 | Brasil e UFs; 2012–2025 | Proporção de domicílios que declaram recebimento de Bolsa Família, BPC ou qualquer programa social. Não equivale ao cadastro administrativo de famílias ou pessoas do MDS. Programas podem coexistir no domicílio. |
| PNAD Contínua anual, tabela 7533 | Brasil e UFs; 2012–2025 | Renda média em dez faixas disjuntas da distribuição, mais Total. Cada faixa representa aproximadamente 10% das pessoas. Valores são médias dentro da faixa, não limites dos percentis. |
| Censo 2022, tabela 10282 | Brasil e UFs; 2022; 11 grandes grupos ocupacionais, mais Total, por sexo | Pessoas ocupadas com rendimento de trabalho; média e mediana nominais de todos os trabalhos. Classificação da ocupação no trabalho principal. A quantidade não representa todos os ocupados, porque o universo exige rendimento. |
| PNAD Contínua anual, tabela 10370 | Brasil e UFs; 2012–2025, com lacunas em 2020–2022; grupos de idade | Média de horas habitualmente trabalhadas por semana em todos os trabalhos. A API registra unidade `%`, embora título e variável descrevam média de horas. A apresentação em horas/semana exige a ressalva explícita da divergência e preserva o valor original. |

O indicador `renda-domiciliar-real` usa o Total da mesma tabela 7533 que sustenta os decis. A tabela 7395 foi investigada e excluída, pois seu valor total difere e não foi reconciliado o universo com a tabela 7533.

O recorte de emprego formal é nacional. O Ipeadata estava inacessível nesta coleta; não se preencheram UFs com dados antigos. A captura anterior do painel de Crédito, referente a julho de 2026, já havia sido revisada no SGS. A nova publicação não transfere a reconciliação antiga para a captura atual.

## Preços, precisão e lacunas

O rendimento habitual da PNAD trimestral é expresso a preços médios do último trimestre civil divulgado, conforme a [documentação oficial do deflator](https://ftp.ibge.gov.br/Trabalho_e_Rendimento/Pesquisa_Nacional_por_Amostra_de_Domicilios_continua/Trimestral/Microdados/Documentacao/PNADcIBGE_Deflator_Trimestral.pdf). A tabela anual 7533 usa preços médios do último ano, 2025 nesta captura. Os rendimentos do Censo são nominais, com referência a julho de 2022. Não se compara diretamente o nível nominal do Censo ao rendimento real da PNAD.

Na divulgação anual de rendimentos, os anos 2020–2022 usam a quinta visita em lugar da primeira durante a pandemia, conforme as notas da fonte. Coeficientes de variação acompanham as observações elegíveis; não são intervalos de confiança. Diferenças pequenas não demonstram significância estatística.

A série de jornada não contém 2020, 2021 e 2022 nesta captura. O gráfico deve interromper a linha entre 2019 e 2023, sem sugerir observações ou interpolação nesses anos. A normalização de unidade documenta a divergência textual da origem e não altera o valor numérico.

## Cadastro Único — MDS / MI Social

```sh
python3 -m pipeline.eficiencia_trabalho.protecao
```

O script consulta o serviço oficial MI Social, preserva respostas comprimidas e produz `cadastro.json`. As referências Brasil e UF são somas dos registros municipais de dezembro de 2023, 2024 e 2025 e setembro de 2026. A visão municipal desta entrega é o retrato de setembro de 2026. Esses quatro pontos não representam uma série mensal completa.

O extrato abrange 5.571 municípios do cadastro territorial atual, enquanto o Censo 2022 contém 5.570 municípios. O script usa a relação municipal oficial atual para reconciliar os códigos; não interpreta essa diferença de cobertura como ausência ou zero do Censo. Qualquer cruzamento exige verificar o período e o código de cada fonte.

As medidas são famílias inscritas, famílias cadastradas com renda por pessoa de até meio salário mínimo e famílias desse recorte com cadastro atualizado. Atualizado significa atualização nos últimos dois anos. Inscrição não implica benefício recebido. O cadastro não cobre toda a população de baixa renda e não estima taxa de pobreza; família cadastrada não equivale a domicílio da PNAD.

Os arquivos `mds-cadunico-{periodo}.json.gz` usam compressão determinística. O campo `sha256` refere-se aos bytes da resposta JSON **descomprimida**, não aos bytes do arquivo gzip. A consulta exata e a captura ficam na fonte. O cadastro territorial auxiliar também é preservado em `brutos/`.

## Recursos municipais — função 11 Trabalho

```sh
python3 -m pipeline.eficiencia_trabalho.recursos
# Para buscar conferências RREO ainda não disponíveis:
python3 -m pipeline.eficiencia_trabalho.recursos --coletar
```

O script reaproveita as respostas completas DCA Anexo I-E e o manifesto do pipeline OBEE e produz `recursos.json`. O universo é a despesa liquidada declarada pelas 26 prefeituras das capitais estaduais, função 11 Trabalho, de 2021 a 2025. O Distrito Federal é excluído porque acumula competências estaduais e municipais. Não se incluem a execução federal, a estadual ou ações classificadas em outras funções.

A DCA define o valor publicado; o RREO Anexo 02 do sexto bimestre é uma conferência separada, nunca uma parcela a somar. Divergências e casos sem conferência permanecem identificados e fora das referências comparativas. Ausência da linha da função Trabalho não significa zero. Subfunções somente sustentam composição fechada quando reconciliam com o total. Valores reais são expressos em reais de 2025 pelo IPCA médio anual; a base nominal também permanece disponível.

Para DCA, o hash do manifesto é validado contra os bytes descomprimidos do arquivo integral preservado. Na conferência RREO, `sha256Resposta` representa a serialização JSON canônica das linhas concatenadas das páginas recebidas; não o corpo HTTP bruto. O arquivo de conferência preserva o recorte Trabalho, e `sha256Linhas` permite reproduzir o hash desse recorte. O hash da resposta completa não pode ser reconstituído apenas pelo subconjunto salvo. Esses objetos são identificados separadamente na proveniência.

Despesa funcional não mede o conjunto de serviços, beneficiários ou resultados de emprego e renda. Correlação entre gasto e indicadores não demonstra eficácia causal.

## Cursos de aprendizagem autorizados — CNAP / MTE

```sh
python3 pipeline/eficiencia_trabalho/cursos.py --data 2026-10-09
# Nova coleta oficial, com até três tentativas:
python3 pipeline/eficiencia_trabalho/cursos.py --coletar --data 2026-10-09
```

O comando padrão lê o ZIP oficial preservado e não acessa a rede. A coleta usa a URL exata do MTE registrada em `cursos/indice.json`. A data informada determina a situação calculada, sem substituir as datas originais de aprovação e validade.

A planilha de outubro de 2026 contém 90.587 registros, 55.507 códigos distintos e 27 UFs. O recorte oficial, indicado no rodapé, é autorização entre 01/02/2024 e 05/10/2026. O rodapé textual não é curso e foi excluído da contagem de registros. A situação em 09/10/2026 inclui 90.041 registros vigentes e 546 vencidos.

Os arquivos `cursos/uf-{UF}.json` preservam duplicações de código entre localidades. A localização EAD usa UF e município específicos quando ambos estão preenchidos; os demais registros usam a sede, com esse perímetro identificado. Autorização não significa vaga disponível, turma aberta, matrícula, atendimento, conclusão ou efeito sobre emprego.

`sha256Zip` refere-se aos bytes do ZIP preservado em `cursos/brutos/original.zip`; `sha256Csv` refere-se aos bytes do CSV extraído, antes de decodificação CP1252. A coluna `originalLinha` permite localizar o registro na fonte.

## Estados, exportação e limites da entrega

No SIDRA, `-` representa zero absoluto; `...`, `..` e `X` permanecem indisponíveis em `null`. Os arquivos originais conservam os símbolos. O CSV exporta o recorte completo, incluindo referência da fonte e coeficiente de variação quando disponível. A ausência de recorte por sexo, grupo ou território não gera troca silenciosa para Total ou UF.

Os testes verificam hashes, unicidade de chaves, referências, ausência sem substituição, integridade do CSV, saldo formal calculado contra o SGS e contagens de registros e códigos dos cursos. A revisão independente deve também reconciliar observações aos originais e avaliar universos, filtros e apresentações.

Não há dados publicados nesta entrega sobre trajetórias individuais ou mobilidade longitudinal, colocação pelo Sine, vagas abertas, filas de atendimento ou avaliação causal de qualificação. Cursos autorizados, famílias cadastradas, despesa municipal e contexto do mercado de trabalho são dimensões diferentes e não recebem uma nota composta de eficiência.
