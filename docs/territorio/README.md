# Observatório do Território e Clima: pipeline próprio

Painéis mantidos pelo próprio observatório, com pipeline em `pipeline/territorio`, seed em `pipeline/territorio/seed` e gold em `public/territorio/gold`. No registro (`src/lib/observatorios/registro.ts`) esses painéis têm `origem: null`. A entrada do observatório é `/territorio` (com conta); `/observatorios/territorio-e-clima` redireciona para ela.

Este arquivo é lido no build pela página aberta de método (`/territorio/metodologia`, `src/lib/territorio/metodo.ts`): as seções de fonte mantêm a forma `- **Rótulo:** texto`, e os rótulos "Não permite concluir" e "Validações que bloqueiam a publicação" são obrigatórios em cada uma (o teste `territorio-entrada-metodo` confere). Números da página vêm das golds, não daqui.

## Queimadas (`/territorio/queimadas`)

- **Fonte:** INPE, Programa Queimadas, servidor de dados abertos COIDS (`https://dataserver-coids.inpe.br/queimadas/queimadas/`). Dados públicos e gratuitos, citação obrigatória ("INPE, Banco de Dados de Queimadas"); licença formal de redistribuição não declarada.
- **Medida:** focos de calor do satélite de referência AQUA_M-T (MODIS, início da tarde), o único comparável entre anos. Série anual consolidada de 2003 em diante (`anual/Brasil_sat_ref`); ano em curso pelos arquivos mensais de todos os satélites, filtrados para o AQUA_M-T (`mensal/Brasil`).
- **Por município:** focos do último ano completo, do acumulado do ano em curso e dos mesmos meses do ano anterior, numa gold própria (`public/territorio/gold/queimadas_municipios.json`, linhas compactas). O anual de referência traz o nome do município e do estado, não o código; o nome é casado com a lista oficial e atual do IBGE (`pipeline/territorio/referencia/municipios_ibge_2022.json`: API de localidades, 5.571 municípios, com a área do Censo 2022 da SIDRA tabela 4714 e o sha256 de cada original). Boa Esperança do Norte (MT), instalado depois do Censo, fica sem área e marcado em `semCoberturaNaFonte`: a malha do INPE atribui seus focos aos municípios de origem, então a busca mostra "indisponível", nunca zero. Dez grafias antigas ou divergentes estão em `EQUIVALENCIAS` (`pipeline/territorio/queimadas.py`); seis delas aparecem nos mensais do próprio INPE com o código IBGE ao lado. O que não casa vai para `semMunicipio`, com o nome da fonte, e entra só no total do país; acima de 1% dos focos de um período, a coleta é retida, porque indica coluna renomeada ou malha nova na fonte. As colunas `municipio` (anual e mensal) e `municipio_id` (mensal) são exigidas. Os mensais trazem o código IBGE e não dependem do casamento. Em 18/10/2026, os 136.393 focos de 2025 foram todos atribuídos a um município, e os 24.373 focos de set/2026 casados por nome tiveram o mesmo código que o INPE informa.
- **Área queimada:** AQ1km Coleção 2 por bioma, em km², produto que o INPE classifica como provisório. Outra medida, que não se compara com a contagem de focos.
- **Não permite concluir:** foco de calor não é incêndio nem área queimada. Um incêndio grande soma vários focos; fogo pequeno, rasteiro, sob a copa ou sob nuvem não aparece, e zero focos num município não prova que não houve fogo. A área queimada é outra medida, de outro produto do INPE, publicada só por bioma.
- **Ressalvas que vão para a página:** foco não é incêndio nem área queimada; só o satélite de referência compara anos; o número é uma fração das ocorrências; dias sem imageamento do AQUA reduzem a contagem; ano e mês em curso são preliminares e podem ser regerados pelo INPE.
- **Validações que bloqueiam a publicação:** satélite de referência ausente no arquivo mensal, colunas exigidas ausentes, foco fora do mês ou do ano do arquivo, série anual com ano faltando ou repetido, ano fechado sem contagem positiva, mais de um ano parcial, estados, biomas ou municípios que não somam o total, código IBGE repetido ou inválido, focos sem município acima de 1% do período, original sem sha256 e área queimada por bioma que não soma o total anual.
- **Conferência em 18/10/2026:** 2025 inteiro (12 meses, 27 UFs, 6 biomas) e ago e set de 2026 batem com o Painel do Fogo do INPE. Jan a mar de 2026 diferem em poucas unidades, porque o INPE regerou os arquivos mensais depois do painel.

## Desastres (`/territorio/desastres`)

- **Fonte:** Atlas Digital de Desastres no Brasil (Sedec/MIDR com Ceped/UFSC), base consolidada extraída do S2iD (`https://atlasdigital.mdr.gov.br/paginas/downloads.xhtml`). Atualização anual; a versão de 06/08/2026 cobre ocorrências de 1991 a 2025. Licença não declarada; citar "Sedec/MIDR, Atlas Digital de Desastres no Brasil".
- **Unidade:** registro municipal de desastre (um protocolo para um município, uma data de ocorrência e uma tipologia COBRADE). "Reconhecido" é o registro que obteve reconhecimento federal de situação de emergência ou estado de calamidade. Não é evento físico, portaria nem decreto. Reconhecimento só existe de 2003 em diante; antes, nulo, nunca zero.
- **Grupos:** secas e estiagens (14110, 14120); chuvas, inundações, enxurradas e alagamentos (12100, 12200, 12300, 13214); movimentos de massa (113xx); outros.
- **Danos humanos:** só óbitos, desabrigados e desalojados, de 2013 em diante, somados de todos os registros do ano. Zero na base também significa campo não preenchido; "afetados" não é publicado porque o total não fecha com as categorias em cerca de um quarto dos registros.
- **Ano corrente:** indisponível. Os reconhecimentos do ano estão no S2iD (`s2id.mi.gov.br`), que só aceita conexões de endereços no Brasil.
- **Não permite concluir:** reconhecimento federal não é contagem de desastres. Uma mesma chuva em vários municípios gera vários registros, e o município que não pediu reconhecimento, ou teve o pedido negado, fica fora mesmo tendo sofrido o desastre. As regras de reconhecimento mudaram em 2012, 2016, 2020 e 2022: comparações longas medem também mudança de regra.
- **Validações que bloqueiam a publicação:** original diferente do capturado (sha256), página de downloads sem exatamente uma base do Atlas, protocolo repetido, situação diferente de "Reconhecido" ou "Registro", série com ano faltando ou fora de ordem, contagem de reconhecidos antes de 2003, grupos que não somam os reconhecidos, mais municípios que registros, estados que não somam o total nacional do último ano completo, ano corrente indisponível sem motivo ou com valores e original sem sha256.
- **Conferência em 18/10/2026:** registros por grupo, óbitos e desabrigados mais desalojados por ano batem com o painel oficial do Atlas; os 184 óbitos das chuvas de 2024 no Rio Grande do Sul batem com o balanço da Defesa Civil do estado.

## Emissões (`/territorio/emissoes`)

- **Fonte:** inventário nacional do MCTI no SIRENE, planilhas de resultados do Relatório do Inventário Nacional (NIR 2024, série 1990 a 2022, base do BTR1 enviado à UNFCCC em dezembro de 2024). As planilhas vigentes são descobertas pela tabela "Planilhas para download" do painel público do SIRENE, com as URLs fixas do NIR 2024 como alternativa. Dado público; licença explícita não declarada; citar MCTI/SIRENE.
- **Medida:** kt de CO2 equivalente, GWP AR5 de 100 anos (a métrica da NDC). Total líquido, total sem uso da terra e florestas (LULUCF) e os cinco setores; categorias de primeiro nível do IPCC; 2005 como referência da NDC.
- **Acesso:** o firewall do gov.br devolve uma página de desafio ao urllib; o módulo tenta urllib e depois o curl do sistema e só aceita resposta que seja planilha.
- **Defasagem:** o inventário é bienal e vai até 2022. O SEEG (no painel do Agro) tem anos mais recentes, como estimativa da sociedade civil; as séries não se somam nem se emendam.
- **Não permite concluir:** o inventário oficial tem defasagem. Ele vai até o último ano da edição publicada, não mede o ano em curso nem os anos seguintes à edição, e cada edição recalcula a série inteira. Não há recorte por estado, e a série não se soma nem se emenda com o SEEG.
- **Validações que bloqueiam a publicação:** setores que não somam o total, total sem uso da terra incoerente, planilha setorial diferente do total Brasil, série com ano faltando ou sem 2005, métrica diferente de GWP AR5 ou unidade diferente de kt CO2e, abas por gás que não reconciliam com o CO2e oficial (tolerância de 0,2%), original sem sha256 e coleta que traria edição anterior à versionada.

## Comandos

```sh
python3 -m pipeline.territorio.run              # reconstrói a gold a partir do seed (sem rede)
python3 -m pipeline.territorio.run --check      # confere se a gold versionada é a do seed
python3 -m pipeline.territorio.run --coleta     # recoleta todas as fontes (cerca de 640 MB) e reconstrói
python3 -m pipeline.territorio.run --coleta desastres   # recoleta só uma fonte
python3 -m pipeline.territorio.run --referencia-ibge   # refaz a lista de municípios com a área do Censo 2022 (raro)
python3 -m unittest pipeline.tests.test_territorio
```

As validações de cada fonte estão na seção dela, acima.

## Atualização

- **Agenda:** o workflow `atualizar-territorio.yml` recoleta as três fontes nos dias 2 e 16 de cada mês, cada uma em passo separado.
- **Falha de uma fonte:** mantém o seed anterior dela, com aviso, e as outras seguem; a gold só é publicada no `main` com os testes do pipeline verdes.

## Lacunas conhecidas

- **Ano corrente dos desastres:** depende do S2iD, que só aceita conexões de endereços no Brasil.
- **Emissões por estado:** o painel por estado do SIRENE está fora do ar (os endereços dele respondem com erro), e o inventário nacional não traz recorte por UF.
- **Área queimada por estado e por município:** o INPE publica a tabela do AQ1km só por bioma; o recorte por estado exigiria cruzar os mapas mensais do produto com a malha estadual.
