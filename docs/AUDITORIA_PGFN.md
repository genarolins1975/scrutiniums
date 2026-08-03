# Auditoria de viabilidade — Dívida Ativa da União (PGFN)

**Data:** 3 de agosto de 2026 · **Fonte:** https://dadosabertos.pgfn.gov.br/
**Motivo:** o catálogo de fontes dos Sinais Antecedentes registrava a PGFN como
`"dados abertos (1,3 GB/trimestre)" — uso: "fase 2"`. Esta é a fase 2: a fonte foi
examinada arquivo por arquivo antes de qualquer linha de coletor.

Tudo abaixo foi verificado por requisição direta ao servidor, não presumido a partir
de documentação.

---

## 1. O que existe

Listagem HTTP simples, sem API e sem catálogo de metadados. Um diretório por trimestre,
de `2020_trimestre_01` a `2026_trimestre_02` — **26 trimestres**. Cada diretório traz
três ZIPs, um por natureza do crédito:

| Conjunto | ZIP | Descomprimido | Membros |
|---|---:|---:|---:|
| Não Previdenciário | 1.336 MB | **9.040 MB** | 6 CSVs |
| Previdenciário | 83 MB | — | 1+ CSV |
| FGTS | 18 MB | — | 1+ CSV |

O servidor aceita `Range` (`Accept-Ranges: bytes`) e publica `ETag` e `Last-Modified`.
Isso permitiu ler o **diretório central do ZIP** e inflar apenas os primeiros megabytes
de cada membro — o esquema foi levantado sem baixar 1,3 GB.

Vazão medida: **6,2 MB/s**. O trimestre completo baixa em cerca de quatro minutos.
O gargalo não é a rede: é descomprimir e percorrer ~9 GB de CSV.

## 2. Esquema — e ele **não** é o mesmo nos três conjuntos

```
Não Previdenciário (13 colunas)
  CPF_CNPJ;TIPO_PESSOA;TIPO_DEVEDOR;NOME_DEVEDOR;UF_DEVEDOR;UNIDADE_RESPONSAVEL;
  NUMERO_INSCRICAO;TIPO_SITUACAO_INSCRICAO;SITUACAO_INSCRICAO;RECEITA_PRINCIPAL;
  DATA_INSCRICAO;INDICADOR_AJUIZADO;VALOR_CONSOLIDADO

Previdenciário (13) — troca RECEITA_PRINCIPAL por TIPO_CREDITO
FGTS (15)          — acrescenta ENTIDADE_RESPONSAVEL e UNIDADE_INSCRICAO
```

Codificação **latin-1**, separador `;`, decimal com ponto, data `DD/MM/AAAA`.

## 3. Armadilhas verificadas

Quatro, e cada uma produz um número errado em silêncio.

### 3.1 Corresponsáveis repetem o valor integral da inscrição — somar dobra o total

Cada inscrição aparece uma vez como `PRINCIPAL` e mais uma vez para **cada**
corresponsável ou devedor solidário, sempre com o **mesmo `VALOR_CONSOLIDADO`**.

Medido na **população inteira** do trimestre 2026-06, não em amostra: o valor correto é
**R$ 3.512,8 bi**; as linhas de corresponsável e solidário carregam outros
**R$ 3.872,7 bi** do mesmo dinheiro. Quem somasse todas as linhas publicaria
**R$ 7.385,5 bi — 2,1 vezes** a dívida ativa real.

O fenômeno está concentrado: o previdenciário e o FGTS não trazem corresponsáveis
(R$ 0,00 repetidos); o inteiro dos R$ 3,87 tri vem do não previdenciário, onde as
inscrições grandes acumulam muitos corresponsáveis.

Conferido que a chave funciona: em 280.303 inscrições distintas, **todas** têm
exatamente uma linha `PRINCIPAL`. O filtro é seguro e custa memória zero.

### 3.2 `TIPO_DEVEDOR` muda de caixa entre os conjuntos

Não Previdenciário grava `PRINCIPAL`; Previdenciário e FGTS gravam `Principal`.
Um filtro por igualdade exata em maiúsculas descarta **todo** o previdenciário e **todo**
o FGTS — e devolve zero sem erro nenhum. Normalizar a caixa é obrigatório.

### 3.3 `UF_DEVEDOR` traz 28 valores, não 27

Além das 27 unidades da federação aparece `Si`, que não é UF. Vai para uma categoria
`indefinida` explícita — nunca redistribuído entre estados, nunca descartado em silêncio.

### 3.4 `UNIDADE_RESPONSAVEL` não é a UF do devedor

São a unidade da PGFN que administra a inscrição. Há linhas com `UF_DEVEDOR = SP` e
`UNIDADE_RESPONSAVEL = AMAZONAS`. Análise regional usa `UF_DEVEDOR`.

## 4. Dados pessoais: o que a fonte publica e o que nós fazemos

O arquivo traz **nome completo do devedor**, inclusive de pessoas físicas
(`JOSE ALEKSANDRO DA SILVA`), CPF parcialmente mascarado (`XXX735.623XX`) e **CNPJ
completo**. É publicação legítima da PGFN sob a Lei de Acesso à Informação.

**Nada disso entra no Observatório.** A regra do projeto é anterior a esta fonte:
publicar somente resultados agregados, nunca identificar pessoa física.

A implementação obedece à regra por construção, não por disciplina:

- `CPF_CNPJ` e `NOME_DEVEDOR` são lidos do CSV e **descartados na mesma linha** — nunca
  entram em estrutura de dados, nem em bronze, nem em cache;
- nenhum CSV bruto é gravado em disco: o coletor descomprime em fluxo, agrega e
  esquece a linha;
- `NUMERO_INSCRICAO` também não é retido — inscrição individual é caso concreto;
- um teste automatizado varre o gold procurando nome próprio, CPF, CNPJ e número de
  inscrição, e **reprova** se encontrar.

Contagem de devedores distintos ficaria de fora dessa política: exigiria guardar
identificadores. Declarada **indisponível**, com o motivo — não estimada.

## 5. Limitação metodológica central: a série histórica é enviesada

`DATA_INSCRICAO` vai de 1982 a 2026, o que tenta a leitura de uma série longa a partir
de um único trimestre. **Isso seria errado.**

Cada arquivo é uma **fotografia do estoque vivo** naquela data-base. Inscrições
quitadas, canceladas ou extintas **desaparecem** da fotografia. Olhando o retrato de
2026 para trás, os anos antigos aparecem menores do que foram — não porque houve menos
inscrições, mas porque as que sobreviveram são as que ninguém pagou.

O efeito é visível na série completa do trimestre 2026-06, em milhões de inscrições
remanescentes por safra: 2019 → 1,3; 2020 → 1,1; 2021 → 3,2; 2022 → 3,1; 2023 → 5,0;
2024 → 6,7; 2025 → 6,0. O gráfico sobe até ontem e despenca quanto mais se recua.
Isso não é história do endividamento tributário — é a curva de sobrevivência das
inscrições. Quem lesse como fluxo concluiria que o Brasil quase não inscrevia dívida
em 2020, o que é falso.

Consequências assumidas:

- a série por data de inscrição é publicada como **estoque remanescente por safra**,
  com o viés declarado no próprio rótulo, e nunca como "novas inscrições no período";
- fluxo verdadeiro só sai de **diferença entre fotografias consecutivas**, e passa a
  ser acumulado a partir da primeira data-base coletada;
- as safras mais recentes sofrem pouca atrição e são as únicas comparáveis entre si.

## 6. Decisão

**Viável, com três restrições.**

1. **Periodicidade própria.** A fonte é trimestral; o pipeline roda diariamente. O
   coletor só trabalha quando aparece um trimestre novo — compara o índice remoto com o
   que já foi absorvido e sai imediatamente se nada mudou. Baixar 1,4 GB por dia para
   reprocessar o mesmo trimestre seria desperdício de banda pública.
2. **Sem materialização.** Nada de 9 GB em disco: HTTP → inflate em fluxo → agrega →
   descarta. O que persiste são agregados de alguns kilobytes.
3. **Universo separado.** Dívida ativa é crédito tributário da União, não crédito do
   SFN. Não entra em nenhuma conta com SCR.data ou SGS, e o painel diz isso antes de
   mostrar o primeiro número.

## 7. O que fica de fora

- **Devedores distintos** e concentração por devedor — exigiria reter identificadores.
- **CNAE / porte da empresa** — o arquivo não traz; cruzar por CNPJ com outra base é
  reidentificação por outro caminho e não será feito.
- **Município** — só há UF.
- **Histórico anterior a 2020** — a fonte começa em `2020_trimestre_01`.
- **Lista de devedores em destaque** (publicação separada da PGFN) — é nominal por
  desenho e está fora do escopo do Observatório.
