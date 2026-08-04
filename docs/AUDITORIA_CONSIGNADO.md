# Auditoria de viabilidade — Consignado, previdência e envelhecimento

**Data:** 3 de agosto de 2026
**Fontes examinadas:** Censo Demográfico 2022 (IBGE), SCR.data (BCB), API de taxas de
juros por instituição (BCB), Estatísticas Municipais da Previdência Social e fontes
públicas de crédito consignado. Cada afirmação abaixo foi verificada por requisição
direta antes de qualquer linha de coletor.

---

## 1. A pergunta que organiza o módulo

O painel quer relacionar envelhecimento, dependência de benefícios previdenciários e
exposição ao consignado, no território. As três coisas existem em geografias diferentes,
e a mais fina não é a que interessa ao crédito:

| Dimensão | Geografia observada | Fonte |
|---|---|---|
| Estrutura etária | **Município** | Censo 2022, tabela 9514 |
| Renda domiciliar e do trabalho | **Município** | Censo 2022, tabelas 10295 e 10289 |
| Composição do rendimento | **Município** | Censo 2022, tabela 10297 |
| Benefícios do INSS | **Município** | Estatísticas Municipais da Previdência (anual) |
| Consignado do INSS | **Nacional** | SGS, séries por vínculo do tomador |
| Reclamações sobre consignado do INSS | **Município** | consumidor.gov.br |
| Consignado total | **UF** | SCR.data |
| Consignado de aposentados e pensionistas | **UF** | SCR.data, corte triplo |
| Taxa de consignado INSS por instituição | **Nacional** | API de taxas de juros do BCB |

A consequência é estrutural e está declarada na página: **não existe carteira municipal
pública de consignado**. Qualquer número municipal de exposição é alocação de um total
estadual, e é rotulado como estimativa.

## 2. Censo 2022 — o que ele mede, e a premissa que se confirmou

### 2.1 A limitação central, verificada documentalmente

A tabela **10297** ("Participação percentual na composição do rendimento nominal mensal
domiciliar dos moradores em domicílios particulares permanentes ocupados, por tipo de
rendimento"), nível municipal, tem a classificação 11308 com **exatamente três
categorias**:

| ID | Categoria |
|---|---|
| 79450 | Rendimento de todas as fontes |
| 79451 | Rendimento de todos os trabalhos |
| 79452 | Rendimento de outras fontes |

**Não existe categoria de aposentadoria ou pensão.** "Outras fontes" reúne aposentadoria,
pensão, BPC, transferências de renda, aluguel, aplicações financeiras, seguro-desemprego
e demais origens num único número. A premissa do briefing está correta, e a consequência
foi adotada sem exceção: a participação de outras fontes é publicada como **teto** do
peso dos benefícios previdenciários, jamais como renda previdenciária. O peso específico
vem de registro administrativo, não do Censo.

A dispersão desse teto é grande e informativa por si só: varia de **6,3%** a **77,0%**
entre municípios, com média simples de 34,5%. Os oito municípios de maior participação
têm entre 3 mil e 24 mil habitantes e estão no Piauí, Rio Grande do Norte, Pernambuco e
Paraíba — o perfil que a literatura associa a dependência previdenciária, mas que este
número **não comprova** por si.

### 2.2 Estrutura etária

Tabela **9514**, variável 93, classificação 287, restrita aos **21 grupos quinquenais de
nível 1** (de "0 a 4" a "100 anos ou mais"), com sexo e forma de declaração neutralizados
pelas categorias Total. Nível N6, período 2022.

Limite empírico da API: com `N6[all]`, 11 categorias devolvem HTTP 500; 8 funcionam. Os
21 grupos vêm em **três lotes de sete**.

Validação da coleta: a soma dos 21 grupos em todos os municípios dá **203.080.756**
habitantes, idêntica ao total do Censo já armazenado por outra tabela. Nenhum município
faltante.

Indicadores nacionais derivados:

| Indicador | Valor |
|---|---|
| População de 60 anos ou mais | 32,11 milhões (15,8%) |
| População de 65 anos ou mais | 22,17 milhões (10,9%) |
| População de 80 anos ou mais | 4,59 milhões (2,3%) |
| Índice de envelhecimento (60+ / 0–14 × 100) | 80,0 |
| Razão de dependência idosa (65+ / 15–64 × 100) | 15,7 |
| Idade mediana | 35,2 anos |

A idade mediana é interpolada linearmente dentro do grupo em que a frequência acumulada
cruza a metade da população — método padrão para dados agrupados. **Não** é a mediana que
o IBGE calcularia a partir do microdado, e a página declara isso.

Dispersão municipal: o índice de envelhecimento vai de **8 a 234**. Apenas **2 municípios**
têm mais de 30% da população com 60 anos ou mais, e **79** passam de 25%. Os oito mais
envelhecidos do país, entre os que têm ao menos 5 mil habitantes, estão **todos no Rio
Grande do Sul**.

### 2.3 Massa de rendimento do trabalho

Tabela **10289**, variável **13424** ("Massa de rendimento nominal mensal de todos os
trabalhos das pessoas de 14 anos ou mais"), em reais, nível municipal, 5.570 municípios
sem faltantes. Total nacional: **R$ 250,4 bilhões por mês**.

É o denominador correto para comparar com a massa de benefícios. A massa domiciliar total
(R$ 331,0 bilhões por mês, da tabela 10295) **não** serve para isso: ela já inclui os
próprios benefícios, e usá-la como denominador de um indicador de dependência
previdenciária colocaria o numerador dentro do denominador.

## 3. SCR.data — a única medida observada de consignado, e até onde ela vai

### 3.1 O corte triplo

O CSV público do SCR.data vem **totalmente cruzado**: `uf × segmento × cliente ×
cnae_ocupacao × porte × modalidade × submodalidade × origem × indexador`. Isso permite
construir um fato que nenhum agregado publicado oferece pronto: **consignado × ocupação ×
unidade da federação**.

O coletor foi estendido para gravar esse corte, restrito ao produto Consignado — o corte
triplo completo geraria centenas de milhares de linhas por mês sem uso.

**Validação:** a soma das 27 unidades da federação do grupo "Aposentado/pensionista" bate
com o agregado nacional por ocupação com diferença de **0,0000%**.

### 3.2 O que o corte revela

Composição do consignado de pessoa física, data-base 2026-05:

| Grupo de ocupação | Saldo | Participação | Inadimplência |
|---|---|---|---|
| Servidor ou empregado público | R$ 271,3 bi | 34,1% | 2,83% |
| Outros | R$ 240,9 bi | 30,3% | 4,20% |
| **Aposentado/pensionista** | **R$ 159,9 bi** | **20,1%** | **2,22%** |
| Empregado de empresa privada | R$ 89,8 bi | 11,3% | 4,93% |
| Empresário | R$ 16,5 bi | 2,1% | 2,75% |
| Autônomo | R$ 15,4 bi | 1,9% | 3,57% |
| MEI | R$ 2,2 bi | 0,3% | 4,72% |

O consignado é popularmente associado ao INSS, mas aposentados e pensionistas respondem
por **um quinto** do produto; servidores públicos, por um terço.

A série de 17 data-bases mostra um contraste que a página publica: o consignado **total**
de pessoa física cresceu de R$ 697,1 bi para R$ 796,1 bi entre 2025-01 e 2026-05 (+14,2%),
enquanto o de aposentados e pensionistas ficou **parado em R$ 159,9 bi**, com **um milhão
de operações a menos** (14,06 para 13,06 milhões). Saldo estável com menos operações
significa ticket médio maior — o que é um fato observado, e não uma explicação.

### 3.3 Uma ressalva de nomenclatura que não pode ser relaxada

O grupo "Aposentado/pensionista" do SCR **é mais amplo que o público do INSS** — inclui
aposentados e pensionistas de regimes próprios — e ao mesmo tempo **cobre só 57% do saldo**
que o Banco Central registra como consignado do INSS na série do SGS (R$ 159,9 bilhões
contra R$ 281,9 bilhões). As duas coisas acontecem juntas porque classificar pela ocupação
declarada do tomador não é o mesmo que identificar a averbação em benefício: o grupo inclui
quem o INSS não financia e exclui quem ele financia.

A consequência prática é uma divisão de trabalho entre as duas fontes. O **SGS** dá o nível
nacional do consignado do INSS; o **SCR** dá o único recorte por unidade da federação
disponível, e só para esse fim. A página nunca chama a série do SCR de consignado do INSS —
o nome usado é **"consignado de aposentados e pensionistas"** — e nunca soma as duas.

Participação do grupo no consignado de cada unidade da federação, data-base 2026-05: Rio
de Janeiro lidera com 28,2%, seguido de Rio Grande do Sul (23,7%), Distrito Federal
(23,5%), Espírito Santo (22,8%), São Paulo e Santa Catarina (22,4%).

## 4. Instituições financeiras — a geografia é nacional, e assim fica

A API de taxas de juros do BCB publica a modalidade **"Crédito pessoal consignado INSS -
Prefixado"** por instituição, identificada por CNPJ de oito dígitos, em janelas de
contratação. Esta é a única fonte que nomeia instituições no consignado do INSS, e ela é
**nacional**. Nenhuma participação municipal ou estadual por instituição é estimada.

Janela iniciada em 22 de junho de 2026, **36 instituições**:

| Estatística | Taxa anual |
|---|---|
| Mínima | 18,85% (Financeira Alfa) |
| Primeiro quartil | 22,52% |
| Mediana | 24,38% |
| Terceiro quartil | 24,99% |
| Máxima | 34,55% (Bradesco) |

Spread sobre a Selic: 10,13 pontos percentuais. Variação em três meses: +0,93 ponto. A
série mensal cobre 27 meses desde maio de 2024, quando a mediana era 21,77% — alta de
2,61 pontos no período.

A instituição mais cara cobra **84% a mais** que a mais barata pelo mesmo produto, com o
mesmo mecanismo de garantia. Isso é dispersão de preço observada, e a página não a
interpreta.

**Ressalva de conceito:** taxa de contratação não é carteira. Mede o preço de operações
novas na janela divulgada, não o estoque. Nenhuma participação de mercado é derivada
daqui, porque a fonte não a suporta.

## 5. Benefícios do INSS por município

Fonte: Ministério da Previdência Social, "Emitidos por Municípios", dois arquivos XLSX por
ano — `ben_municipios_especie_{ano}.xlsx` e `ben_municipios_clientela_{ano}.xlsx`. Ambos
legíveis com a biblioteca padrão. Periodicidade **anual**: cada arquivo traz a posição de
dezembro e o acumulado do ano. Não existe série municipal mensal.

Um detalhe técnico bloqueava a coleta e foi resolvido: o portal devolve **HTTP 401** para
arquivo binário pedido com `Accept: application/json`. O bloqueio é do cabeçalho, não do
User-Agent — foi medido em sete combinações. O `http_get` do projeto passou a aceitar
`accept="*/*"`.

### 5.1 As três definições que determinam a nomenclatura

**O município é o do órgão pagador.** A página oficial diz "classificados de acordo com o
município do órgão pagador", e o rodapé da planilha repete: "Não necessariamente refletem o
município de residência do beneficiários". O efeito é grande — Nova Petrópolis, no Rio
Grande do Sul, registra 18.721 benefícios para 23.934 habitantes; São Raimundo do Doca
Bezerra, no Maranhão, registra 13 para 5.761.

**O valor é líquido de descontos**, e o empréstimo consignado é descontado em folha. Logo o
consignado **já saiu deste número**: um município com mais consignado aparece com valor
menor, não maior. O indicador é sempre chamado de "valor líquido de benefícios emitidos".
Ressalva registrada: a documentação exemplifica os descontos com imposto de renda e pensão
alimentícia e fecha com "etc." — **não localizamos documentação que nomeie explicitamente o
consignado**. A evidência é indireta e quantitativa: a tabela de valor líquido do Boletim
soma R$ 74,19 bilhões e a que declara não incluir descontos soma R$ 84,19 bilhões, uma
diferença de 11,9%.

**É benefício emitido, não pago.** São créditos encaminhados à rede bancária, sem os
Pagamentos Alternativos de Benefícios. E a contagem é de **créditos**: um benefício pode
gerar mais de um crédito na mesma competência.

**Beneficiários não são benefícios, e não existem por município.** O Anuário registra
36.468.396 beneficiários para 40.768.504 benefícios em dezembro de 2024 — 1,12 benefício por
pessoa, com 11,1% acumulando dois ou mais. Mas o menor nível geográfico é a unidade da
federação.

### 5.2 Cobertura e reconciliação

Quatro safras coletadas, de 2022 a 2025, com 5.570 municípios cada. Nenhum valor suprimido:
o menor município publicado é Serra da Saudade, em Minas Gerais, com nove benefícios, o que
confirma ausência de máscara por baixa contagem.

A reconciliação com o Boletim Estatístico de dezembro de 2025 fecha **dígito a dígito** nas
sete linhas: aposentadorias 24.144.902, pensões por morte 8.514.458, auxílios 2.079.494,
outros previdenciários 434.217, total previdenciário 35.173.071, assistenciais e legislação
específica 6.468.870, total 41.641.941, e valor líquido de dezembro R$ 74.193.962.854,56. O
acumulado do ano difere em R$ 5.660,92 — inconsistência residual do publicador, de ordem
6×10⁻⁹, que exige tolerância em vez de igualdade estrita.

O arquivo de clientela cobre **apenas o RGPS**, e por isso soma 35.173.071 em 2025, idêntico
ao total previdiário do outro arquivo e sem os assistenciais. Fecha nos quatro anos.

### 5.3 Três defeitos do publicador que o coletor precisa tratar

1. **Cabeçalho em três linhas mescladas.** Ler uma linha só devolve quatro colunas de
   catorze, e o total previdenciário fica nulo em todos os anos — foi o que aconteceu na
   primeira versão. O coletor acumula rótulos por todo o bloco de cabeçalho.
2. **Rótulos trocados em 2024.** No arquivo de clientela daquele ano, o cabeçalho diz que a
   coluna A é "Código IBGE" e a B é "Município", mas os dados estão invertidos. Confiar no
   rótulo perderia o ano inteiro em silêncio. A coluna do código passou a ser detectada
   pelo **conteúdo** — a que tem mais valores de sete dígitos.
3. **Código em branco.** Boa Esperança do Norte, no Mato Grosso, vem sem código na aba de
   quantidade e com código nas de valor. Sem recuperá-lo pelo nome, a soma nacional erra
   por 346 benefícios.

### 5.4 O que a fonte não separa

BPC não é isolado — vem somado a renda mensal vitalícia e legislação específica na mesma
coluna. Auxílio-doença não é isolado — vem dentro de "Auxílios", junto com acidente,
reclusão e suplementar. Salário-maternidade cai em "Outros". Essas separações existem
**apenas no agregado nacional**, no Boletim.

### 5.5 O teste de coerência

O Censo mede, de forma independente, quanto do rendimento domiciliar não vem do trabalho.
Benefícios previdenciários são parte disso, então o peso calculado não pode ultrapassar essa
participação. Aplicado aos 5.570 municípios, depois de deflacionar o valor de dezembro de
2025 a preços de julho de 2022 pelo IPCA (fator 1,1935), o teste **reprova 870 municípios,
15,6% do total** — exatamente os polos de agência. Eles são rebaixados a confiabilidade
baixa e ficam fora dos rankings e das classificações de saturação.

## 6. Consignado: a granularidade real

**Não existe carteira municipal pública de crédito consignado.** A verificação foi
exaustiva: o domínio `dadosabertos.previdencia.gov.br` não resolve; a API do `dados.gov.br`
exige chave e devolve 401; o Portal da Transparência tem 39 conjuntos e nenhum de
consignado; o Boletim Estatístico da Previdência não contém a palavra "consignado"; e o
endereço de dados abertos da Dataprev devolve 403.

O que existe, por ordem de granularidade:

| Geografia | Separa INSS? | Fonte | O que mede |
|---|---|---|---|
| Nacional | **Sim** | SGS, séries 20578 e seguintes | saldo, concessões, taxa, prazo, atraso, inadimplência, custo |
| Unidade da federação | Aproximadamente | SCR.data, ocupação do tomador | carteira, mensal |
| Nacional, por instituição | **Sim** | API de taxas do BCB | taxa de contratação |
| **Município** | **Sim** | consumidor.gov.br | **reclamações**, não crédito |

### 6.1 A medida nacional direta

As séries do SGS por vínculo do tomador são a medida correta do consignado do INSS.
Junho de 2026: saldo de **R$ 281,9 bilhões**, taxa média de 24,31% ao ano, custo do crédito
de 23,56%, prazo médio de concessão de **91,8 meses** e inadimplência de **1,95%**. A
validação de integridade fecha exatamente: privado R$ 113,3 bi mais público R$ 390,3 bi mais
INSS R$ 281,9 bi somam os R$ 785,5 bilhões da série de total.

O contraste de inadimplência é o dado mais eloquente do bloco: 1,95% no INSS contra **8,63%
no consignado privado** e 2,58% no público.

### 6.2 Por que o SCR não substitui o SGS

O grupo "Aposentado/pensionista" do SCR soma R$ 159,9 bilhões de consignado de pessoa
física, contra R$ 281,9 bilhões da série do SGS — **57% de cobertura**. Classificar pela
ocupação declarada do tomador não é o mesmo que identificar a averbação em benefício. O SCR
é usado apenas onde é insubstituível: o recorte por unidade da federação, que o SGS não
oferece. Os dois números nunca são somados nem trocados um pelo outro.

### 6.3 O que seria preciso para uma medida municipal observada

| Dado | Quem detém | Obstáculo |
|---|---|---|
| Consignados por município do beneficiário | INSS e Dataprev, via e-Consignado | É a fonte que alimenta o Anuário, hoje agregado só por unidade da federação. Pedido de acesso viável, com supressão de células pequenas |
| Operações com localização do tomador | Banco Central, documento 3040 | Sigilo bancário. O caminho realista não é o microdado, e sim pedir que a sub-região já publicada ganhe o recorte de INSS |
| Beneficiários por município | INSS e Dataprev | Não publicado em nenhuma geografia abaixo da unidade da federação |

### 6.4 A única fonte municipal existente

O consumidor.gov.br publica reclamações com **categoria dedicada ao consignado de
beneficiários do INSS**, com município, em 58 arquivos mensais desde agosto de 2021. Em
junho de 2026 são 11.896 reclamações dessa categoria, cobrindo 1.930 municípios, com
concentração nas faixas de 61 a 70 anos e de 70 ou mais.

Ressalva metodológica indispensável: isso mede **propensão a reclamar**, não incidência de
problema. Depende de acesso digital e de base de clientes. Contagem bruta não é ranking de
conduta.

## 7. Inferência circular — a restrição de primeira ordem

Se a massa de benefícios municipal for usada como chave para distribuir o consignado
estadual entre municípios, então a correlação entre dependência previdenciária e
consignado municipal estimado é **mecânica**: ela foi construída pela fórmula de
alocação, não observada no mundo. Publicá-la como evidência de associação seria
circular.

A regra adotada, sem exceção:

- a estimativa municipal existe, é rotulada como estimativa e serve para **ordenar**
  municípios por exposição potencial;
- a hipótese de que municípios mais dependentes de benefícios apresentam maior exposição
  é testada **apenas** contra o consignado **estadual observado**, que não passou por
  nenhuma alocação;
- todo indicador derivado da alocação carrega, na interface, a marca de que a relação com
  a chave de alocação é mecânica.

A página distingue explicitamente quatro coisas: associação observada, resultado
mecanicamente produzido, hipótese e estimativa. Nenhuma delas é apresentada como evidência
causal.

## 8. Pendências desta auditoria

| Pendência | Situação |
|---|---|
| Estatísticas Municipais da Previdência: fonte, campos e definições | em apuração |
| Existência de consignado municipal público | em apuração |
| Linha do tempo regulatória com norma e data | em apuração |
| Reclamações e sanções por instituição | em apuração |
| Quantidade de beneficiários distinta de quantidade de benefícios | em apuração |
