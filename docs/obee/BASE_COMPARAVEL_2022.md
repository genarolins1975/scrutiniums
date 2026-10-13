# Base Municipal Comparável 2022

Camada descritiva com oito medidas, diferença em unidade nativa e contrato verificável de comparabilidade. Não produz nota, composição ponderada, classificação de desempenho ou inferência causal.

## Estado desta branch

As 208 observações das 26 capitais foram reconciliadas exatamente com os arquivos auditados. A aquisição dos 318 municípios ainda está bloqueada pela política de rede desta instância. O JSON de trabalho declara `CAPITAIS_RECONCILIADAS_UNIVERSO_PENDENTE`; não representa uma referência adquirida de 318. Os gates de desenvolvimento e build recusam promover esse estado. A entrega e o PR permanecem pendentes dos critérios de cobertura e validação integral.

O proxy recusou a conexão ao SIDRA com HTTP 403 no túnel CONNECT. A consulta não chegou ao produtor. Os domínios `apisidra.ibge.gov.br`, `servicodados.ibge.gov.br` e `api.github.com` foram adicionados ao rascunho do ambiente, ainda sem aplicação à instância. A API do GitHub também respondeu Forbidden; o PR não foi criado.

## Dois eixos independentes

O catálogo versionado está em `pipeline/eficiencia_comparavel/contrato.json`. Cada ficha declara município, base de residência, universo, referência, unidade, fonte, desvios e precisão.

* A: residência municipal, referência de 2022, universo uniforme da fonte, cobertura observada completa.
* B: um único desvio declarado. A mortalidade tem janela de 2021 a 2023; a violência estimada contém componente modelado. Subnotificação é limitação de cobertura, não um segundo deslocamento temporal.
* C: outra natureza ou período. APS de dezembro de 2025 fica em Capacidade dos serviços e é recusada pelo comparador de 2022.

Precisão é quantificada, não quantificada ou universo sem erro amostral. A categoria não aplicável é usada somente na camada C. Alinhamento não resolve precisão, e o intervalo condicional de uma taxa não resolve cobertura do registro.

| Medida | Fonte e referência | Classe | Precisão | Capitais | Referência ampliada |
| --- | --- | --- | --- | --- | --- |
| Frequência de 4 e 5 anos | SIDRA 10056, 2022 | A | Não quantificada | 26 observadas | Não adquirida |
| Mediana da renda por pessoa | SIDRA 10295, variável 13534, julho de 2022 | A | Não quantificada | 26 observadas | Não adquirida |
| Trabalho acima de uma hora | SIDRA 10330, 2022 | A | Não quantificada | 26 observadas | Não adquirida |
| Esgotamento especificado | SIDRA 6805, 2022 | A | Universo | 26 observadas | Não adquirida |
| Mais de dois moradores por dormitório | SIDRA 9934, 2022 | A | Não quantificada | 26 observadas | Não adquirida |
| Internet no domicílio | SIDRA 9936, 2022 | A | Não quantificada | 26 observadas | Não adquirida |
| Homicídios estimados por 100 mil | Atlas da Violência 2024, dados de 2022 | B, modelo | Não quantificada | 26 observadas | Sem extrapolação do Atlas |
| Mortalidade infantil por mil | SIM e SINASC, 2021 a 2023 | B, janela | Poisson condicional | 26 observadas | Sem extrapolação das capitais |

A alternativa de homicídios exclusivamente registrados está classificada como A e preservada separadamente para as capitais no recorte auditado do Atlas. O campo do SIM no universo ampliado permanece `NAO_ADQUIRIDO`. Não se atribui valor do Atlas a município não coberto. A aquisição municipal do SIM só pode entrar com consulta, filtros, residência, CID X85 a Y09 e Y35 a Y36, exposição do Censo 2022 e hash reproduzíveis.

## Fontes e reconciliação

As cinco medidas da v2 vêm de `docs/obee/resultados/piloto-2022-v2.json`; adensamento e Internet, dos valores originais no cenário `conjunta__domicilios_gt2__materiais_40pct` de `cesta-conjunta.json`; violência, de `pipeline/eficiencia_resultados/seed/expansao-2022.json`; mortalidade, de `saude-contagens-2021-2023.json`. Não se lê nem recalibra uma nota para construir a BMC.

O manifesto congelado tem SHA256 `bfd575fdc4c92ff23147999902ceb5a71a41892ca4e0ba1bf9da5e7379f11a6f`. A identidade do pacote é `6707a21e499c774e838810541de48d81e760f520bb8ccd89c9f947f6542651fd`. Os 54 arquivos são verificados somente para leitura. Não há chamada a `freeze()`, alteração de `approved_weights`, `publication_ready`, da trava do piloto ou de `OBEE_LABORATORIO_V3`.

O recorte das capitais preserva os valores numéricos completos dos arquivos auditados. Na coleta ampliada, os seis indicadores SIDRA são conferidos contra as capitais antes da promoção. Diferença superior a metade da última casa publicada reprova o gate; não se amplia a tolerância. O valor congelado permanece canônico, e `valor_consulta`, diferença e hash da consulta são registrados para qualquer variação dentro do arredondamento. Esta reconciliação ampliada ainda não foi executada nesta instância.

Cada observação inclui valor, unidade, período, estado, classes, fonte, captura, arquivo de origem e hash. Erro padrão e intervalo permanecem nulos quando não quantificados. Para mortalidade, o intervalo central de Garwood e o erro padrão são condicionais às contagens registradas; não incluem subnotificação municipal ou incerteza do denominador.

## Consultas e universo

A consulta de população planejada é `https://apisidra.ibge.gov.br/values/t/4714/n6/all/v/93/p/2022`. O coletor exige 319 municípios com pelo menos 100 mil habitantes incluindo Brasília e 318 após sua exclusão, conforme o universo informado no pedido em 13/10/2026. Essa contagem ainda não foi readquirida nesta máquina. Dado não acessado não é tratado como verificado.

O coletor usa lotes de até 80 códigos N6 e preserva as seguintes variáveis e categorias:

| Tabela | Recorte da consulta |
| --- | --- |
| 10056 | v3795, c58=47813, c2=6794, c86=95251 |
| 10295 | v13534, c2=6794, c86=95251, c58=95253 |
| 10330 | v13376, c537=31609,19432,79191,79192, c2088=79488, c86=95251, c469=79176 |
| 6805 | v381, c11558=todas; numerador 46290+72112, denominador 46292 |
| 9934 | v381,1000381, c1975=todas, c1986=73103, c1988=73108 |
| 9936 | v381,1000381, c2072=todas, c63=95826, c125=2932 |
| 9940 | v382,1000382, c1975=todas, c86=95251, c58=95253 |

Todos os períodos são 2022. O 6805 verifica a identidade 46290=72110+72111 e a soma das categorias de primeiro nível. As filhas não entram novamente no numerador. Em contagens, o marcador SIDRA de zero absoluto é tratado como tal; ausência, sigilo e não aplicabilidade continuam sem valor. Um percentual com marcador não é convertido silenciosamente em zero.

O novo manifesto de aquisição registra URL integral, captura, hash da resposta, hash do transporte, hash do recorte e cobertura por tabela. Os originais completos ficam no cache externo; somente recortes e metadados entram no repositório. Nenhum hash de uma aquisição não realizada foi inventado.

## Pares e distribuição

Os grupos usam somente população do Censo 2022 e Grande Região. Renda, frequência, violência e outras variáveis de resultado são recusadas. Os intervalos de porte são 100 mil a menos de 250 mil, 250 mil a menos de 500 mil, 500 mil até 1 milhão, e acima de 1 milhão. A região segue a identidade territorial IBGE, sem atribuir resultado de UF ao município.

Mínimo, máximo, mediana e quartis tipo 7 descrevem os valores observados, com igual peso municipal. Toda distribuição declara número de municípios, observados e ausentes. Referência incompleta nunca é apresentada como distribuição integral dos 318. A faixa dos quartis e as quatro definições alternativas de adensamento são descrições ou sensibilidade, nunca intervalo de confiança.

## Apresentação

`CompararCidades` integra `AtlasCidadao` e reutiliza `DistribuicaoCapitais` em modo compacto. A diferença fica na unidade nativa; as duas cidades, classes e precisão permanecem visíveis. A ressalva amostral segue exatamente o texto do pedido e fica associada a cada valor por `aria-describedby`, com texto visível na mesma linha analítica. Universo, modelo do Atlas e Poisson têm ressalvas próprias para não atribuir origem amostral do Censo a outra fonte.

O CSV usa UTF8 com BOM, ponto e vírgula e vírgula decimal. Cada linha contém sua própria ressalva, estado, classe, período, fonte, captura e hash. Ausências são campos vazios, nunca zero.

`distribuicoes.csv` exporta mínimo, máximo, mediana e quartis por medida e grupo, contagens observadas e ausentes, classe, ressalva e hash do JSON de origem. O estado da base e o tamanho da referência acompanham cada linha para distinguir o recorte de trabalho da referência ampliada. Quartis não são intervalos de confiança.

Seleção de cidades, medida, pares e ordem permanece na URL. A tabela inicia alfabeticamente; a ordem por valor depende de escolha explícita. A distribuição permite percorrer municípios pelo teclado e por controles de pelo menos 44 px. Cor identifica seleção, sem polaridade de desempenho.

## Reprodução

Aquisição após liberação dos destinos oficiais:

```sh
python3.12 -m pipeline.eficiencia_comparavel.coletar --cache /tmp/obee_bmc_2022
```

Reprodução e verificação sem rede, depois de adquirido o seed:

```sh
python3.12 -m pipeline.eficiencia_comparavel.run
python3.12 -m pipeline.eficiencia_comparavel.run --check
python3.12 -m unittest pipeline.tests.test_base_comparavel_2022
```

O modo `--somente-capitais` existe para o trabalho local auditável; não satisfaz o aceite dos 318 e não é aceito pelo prebuild. `--check` não escreve dados. O coletor não altera a v3 e a geração pública usa substituição atômica dos arquivos.

## Premissas e decisões do titular

1. Universo de 318, com corte de 100 mil habitantes, conforme a tarefa. Uma expansão para o corte de 50 mil e os 657 municípios informados no pedido exige aquisição e decisão explícitas; esse número não foi verificado aqui.
2. Habitação por domicílios acima de dois moradores por dormitório, conforme a tarefa e a definição congelada. Troca de unidade ou limiar exige decisão conceitual; não foi escolhida por efeito na ordenação.
3. Acesso institucional a APOND ou SAR do IBGE continua necessário para uma rota adequada de precisão municipal. A BMC não solicita nem publica microdados controlados e não estima erro com totais expandidos.
4. Revisão independente da v3 permanece pendente. Esta entrega não emite parecer nem aprova pesos.

O texto da ressalva amostral do pedido omite “neste estudo”, expressão presente em `PRECISAO_CANDIDATAS.md`. Foi aplicada a precedência expressa do pedido. O restante do protocolo e o arquivo congelado foram preservados. A afirmação “dois módulos” no README anterior era incompatível com os 13 capítulos com painéis no catálogo e foi atualizada sem atribuir cobertura uniforme a todos eles.
