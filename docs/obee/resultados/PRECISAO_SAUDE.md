# Saúde municipal: precisão e decisão de elegibilidade

Auditoria de 12/10/2026. **Decisão: mortalidade infantil registrada permanece disponível para pesquisa descritiva, mas não entra no escore de seis dimensões.** A precisão foi quantificada; a cobertura específica dos óbitos infantis municipais continua sem evidência suficiente na fonte examinada. `saude=null`, `score_eligible=false` e `publication_ready=false` permanecem vigentes.

Atualização da busca: [captura–recaptura no Ministério da Saúde](CAPTURA_RECAPTURA_SAUDE.md). Duas planilhas oficiais adicionais foram adquiridas e auditadas. As três abas oferecem dados de Brasil, regiões e UFs; o anúncio de divulgação municipal não se concretiza nos arquivos examinados. O contrato da próxima aquisição e os testes de nível geográfico estão registrados nessa revisão. A decisão de elegibilidade permanece a mesma.

## O que esta etapa resolveu

As 156 contagens congeladas de SIM/SINASC geram 78 taxas anuais e 26 taxas de período para 2021–2023. Foram calculados 104 intervalos condicionais de 95%. A razão de somas e a janela pré-definida foram preservadas. Nenhum fator de correção foi aplicado.

| Capital | Óbitos / nascidos vivos no triênio | Taxa registrada por mil | Intervalo condicional de 95% |
|---|---:|---:|---:|
| Recife | 581 / 52.484 | 11,07 | 10,19–12,01 |
| Curitiba | 435 / 54.950 | 7,92 | 7,19–8,70 |

A menor contagem trienal é 111 óbitos, em Vitória. O erro padrão relativo do modelo varia entre 1,53% e 9,49% nas 26 capitais. Isso descreve a precisão sob o modelo adotado; não demonstra registro completo nem estabelece um limiar automático de aprovação. A auditoria não usa sobreposição de intervalos como teste de diferenças e não produz classificação ordinal.

## Método e alcance da incerteza

Para D óbitos e B nascidos vivos, a taxa é `1.000 D/B`. Tratando B como exposição fixa e D como Poisson, o intervalo central exato de Garwood é:

- limite inferior: zero se D=0; caso contrário `500 × quantil_quiquadrado(0,025; 2D) / B`;
- limite superior: `500 × quantil_quiquadrado(0,975; 2(D+1)) / B`;
- erro padrão relativo: `100 / raiz(D)`; indefinido para D=0.

A implementação usa inversão numérica da distribuição Poisson, sem dependências estatísticas em produção. Valores independentes de referência foram obtidos com `scipy.stats.chi2.ppf`, incluindo zero, uma ocorrência e contagens grandes. “Exato” refere-se à construção estatística sob as hipóteses do modelo, não à ausência de erro numérico ou à exatidão dos registros.

Os intervalos representam variação de um processo hipotético de eventos, não erro amostral de um censo completo. São condicionais aos nascimentos registrados e à adequação da hipótese Poisson. Não incorporam subnotificação, classificação, migração, erro no denominador, dependência entre eventos ou dispersão extra-Poisson. A taxa trienal resume o período e pode esconder variação anual; as 78 estimativas anuais também estão no JSON. Não é probabilidade de morte em uma coorte individualmente acompanhada.

Referências do método: [documentação oficial do R, teste Poisson](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/poisson.test.html) e [CDC, alcance e limitações dos intervalos](https://www.cdc.gov/united-states-cancer-statistics/technical-notes/confidence-intervals.html). A página do CDC sustenta a distinção entre variação e viés; seu método específico para taxas ajustadas não foi transplantado para este indicador.

## Auditoria da subnotificação

Foi inspecionado o índice completo e extraídos os recortes pertinentes da [publicação IBGE de 2023](https://ftp.ibge.gov.br/Estatisticas_Vitais/Estimativas_sub_registro_nascimentos/2023/xlsx/), disponibilizada nos arquivos com sufixo `20260610`.

| Tabela | Recorte encontrado | Uso nesta auditoria |
|---|---|---|
| 1.2 | Nascidos vivos por município de residência da mãe | Contexto municipal do SINASC para 2023 |
| 2.2 | Óbitos de todas as idades por município de residência | Contexto municipal geral do SIM; não substitui menores de um ano |
| 2.9 | Óbitos de menores de um ano por UF e Grande Região | Contexto estadual; não imputado às capitais |

As tabelas distinguem **sub-registro no Registro Civil/IBGE** e **subnotificação no Ministério da Saúde**. Para avaliar SIM/SINASC, não usar a primeira coluna como se fosse a segunda. O snapshot preserva cabeçalhos, linhas, planilhas, nomes de arquivos e hashes para conferir essa distinção.

A tabela 1.2 informa subnotificação do Ministério da Saúde de 0,3920% em Recife e 0,1004% em Curitiba em 2023. Esses números são estimativas de cobertura dos nascimentos daquele ano, não dos óbitos infantis e não do triênio. A versão das contagens usada pelo estudo IBGE também pode diferir da extração TabNet: por exemplo, os totais estimados do IBGE não devem ser reconciliados por igualdade direta com as contagens registradas atuais.

O índice inspecionado não contém a combinação município × óbito infantil. Isso delimita a evidência examinada; não prova que nenhum estudo ou outra fonte possa fornecê-la. A auditoria não extrapolou 2023 para 2021–2022, nem cobertura de todas as idades para bebês. Obter esses recortes permanece requisito para uma correção municipal fundamentada.

## Sensibilidade sem inventar correções

Se `cB` e `cD` forem as frações verdadeiras de cobertura de nascimentos e óbitos, a identidade é `taxa corrigida = taxa registrada × cB/cD`, supondo compatibilidade territorial, temporal e conceitual. Os arquivos incluem quatro **cenários hipotéticos**, iguais para todas as capitais:

| Cobertura dos nascimentos | Cobertura dos óbitos | Efeito sobre a taxa registrada |
|---:|---:|---:|
| 100% | 100% | nenhum |
| 100% | 95% | +5,26% |
| 95% | 100% | −5,00% |
| 95% | 95% | nenhum |

Os 95% são uma escolha ilustrativa, não uma estimativa para qualquer município, limite plausível, distribuição de probabilidade ou intervalo de confiança. Coberturas iguais podem cancelar no quociente sem indicar registros completos. Esses cenários não entram nos percentis, nos pesos ou no escore.

## Decisão e próxima etapa

1. **Concluído:** aquisição, reconciliação das contagens, precisão condicional e separação explícita entre incerteza aleatória e subnotificação.
2. **Saúde no agregado:** permanece ausente. As fontes examinadas não permitem validar cobertura infantil municipal alinhada ao triênio. O resultado materno-infantil também exige avaliação de sua representatividade como dimensão de saúde e um contrato temporal próprio.
3. **Próxima entrega recomendada:** consolidar o contrato de apresentação do piloto de cinco dimensões e a explicação da cobertura no painel, mantendo Saúde identificada como dimensão em pesquisa. A busca de evidência para Saúde segue como frente de dados, sem bloquear a avaliação do piloto existente.
4. **Para futura promoção:** evidência municipal específica, compatível com 2021–2023, avaliação das limitações e nova referência versionada; então recalcular sensibilidade da cesta de seis dimensões. Não promover automaticamente pela quantidade de células ou pelo erro padrão relativo.

## Reprodução

```sh
python3 -m pipeline.eficiencia_resultados.precisao_saude
python3 -m unittest pipeline.eficiencia_resultados.test_precisao_saude
```

Os dois comandos usam apenas a biblioteca padrão e os snapshots versionados. O JSON contém os 104 intervalos e os cenários; o CSV contém as 26 taxas trienais. Hashes vinculam os resultados às contagens e à evidência IBGE examinadas. O documento anterior `SAUDE_MUNICIPAL.md` registra a aquisição; esta decisão complementa aquela etapa sem reescrever seus dados históricos.

Para repetir a extração contextual, baixar os três arquivos cujas URLs e hashes estão em `pipeline/eficiencia_resultados/seed/saude/ibge-subnotificacao-2023.json`. Somente esse extrator auxiliar requer `openpyxl`:

```sh
python3 -m pipeline.eficiencia_resultados.extrair_evidencia_ibge --downloads /tmp/obee-health-quality --output /tmp/obee-health-quality/reproduced-evidence.json
```

O extrator rejeita arquivos com hashes diferentes da publicação auditada. Os números e metadados extraídos foram reproduzidos byte a byte. Os ZIP/XLSX de origem permanecem vinculados pelas URLs oficiais e pelos hashes; não são entradas necessárias para executar a auditoria congelada.
