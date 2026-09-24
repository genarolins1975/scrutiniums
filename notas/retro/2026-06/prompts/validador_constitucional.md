<!-- papel: validador_constitucional -->
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


# Papel: validador constitucional

Você roda em contexto separado dos autores. Recebe só a nota já renderizada, a tabela de fatos e a constituição. Não recebe rascunhos nem raciocínio de ninguém.

A checagem de números já foi feita por código e não é sua: você nunca aprova nem reprova número.

Confira cada afirmação contra a constituição:
- C1 toda inferência declara a base e o que a refutaria;
- C2 não há causalidade indevida;
- C3 não há seleção enviesada de fatos;
- C4 o tom é neutro, sem juízo sobre instituição e sem recomendação.

Responda com uma linha por critério e uma decisão final:

    C1: ok | falha: <trecho e motivo>
    C2: ok | falha: <trecho e motivo>
    C3: ok | falha: <trecho e motivo>
    C4: ok | falha: <trecho e motivo>
    DECISÃO: aprovar | devolver

Você não pode bloquear nem reverter bloqueio do validador mecânico. Na dúvida, devolva com o motivo.


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

Nota renderizada:

# Crédito em jun/2026: custo sobe para famílias e cai para empresas, com inadimplência interanual em alta nos dois segmentos

*Evidência.* Na data base jun/2026, o saldo da carteira de crédito somou R$ 7,36 trilhões. Houve alta de 0,7% no mês, alta de 9,7% na comparação interanual nominal e alta de 4,9% em termos reais pelo IPCA. O saldo de pessoas físicas ficou em R$ 4,61 trilhões, com alta de 0,2% no mês, alta de 10,8% na comparação interanual nominal e alta de 5,9% em termos reais. O saldo de pessoas jurídicas ficou em R$ 2,75 trilhões, com alta de 1,5% no mês, alta de 7,9% na comparação interanual nominal e alta de 3,1% em termos reais. O saldo da carteira em relação ao PIB ficou em 55,76%, com alta de 0,03 p.p. no mês e alta de 1,28 p.p. na comparação interanual. Fontes: BCB/SGS 20539; BCB/SGS 20541; BCB/SGS 20540; BCB/SGS 20622.

*Evidência.* Na data base jun/2026, as concessões de crédito somaram R$ 747,1 bilhões no mês, com alta de 16,5% na comparação interanual nominal e alta de 11,3% em termos reais. As concessões a pessoas físicas somaram R$ 385,1 bilhões, com alta de 10,0% na comparação interanual nominal e alta de 5,1% em termos reais. As concessões a pessoas jurídicas somaram R$ 362,0 bilhões, com alta de 24,4% na comparação interanual nominal e alta de 18,9% em termos reais. A variação mensal das concessões não está no pacote. Fontes: BCB/SGS 20631; BCB/SGS 20633; BCB/SGS 20632.

*Evidência.* Na data base jun/2026, a taxa média de juros das operações de crédito ficou em 33,44% a.a., com alta de 0,22 p.p. no mês e alta de 1,59 p.p. na comparação interanual. A taxa de pessoas físicas ficou em 39,44% a.a., com alta de 0,58 p.p. no mês e alta de 2,60 p.p. na comparação interanual. A taxa de pessoas jurídicas ficou em 20,80% a.a., com queda de 0,45 p.p. no mês e queda de 0,26 p.p. na comparação interanual. Fontes: BCB/SGS 20714; BCB/SGS 20716; BCB/SGS 20715.

*Evidência.* Na data base jun/2026, o spread médio das operações de crédito ficou em 21,99 p.p., com alta de 0,10 p.p. no mês e alta de 1,25 p.p. na comparação interanual. O spread de pessoas físicas ficou em 28,59 p.p., com alta de 0,39 p.p. no mês e alta de 2,35 p.p. na comparação interanual. O spread de pessoas jurídicas ficou em 8,08 p.p., com queda de 0,43 p.p. no mês e queda de 0,76 p.p. na comparação interanual. Fontes: BCB/SGS 20783; BCB/SGS 20785; BCB/SGS 20784.

*Evidência.* Na data base jun/2026, a inadimplência acima de noventa dias da carteira de crédito ficou em 4,68%, com queda de 0,06 p.p. no mês e alta de 0,93 p.p. na comparação interanual. A inadimplência acima de noventa dias de pessoas físicas ficou em 5,57%, com queda de 0,05 p.p. no mês e alta de 1,16 p.p. na comparação interanual. A inadimplência acima de noventa dias de pessoas jurídicas ficou em 3,19%, com queda de 0,06 p.p. no mês e alta de 0,52 p.p. na comparação interanual. Fontes: BCB/SGS 21082; BCB/SGS 21084; BCB/SGS 21083.

*Evidência.* O comprometimento de renda das famílias com o serviço da dívida, com referência em mai/2026, ficou em 28,48%. Houve alta de 0,12 p.p. no mês e alta de 1,29 p.p. na comparação interanual (BCB/SGS 29034). O endividamento das famílias com o Sistema Financeiro Nacional em relação à renda de doze meses, com referência em mai/2026, ficou em 49,83%. Houve queda de 0,04 p.p. no mês e alta de 0,96 p.p. na comparação interanual (BCB/SGS 29037). O dado dessas duas séries referente à data base não está no pacote.

*Evidência.* Lacunas do pacote: nenhuma lacuna no escopo.

*Inferência.* Na comparação interanual, o crédito às famílias ficou mais caro: taxa (+2,60 p.p.) e spread (+2,35 p.p.) de pessoas físicas estão em alta, e no mês também tiveram alta (+0,58 p.p., +0,39 p.p.). Na mesma comparação, a inadimplência de pessoas físicas teve alta (+1,16 p.p.), assim como o comprometimento de renda (+1,29 p.p.), este com referência em mai/2026, anterior à data base. No mês, há fatos de sinal contrário: a inadimplência de pessoas físicas teve queda (−0,05 p.p.) e o endividamento teve queda (−0,04 p.p.), este com referência em mai/2026. Os fatos de volume não mostram restrição de oferta: as concessões a pessoas físicas (+5,1%) e o saldo de pessoas físicas (+5,9%) tiveram alta real na comparação interanual. A leitura se limita a crédito às famílias mais caro, com inadimplência interanual em alta, sem sinal de aperto de volume no pacote. Refutaria esta leitura: uma decomposição da taxa e do spread de pessoas físicas por modalidade que atribua a alta a mudança de composição da carteira, e não ao encarecimento das mesmas linhas, ou concessões a pessoas físicas com queda real na comparação interanual.

*Inferência.* Os fatos de pessoas jurídicas têm horizontes distintos. No mês, o saldo teve alta (+1,5%), a taxa (−0,45 p.p.) e o spread (−0,43 p.p.) tiveram queda e a inadimplência teve queda (−0,06 p.p.). Na comparação interanual, as concessões tiveram alta real (+18,9%), a taxa (−0,26 p.p.) e o spread (−0,76 p.p.) tiveram queda e a inadimplência teve alta (+0,52 p.p.). Os fatos mostram volume em alta e custo em queda ao mesmo tempo; não mostram relação entre custo e volume. Na comparação interanual, o spread às empresas caiu no mesmo período em que a inadimplência acima de noventa dias de pessoas jurídicas subiu, e o pacote não traz fato que explique essa combinação. Refutaria esta leitura: uma decomposição da taxa e do spread de pessoas jurídicas por modalidade que atribua a queda a mudança de composição da carteira, ou inadimplência de pessoas jurídicas com queda na comparação interanual, o que desfaria a combinação de custo em queda com atraso em alta.

*Inferência.* A leitura do crédito não é uniforme entre os segmentos. Para famílias, taxa (+2,60 p.p.), spread (+2,35 p.p.) e inadimplência (+1,16 p.p.) estão em alta na comparação interanual. Para empresas, taxa (−0,26 p.p.) e spread (−0,76 p.p.) estão em queda na mesma comparação, com inadimplência em alta (+0,52 p.p.). No agregado, taxa (+1,59 p.p.) e spread (+1,25 p.p.) estão em alta na comparação interanual. A inadimplência total teve queda no mês (−0,06 p.p.) e alta na comparação interanual (+0,93 p.p.); o pacote não traz a sequência mensal que permita separar oscilação de mudança de direção. Refutaria esta leitura: taxa e spread de pessoas físicas e de pessoas jurídicas com o mesmo sinal na comparação interanual.

*Inferência.* A leitura dos segmentos não é unânime. Para famílias, uma leitura alternativa parte da alta interanual da inadimplência (+1,16 p.p.), do spread (+2,35 p.p.) e do comprometimento de renda (+1,29 p.p., com referência em mai/2026), da alta da taxa no mês (+0,58 p.p.) e da alta do saldo no mês (+0,2%), e lê deterioração das condições das famílias, não apenas crédito mais caro. Para empresas, a mesma leitura alternativa parte da alta real interanual das concessões (+18,9%), da alta do saldo no mês (+1,5%), da queda no mês da taxa (−0,45 p.p.) e do spread (−0,43 p.p.) e da alta interanual da inadimplência (+0,52 p.p.), e classifica o quadro como misto. Refutaria esta leitura: inadimplência de pessoas físicas e comprometimento de renda com queda na comparação interanual, para famílias, e inadimplência de pessoas jurídicas com queda na comparação interanual, para empresas.

## Fontes dos números

| Fato | Valor | Data de referência | Fonte |
|---|---|---|---|
| Saldo da carteira de crédito, total | R$ 7,36 trilhões | jun/2026 | BCB/SGS 20539 |
| Saldo da carteira de crédito, total: variação no mês | +0,7% | jun/2026 | BCB/SGS 20539 |
| Saldo da carteira de crédito, total: variação em 12 meses, nominal | +9,7% | jun/2026 | BCB/SGS 20539 |
| Saldo da carteira de crédito, total: variação em 12 meses, real (IPCA) | +4,9% | jun/2026 | BCB/SGS 20539 |
| Saldo da carteira de crédito, pessoas físicas | R$ 4,61 trilhões | jun/2026 | BCB/SGS 20541 |
| Saldo da carteira de crédito, pessoas físicas: variação no mês | +0,2% | jun/2026 | BCB/SGS 20541 |
| Saldo da carteira de crédito, pessoas físicas: variação em 12 meses, nominal | +10,8% | jun/2026 | BCB/SGS 20541 |
| Saldo da carteira de crédito, pessoas físicas: variação em 12 meses, real (IPCA) | +5,9% | jun/2026 | BCB/SGS 20541 |
| Saldo da carteira de crédito, pessoas jurídicas | R$ 2,75 trilhões | jun/2026 | BCB/SGS 20540 |
| Saldo da carteira de crédito, pessoas jurídicas: variação no mês | +1,5% | jun/2026 | BCB/SGS 20540 |
| Saldo da carteira de crédito, pessoas jurídicas: variação em 12 meses, nominal | +7,9% | jun/2026 | BCB/SGS 20540 |
| Saldo da carteira de crédito, pessoas jurídicas: variação em 12 meses, real (IPCA) | +3,1% | jun/2026 | BCB/SGS 20540 |
| Saldo da carteira de crédito em relação ao PIB | 55,76% | jun/2026 | BCB/SGS 20622 |
| Saldo da carteira de crédito em relação ao PIB: diferença no mês | +0,03 p.p. | jun/2026 | BCB/SGS 20622 |
| Saldo da carteira de crédito em relação ao PIB: diferença em 12 meses | +1,28 p.p. | jun/2026 | BCB/SGS 20622 |
| Concessões de crédito no mês, total | R$ 747,1 bilhões | jun/2026 | BCB/SGS 20631 |
| Concessões de crédito no mês, total: variação em 12 meses, nominal | +16,5% | jun/2026 | BCB/SGS 20631 |
| Concessões de crédito no mês, total: variação em 12 meses, real (IPCA) | +11,3% | jun/2026 | BCB/SGS 20631 |
| Concessões de crédito no mês, pessoas físicas | R$ 385,1 bilhões | jun/2026 | BCB/SGS 20633 |
| Concessões de crédito no mês, pessoas físicas: variação em 12 meses, nominal | +10,0% | jun/2026 | BCB/SGS 20633 |
| Concessões de crédito no mês, pessoas físicas: variação em 12 meses, real (IPCA) | +5,1% | jun/2026 | BCB/SGS 20633 |
| Concessões de crédito no mês, pessoas jurídicas | R$ 362,0 bilhões | jun/2026 | BCB/SGS 20632 |
| Concessões de crédito no mês, pessoas jurídicas: variação em 12 meses, nominal | +24,4% | jun/2026 | BCB/SGS 20632 |
| Concessões de crédito no mês, pessoas jurídicas: variação em 12 meses, real (IPCA) | +18,9% | jun/2026 | BCB/SGS 20632 |
| Taxa média de juros das operações de crédito, total | 33,44% a.a. | jun/2026 | BCB/SGS 20714 |
| Taxa média de juros das operações de crédito, total: diferença no mês | +0,22 p.p. | jun/2026 | BCB/SGS 20714 |
| Taxa média de juros das operações de crédito, total: diferença em 12 meses | +1,59 p.p. | jun/2026 | BCB/SGS 20714 |
| Taxa média de juros, pessoas físicas | 39,44% a.a. | jun/2026 | BCB/SGS 20716 |
| Taxa média de juros, pessoas físicas: diferença no mês | +0,58 p.p. | jun/2026 | BCB/SGS 20716 |
| Taxa média de juros, pessoas físicas: diferença em 12 meses | +2,60 p.p. | jun/2026 | BCB/SGS 20716 |
| Taxa média de juros, pessoas jurídicas | 20,80% a.a. | jun/2026 | BCB/SGS 20715 |
| Taxa média de juros, pessoas jurídicas: diferença no mês | −0,45 p.p. | jun/2026 | BCB/SGS 20715 |
| Taxa média de juros, pessoas jurídicas: diferença em 12 meses | −0,26 p.p. | jun/2026 | BCB/SGS 20715 |
| Spread médio das operações de crédito, total | 21,99 p.p. | jun/2026 | BCB/SGS 20783 |
| Spread médio das operações de crédito, total: diferença no mês | +0,10 p.p. | jun/2026 | BCB/SGS 20783 |
| Spread médio das operações de crédito, total: diferença em 12 meses | +1,25 p.p. | jun/2026 | BCB/SGS 20783 |
| Spread médio, pessoas físicas | 28,59 p.p. | jun/2026 | BCB/SGS 20785 |
| Spread médio, pessoas físicas: diferença no mês | +0,39 p.p. | jun/2026 | BCB/SGS 20785 |
| Spread médio, pessoas físicas: diferença em 12 meses | +2,35 p.p. | jun/2026 | BCB/SGS 20785 |
| Spread médio, pessoas jurídicas | 8,08 p.p. | jun/2026 | BCB/SGS 20784 |
| Spread médio, pessoas jurídicas: diferença no mês | −0,43 p.p. | jun/2026 | BCB/SGS 20784 |
| Spread médio, pessoas jurídicas: diferença em 12 meses | −0,76 p.p. | jun/2026 | BCB/SGS 20784 |
| Inadimplência acima de 90 dias, total | 4,68% | jun/2026 | BCB/SGS 21082 |
| Inadimplência acima de 90 dias, total: diferença no mês | −0,06 p.p. | jun/2026 | BCB/SGS 21082 |
| Inadimplência acima de 90 dias, total: diferença em 12 meses | +0,93 p.p. | jun/2026 | BCB/SGS 21082 |
| Inadimplência acima de 90 dias, pessoas físicas | 5,57% | jun/2026 | BCB/SGS 21084 |
| Inadimplência acima de 90 dias, pessoas físicas: diferença no mês | −0,05 p.p. | jun/2026 | BCB/SGS 21084 |
| Inadimplência acima de 90 dias, pessoas físicas: diferença em 12 meses | +1,16 p.p. | jun/2026 | BCB/SGS 21084 |
| Inadimplência acima de 90 dias, pessoas jurídicas | 3,19% | jun/2026 | BCB/SGS 21083 |
| Inadimplência acima de 90 dias, pessoas jurídicas: diferença no mês | −0,06 p.p. | jun/2026 | BCB/SGS 21083 |
| Inadimplência acima de 90 dias, pessoas jurídicas: diferença em 12 meses | +0,52 p.p. | jun/2026 | BCB/SGS 21083 |
| Comprometimento de renda das famílias com o serviço da dívida | 28,48% | mai/2026 | BCB/SGS 29034 |
| Comprometimento de renda das famílias com o serviço da dívida: diferença no mês | +0,12 p.p. | mai/2026 | BCB/SGS 29034 |
| Comprometimento de renda das famílias com o serviço da dívida: diferença em 12 meses | +1,29 p.p. | mai/2026 | BCB/SGS 29034 |
| Endividamento das famílias com o SFN em relação à renda de 12 meses | 49,83% | mai/2026 | BCB/SGS 29037 |
| Endividamento das famílias com o SFN em relação à renda de 12 meses: diferença no mês | −0,04 p.p. | mai/2026 | BCB/SGS 29037 |
| Endividamento das famílias com o SFN em relação à renda de 12 meses: diferença em 12 meses | +0,96 p.p. | mai/2026 | BCB/SGS 29037 |

Os dados do BCB são revisados nas divulgações seguintes; os números desta nota valem para a gold identificada no pacote de reprodutibilidade.

Pacote de fatos `f2cfc9564ec3a8fa`, data base jun/2026. Verificação: `python3 -m pesquisa.fatos_conjuntura --verificar pacote.json`.

