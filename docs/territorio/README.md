# Observatório do Território e Clima: pipeline próprio

Painéis mantidos pelo próprio observatório, com pipeline em `pipeline/territorio`, seed em `pipeline/territorio/seed` e gold em `public/territorio/gold`. No registro (`src/lib/observatorios/registro.ts`) esses painéis têm `origem: null`.

## Queimadas (`/territorio/queimadas`)

- **Fonte:** INPE, Programa Queimadas, servidor de dados abertos COIDS (`https://dataserver-coids.inpe.br/queimadas/queimadas/`). Dados públicos e gratuitos, citação obrigatória ("INPE, Banco de Dados de Queimadas"); licença formal de redistribuição não declarada.
- **Medida:** focos de calor do satélite de referência AQUA_M-T (MODIS, início da tarde), o único comparável entre anos. Série anual consolidada de 2003 em diante (`anual/Brasil_sat_ref`); ano em curso pelos arquivos mensais de todos os satélites, filtrados para o AQUA_M-T (`mensal/Brasil`).
- **Área queimada:** AQ1km Coleção 2 por bioma, em km², produto que o INPE classifica como provisório. Outra medida, que não se compara com a contagem de focos.
- **Ressalvas que vão para a página:** foco não é incêndio nem área queimada; só o satélite de referência compara anos; o número é uma fração das ocorrências; dias sem imageamento do AQUA reduzem a contagem; ano e mês em curso são preliminares e podem ser regerados pelo INPE.
- **Conferência em 18/10/2026:** 2025 inteiro (12 meses, 27 UFs, 6 biomas) e ago e set de 2026 batem com o Painel do Fogo do INPE. Jan a mar de 2026 diferem em poucas unidades, porque o INPE regerou os arquivos mensais depois do painel.

## Desastres (`/territorio/desastres`)

- **Fonte:** Atlas Digital de Desastres no Brasil (Sedec/MIDR com Ceped/UFSC), base consolidada extraída do S2iD (`https://atlasdigital.mdr.gov.br/paginas/downloads.xhtml`). Atualização anual; a versão de 06/08/2026 cobre ocorrências de 1991 a 2025. Licença não declarada; citar "Sedec/MIDR, Atlas Digital de Desastres no Brasil".
- **Unidade:** registro municipal de desastre (um protocolo para um município, uma data de ocorrência e uma tipologia COBRADE). "Reconhecido" é o registro que obteve reconhecimento federal de situação de emergência ou estado de calamidade. Não é evento físico, portaria nem decreto. Reconhecimento só existe de 2003 em diante; antes, nulo, nunca zero.
- **Grupos:** secas e estiagens (14110, 14120); chuvas, inundações, enxurradas e alagamentos (12100, 12200, 12300, 13214); movimentos de massa (113xx); outros.
- **Danos humanos:** só óbitos, desabrigados e desalojados, de 2013 em diante, somados de todos os registros do ano. Zero na base também significa campo não preenchido; "afetados" não é publicado porque o total não fecha com as categorias em cerca de um quarto dos registros.
- **Ano corrente:** indisponível. Os reconhecimentos do ano estão no S2iD (`s2id.mi.gov.br`), que só aceita conexões de endereços no Brasil.
- **Conferência em 18/10/2026:** registros por grupo, óbitos e desabrigados mais desalojados por ano batem com o painel oficial do Atlas; os 184 óbitos das chuvas de 2024 no Rio Grande do Sul batem com o balanço da Defesa Civil do estado.

## Emissões (`/territorio/emissoes`)

- **Fonte:** inventário nacional do MCTI no SIRENE, planilhas de resultados do Relatório do Inventário Nacional (NIR 2024, série 1990 a 2022, base do BTR1 enviado à UNFCCC em dezembro de 2024). As planilhas vigentes são descobertas pela tabela "Planilhas para download" do painel público do SIRENE, com as URLs fixas do NIR 2024 como alternativa. Dado público; licença explícita não declarada; citar MCTI/SIRENE.
- **Medida:** kt de CO2 equivalente, GWP AR5 de 100 anos (a métrica da NDC). Total líquido, total sem uso da terra e florestas (LULUCF) e os cinco setores; categorias de primeiro nível do IPCC; 2005 como referência da NDC.
- **Acesso:** o firewall do gov.br devolve uma página de desafio ao urllib; o módulo tenta urllib e depois o curl do sistema e só aceita resposta que seja planilha.
- **Defasagem:** o inventário é bienal e vai até 2022. O SEEG (no painel do Agro) tem anos mais recentes, como estimativa da sociedade civil; as séries não se somam nem se emendam.
- **Validações que bloqueiam a publicação:** setores que não somam o total, planilha setorial diferente do total Brasil, série com ano faltando ou sem 2005, abas por gás que não reconciliam com o CO2e oficial (tolerância de 0,2%).

## Comandos

```sh
python3 -m pipeline.territorio.run              # reconstrói a gold a partir do seed (sem rede)
python3 -m pipeline.territorio.run --check      # confere se a gold versionada é a do seed
python3 -m pipeline.territorio.run --coleta     # recoleta todas as fontes (cerca de 640 MB) e reconstrói
python3 -m pipeline.territorio.run --coleta desastres   # recoleta só uma fonte
python3 -m unittest pipeline.tests.test_territorio
```

O workflow `atualizar-territorio.yml` recoleta nos dias 2 e 16 de cada mês, cada fonte em passo separado (falha de uma mantém o seed anterior dela, com aviso), e publica no `main` só com os testes verdes. Validações que bloqueiam a publicação: satélite de referência ausente no arquivo mensal, foco fora do mês ou do ano do arquivo, série anual com ano faltando ou repetido, estados e biomas que não somam o total, original sem sha256, área queimada por bioma que não soma o total anual.

## Lacunas conhecidas

- **Ano corrente dos desastres:** depende do S2iD, que só aceita conexões de endereços no Brasil.
- **Emissões por estado:** os links do painel por UF do SIRENE respondem 404.
