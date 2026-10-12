# Saúde municipal: contrato da próxima aquisição

Data: 12/10/2026. Estado: **156 contagens municipais adquiridas e reconciliadas; elegibilidade no escore pendente**. A cesta ampliada de seis dimensões da v2 mantém `saude=null`.

## Indicador e janela pré-definidos

Indicador candidato: taxa de mortalidade infantil registrada por 1.000 nascidos vivos, por município de residência. Resume um desfecho materno-infantil importante, mas não representa sozinho a saúde da população, acesso ao SUS ou qualidade integral dos serviços.

Janela pré-definida e aplicada nesta auditoria: **2021–2023**, centrada em 2022 e escolhida antes da leitura comparativa dos resultados. Usar a mesma janela em todas as capitais. Essa escolha é do projeto, não uma recomendação normativa atribuída à RIPSA. A janela inclui a pandemia e demanda leitura da série anual. Se inviável, revisar o contrato explicitamente, sem selecionar anos conforme os resultados.

- Numerador: soma dos óbitos não fetais de menores de um ano, ocorridos em 2021, 2022 e 2023, segundo município de residência, no SIM.
- Denominador: soma dos nascidos vivos nos mesmos anos, segundo município de residência da mãe, no SINASC.
- Cálculo: `1000 × soma(óbitos) / soma(nascidos vivos)`. Não usar média simples das três taxas anuais.
- Coorte territorial: os mesmos 26 códigos IBGE da referência; DF excluído. Documentar a correspondência entre códigos de seis e sete dígitos, sem junção por nome ou prefixos ambíguos.
- Trata-se de uma taxa de período. Os óbitos e nascimentos não são uma coorte de crianças individualmente vinculadas.

O rótulo será “Mortalidade infantil registrada · 2021–2023”, não “Saúde 2022”. Incorporar esse indicador ao agregado exigirá versão nova do contrato temporal e exame de validade de conteúdo. A v2 não será alterada silenciosamente.

## Fontes e achados desta sessão

1. RIPSA MRT.1.01: arquivo oficial adquirido e auditado, mas só contém UF. Essa base não fornece o indicador municipal necessário.
2. A documentação pública da API DEMAS foi lida em `https://apidadosabertos.saude.gov.br/static/swagger.json`, versão informada 1.8.32. Os endpoints SIM e SINASC documentam somente `limit` e `offset`, com limite de 1.000 registros por página; não documentam agregação por município/ano.
3. Consulta de diagnóstico `limit=1&offset=0`: SIM retornou um registro, com campos de residência e data/idade; SINASC retornou uma lista vazia. Essa consulta verifica disponibilidade/esquema, **não mede cobertura**. Lista vazia não equivale a zero nascimentos e não autoriza gerar taxas.
4. As páginas oficiais do DATASUS identificam tabuladores separados para óbitos infantis e nascidos vivos, com abrangência “Brasil por Municípios”. Os acessos HTTPS devolveram erro 502, mas os links HTTP publicados nas páginas oficiais funcionaram. As duas tabulações foram adquiridas com residência, anos 2021–2023 e filtro das 26 capitais. Os rodapés classificam esses anos como dados finais, com extração da fonte em 02/12/2025 em ambas as fontes. A evidência técnica de acesso fica em `saude-aquisicao-2026-10-12.json`.

Fontes oficiais:

- [SIM no catálogo](https://dadosabertos.saude.gov.br/dataset/sim).
- [SINASC no catálogo](https://dadosabertos.saude.gov.br/dataset/sistema-de-informacao-sobre-nascidos-vivos-sinasc).
- [Mortalidade no DATASUS](https://datasus.saude.gov.br/mortalidade-desde-1996-pela-cid-10/).
- [Nascidos vivos no DATASUS](https://datasus.saude.gov.br/nascidos-vivos-desde-1994/).
- [API DEMAS](https://apidadosabertos.saude.gov.br/v1).

Não foram adquiridas bases nacionais completas de microdados nem enviados pedidos a terceiros.

## Critérios de aceitação da base

| Verificação | Evidência necessária |
|---|---|
| Universo | Óbitos infantis não fetais e nascimentos por residência; distinção explícita de ocorrência |
| Cobertura da extração | 26 capitais × 3 anos × 2 contagens = 156 células esperadas; ausências distintas de zeros |
| Qualidade do registro | Evidências de cobertura/sub-registro do SIM e SINASC; não inferir completude pela existência de uma célula |
| Consistência | Inteiros não negativos, denominadores positivos, sem duplicatas; totais reconciliados com extração independente/amostra oficial |
| Tempo | Anos dos eventos, data da extração e situação definitiva/preliminar; mesma janela em toda a coorte |
| Rastreabilidade | Consulta, filtros, arquivos originais, hashes, códigos municipais e regra de transformação |
| Precisão | Avaliar instabilidade e intervalos condicionais para a taxa; não confundir incerteza aleatória com sub-registro |

Um intervalo de Poisson para a contagem, condicionado ao denominador, é candidato para descrever variação aleatória, sujeito à adequação do modelo. Ele não corrige sub-registro, mudanças de residência ou erros de classificação. Não usar intervalo binomial como se houvesse seguimento individual de uma coorte de nascimentos. A implementação e a escolha final de apresentação dependem da base auditada.

## Próxima sequência de execução

1. Concluído: duas tabulações, filtros e 156 células preservados; somas anuais e totais reconciliados.
2. Próximo: conferir uma amostra contra outra tabulação oficial e avaliar qualidade/cobertura dos registros antes de pontuar.
3. Razão de somas e taxas anuais calculadas; falta avaliar precisão e sensibilidade antes da elegibilidade.
4. Decidir se o indicador é elegível e suficiente para um piloto ampliado; versionar referência e registrar limitações.
5. Somente então recalcular a cesta de seis dimensões e avaliar a incorporação visual.

Dados indisponíveis ou inadequados mantêm saúde ausente. Não usar taxa estadual, cobertura potencial APS ou média imputada para completar o agregado.

## Arquivos disponíveis e reprodução

`saude-contagens-2021-2023.csv` contém 78 linhas anuais com as duas contagens; o JSON inclui as taxas anuais e a razão de somas por capital. Recife: 581 / 52.484 × 1.000 = 11,07 por mil no triênio; Curitiba: 435 / 54.950 × 1.000 = 7,92. Esses valores são taxas registradas, não notas no escore.

Os snapshots HTML completos das respostas TabNet estão em `pipeline/eficiencia_resultados/seed/saude/`, convertidos de ISO-8859-1 para UTF-8. O manifesto mantém hashes das respostas originais e dos arquivos versionados, consultas POST de leitura, filtros e a correspondência explícita de códigos de seis/sete dígitos. As linhas de outras localidades aparecem zeradas pela seleção e são auditadas para não introduzir observações fora da coorte.

O parser rejeita ano, residência ou status temporal incorretos, duplicatas, ausência de capital, totais inconsistentes, códigos ambíguos e denominadores inválidos. Seis testes novos cobrem a auditoria de saúde; 25 testes no conjunto.

```sh
python3 -m pipeline.eficiencia_resultados.saude_municipal
python3 -m unittest pipeline.eficiencia_resultados.test_saude_municipal
```

Para readquirir as duas consultas públicas em cache separado, sem alterar a referência ou sobrescrever as entradas congeladas:

```sh
python3 -m pipeline.eficiencia_resultados.coletar_saude --cache /tmp/obee-saude-recoleta
```

O coletor de saúde foi executado de ponta a ponta nesta sessão: as duas novas respostas reproduziram exatamente os hashes dos snapshots versionados. Isso verifica a reprodução da extração, não o grau de sub-registro dos sistemas.
