# Auditoria de viabilidade — Desenrola Brasil

**Data:** 3 de agosto de 2026
**Fontes examinadas:** BCB dados abertos (dataset `desenrola-brasil`), Relatório de Avaliação
do Ministério do Planejamento e Orçamento com BID e BCB, Exposição de Motivos 1199/2023,
Lei 14.690/2023, MP 1.213/2024, IBGE SIDRA 6579, séries do BCB/SGS já no Observatório.

Tudo abaixo foi verificado por requisição direta às fontes. Onde um número é citado de
documento oficial, o documento está nomeado ao lado.

---

## 1. Diagnóstico da fonte principal

O BCB publica **um CSV**, atualizado no último dia útil de cada mês. Não há API, não há
séries derivadas, não há tabulação complementar.

| Atributo | Valor verificado |
|---|---|
| Arquivo | `https://www.bcb.gov.br/pda/desig/desenrola/dados_desenrola.csv` |
| Tamanho | 486 KB · 10.937 linhas de dado |
| Última publicação | 31/07/2026 |
| Cobertura | data-base 2023-09 a 2026-06 — **34 meses, sem lacunas** |
| Licença | Open Data Commons ODbL |
| Chave | data-base × tipo × UF × conglomerado — **verificada como única** |

### O dicionário completo, e ele tem sete colunas

```
DATA_BASE                     AAAAMM
TIPO_DESENROLA                1 e 2 = faixas do Desenrola Brasil (PF); 3 = Pequenos Negócios (PJ)
UNIDADE_FEDERACAO             sigla da UF
COD_CONGLOMERADO_FINANCEIRO   código do conglomerado
NOME_CONGLOMERADO_FINANCEIRO  nome do conglomerado
NUMERO_OPERACOES              operações renegociadas no mês
VOLUME_OPERACOES              soma dos valores DEPOIS do desconto
```

Não existem, nesta base: pessoa, CPF, dívida original, desconto, entrada, parcela, taxa,
prazo, modalidade, renda, sexo, idade, CadÚnico, município, situação posterior da operação.
**A maior parte do que se esperaria de um painel do Desenrola não é calculável daqui** — e a
decisão do projeto foi declarar isso, não estimar.

### Totais observados

| Tipo | Operações | Volume (após desconto) | Período | Valor médio |
|---|---:|---:|---|---:|
| Faixa 1 | 2.108.462 | R$ 2,19 bi | 2023-10 a 2026-06 | R$ 1.038 |
| Faixa 2 | 577.128 | R$ 2,33 bi | 2023-09 a 2026-06 | R$ 4.035 |
| **Faixas 1+2 (PF)** | **2.685.590** | **R$ 4,52 bi** | | R$ 1.682 |
| Pequenos Negócios (PJ) | 71.713 | R$ 3,14 bi | 2024-05 a 2026-06 | R$ 43.822 |

O valor médio do tipo 3 é **26 vezes** o das faixas de pessoa física. É a evidência
quantitativa de que são universos distintos e não devem ser somados.

## 2. Armadilhas verificadas

### 2.1 O volume é depois do desconto

A fonte é explícita: "valores das operações **após a concessão do desconto**". Sem o valor
original, desconto médio, mediano ou por instituição são **indetermináveis** nesta base. O
único desconto conhecido é o médio de 83% ofertado no leilão da Faixa 1, que vem de outro
documento e é agregado para o programa inteiro.

### 2.2 Setembro de 2023 é acumulado

A fonte declara que, **só nessa data-base**, as informações contemplam operações renegociadas
no mês *ou em meses anteriores*. Lido como fluxo mensal, cria um pico que não existiu. A
marcação viaja com o dado até a interface.

### 2.3 Um conglomerado pode ter dois nomes

Três códigos aparecem com nomes diferentes ao longo da série — mudanças de marca do sistema
Sicoob, principalmente. A identidade é o **código**; o rótulo exibido é o nome mais recente.
Agrupar por nome fragmentaria a mesma instituição em duas linhas.

### 2.4 A série continua depois do fim do programa

O Desenrola encerrou em 20/05/2024, mas há registros até 2026-06 — **18,2%** das operações
estão depois do encerramento. A fonte não explica. As hipóteses compatíveis com o que o BCB
documenta são retificação de informações já prestadas pelas entidades remetentes e operações
contratadas no prazo e informadas depois. **Não é adesão nova**, e o painel diz isso em vez
de deixar o leitor concluir sozinho.

## 3. A diferença de ordem de grandeza — e por que os dois números estão certos

O SCR mostra **R$ 4,52 bi** nas faixas de pessoa física. O Ministério da Fazenda reporta
**mais de R$ 53 bi** de dívidas regularizadas. A razão é de 11,7×, e nenhum dos dois está
errado: eles medem coisas diferentes.

A base do BCB exclui, por declaração da própria fonte:

- operações e parcelas **quitadas com recursos próprios no momento da renegociação**;
- renegociações não elegíveis ao programa;
- clientes com dívida total **inferior a R$ 200**.

E, por construção, só contém quem **reporta ao SCR** — bancos, financeiras e cooperativas.
Varejo, serviços públicos e telecomunicações participaram do programa e não aparecem em
nenhuma linha. O leilão da Faixa 1 teve **654 credores**; a base tem **73 conglomerados**.

Somando-se a isso que o leilão produziu desconto médio de 83% — e a Faixa 1 chegou a 90% —,
a maior parte das dívidas foi liquidada **à vista**, e liquidação à vista, por definição da
fonte, não entra nesta base. É a explicação suficiente para a distância entre os números.

## 4. Números oficiais citados, com procedência

| Número | Valor | Fonte |
|---|---:|---|
| Público potencialmente elegível (Faixa 1) | 30 milhões de pessoas | Relatório de Avaliação, introdução |
| Pessoas que renegociaram | menos de 5 milhões | Relatório de Avaliação, introdução |
| Pessoas beneficiadas pelo programa | cerca de 15 milhões | Considerações da SRE/MF no mesmo relatório |
| Dívidas regularizadas | mais de R$ 53 bilhões | Considerações da SRE/MF no mesmo relatório |
| Dívidas levadas ao leilão | R$ 137 bilhões | Exposição de Motivos 1199/2023 |
| Valor após o leilão | cerca de R$ 25 bilhões | Exposição de Motivos 1199/2023 |

**A tensão entre 15 milhões de beneficiados e menos de 5 milhões que renegociaram é
informativa, não contraditória.** A diferença é, em boa parte, a baixa de registro negativo
das dívidas de até R$ 100, que foi automática e não exigiu ação do devedor. Baixa de
negativação **não é pagamento, não é renegociação e não é perdão**: o débito continua
existindo, o que sai é a anotação no cadastro. O painel separa os dois conceitos em toda
parte onde eles poderiam ser confundidos.

## 5. Matriz de viabilidade

29 indicadores avaliados: **9 viáveis, 3 parciais, 17 indisponíveis**. A matriz completa está
publicada na própria página, na seção de metodologia. Resumo por área:

| Área | Viável | Parcial | Indisponível |
|---|---:|---:|---:|
| Alcance e adesão | 3 | 2 | 2 |
| Valores e condições | 0 | 0 | 5 |
| Beneficiários | 2 | 0 | 4 |
| Credores | 2 | 1 | 2 |
| Depois da renegociação | 0 | 0 | 2 |
| Fiscal | 0 | 0 | 2 |
| Efeitos | 2 | 0 | 1 |

A seção mais vazia é a mais importante: **o que aconteceu depois da renegociação**. Coorte,
curva de sobrevivência, reincidência e novo crédito exigiriam painel longitudinal por
operação, que é sigiloso. Construir essa seção com proxies agregadas produziria uma curva
plausível e sem sustentação; o painel declara a ausência em vez de preenchê-la.

## 6. Evidência causal disponível

Existe **uma** avaliação com desenho de identificação válido, e ela **não** avalia o efeito do
programa: avalia o efeito de uma campanha de e-mails para aumentar a adesão.

*Relatório de Avaliação — Desenrola Brasil*, SMA/MPO com Banco Interamericano de
Desenvolvimento e Banco Central do Brasil, publicado em 12/01/2026.

- **Desenho:** experimento aleatorizado. De 28 milhões de elegíveis no CadÚnico, 7,2 milhões
  tinham e-mail válido; 3,63 milhões foram sorteados e estratificados em 6 amostras
  semelhantes; ~3 milhões tratados e 600 mil de controle puro. Estimação por corte
  transversal, painel e diferenças em diferenças.
- **Resultado principal (intenção de tratar):** *não foi possível encontrar impacto
  observável* da campanha sobre acesso à plataforma, renegociação ou pagamento.
- **Execução:** apenas **2,3%** abriram os e-mails.
- **Resultado condicionado à abertura:** +0,4 a 0,6 p.p. em renegociação e pagamento; +0,6 a
  1 p.p. em acesso à plataforma.

**O Observatório classifica o segundo resultado como associação, não como causal**, e diz
por quê: condicionar à abertura do e-mail seleciona sobre uma variável posterior ao sorteio.
Quem abre difere de quem não abre em características não observadas, e a aleatorização não
protege mais a comparação. O próprio relatório apresenta o achado como condicionado.

**Nada existe, em fonte pública verificável, sobre o efeito do Desenrola em inadimplência,
acesso a crédito ou bem-estar dos beneficiários.** Essa avaliação não foi feita — ou não foi
publicada — até esta data-base.

## 7. Camada de dados

- **Bronze:** o CSV bruto é preservado a cada coleta com URL, data e sha256; arquivos idênticos
  não são regravados.
- **Silver:** `desenrola_op` (data-base × tipo × UF × conglomerado) e `desenrola_coleta`
  (vintage por hash). Como a fonte **republica a série inteira** a cada mês e reflete
  retificações das entidades remetentes, a absorção substitui a série completa em vez de
  acumular — e o hash identifica cada versão.
- **Validações automatizadas:** esquema de colunas (falha alto se a fonte mudar), domínio de
  UF e de tipo, unicidade da chave, ausência de meses faltantes, reconciliação da soma das
  partes com o total, e a separação entre faixas de PF e Pequenos Negócios.
- **Custo:** ~500 KB por execução. Barato o bastante para rodar diariamente e comparar o hash.

## 8. O que ficou pendente, e o que resolveria

| Pendência | O que resolveria |
|---|---|
| Contagem de pessoas, sexo, idade, renda, CadÚnico, município | Tabulação demográfica agregada publicada pelo BCB, com supressão de células pequenas |
| Valor original, desconto, entrada, parcelas, prazo, taxa | Inclusão do valor pré-desconto e das condições contratuais na divulgação |
| Coortes, sobrevivência dos acordos, reincidência, novo crédito | Série de situação das operações do programa por safra de contratação |
| Credores não financeiros | Base do operador da plataforma do programa |
| Garantias do FGO, custo fiscal, custo por beneficiário | Relatórios do fundo garantidor e execução orçamentária com identificação do programa |
| Efeito causal do programa | Avaliação com grupo de comparação e estratégia de identificação declarada |
