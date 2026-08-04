# Auditoria de viabilidade — Penetração e gap de crédito municipal

**Data:** 4 de agosto de 2026
**Fontes examinadas:** ESTBAN (BCB), Censo Demográfico 2022 e malhas municipais (IBGE),
SCR.data (BCB). Tudo verificado por requisição direta antes de qualquer linha de coletor.

---

## 1. Diagnóstico das fontes

| Fonte | Geografia | O que mede | Cobertura verificada | Principal limitação |
|---|---|---|---|---|
| **ESTBAN** | Município | Saldos contabilizados nas dependências bancárias (verbete 160) | 2.915 municípios · 111 instituições · 7.966 linhas na data-base 2026-03 | O município de contabilização pode não ser o do tomador |
| **SCR.data** | **UF** | Exposição de crédito dos clientes | Operações reportadas ao SCR | **Não permite observação municipal na base pública** |
| **Censo 2022** | Município | População e renda dos residentes | 5.570 municípios, sem faltantes | Renda referente a 2022 |
| **Malha IBGE** | Município | Geometria | 5.570 polígonos, códigos de 7 dígitos | — |

### O que existe em nível municipal, confirmado

- **Crédito:** só o ESTBAN. A base pública do SCR.data é estadual, e nada neste módulo a
  desagrega. Nenhum saldo do ESTBAN é rebatizado de SCR.
- **População total e de 18 anos ou mais:** tabela 9514 do Censo 2022. O corte de 18+ é
  feito por subtração exata — total menos os grupos 0–4, 5–9, 10–14 e as idades
  individuais 15, 16 e 17, todas categorias publicadas. Soma nacional: 203.080.756
  habitantes, idêntica ao Censo.
- **Renda domiciliar:** tabela 10295, que traz moradores em domicílios particulares
  permanentes e rendimento nominal médio mensal domiciliar per capita. O produto é a
  massa de renda domiciliar — não é estimativa, é a média multiplicada pelo próprio
  denominador. Total nacional: R$ 331,0 bi por mês, R$ 3,97 tri por ano.
- **Urbanização:** tabela 9923, situação do domicílio.

### O que não existe

- Número de domicílios por município nas tabelas usadas — o painel trabalha com
  moradores e população adulta, e declara a ausência.
- Estrutura econômica municipal (participação setorial) na primeira entrega.
- Qualquer detalhamento municipal do SCR.

## 2. A conciliação de códigos, que era o risco central

**O ESTBAN não usa o código do IBGE.** São Paulo é `7388` no ESTBAN e `3550308` no IBGE.
A ligação é feita por (UF, nome normalizado) contra a lista oficial de municípios do
IBGE, e o resultado é auditado a cada coleta.

Três problemas apareceram e foram resolvidos explicitamente:

1. **Hífen.** Normalizar removendo pontuação colava as palavras: `MOGI-GUACU` virava
   `MOGIGUACU` e não casava com `Mogi Guaçu`. Pontuação passou a virar espaço.
2. **Distrito Federal.** O ESTBAN reparte Brasília em 20 regiões administrativas —
   `BRASILIA (CEILANDIA)`, `BRASILIA (TAGUATINGA)` e outras. O IBGE tem um único
   município. Descartá-las perdia R$ 13,4 bi do saldo da capital; elas são somadas em
   Brasília.
3. **Grafias divergentes.** Dezesseis casos em que o ESTBAN mantém a grafia antiga —
   `ITAPAGE`/Itapajé, `PARATI`/Paraty, `ACU`/Assu, `BRASOPOLIS`/Brazópolis. Lista
   explícita e auditável; nome que não casa e não está nela fica de fora, nunca é
   aproximado por semelhança.

**Resultado: 100% de casamento** nas 13 data-bases coletadas.

## 3. A limitação estrutural do painel

Duas descobertas quantitativas definem o que a página pode afirmar:

**2.654 dos 5.570 municípios não têm nenhuma dependência bancária reportando ao
ESTBAN** — quase metade do país, onde vivem 14,5 milhões de adultos. Ausência de saldo
**não é crédito zero**: é ausência de agência que contabilize. Esses municípios ficam
com saldo nulo, fora dos rankings de gap, e são contados à parte.

**A concentração é extrema.** São Paulo responde por 27,2% de todo o saldo municipal e
os dez maiores por 69,9%. Osasco aparece com R$ 810,8 bi — mais que o Rio de Janeiro —
por ser sede administrativa de um grande conglomerado. Isso não é erro do dado: é o que
"município de contabilização" significa. O painel converte esse fato num **selo de
confiabilidade** por município, e exclui os de selo baixo dos rankings por padrão.

## 4. Os dois métodos de gap, e uma correção metodológica

**Benchmark por pares.** Grupos formados por região × faixa de população adulta
(quartis) × faixa de renda per capita (tercis) × urbanização (≥ 75%), exigindo pelo
menos 8 municípios por grupo. A penetração esperada é a **mediana** do grupo. 110 grupos
cobrem 5.371 municípios.

**Modelo estatístico.** Especificação em logaritmos:

```
ln(crédito) = β₀ + β₁·ln(população 18+) + β₂·ln(renda domiciliar per capita)
              + β₃·urbanização + efeitos fixos de região
```

n = 2.914 · R² = 0,709 · σ residual = 0,982.

### Por que a renda total saiu da especificação

A primeira versão incluía `ln(renda domiciliar anual)`, `ln(população 18+)` e
`ln(renda per capita)` juntas e produzia **elasticidade-renda negativa** (−0,30), que não
tem leitura econômica. A causa foi medida: **corr(ln renda, ln adultos) = 0,957** — a
renda é, por construção, moradores × renda per capita, e as três variáveis são quase
linearmente dependentes.

Escala e prosperidade separadas são quase ortogonais (**corr = 0,06**), entregam o mesmo
ajuste (R² 0,7088 contra 0,7089) e dão coeficientes interpretáveis: +1,15 para população
adulta, +1,83 para renda per capita, +0,48 para urbanização.

### Por que a referência é a mediana condicional, não a média

Voltar do logaritmo pela média exige a correção de Duan, que aqui vale **1,46** — ou
seja, a média condicional é 46% maior que a mediana, por causa da assimetria da
distribuição. Usá-la como referência colocaria **a maioria dos municípios "abaixo do
esperado" por construção**, e o gap mediria a assimetria da distribuição, não falta de
crédito.

A referência passou a ser `exp(ln estimado)`, a **mediana condicional**: metade dos
comparáveis fica acima, metade abaixo — mesmo critério do benchmark de pares, o que
torna os dois métodos comparáveis. A média condicional continua publicada por município,
para quem precisar somar volume.

O efeito da correção: o gap agregado caiu de R$ 2,02 tri para **R$ 835 bi**, e a
proporção de municípios abaixo do esperado passou de 70% para **45%** — próxima dos 50%
que um benchmark mediano produz por construção.

### A precisão individual é baixa, e o painel diz isso

Com σ = 0,98 em logaritmo, a faixa de ±1 desvio vai de cerca de **um terço a 2,7 vezes**
o valor central. O gap de um município isolado é indicativo; a soma de muitos é mais
informativa que qualquer linha do ranking. A faixa de referência é publicada por
município e a advertência aparece na seção de metodologia.

Os dois métodos divergem — R$ 835 bi pelo modelo contra R$ 280 bi pelo benchmark de
pares na mesma base. A divergência é informação, não defeito: o painel permite alternar
entre eles e mostra os dois resultados.

## 5. Rankings

Sete rankings separados, porque cada um responde a uma pergunta diferente e misturá-los
produz conclusão distorcida: gap absoluto, gap relativo, menor crédito por adulto, menor
crédito sobre renda, maior penetração, resultados mais atípicos, e o principal —
**oportunidade com escala**, que combina gap absoluto, gap relativo e população adulta em
postos normalizados, para que nenhuma escala domine as outras.

Cortes mínimos de 20 mil adultos e R$ 200 milhões de renda anual evitam que municípios
minúsculos ocupem o topo por terem denominador pequeno. **As duas versões são
publicadas** — com e sem cortes.

## 6. O que o painel não autoriza concluir

- O ESTBAN mostra onde o saldo foi **contabilizado**, não o domicílio do tomador.
- Bancos digitais e contabilização centralizada distorcem a distribuição municipal.
- Centros regionais concentram operações de moradores de cidades vizinhas.
- O SCR público não oferece detalhamento municipal, e nada aqui o desagrega.
- **Baixa penetração não prova restrição de oferta** — pode ser demanda, informalidade,
  composição econômica, cooperativismo, crédito não bancário ou deslocamento.
- O gap é contrafactual, não valor observado.
- **Não é possível inferir quantas pessoas estão sem acesso a crédito** a partir de
  saldos agregados. O painel não publica esse número.
- Renda e população são de 2022; o saldo é da data-base corrente.

## 7. Pendências desta primeira entrega

### Resolvidas nesta segunda entrega

**Reconciliação estadual com o SCR.** A série `scr_uf` entrou no armazém (17 data-bases,
27 UFs, grade completa) e a comparação está publicada, alinhada por data-base — ESTBAN e
SCR ambos em 2026-03. Nacionalmente a razão é **0,94×**, o que valida a ordem de grandeza
do ESTBAN. Por estado ela se desfaz: o **DF contabiliza 7,3×** a exposição de crédito de
seus residentes, e Santa Catarina apenas 0,31×. É a centralização contábil medida no nível
estadual — o mesmo fenômeno que, no municipal, gera o selo de confiabilidade.

**Série histórica municipal.** Treze data-bases coletadas, doze publicadas. A auditoria da
série encontrou dois problemas que teriam ido ao ar:

1. **2025-03 é uma data-base subcoletada** — 94 municípios com saldo zero contra cerca de
   3 nos demais meses, salto de 16,7% em São Paulo no mês seguinte e 17,2% dos municípios
   variando mais de 10%. Foi excluída da série publicada, com o motivo declarado. O efeito
   sobre os números: a variação de São Paulo no período caiu de +32% para **+13,1%**.
2. **Saltos de reclassificação contábil.** Quarenta e dois municípios apresentam variação
   superior a 50% em um único mês. O caso maior é Brasília, onde uma instituição alterna
   entre R$ 3 bi e R$ 750 bi conforme a data-base — sozinha, move o total nacional em mais
   de 10% ao mês. O salto virou critério do selo, e os 42 foram rebaixados a confiabilidade
   baixa, ficando fora dos rankings.

**Composição por instituição** no perfil municipal, para os 1.233 municípios que passam nos
cortes: concentração num único nome é um dos sinais de contabilização centralizada.

### Ainda pendentes

| Pendência | O que resolveria |
|---|---|
| Visão deflacionada pelo IPCA | Série `ipca` no armazém; a comparação 2022 × data-base corrente hoje é nominal |
| Número de domicílios por município | Tabela do Censo 2022 com domicílios particulares permanentes ocupados |
| Estrutura econômica no agrupamento de pares | Participação setorial municipal (PIB dos municípios, IBGE) |
| Série histórica no perfil municipal | Já coletadas 13 data-bases; falta expor a série por município na interface |
| Composição por instituição no perfil | Tabela `estban_mun_inst` já coletada; falta expor |
