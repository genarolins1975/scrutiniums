# Habitação: duas decisões editoriais, registradas na edição v4

13/10/2026. Referência do experimento: Censo 2022, 26 capitais estaduais. Este documento não escolhe unidade, limiar, pesos ou normalização, nem altera a definição principal congelada.

## Fontes primárias e distinção entre conceitos

**IBGE, Síntese de indicadores sociais: uma análise das condições de vida da população brasileira, edição 2018**, Rio de Janeiro, série Estudos e Pesquisas, n. 39. [Catálogo oficial](https://biblioteca.ibge.gov.br/index.php/biblioteca-catalogo?view=detalhes&id=2101629) conferido em 13/10/2026; [PDF oficial](https://biblioteca.ibge.gov.br/visualizacao/livros/liv101629.pdf). Na seção sobre inadequações domiciliares, **p. 63 do PDF**, o texto define o adensamento domiciliar excessivo como “uma situação onde o domicílio tem mais de três moradores para cada cômodo utilizado como dormitório”. A nota (2) do Gráfico 10, **p. 64 do PDF**, repete o critério: “há adensamento excessivo no domicílio em que há mais de 3 moradores por dormitório”; a mesma nota acompanha as tabelas das p. 68 e 69 do PDF. O [release oficial da SIS 2018](https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/2013-agencia-de-noticias/releases/23298-sintese-de-indicadores-sociais-indicadores-apontam-aumento-da-pobreza-entre-2016-e-2017) também identifica esse limiar.

**Paginação.** PDF oficial obtido em 13/10/2026, 20:33 UTC: HTTP 200, 4.177.076 bytes, 149 páginas, SHA-256 `cad23b9f3c1ff6ac82b9b1dbf34751c9f9c421132abf61a471871328a07077b2`. A consulta anterior havia retornado HTTP 403. O arquivo **não traz numeração impressa**: as p. 63, 64 e 100 do PDF foram conferidas na camada de texto, sem número de página no cabeçalho ou no rodapé, e as p. 63 e 64 também na imagem renderizada. Por isso a citação usa a página do PDF; não se atribui número impresso presumido. Com isso, a exigência de paginação do parecer fica atendida para a SIS 2018.

**Fundação João Pinheiro, Metodologia do deficit habitacional e da inadequação de domicílios no Brasil – 2016–2019**, Belo Horizonte, edição **2021**, [PDF oficial](https://fjp.mg.gov.br/wp-content/uploads/2020/12/04.03_Relatorio-Metodologia-do-Deficit-Habitacional-e-da-Inadequacao-de-Domicilios-no-Brasil-2016-2019-v-1.0_compressed.pdf), acesso em 13/10/2026. Na **seção 4.2.5, p. 62 impressa (p. 66 do PDF)**, a descrição do conceito anterior registra: “número médio de moradores fosse superior a três pessoas por dormitório”. A metodologia revisada trata o adensamento na identificação de famílias conviventes: **p. 42 impressa (p. 46 do PDF)**, com núcleo familiar secundário e ocupação “superior a duas pessoas por dormitório”. Não é uma regra geral de que todo domicílio acima de dois esteja no déficit. O adensamento de domicílios alugados deixou de ser componente autônomo; a inadequação considera também o uso dos cômodos como dormitórios. Portanto, um percentual simples do SIDRA não reproduz o déficit habitacional da FJP.

## Perguntas para o editor

1. **Qual é a unidade do estimando: moradores ou domicílios?** Domicílios (SIDRA 9934) dão igual peso às unidades domiciliares na proporção estimada; moradores (9940) descrevem a parcela de pessoas exposta à condição e dão mais peso a domicílios maiores. Os denominadores e as interpretações são diferentes. Ambas as alternativas são amostrais; erros municipais não foram obtidos.
2. **Qual limiar descritivo será adotado: mais de 2 ou mais de 3 moradores por dormitório?** O primeiro identifica uma condição mais abrangente. O segundo corresponde ao limiar de adensamento excessivo da SIS consultada e ao conceito histórico descrito pela FJP. Nenhum limiar, sozinho, mede déficit habitacional ou implementa integralmente a metodologia revisada da FJP. A justificativa deve ser conceitual e registrada antes de comparar rankings.

## Consequências observadas, sem recomendação pelo resultado

Reprodução em 13/10/2026 a partir de `habitacao.build()`, `habitacao_cenarios.DEFINITIONS` e `percentiles_lower`, usando os mesmos seeds SIDRA preservados no pacote. Correlação de Pearson dos percentis orientados equivale à correlação de postos neste experimento.

| Comparação | Correlação | Maior mudança absoluta de percentil |
|---|---:|---:|
| Domicílios >2 × domicílios >3 | 0,985641 | 11,54 pontos |
| Domicílios >2 × moradores >2 | 0,995897 | 7,69 pontos |
| Domicílios >2 × moradores >3 | 0,971966 | 19,23 pontos |
| Domicílios >3 × moradores >2 | 0,991795 | 11,54 pontos |
| Domicílios >3 × moradores >3 | 0,993846 | 7,69 pontos |
| Moradores >2 × moradores >3 | 0,982222 | 11,54 pontos |

Assim, correlações de aproximadamente **0,972 a 0,996** coexistem com mudanças locais de até **19,23 pontos**. São efeitos determinísticos da definição, não significância estatística.

O arquivo `sensibilidade-pares-v3.json`, produzido por `scripts/obee_sensibilidade_pares.py`, mostra **Aracaju e Teresina** empatando quando o peso total do bloco material é **28/59 (47,46%)** nas definições >2, ou **1/2 (50%)** nas definições >3, tanto para moradores quanto para domicílios. São raízes exatas da diferença de escores na família com pesos iguais dentro dos blocos, entre 40% e 4/7; não são pesos recomendados, probabilidades ou limites de confiança.

## Encaminhamento

Decisão: **registrada em 14/10/2026** pelo titular do repositório para a edição v4: unidade **moradores**, limiar **mais de 3 moradores por dormitório**, com o fundamento conceitual descrito em `v4/DECISAO_EDICAO_V4.md`. A definição principal congelada da candidata v3 (domicílios acima de 2) permanece intacta como evidência. Qualquer decisão que altere `habitacao_cenarios.py`, seeds, `cesta-conjunta.*` ou outro item congelado exige a proposta descrita em `PENDENCIAS_NOVA_VERSAO_PACOTE.md`; não executar `freeze()` sobre a v3. A documentação bibliográfica das duas fontes conceituais está concluída: SIS 2018 citada pela página do PDF, que não tem numeração impressa, e FJP pela página impressa.
