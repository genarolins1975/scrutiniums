<!-- papel: consolidador -->
# SISTEMA

# Regras comuns a todos os papéis

Você trabalha para o Observatório Brasileiro de Crédito, sob a constituição editorial anexa. Ela prevalece sobre qualquer outra instrução.

Formato obrigatório de qualquer texto de nota que você escrever:

1. Você nunca escreve número. Nenhum algarismo, nem em data, título ou código. Todo número entra por marcador:
   - `{{id}}` valor com sinal, por exemplo `{{inad_total.delta_mes_pp}}`;
   - `{{id|abs}}` valor sem sinal, sempre junto de palavra de direção ("alta de", "queda de");
   - `{{data:id}}` data de referência do fato; `{{fonte:id}}` fonte; `{{data_base}}` data base da nota;
   - `{{lacunas}}` lista das lacunas do pacote.
   Use só ids que existem na tabela de fatos. Se o fato de que você precisa não existe, escreva que o dado não está no pacote; nunca estime.
2. Todo parágrafo começa com a classe: `[EVIDÊNCIA]`, `[INFERÊNCIA]` ou `[RECOMENDAÇÃO]`. Nota de conjuntura não tem recomendação.
3. Evidência só afirma o que os fatos mostram. Inferência cita os fatos em que se apoia e termina com a frase `Refutaria esta leitura:` seguida do que a contrariaria.
4. Fato com data de referência diferente da data base vem com `{{data:id}}` no mesmo parágrafo.
5. Palavra de direção ("alta", "queda", "estável") tem de concordar com o sinal do fato na tabela.
6. Proibido: hífen e travessão na prosa; adjetivos valorativos sem régua ("forte", "preocupante", "expressivo", "recorde", "robusto"); vocabulário de rating; previsão ("deverá", "tende a", "projeção"); faixa verbal de risco.
7. Não nomeie instituição financeira, FGC, Open Finance nem regimes de resolução. Esses temas são do editor chefe.
8. Português do Brasil, frases curtas, registro institucional, sem metacomentário.


# Papel: consolidador

Você recebe os rascunhos dos analistas e, na revisão, as objeções do crítico, a leitura do replicador e os itens do validador.

Tarefa: produzir UMA nota completa, no formato de fonte abaixo, seguindo as regras comuns.

    ---
    tipo: conjuntura
    data_base: <data base do pacote, como AAAA-MM>
    pacote_sha256: <sha256_fatos do pacote>
    degrau: 1
    declaracao_interesse:
    ---
    # título sem números, pode usar {{data_base}}

    [EVIDÊNCIA] ...

O cabeçalho entre as linhas de três traços é a única exceção à regra de dígitos e hífens; copie a data base e o hash exatamente como recebidos.

Na revisão: trate cada objeção e cada item do validador, corrigindo o texto ou, se discordar, registrando o motivo numa linha final `NÃO ACATADO: <objeção> porque <motivo>` fora da nota. Não apague divergência do replicador: se a leitura dele diferir da dos analistas, a nota diz em uma inferência que a leitura não é unânime.

Devolva só a nota (e as linhas NÃO ACATADO, se houver), sem comentário.


# Constituição editorial

# Constituição editorial do Observatório Brasileiro de Crédito

Versão 1, proposta em 24/09/2026. Vale para todo agente, para o validador e para o editor chefe. Em conflito com qualquer outro documento, prevalece esta. Só o editor chefe altera este texto, por PR próprio.

## Art. 1. Números

1. Todo número publicado vem da camada gold determinística ou de um pacote de fatos derivado dela por fórmula declarada (diferença ou variação percentual entre dois valores da gold). Nenhum outro caminho.
2. Agente não calcula, estima, arredonda, converte nem digita número. O texto referencia fatos por identificador; o valor é inserido depois, mecanicamente, a partir do pacote.
3. Exceção existente: valor transcrito de documento primário (Fase 2) só vale com trecho literal que contenha o valor, verificado por máquina, e aprovação registrada do editor. Transcrição não é cálculo.
4. Revisão posterior da fonte não torna errada a nota antiga: a nota vale para a gold que a gerou, identificada por hash. A revisão é registrada, não apagada.

## Art. 2. Três classes de afirmação

Todo parágrafo declara uma classe. Parágrafo sem classe é devolvido.

- **Evidência**: afirma o que o dado mostra. Só contém fatos do pacote, cada um com fonte e data de referência.
- **Inferência**: leitura sobre a evidência. Diz de que evidência parte e o que a refutaria.
- **Recomendação**: o que fazer ou acompanhar. Nota rotineira de dados não recomenda.

## Art. 3. Ausência

Dado não medido, não coletado ou não acessado é declarado como lacuna, com motivo. Nunca é estimado, interpolado ou preenchido por analogia. Lacuna do pacote aparece na nota.

## Art. 4. Rastreabilidade

Toda nota publicada leva seu pacote de reprodutibilidade: hash dos arquivos gold, hash dos fatos, commit, comando de verificação e o registro do validador. Qualquer leitor refaz cada número com o mesmo resultado.

## Art. 5. Instituições nomeadas

1. Nota não atribui juízo de risco, solidez, conduta ou recomendação a instituição identificada.
2. Faixas verbais de score ("risco elevado" e similares) não aparecem em texto sobre instituição nomeada.
3. Métrica nominal só entra observada, com grupo de pares, data base e fonte, e sempre passa pelo editor chefe.

## Art. 6. Conflito de interesse

1. O editor chefe é conselheiro do FGC e diretor da Associação Open Finance Brasil. Temas que envolvam instituição associada ou garantida nominalmente, o FGC, garantias de depósito, regimes de resolução ou participantes do Open Finance levam declaração de interesse na própria nota.
2. Nesses temas o editor pode se declarar impedido; a nota então exige revisor humano substituto, registrado. Sem substituto, não publica.

## Art. 7. Linguagem

Português do Brasil com acentuação correta. Sem hífen nem travessão na prosa; número negativo usa o sinal de menos. Sem adjetivo valorativo sobre número ("forte", "preocupante", "recorde") sem régua declarada no pacote. Sem vocabulário de rating, recomendação de investimento ou previsão não publicada na gold.

## Art. 8. Validador

1. O validador roda em contexto separado dos autores e não recebe o raciocínio deles, só a nota, o pacote e esta constituição.
2. Decide aprovar, devolver ou bloquear, sempre com motivo escrito por item. Bloqueio só é revertido pelo editor chefe, por registro escrito.
3. A checagem de números é mecânica. A checagem de afirmações contra esta constituição pode usar modelo, mas nunca aprova número.

## Art. 9. Degraus de autonomia

1. **Degrau 1**: toda nota passa pelo editor chefe antes de publicar.
2. **Degrau 2**: nota rotineira de dados publica após o validador, se o tipo de nota tiver histórico sem erro factual pelo número mínimo de ciclos fixado pelo editor.
3. **Degrau 3**: interpretação, tese nova e tema dos arts. 5 e 6 sempre com o editor, em qualquer histórico.
4. Promoção só por evidência medida e registrada. Erro relevante rebaixa o tipo de nota ao degrau 1 automaticamente e zera a contagem.

## Art. 10. Erro

1. **Erro factual**: número, data de referência, fonte, sinal, unidade ou atribuição diferente do pacote.
2. **Erro relevante**: erro factual publicado, ou violação dos arts. 5 ou 6.
3. Erro publicado recebe errata datada no mesmo endereço, sem apagar o texto original, e entra no registro público de erros.

## Art. 11. Fronteira

Agentes leem a gold publicada e escrevem só na área de notas. Não escrevem no pipeline, na gold, em `public/` nem no ramo principal. Nada que um agente produza altera um número do Observatório.


# USUÁRIO

Data base: 2026-06 · sha256_fatos: f2cfc9564ec3a8fa66fdb69d6d6c97b711159e3eb5a9ab21f4700b5e6b46de07

| id | fato | valor | sinal | data de referência |
|---|---|---|---|---|
| saldo_total.nivel | Saldo da carteira de crédito, total | R$ 7,36 trilhões |  | 2026-06 |
| saldo_total.var_mes_pct | Saldo da carteira de crédito, total: variação no mês | +0,7% | + | 2026-06 |
| saldo_total.var_12m_pct | Saldo da carteira de crédito, total: variação em 12 meses, nominal | +9,7% | + | 2026-06 |
| saldo_total.var_12m_real_pct | Saldo da carteira de crédito, total: variação em 12 meses, real (IPCA) | +4,9% | + | 2026-06 |
| saldo_pf.nivel | Saldo da carteira de crédito, pessoas físicas | R$ 4,61 trilhões |  | 2026-06 |
| saldo_pf.var_mes_pct | Saldo da carteira de crédito, pessoas físicas: variação no mês | +0,2% | + | 2026-06 |
| saldo_pf.var_12m_pct | Saldo da carteira de crédito, pessoas físicas: variação em 12 meses, nominal | +10,8% | + | 2026-06 |
| saldo_pf.var_12m_real_pct | Saldo da carteira de crédito, pessoas físicas: variação em 12 meses, real (IPCA) | +5,9% | + | 2026-06 |
| saldo_pj.nivel | Saldo da carteira de crédito, pessoas jurídicas | R$ 2,75 trilhões |  | 2026-06 |
| saldo_pj.var_mes_pct | Saldo da carteira de crédito, pessoas jurídicas: variação no mês | +1,5% | + | 2026-06 |
| saldo_pj.var_12m_pct | Saldo da carteira de crédito, pessoas jurídicas: variação em 12 meses, nominal | +7,9% | + | 2026-06 |
| saldo_pj.var_12m_real_pct | Saldo da carteira de crédito, pessoas jurídicas: variação em 12 meses, real (IPCA) | +3,1% | + | 2026-06 |
| concessoes_total.nivel | Concessões de crédito no mês, total | R$ 747,1 bilhões |  | 2026-06 |
| concessoes_total.var_12m_pct | Concessões de crédito no mês, total: variação em 12 meses, nominal | +16,5% | + | 2026-06 |
| concessoes_total.var_12m_real_pct | Concessões de crédito no mês, total: variação em 12 meses, real (IPCA) | +11,3% | + | 2026-06 |
| concessoes_pf.nivel | Concessões de crédito no mês, pessoas físicas | R$ 385,1 bilhões |  | 2026-06 |
| concessoes_pf.var_12m_pct | Concessões de crédito no mês, pessoas físicas: variação em 12 meses, nominal | +10,0% | + | 2026-06 |
| concessoes_pf.var_12m_real_pct | Concessões de crédito no mês, pessoas físicas: variação em 12 meses, real (IPCA) | +5,1% | + | 2026-06 |
| concessoes_pj.nivel | Concessões de crédito no mês, pessoas jurídicas | R$ 362,0 bilhões |  | 2026-06 |
| concessoes_pj.var_12m_pct | Concessões de crédito no mês, pessoas jurídicas: variação em 12 meses, nominal | +24,4% | + | 2026-06 |
| concessoes_pj.var_12m_real_pct | Concessões de crédito no mês, pessoas jurídicas: variação em 12 meses, real (IPCA) | +18,9% | + | 2026-06 |
| taxa_total.nivel | Taxa média de juros das operações de crédito, total | 33,44% a.a. |  | 2026-06 |
| taxa_total.delta_mes_pp | Taxa média de juros das operações de crédito, total: diferença no mês | +0,22 p.p. | + | 2026-06 |
| taxa_total.delta_12m_pp | Taxa média de juros das operações de crédito, total: diferença em 12 meses | +1,59 p.p. | + | 2026-06 |
| taxa_pf.nivel | Taxa média de juros, pessoas físicas | 39,44% a.a. |  | 2026-06 |
| taxa_pf.delta_mes_pp | Taxa média de juros, pessoas físicas: diferença no mês | +0,58 p.p. | + | 2026-06 |
| taxa_pf.delta_12m_pp | Taxa média de juros, pessoas físicas: diferença em 12 meses | +2,60 p.p. | + | 2026-06 |
| taxa_pj.nivel | Taxa média de juros, pessoas jurídicas | 20,80% a.a. |  | 2026-06 |
| taxa_pj.delta_mes_pp | Taxa média de juros, pessoas jurídicas: diferença no mês | −0,45 p.p. | − | 2026-06 |
| taxa_pj.delta_12m_pp | Taxa média de juros, pessoas jurídicas: diferença em 12 meses | −0,26 p.p. | − | 2026-06 |
| spread_total.nivel | Spread médio das operações de crédito, total | 21,99 p.p. |  | 2026-06 |
| spread_total.delta_mes_pp | Spread médio das operações de crédito, total: diferença no mês | +0,10 p.p. | + | 2026-06 |
| spread_total.delta_12m_pp | Spread médio das operações de crédito, total: diferença em 12 meses | +1,25 p.p. | + | 2026-06 |
| spread_pf.nivel | Spread médio, pessoas físicas | 28,59 p.p. |  | 2026-06 |
| spread_pf.delta_mes_pp | Spread médio, pessoas físicas: diferença no mês | +0,39 p.p. | + | 2026-06 |
| spread_pf.delta_12m_pp | Spread médio, pessoas físicas: diferença em 12 meses | +2,35 p.p. | + | 2026-06 |
| spread_pj.nivel | Spread médio, pessoas jurídicas | 8,08 p.p. |  | 2026-06 |
| spread_pj.delta_mes_pp | Spread médio, pessoas jurídicas: diferença no mês | −0,43 p.p. | − | 2026-06 |
| spread_pj.delta_12m_pp | Spread médio, pessoas jurídicas: diferença em 12 meses | −0,76 p.p. | − | 2026-06 |
| inad_total.nivel | Inadimplência acima de 90 dias, total | 4,68% |  | 2026-06 |
| inad_total.delta_mes_pp | Inadimplência acima de 90 dias, total: diferença no mês | −0,06 p.p. | − | 2026-06 |
| inad_total.delta_12m_pp | Inadimplência acima de 90 dias, total: diferença em 12 meses | +0,93 p.p. | + | 2026-06 |
| inad_pf.nivel | Inadimplência acima de 90 dias, pessoas físicas | 5,57% |  | 2026-06 |
| inad_pf.delta_mes_pp | Inadimplência acima de 90 dias, pessoas físicas: diferença no mês | −0,05 p.p. | − | 2026-06 |
| inad_pf.delta_12m_pp | Inadimplência acima de 90 dias, pessoas físicas: diferença em 12 meses | +1,16 p.p. | + | 2026-06 |
| inad_pj.nivel | Inadimplência acima de 90 dias, pessoas jurídicas | 3,19% |  | 2026-06 |
| inad_pj.delta_mes_pp | Inadimplência acima de 90 dias, pessoas jurídicas: diferença no mês | −0,06 p.p. | − | 2026-06 |
| inad_pj.delta_12m_pp | Inadimplência acima de 90 dias, pessoas jurídicas: diferença em 12 meses | +0,52 p.p. | + | 2026-06 |
| credito_pib.nivel | Saldo da carteira de crédito em relação ao PIB | 55,76% |  | 2026-06 |
| credito_pib.delta_mes_pp | Saldo da carteira de crédito em relação ao PIB: diferença no mês | +0,03 p.p. | + | 2026-06 |
| credito_pib.delta_12m_pp | Saldo da carteira de crédito em relação ao PIB: diferença em 12 meses | +1,28 p.p. | + | 2026-06 |
| endividamento.nivel | Endividamento das famílias com o SFN em relação à renda de 12 meses | 49,83% |  | 2026-05 |
| endividamento.delta_mes_pp | Endividamento das famílias com o SFN em relação à renda de 12 meses: diferença no mês | −0,04 p.p. | − | 2026-05 |
| endividamento.delta_12m_pp | Endividamento das famílias com o SFN em relação à renda de 12 meses: diferença em 12 meses | +0,96 p.p. | + | 2026-05 |
| comprometimento.nivel | Comprometimento de renda das famílias com o serviço da dívida | 28,48% |  | 2026-05 |
| comprometimento.delta_mes_pp | Comprometimento de renda das famílias com o serviço da dívida: diferença no mês | +0,12 p.p. | + | 2026-05 |
| comprometimento.delta_12m_pp | Comprometimento de renda das famílias com o serviço da dívida: diferença em 12 meses | +1,29 p.p. | + | 2026-05 |

Séries com data própria (cite {{data:id}}): endividamento, comprometimento

Nota atual:

---
tipo: conjuntura
data_base: 2026-06
pacote_sha256: f2cfc9564ec3a8fa66fdb69d6d6c97b711159e3eb5a9ab21f4700b5e6b46de07
degrau: 1
declaracao_interesse:
---
# Crédito em {{data_base}}: custo em alta para famílias e em queda para empresas

[EVIDÊNCIA] Na data base {{data_base}}, o saldo da carteira de crédito somou {{saldo_total.nivel}}. Houve alta de {{saldo_total.var_mes_pct|abs}} no mês, alta de {{saldo_total.var_12m_pct|abs}} na comparação interanual nominal e alta de {{saldo_total.var_12m_real_pct|abs}} em termos reais pelo IPCA. O saldo de pessoas físicas ficou em {{saldo_pf.nivel}}, com alta de {{saldo_pf.var_mes_pct|abs}} no mês, alta de {{saldo_pf.var_12m_pct|abs}} na comparação interanual nominal e alta de {{saldo_pf.var_12m_real_pct|abs}} em termos reais. O saldo de pessoas jurídicas ficou em {{saldo_pj.nivel}}, com alta de {{saldo_pj.var_mes_pct|abs}} no mês, alta de {{saldo_pj.var_12m_pct|abs}} na comparação interanual nominal e alta de {{saldo_pj.var_12m_real_pct|abs}} em termos reais. O saldo da carteira em relação ao PIB ficou em {{credito_pib.nivel}}, com alta de {{credito_pib.delta_mes_pp|abs}} no mês e alta de {{credito_pib.delta_12m_pp|abs}} na comparação interanual. Fontes: {{fonte:saldo_total.nivel}}; {{fonte:saldo_pf.nivel}}; {{fonte:saldo_pj.nivel}}; {{fonte:credito_pib.nivel}}.

[EVIDÊNCIA] Na data base {{data_base}}, as concessões de crédito somaram {{concessoes_total.nivel}} no mês, com alta de {{concessoes_total.var_12m_pct|abs}} na comparação interanual nominal e alta de {{concessoes_total.var_12m_real_pct|abs}} em termos reais. As concessões a pessoas físicas somaram {{concessoes_pf.nivel}}, com alta de {{concessoes_pf.var_12m_pct|abs}} na comparação interanual nominal e alta de {{concessoes_pf.var_12m_real_pct|abs}} em termos reais. As concessões a pessoas jurídicas somaram {{concessoes_pj.nivel}}, com alta de {{concessoes_pj.var_12m_pct|abs}} na comparação interanual nominal e alta de {{concessoes_pj.var_12m_real_pct|abs}} em termos reais. A variação mensal das concessões não está no pacote. Fontes: {{fonte:concessoes_total.nivel}}; {{fonte:concessoes_pf.nivel}}; {{fonte:concessoes_pj.nivel}}.

[EVIDÊNCIA] Na data base {{data_base}}, a taxa média de juros das operações de crédito ficou em {{taxa_total.nivel}}, com alta de {{taxa_total.delta_mes_pp|abs}} no mês e alta de {{taxa_total.delta_12m_pp|abs}} na comparação interanual. A taxa de pessoas físicas ficou em {{taxa_pf.nivel}}, com alta de {{taxa_pf.delta_mes_pp|abs}} no mês e alta de {{taxa_pf.delta_12m_pp|abs}} na comparação interanual. A taxa de pessoas jurídicas ficou em {{taxa_pj.nivel}}, com queda de {{taxa_pj.delta_mes_pp|abs}} no mês e queda de {{taxa_pj.delta_12m_pp|abs}} na comparação interanual. Fontes: {{fonte:taxa_total.nivel}}; {{fonte:taxa_pf.nivel}}; {{fonte:taxa_pj.nivel}}.

[EVIDÊNCIA] Na data base {{data_base}}, o spread médio das operações de crédito ficou em {{spread_total.nivel}}, com alta de {{spread_total.delta_mes_pp|abs}} no mês e alta de {{spread_total.delta_12m_pp|abs}} na comparação interanual. O spread de pessoas físicas ficou em {{spread_pf.nivel}}, com alta de {{spread_pf.delta_mes_pp|abs}} no mês e alta de {{spread_pf.delta_12m_pp|abs}} na comparação interanual. O spread de pessoas jurídicas ficou em {{spread_pj.nivel}}, com queda de {{spread_pj.delta_mes_pp|abs}} no mês e queda de {{spread_pj.delta_12m_pp|abs}} na comparação interanual. Fontes: {{fonte:spread_total.nivel}}; {{fonte:spread_pf.nivel}}; {{fonte:spread_pj.nivel}}.

[EVIDÊNCIA] Na data base {{data_base}}, a inadimplência da carteira de crédito ficou em {{inad_total.nivel}}, com queda de {{inad_total.delta_mes_pp|abs}} no mês e alta de {{inad_total.delta_12m_pp|abs}} na comparação interanual. A inadimplência de pessoas físicas ficou em {{inad_pf.nivel}}, com queda de {{inad_pf.delta_mes_pp|abs}} no mês e alta de {{inad_pf.delta_12m_pp|abs}} na comparação interanual. A inadimplência de pessoas jurídicas ficou em {{inad_pj.nivel}}, com queda de {{inad_pj.delta_mes_pp|abs}} no mês e alta de {{inad_pj.delta_12m_pp|abs}} na comparação interanual. Fontes: {{fonte:inad_total.nivel}}; {{fonte:inad_pf.nivel}}; {{fonte:inad_pj.nivel}}.

[EVIDÊNCIA] O comprometimento de renda das famílias com o serviço da dívida, com referência em {{data:comprometimento.nivel}}, ficou em {{comprometimento.nivel}}. Houve alta de {{comprometimento.delta_mes_pp|abs}} no mês e alta de {{comprometimento.delta_12m_pp|abs}} na comparação interanual ({{fonte:comprometimento.nivel}}). O endividamento das famílias com o Sistema Financeiro Nacional em relação à renda acumulada no ano, com referência em {{data:endividamento.nivel}}, ficou em {{endividamento.nivel}}. Houve queda de {{endividamento.delta_mes_pp|abs}} no mês e alta de {{endividamento.delta_12m_pp|abs}} na comparação interanual ({{fonte:endividamento.nivel}}). O dado dessas duas séries referente à data base não está no pacote.

[EVIDÊNCIA] Lacunas do pacote: {{lacunas}}.

[INFERÊNCIA] O custo do crédito às famílias subiu no mês e na comparação interanual, com alta da taxa ({{taxa_pf.delta_mes_pp}}, {{taxa_pf.delta_12m_pp}}) e do spread ({{spread_pf.delta_mes_pp}}, {{spread_pf.delta_12m_pp}}) de pessoas físicas. Na comparação interanual, a inadimplência de pessoas físicas também subiu ({{inad_pf.delta_12m_pp}}), assim como o comprometimento de renda ({{comprometimento.delta_12m_pp}}), este com referência em {{data:comprometimento.delta_12m_pp}}, anterior à data base. A leitura é de condições de crédito às famílias mais apertadas, mesmo com a carteira de pessoas físicas em alta real ({{saldo_pf.var_12m_real_pct}}). Refutaria esta leitura: uma decomposição da taxa e do spread de pessoas físicas por modalidade que atribua a alta a mudança de composição da carteira, e não ao encarecimento das mesmas linhas, ou um dado de comprometimento de renda referente à data base com queda.

[INFERÊNCIA] O saldo de pessoas jurídicas teve alta no mês ({{saldo_pj.var_mes_pct}}), com queda da taxa ({{taxa_pj.delta_mes_pp}}) e do spread ({{spread_pj.delta_mes_pp}}) de pessoas jurídicas no mesmo mês, e as concessões a empresas tiveram alta real na comparação interanual ({{concessoes_pj.var_12m_real_pct}}). O conjunto é compatível com crédito às empresas em expansão a custo menor. A inadimplência de pessoas jurídicas teve queda no mês ({{inad_pj.delta_mes_pp}}), mas registra alta na comparação interanual ({{inad_pj.delta_12m_pp}}). Refutaria esta leitura: uma decomposição da taxa e do spread de pessoas jurídicas por modalidade que atribua a queda a mudança de composição da carteira, ou uma variação mensal das concessões a pessoas jurídicas com queda, dado que não está no pacote.

[INFERÊNCIA] A leitura do crédito não é uniforme entre os segmentos. Para famílias, taxa ({{taxa_pf.delta_12m_pp}}), spread ({{spread_pf.delta_12m_pp}}) e inadimplência ({{inad_pf.delta_12m_pp}}) estão em alta na comparação interanual. Para empresas, taxa ({{taxa_pj.delta_12m_pp}}) e spread ({{spread_pj.delta_12m_pp}}) estão em queda na mesma comparação, com inadimplência em alta ({{inad_pj.delta_12m_pp}}). No agregado, taxa ({{taxa_total.delta_12m_pp}}) e spread ({{spread_total.delta_12m_pp}}) estão em alta na comparação interanual. A queda mensal da inadimplência total ({{inad_total.delta_mes_pp}}) é observada num único mês, contra alta na comparação interanual ({{inad_total.delta_12m_pp}}). Refutaria esta leitura: taxa, spread e inadimplência de pessoas físicas e de pessoas jurídicas com o mesmo sinal na comparação interanual, ou quedas mensais da inadimplência total em datas base seguintes.


Objeções do crítico:

OBJEÇÃO [grave]: "A leitura é de condições de crédito às famílias mais apertadas, mesmo com a carteira de pessoas físicas em alta real ({{saldo_pf.var_12m_real_pct}})" | seleção enviesada e conclusão mais forte do que os fatos: a inferência omite a alta real das concessões a pessoas físicas na comparação interanual ({{concessoes_pf.var_12m_real_pct}}), fato de volume que contraria a leitura de aperto; os fatos citados mostram preço e inadimplência em alta, não restrição de oferta | citar {{concessoes_pf.var_12m_real_pct}} na inferência e limitar a conclusão a "crédito às famílias mais caro", ou incluir a alta real das concessões entre os elementos que refutariam a leitura de aperto
OBJEÇÃO [grave]: "O endividamento das famílias com o Sistema Financeiro Nacional em relação à renda acumulada no ano" | atribuição diferente do pacote: o fato endividamento.nivel é definido em relação à renda de doze meses, não à renda acumulada no ano; é erro factual de definição em parágrafo de evidência | trocar por "em relação à renda de doze meses", como na tabela de fatos
OBJEÇÃO [moderada]: "Refutaria esta leitura: [...] ou um dado de comprometimento de renda referente à data base com queda." | a refutação não enfrenta a leitura: a inferência se apoia na alta interanual do comprometimento ({{comprometimento.delta_12m_pp}}), e uma queda mensal na data base não a contrariaria | substituir por condição coerente com o horizonte da inferência, por exemplo comprometimento na data base com queda na comparação interanual, ou retirar o item
OBJEÇÃO [moderada]: "O conjunto é compatível com crédito às empresas em expansão a custo menor." | mistura de horizontes e coincidência no tempo: saldo, taxa e spread de pessoas jurídicas são do mês, concessões são interanuais; a sequência sugere que o custo menor acompanha ou explica a expansão sem fato que ligue os dois | declarar os horizontes de cada fato e deixar explícito que os fatos mostram simultaneidade, não relação entre custo e volume
OBJEÇÃO [moderada]: "A inadimplência de pessoas jurídicas teve queda no mês ({{inad_pj.delta_mes_pp}}), mas registra alta na comparação interanual ({{inad_pj.delta_12m_pp}})." | fato adverso apresentado sem integração: spread de pessoas jurídicas em queda interanual ({{spread_pj.delta_12m_pp}}) com inadimplência em alta interanual não é discutido, e a cláusula de refutação não o considera | incorporar a alta interanual da inadimplência de pessoas jurídicas à leitura ou à condição que a refutaria
OBJEÇÃO [moderada]: "Refutaria esta leitura: taxa, spread e inadimplência de pessoas físicas e de pessoas jurídicas com o mesmo sinal na comparação interanual" | a inadimplência de pessoas físicas ({{inad_pf.delta_12m_pp}}) e a de pessoas jurídicas ({{inad_pj.delta_12m_pp}}) já têm o mesmo sinal no pacote, o que torna a condição de refutação parcialmente satisfeita e ambígua | restringir a condição a taxa e spread, os fatos que de fato divergem entre os segmentos
OBJEÇÃO [leve]: "ou quedas mensais da inadimplência total em datas base seguintes" | a refutação depende de dados futuros e, junto com "observada num único mês", sugere expectativa sobre o comportamento seguinte da série, próximo de previsão | reformular como condição verificável no pacote atual ou retirar a referência a datas base seguintes
OBJEÇÃO [leve]: "O custo do crédito às famílias subiu no mês e na comparação interanual [...]" | omissão de fatos de sinal contrário no mesmo segmento: inadimplência de pessoas físicas em queda no mês ({{inad_pf.delta_mes_pp}}) e endividamento em queda no mês ({{endividamento.delta_mes_pp}}) não aparecem na inferência | mencionar esses fatos ou declarar que a leitura se limita à comparação interanual
OBJEÇÃO [leve]: "# Crédito em {{data_base}}: custo em alta para famílias e em queda para empresas" | o título seleciona só o custo e omite a alta interanual da inadimplência nos dois segmentos, fato de relevância comparável | incluir a inadimplência no título ou torná-lo descritivo sem destacar um único eixo
OBJEÇÃO [leve]: "a inadimplência da carteira de crédito ficou em {{inad_total.nivel}}" | ambiguidade de definição: o pacote mede inadimplência acima de noventa dias, qualificação ausente no texto | acrescentar "acima de noventa dias" na primeira menção


Leitura do replicador:

DESTAQUES_FAMILIAS: inad_pf.delta_12m_pp, taxa_pf.delta_mes_pp, spread_pf.delta_12m_pp, comprometimento.delta_12m_pp, saldo_pf.var_mes_pct
LEITURA_FAMILIAS: deterioração
DESTAQUES_EMPRESAS: concessoes_pj.var_12m_real_pct, saldo_pj.var_mes_pct, taxa_pj.delta_mes_pp, spread_pj.delta_mes_pp, inad_pj.delta_12m_pp
LEITURA_EMPRESAS: misto


Itens do validador mecânico:

nenhum (primeira revisão)

Devolva a nota revisada. data_base: 2026-06 · pacote_sha256: f2cfc9564ec3a8fa66fdb69d6d6c97b711159e3eb5a9ab21f4700b5e6b46de07
