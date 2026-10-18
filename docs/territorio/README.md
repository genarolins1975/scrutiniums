# Observatório do Território e Clima: pipeline próprio

Painéis mantidos pelo próprio observatório, com pipeline em `pipeline/territorio`, seed em `pipeline/territorio/seed` e gold em `public/territorio/gold`. No registro (`src/lib/observatorios/registro.ts`) esses painéis têm `origem: null`.

## Queimadas (`/territorio/queimadas`)

- **Fonte:** INPE, Programa Queimadas, servidor de dados abertos COIDS (`https://dataserver-coids.inpe.br/queimadas/queimadas/`). Dados públicos e gratuitos, citação obrigatória ("INPE, Banco de Dados de Queimadas"); licença formal de redistribuição não declarada.
- **Medida:** focos de calor do satélite de referência AQUA_M-T (MODIS, início da tarde), o único comparável entre anos. Série anual consolidada de 2003 em diante (`anual/Brasil_sat_ref`); ano em curso pelos arquivos mensais de todos os satélites, filtrados para o AQUA_M-T (`mensal/Brasil`).
- **Área queimada:** AQ1km Coleção 2 por bioma, em km², produto que o INPE classifica como provisório. Outra medida, que não se compara com a contagem de focos.
- **Ressalvas que vão para a página:** foco não é incêndio nem área queimada; só o satélite de referência compara anos; o número é uma fração das ocorrências; dias sem imageamento do AQUA reduzem a contagem; ano e mês em curso são preliminares e podem ser regerados pelo INPE.
- **Conferência em 18/10/2026:** 2025 inteiro (12 meses, 27 UFs, 6 biomas) e ago e set de 2026 batem com o Painel do Fogo do INPE. Jan a mar de 2026 diferem em poucas unidades, porque o INPE regerou os arquivos mensais depois do painel.

## Comandos

```sh
python3 -m pipeline.territorio.run              # reconstrói a gold a partir do seed (sem rede)
python3 -m pipeline.territorio.run --check      # confere se a gold versionada é a do seed
python3 -m pipeline.territorio.run --coleta     # recoleta (cerca de 550 MB no ano corrente) e reconstrói
python3 -m unittest pipeline.tests.test_territorio
```

O workflow `atualizar-territorio.yml` recoleta nos dias 2 e 16 de cada mês e publica no `main` só com os testes verdes. Validações que bloqueiam a publicação: satélite de referência ausente no arquivo mensal, foco fora do mês ou do ano do arquivo, série anual com ano faltando ou repetido, estados e biomas que não somam o total, original sem sha256, área queimada por bioma que não soma o total anual.

## Próximas fontes

- **Desastres:** Atlas Digital de Desastres no Brasil (Sedec/MIDR), registros municipais com reconhecimento federal de 2003 a 2025. O ano corrente depende do S2iD, que só aceita conexões de endereços no Brasil.
- **Emissões:** inventário oficial do MCTI (NIR 2024, série 1990 a 2022, GWP AR5) nas planilhas do SIRENE. O SEEG fica como estimativa da sociedade civil, declarada e separada.
