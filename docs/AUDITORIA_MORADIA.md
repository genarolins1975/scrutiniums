# Auditoria de viabilidade — Moradia e crédito habitacional municipal

**Data:** 3 de agosto de 2026
**Fontes examinadas:** ESTBAN (BCB), Informações do Mercado Imobiliário (BCB), SCR.data
(BCB), Censo Demográfico 2022 (IBGE) e Manual do COSIF. Cada afirmação abaixo foi
verificada por requisição direta ou por leitura da norma antes de qualquer linha de
coletor.

---

## 1. Diagnóstico das fontes

| Fonte | Geografia | O que mede | Principal limitação |
|---|---|---|---|
| **ESTBAN, verbete 169** | Município | Saldo de financiamentos imobiliários contabilizado na dependência bancária | Soma quatro contas COSIF heterogêneas e é escriturado no município da agência |
| **Informações do Mercado Imobiliário** | **UF** | Carteira residencial e comercial de PF por segmento de funding, taxa, LTV, prestação, valor do imóvel | Não existe detalhamento municipal |
| **SCR.data, produto Imobiliário** | **UF** | Exposição de clientes PF e PJ, operações, inadimplência | Não existe detalhamento municipal |
| **Censo 2022, tabela 9930** | Município | Condição de ocupação de 72,5 milhões de domicílios | Não coletou valor de aluguel nem de prestação |

A assimetria é a estrutura do problema: a única base com granularidade municipal é
justamente a que não separa residencial de comercial nem pessoa física de jurídica; as
duas bases que têm exatamente esses cortes param na unidade da federação. As três não
são somadas em nenhum ponto da página.

## 2. O verbete 169 do ESTBAN, e o que ele de fato contém

A pergunta que abriu esta auditoria era se o verbete 169 inclui operações que não sejam
financiamento habitacional residencial de pessoa física. **A resposta é sim.**

O nome oficial da coluna é `VERBETE_169_FINANCIAMENTOS_IMOBILIARIOS`, subitem do verbete
160 (Operações de Crédito). A fonte normativa é o COSIF, Capítulo 3, Documento nº 13
(Estatística Bancária Mensal/Global). O mapeamento de conta contábil para verbete está na
coluna "E" do elenco de contas
(`https://www3.bcb.gov.br/aplica/cosif/manual/completo_contas.pdf`, versão gerada em
27/07/2026). Exatamente quatro contas apontam para o 169:

| Conta | Título | Função contábil oficial |
|---|---|---|
| 1.6.4.30.00.00-2 | Imóveis residenciais | "Registrar as operações de crédito destinadas à aquisição, construção, reforma, ampliação e produção de unidades imobiliárias residenciais." |
| 1.6.4.10.00.00-4 | Imóveis não residenciais | Mesma redação, referida a unidades não residenciais |
| 1.6.4.40.00.00-1 | Financiamentos imobiliários — carteiras de ativos — LIG | Créditos que integram carteiras garantidoras de Letra Imobiliária Garantida |
| 1.6.6.10.00.00-8 | Financiamentos de infraestrutura e desenvolvimento | "Registrar as operações realizadas em condições especiais" — a função não menciona imóveis |

O verbete não distingue residencial de não residencial, não distingue pessoa física de
pessoa jurídica e não distingue mutuário final de empreendimento em construção — a
palavra "produção", presente nas funções contábeis, cobre incorporação e construção, isto
é, plano empresário. A conta 1.6.6.10 não é crédito imobiliário sob nenhuma leitura da sua
própria função contábil.

A consequência de nomenclatura é direta e vale para toda a página: o 169 é sempre "saldo
de financiamentos imobiliários contabilizado no município", nunca "crédito habitacional".

### 2.1 A armadilha da Resolução CMN 4.966

Na Resolução CMN 4.966, vigente desde 1º de janeiro de 2025, que trouxe o plano de contas
de nove dígitos, **1.6.4.10 é não residencial e 1.6.4.30 é residencial** — invertidos em
relação ao plano de oito dígitos usado na Metodologia de 2020 do próprio BCB. Qualquer
análise que reaproveite o mapeamento antigo troca residencial por comercial e publica o
oposto do que pretende. O registro fica aqui porque o erro é silencioso: as duas contas
existem nos dois planos, com os mesmos códigos e significados trocados.

### 2.2 Os subverbetes não esgotam o verbete 160

Na data-base 2026-03, a soma dos subverbetes publicados — 161, 162, 163, 167, 169 e 171 —
dá R$ 5.012,2 bilhões contra R$ 7.118,3 bilhões do verbete 160, cerca de 70% do total.
Apenas 730 das 7.888 linhas do arquivo reconciliam exatamente. A decomposição publicada
pelo ESTBAN não fecha, e o 169 não pode ser tratado como "a parte imobiliária de um todo
que fecha". Nenhuma participação do 169 sobre o 160 é apresentada como composição
exaustiva.

### 2.3 Teste de quebra de série na virada da Res. 4.966

A mudança de plano de contas em janeiro de 2025 podia ter reclassificado massa de saldo
para dentro ou para fora do 169. Foi testado contra os totais nacionais:

| Data-base | Verbete 160 | Verbete 169 | Verbete 420 | Verbete 171 | 169/160 |
|---|---|---|---|---|---|
| 2024-06 | R$ 5.484 bi | R$ 1.264 bi | R$ 1.006 bi | R$ 33,7 bi | 23,0% |
| 2024-12 | R$ 5.944 bi | R$ 1.346 bi | R$ 1.027 bi | R$ 49,6 bi | 22,6% |
| 2025-01 | R$ 5.441 bi | R$ 1.273 bi | R$ 950 bi | R$ 7,9 bi | 23,4% |
| 2025-06 | R$ 5.810 bi | R$ 1.398 bi | R$ 948 bi | R$ 9,5 bi | 24,1% |
| 2026-03 | R$ 7.118 bi | R$ 1.665 bi | R$ 1.172 bi | R$ 10,1 bi | 23,4% |

Na virada de dezembro de 2024 para janeiro de 2025 o 169 cai 5,4%, em linha com o
agregado — o verbete 160 cai 8,5% e o 420 cai 7,5%. Não há quebra específica do 169, e a
razão 169/160 permanece estável em torno de 23% ao longo de toda a janela. **O verbete
171, ao contrário, quebra 84%** e não deve ser usado em nenhuma decomposição que atravesse
a fronteira 2024/2025.

### 2.4 O que não foi verificado

Não foi possível recuperar o elenco de contas do COSIF anterior a 2025 contendo a coluna
"E": a versão de setembro de 2024 não traz essa coluna, as URLs anteriores devolvem 404 e
o Wayback Machine não tem snapshot do arquivo. **A composição do verbete 169 entre 1988 e
2024 permanece não verificada documentalmente.** O teste de quebra da seção 2.3 é evidência
indireta de estabilidade, não substituto da norma.

## 3. Informações do Mercado Imobiliário: geografia e coleta

A granularidade máxima da publicação é nacional e por unidade da federação. **Não existe
detalhamento municipal**, e a verificação é literal: a busca pela cadeia "munic" no texto
integral do arquivo Metodologia.pdf oficial retorna zero ocorrências. A periodicidade é
mensal, com defasagem de 60 dias na seção Crédito e 90 dias na seção Imóveis — as duas
seções nunca têm a mesma data-base mais recente, e a página nunca as apresenta como se
tivessem.

O acesso é pela API OData em
`https://olinda.bcb.gov.br/olinda/servico/MercadoImobiliario/versao/v1/odata/mercadoimobiliario`.
Três limitações do endpoint foram medidas antes de escrever o coletor: `$skip` devolve
HTTP 500 para qualquer valor, inclusive zero, o que torna a paginação impossível;
`substringof` devolve HTTP 400; e o filtro por lista de nomes estoura o limite de URL. O
único caminho que funciona é uma requisição única com
`$top=1000000&$select=Info,Data,Valor`, que traz as 399.384 linhas em cerca de 48 MB e
20 segundos. É exatamente o que o coletor faz.

O dataset tem 3.594 séries; 1.517 foram coletadas, com 191.738 observações. Apenas 7
séries do alvo não têm dado, todas de UFs pequenas sem crédito de pessoa jurídica em
imóvel comercial — por exemplo `credito_estoque_carteira_credito_pj_comercial_ac` e
`credito_estoque_carteira_credito_pj_sfh_rr`. É ausência real, gravada como nula e nunca
como zero.

Uma anomalia foi encontrada e a série correspondente foi descartada: `contabil_financiamento_residencial_br`
retorna R$ 57,5 trilhões em dezembro de 2024, implausível por cerca de cinquenta vezes. A
calibração foi feita contra `fontes_sbpe_saldo_br`, que na mesma data dá R$ 773,5 bilhões
e é correta. As duas séries contábeis terminam em 31/12/2024 e nenhuma das duas é usada.

## 4. Censo 2022: a tabela, as categorias e o que não foi perguntado

A condição de ocupação vem da **tabela 9930**, variável **381** (Domicílios particulares
permanentes ocupados, em Unidades), classificação **63** (Condição de ocupação). A tabela
cruza a condição com número de cômodos (classificação 65) e tipo de domicílio
(classificação 125); as duas são neutralizadas pelas categorias Total, 95810 e 2932
respectivamente. O nível N6, de município, está disponível, e o período é só 2022.

As categorias da classificação 63 são: Total (95826); Próprio de algum morador (73554),
com as subcategorias já pago, herdado ou ganho (73126) e ainda pagando (4343); Alugado
(1055); Cedido ou emprestado (73553), com as subcategorias por empregador (73127), por
familiar (73128) e outra forma (73129); e Outra condição (1058). A nomenclatura mudou em
relação a 2010: não existe "Próprio — já pago", e sim "Próprio de algum morador — já pago,
herdado ou ganho". Reaproveitar rótulos de 2010 não casa com nenhuma categoria de 2022.

Limite empírico da API, medido: com `N6[all]`, no máximo 8 categorias da classificação 63
por requisição. Com 9 ou mais o servidor devolve HTTP 500 por estouro de payload.

Ausências vêm como a string `"-"`, que na convenção do SIDRA significa zero absoluto e não
dado faltante: 890 ocorrências em 861 municípios distintos, sendo 795 em "Outra condição",
94 em "Próprio — ainda pagando" e 1 em "Cedido". Nenhum `".."`, `"X"` ou `"..."` apareceu
na extração.

O Censo 2022 aplica arredondamento aleatório como controle de divulgação. Comparando a
soma de Próprio, Alugado, Cedido e Outra contra o Total publicado nos 5.570 municípios:
3.615 batem exatamente, 975 divergem em +1, 970 em −1, 6 em +2 e 4 em −2. Qualquer
validação de soma precisa de tolerância de ±2, e a divergência é da fonte, não do
processamento.

### 4.1 O Censo 2022 não coletou valor de aluguel nem de prestação

A premissa está confirmada, e a verificação é documentada. O filtro
`?classificacao=511&periodo=2022`, sendo 511 a classificação de classes de aluguel nominal
mensal, retorna `[]`. O filtro `?classificacao=192&periodo=2022` também retorna `[]`. O
filtro `?classificacao=511` sem restrição de período retorna apenas as tabelas 3511 e
3524, ambas com `inicio: 2010, fim: 2010`. **Nenhuma variável de valor de aluguel ou de
prestação existe em qualquer agregado de 2022.** O único dado municipal de valor de aluguel
disponível na API é o do Censo 2010, nas tabelas 3511 e 3524, e ainda assim em faixas, não
em valor contínuo.

Disso decorre a restrição mais dura da página: nenhum comprometimento de renda observado
com moradia pode ser publicado. Ele exigiria numerador e denominador do mesmo domicílio, e
nenhuma base pública oferece isso.

### 4.2 Não há cruzamento de condição de ocupação com renda em 2022

Verificado pelo mesmo caminho: o filtro `?classificacao=63&periodo=2022` retorna
exatamente 11 agregados — 9928, 9929, 9930, 9932, 9933, 9935, 9936, 9938, 9944, 10202 e
10205 — e nenhum deles cruza condição de ocupação com classes de rendimento. Esse
cruzamento existe apenas no Censo 2000, tabelas 1483 e 2011, e no Censo 2010, tabela 3168.
A tabela 9932 não tem nível municipal.

## 5. Números coletados

### 5.1 Censo 2022, nacional

| Condição de ocupação | Domicílios | Participação |
|---|---|---|
| Próprio já pago, herdado ou ganho | 45.302.103 | 62,52% |
| Próprio ainda sendo pago | 6.326.945 | 8,73% |
| Alugado | 16.111.355 | 22,23% |
| Cedido ou emprestado | 4.117.217 | 5,68% |
| Outra condição | 603.697 | 0,83% |
| **Total** | **72.461.317** | **100%** |

Cobertura de 5.570 municípios, nenhum sem total publicado. Noventa e quatro municípios têm
"ainda pagando" nulo.

### 5.2 ESTBAN, verbete 169, data-base 2026-03

O saldo nacional é de R$ 1.664,6 bilhões, 23,4% do verbete 160. A poupança, verbete 420,
soma R$ 1.171,9 bilhões. Há saldo em 2.499 municípios; **3.071 municípios não têm nenhuma
dependência bancária reportando saldo imobiliário**, e ausência de saldo não é crédito
zero: é ausência de agência que o contabilize. Trinta e quatro instituições têm saldo no
169, contra 111 no verbete 160. A mediana do saldo por domicílio é de R$ 5.304. Foram
coletadas 13 data-bases, de 2025-03 a 2026-03, com 2025-03 excluída por ser subcoletada —
a mesma exclusão já documentada na auditoria de penetração.

Os selos de confiabilidade municipal distribuem-se assim: 1.017 municípios com selo alto,
1.467 médio, 15 baixo e 3.071 sem dependência.

### 5.3 A concentração contábil, que é o limite da leitura municipal

| Instituição | Saldo no 169 | Participação | Municípios |
|---|---|---|---|
| Caixa Econômica Federal | R$ 1.046,2 bi | 62,85% | 1.618 |
| Itaú Unibanco | R$ 319,6 bi | 19,20% | **2** |
| Bradesco | R$ 132,6 bi | 7,97% | **1** |
| Santander | R$ 70,8 bi | 4,25% | **1** |
| Banco do Brasil | R$ 49,9 bi | 3,00% | **2.272** |
| Banco Inter | R$ 10,1 bi | 0,61% | **1** |

**Vinte e nove das 34 instituições contabilizam em dois municípios ou menos, e somam
R$ 562,2 bilhões, ou 33,77% do saldo nacional.** Este é o fato que mais limita a leitura
municipal da página, e por isso é publicado como número, não como advertência genérica: um
terço do saldo imobiliário do país está escriturado em um ou dois pontos por instituições
que operam em todo o território. O contraste entre Bradesco, com R$ 132,6 bilhões em um
município, e Banco do Brasil, com R$ 49,9 bilhões distribuídos por 2.272, mostra que a
diferença não é de tamanho de carteira, é de política de escrituração.

### 5.4 Quociente locacional por instituição

O quociente é definido como QL(b,i) = (saldo da instituição i no município b ÷ saldo total
do município b) ÷ (saldo nacional da instituição i ÷ saldo nacional). Igual a 1 significa
presença local proporcional à nacional. Ele só é publicado para instituições presentes em
ao menos 25 municípios: abaixo disso o quociente é alto por aritmética, não por
concentração real. Quatro instituições se qualificam.

| Instituição | QL mediano | QL p90 |
|---|---|---|
| Caixa Econômica Federal | 1,54 | 1,59 |
| Banco do Brasil | 2,30 | 33,35 |
| Banco do Estado do Pará | 582,61 | 1.129,69 |
| Banco do Estado de Sergipe | 235,26 | 2.077,65 |

Os dois bancos estaduais ilustram o que o indicador mede: participação local
desproporcional à participação nacional. A Caixa, com QL mediano próximo de 1,5 e p90
quase igual à mediana, é o caso oposto — presença uniforme.

### 5.5 Informações do Mercado Imobiliário, nacional

Data-base de crédito 2026-04-30, data-base de imóveis 2026-03-31. As duas nunca são
apresentadas juntas como se fossem a mesma data.

| Segmento | Carteira PF | Taxa (% a.a.) | LTV (%) | Prestação do estoque | Inadimplência (%) |
|---|---|---|---|---|---|
| SFH | R$ 587,3 bi | 13,95 | 66,19 | R$ 1.844,04 | 1,00 |
| FGTS | R$ 619,5 bi | 8,99 | 73,73 | R$ 661,84 | 2,03 |
| Taxas de mercado | R$ 150,1 bi | 14,52 | 63,64 | R$ 3.466,63 | 0,85 |
| Home equity | R$ 28,4 bi | 21,69 | 45,49 | R$ 2.259,02 | 2,41 |
| Imóvel comercial | R$ 4,2 bi | 15,58 | 62,63 | R$ 2.267,78 | 0,76 |
| **Total** | **R$ 1.389,5 bi** | — | — | — | — |

O home equity não financia a compra do imóvel: o imóvel já é do tomador e serve de
garantia para outro fim. Seu LTV mais baixo e sua taxa mais alta são consistentes com
isso, e ele nunca é somado ao habitacional sem ressalva.

Nos imóveis financiados, o valor médio de avaliação é de R$ 277.849,51 e o valor de compra
de R$ 262.500, com área privativa média de 57,83 m². No mês foram financiadas 52.910 casas
e 25.266 apartamentos.

No direcionamento dos recursos da poupança em habitação residencial, R$ 1.113,2 bilhões
estão em aquisição, R$ 118,9 bilhões em construção e R$ 0,5 bilhão em reforma e ampliação,
com R$ 477,0 bilhões em aplicação. O crédito imobiliário brasileiro financia compra;
construção é uma fração pequena e reforma é residual.

As séries mensais começam em abril de 2014 na seção de crédito e em janeiro de 2018 na de
imóveis; a prestação média começa em março de 2016.

### 5.6 SCR.data, produto Imobiliário

Na data-base 2026-05, pessoa física: saldo de R$ 1.385,7 bilhões em 9,37 milhões de
operações, inadimplência de 1,49% pelo critério de carteira arrastada acima de 90 dias e
ativo problemático de 5,16%. Pessoa jurídica: R$ 84,7 bilhões, com inadimplência de 1,16%.
A série cobre 17 data-bases, de 2025-01 a 2026-05, subindo de R$ 1.185,1 bilhões para
R$ 1.385,7 bilhões.

Comparado aos demais produtos de pessoa física na mesma data-base, o imobiliário é o
crédito de menor inadimplência entre as linhas comparáveis: cartão à vista 0,30%,
imobiliário 1,49%, consignado 3,38%, veículos 6,52%, rural 7,01%, crédito pessoal 11,19% e
cartão parcelado 41,25%.

## 6. Reconciliação entre as três medidas

As três medidas não devem ser forçadas à igualdade, porque medem coisas diferentes:

| Medida | Geografia | Valor | O que abrange |
|---|---|---|---|
| ESTBAN, verbete 169 | Município | R$ 1.664,6 bi | Saldo contabilizado na dependência; inclui não residencial, PJ e infraestrutura |
| Mercado Imobiliário, carteira PF | UF | R$ 1.389,5 bi | Residencial e comercial de pessoa física, sem PJ |
| SCR.data, Imobiliário PF | UF | R$ 1.385,7 bi | Exposição de clientes pessoa física |

As duas últimas praticamente coincidem — a diferença é de 0,3% —, o que valida a ordem de
grandeza de ambas apesar de virem de sistemas de coleta distintos. A primeira é maior
porque abrange mais coisa, e essa diferença é a medida aproximada do que o 169 carrega
além do crédito imobiliário de pessoa física.

Por unidade da federação a razão entre ESTBAN e Mercado Imobiliário se desfaz — Acre 0,96,
Alagoas 0,93, Amazonas 0,76, Amapá 1,30 —, refletindo centralização contábil. É o mesmo
fenômeno que, no nível municipal, produz o selo de confiabilidade.

## 7. Os dois modelos, e uma restrição amostral que foi medida

### 7.1 Lacuna de penetração habitacional

Selo Estimado. O benchmark de pares agrupa municípios por região × tercil de renda
domiciliar per capita × urbanização de 75% ou mais, exigindo pelo menos 8 municípios por
grupo. Trinta grupos cobrem 5.476 municípios; 2.725 ficam abaixo da mediana do próprio
grupo, com lacuna somada de 732.811 domicílios. Não usa crédito, não usa preço, e é um
contraste do Censo 2022 consigo mesmo. **Não é demanda comprovada:** pode refletir
preferência por aluguel, herança, autoconstrução, programas não financiados, informalidade
fundiária ou um parque domiciliar mais antigo, e nada disso é observável nos dados
disponíveis.

### 7.2 Lacuna de saldo

Selo Estimado. A especificação é

```
ln(saldo 169) = β₀ + β₁·ln(domicílios) + β₂·ln(renda domiciliar per capita)
                + β₃·urbanização + efeitos fixos de região
```

A referência é a **mediana condicional**, `exp(valor ajustado)`, e não a média com correção
de Duan. Retransformar pela média colocaria a maioria dos municípios abaixo do esperado por
construção, e a lacuna passaria a medir a assimetria da distribuição em vez de falta de
crédito. É o mesmo critério adotado na aba de penetração, o que mantém os dois módulos
comparáveis.

### 7.3 Por que a amostra exige duas ou mais instituições no município

A restrição foi medida, não arbitrada. Quatro amostras foram ajustadas com a mesma
especificação:

| Amostra | n | R² | σ | Lacuna ÷ saldo observado |
|---|---|---|---|---|
| Selo alto e médio, sem restrição de instituições | 2.484 | 0,706 | 1,450 | 2,66 |
| Somente selo alto | 1.017 | 0,710 | 0,668 | 0,14 |
| Selo alto e médio, com 5.000 domicílios ou mais | 1.906 | 0,684 | 1,354 | 1,02 |
| **Selo alto e médio, com 2 instituições ou mais (escolhida)** | **1.479** | **0,805** | **0,662** | **0,13** |

A última coluna compara a lacuna somada ao saldo observado da própria amostra, não ao
saldo nacional. Sem a restrição, a lacuna somada dava **R$ 2,54 trilhões contra um saldo
nacional observado de R$ 1,66 trilhão** — um resultado sem sentido, que não podia ser
publicado. Com a restrição, a lacuna cai para R$ 120,6 bilhões, 7,2% do saldo nacional
observado, com 677 municípios abaixo da referência.

A razão da restrição é substantiva, e é ela que justifica a escolha, não o ganho de ajuste:
**município com uma única instituição no verbete 169 é, quase sempre, o ponto onde um banco
centraliza a escrituração de uma carteira nacional, e o saldo ali não descreve mercado
local nenhum.** A seção 5.3 quantifica exatamente isso. O corte por porte, que parece a
alternativa natural, resolve menos — mantém σ em 1,35 e a lacuna acima do saldo observado —
porque o problema não é município pequeno, é município que é sede contábil.

Os coeficientes finais são: intercepto −3,8288; ln(domicílios) 0,9874; ln(renda per capita)
1,5316; urbanização 1,6020; e efeitos fixos de região, tendo o Norte como base, de 0,9415
no Nordeste, 0,7646 no Centro-Oeste, 0,5430 no Sudeste e 0,7081 no Sul. A elasticidade da
escala domiciliar é praticamente unitária e a da renda per capita é mais que proporcional.

Com σ = 0,66 em logaritmo, a faixa de um desvio vai de 52% a 1,9 vez o valor central. A
precisão individual é baixa e a página diz isso: a lacuna de um município isolado é
indicativa, e a soma de muitos é mais informativa que qualquer linha do ranking. A faixa é
publicada por município.

## 8. O que a página não autoriza concluir

O verbete 169 não é crédito habitacional residencial de pessoa física, e nunca é assim
nomeado. Domicílios registrados como "ainda pagando" não são contratos bancários: a
declaração cobre consórcio, financiamento com construtora, programas habitacionais e compra
parcelada entre particulares, e o Censo não pergunta quem é o credor.

Os 6,33 milhões de domicílios ainda sendo pagos, de julho de 2022, e os 9,37 milhões de
operações imobiliárias de pessoa física do SCR, de maio de 2026, são universos distintos e
não devem ser subtraídos: uma pessoa pode ter várias operações, há imóveis de investimento
e segunda residência, e há quatro anos entre as duas medidas.

Saldo dividido por operação é saldo médio por operação em aberto, não ticket médio nem
valor de contrato — operações em aberto estão em estágios distintos de amortização.
Participação de instituição é participação no saldo imobiliário contabilizado no município,
nunca participação de clientes: o ESTBAN não publica clientes, e o SCR publica operações
por UF, sendo que operação não é cliente.

Nenhum comprometimento de renda observado é publicado, pela razão exposta na seção 4.1. O
simulador produz cenário aritmético sobre parâmetros escolhidos pelo usuário, com seguros,
taxas de administração e correção monetária explicitamente fora da conta, e nenhuma faixa é
classificada automaticamente como inadimplente ou insustentável.

As duas lacunas são contrafactuais estatísticos: não são demanda comprovada nem prova de
restrição de oferta. Fontes privadas e dados de anúncios imobiliários não foram usados. O
déficit habitacional, que tem metodologia própria da Fundação João Pinheiro, não se deduz
das bases aqui reunidas e não é estimado.

## 9. Pendências

| Pendência | Situação |
|---|---|
| Composição do verbete 169 antes de 2025 | Não verificada documentalmente: o elenco de contas do COSIF com a coluna "E" não está disponível para versões anteriores (seção 2.4) |
| Coluna `CODMUN_IBGE` no CSV do ESTBAN | O arquivo passou a trazer uma 54ª coluna com o código do IBGE. A conciliação atual por (UF, nome normalizado) com tabela de apelidos atinge 100%; falta avaliar se a coluna nova pode reduzir a conciliação a mera validação cruzada |
| Nota metodológica do ESTBAN municipal | Não existe publicação específica. Toda a documentação vem do Manual do COSIF e das instruções do documento 4500 |
| Defasagem entre as seções do Mercado Imobiliário | A seção Imóveis tem defasagem maior que a de Crédito; as duas nunca são apresentadas na mesma data-base, e a diferença é declarada em cada tela |
