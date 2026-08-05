# METODOLOGIA_OPERACIONAL.md — indicadores operacionais (Fase 0)

## Princípio

A Fase 0 publica **apenas o que existe em fonte estruturada oficial** — CSV/API de
CVM e BCB — com validação determinística e publicação automática. Nenhuma leitura
de PDF, nenhum modelo de linguagem, nenhuma estimativa. O que não está nas fontes
estruturadas (clientes, gastos de TI, guidance) **não existe nesta fase** e não é
aproximado.

## Conceitos protegidos

- **Empregados (FRE)** ≠ empregados do conglomerado prudencial. O FRE (item 10.1)
  traz o número **declarado pela companhia listada**, no escopo que ela declara.
  A data de referência é a informada pela CVM no próprio arquivo. O painel nunca
  soma nem reconcilia com outras fontes — divergência de escopo viaja com o dado.
- **Agências (ESTBAN)** = agências processadas na estatística bancária mensal,
  somadas nacionalmente por **CNPJ-raiz do banco operacional** — que pode diferir
  do CNPJ da holding listada (ex.: Itaú Holding 60872504 × Itaú Unibanco S.A.
  60701190). O mapeamento holding→banco é explícito e auditável no código
  (`pipeline/operacional.py`, `REDE_CNPJ8`), verificado contra o nome retornado
  pelo próprio ESTBAN. Posto de atendimento não é agência e não entra.
- **Ausência não vira zero.** Instituição sem FRE (ex.: Caixa, não listada)
  aparece sem o bloco de empregados — nunca com zero. Banco sem linha no ESTBAN
  aparece sem o bloco de rede.
- **Municípios**: contagem de municípios com ao menos uma agência processada,
  pelo código de município do próprio ESTBAN (que difere do código IBGE — ver
  `pipeline/sources/estban.py`).

## Validações automáticas (geram flag, nunca correção silenciosa)

- Variação anual de empregados acima de **30%** em módulo → flag "verificar
  mudança de escopo ou perímetro no FRE";
- Queda de agências acima de **15%** em 12 meses → flag "verificar reorganização
  societária" (bancos migram agências entre CNPJs do grupo);
- Total de empregados zerado após série positiva → flag de possível falha de
  declaração;
- Somas internas conferidas por teste (`src/tests/operacional-data.test.ts`):
  total = liderança + não-liderança = soma das regiões; var_12m consistente com a
  série; flags obrigatórias quando o limiar é excedido.

As flags são **publicadas junto com o dado** — o leitor vê o valor e o alerta,
no lugar de um valor silenciosamente "corrigido".

## Nível de evidência

Tudo na Fase 0 é **A (dado administrativo oficial)**: registro da CVM ou do BCB.
O teste automatizado impede que qualquer item de nível diferente entre neste gold
sem decisão consciente.

## Idempotência e atualização

FRE/FCA de ano fechado e ESTBAN de mês fechado são imutáveis: coletados uma vez,
registrados em `oper_coleta`, nunca rebaixados. O zip do ano corrente da CVM é
recoletado a cada execução (companhias retificam o FRE o ano inteiro; fica sempre
a **maior versão** por companhia). A execução é diária, junto com o pipeline do
Observatório (workflow `atualizar-dados.yml`).

## Fase 2 — clientes a partir dos releases de resultados

A Fase 2 cobre o que **não existe** em fonte estruturada: contagens de clientes,
divulgadas apenas nos releases de resultados. O processo, de ponta a ponta:

1. **Descoberta estruturada, nunca raspagem de RI**: os releases são
   protocolados na CVM e listados no dataset aberto **IPE**
   (`pipeline/sources/releases.py`). Regras explícitas por banco (categoria +
   tipo + filtro de assunto) selecionam os documentos; reentrega do mesmo
   período substitui a anterior; o PDF é baixado do domínio da própria CVM.
2. **Extração local primeiro**: texto por página (pypdf) e seleção das páginas
   candidatas por termos (clientes, correntistas, base de clientes) — só essas
   páginas seguem para a extração semântica.
3. **Extração com evidência obrigatória** (camada 3, em sessão Claude Code):
   toda observação carrega documento (protocolo CVM + URL), página e **trecho
   literal**. Sem evidência completa, a observação não avança — regra imposta
   por teste e pelo próprio gold.
4. **Revisão humana obrigatória**: as observações nascem com status `review`
   em `pipeline/curated/fase2_observacoes.json` (versionado — o histórico de
   extrações é ativo do projeto). **Só `aprovado` é publicado.** O gold expõe
   os contadores (em revisão/aprovadas/rejeitadas), nunca os valores pendentes.
5. **Comparabilidade C, sempre**: cada companhia define o próprio conceito de
   cliente (CPF/CNPJ, ativo, digital). Os números aparecem por instituição com
   o conceito declarado e **nunca** entram em comparação entre bancos nem em
   ranking. Ausência (banco que não divulga) é registrada com motivo — não é
   zero.

Conceitos protegidos: base total ≠ clientes ativos ≠ correntistas ≠ ativos nos
canais digitais — quatro métricas distintas, jamais misturadas na mesma série.
