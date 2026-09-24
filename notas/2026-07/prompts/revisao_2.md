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
2. Todo parágrafo começa com a classe: `[EVIDÊNCIA]`, `[INFERÊNCIA]` ou `[RECOMENDAÇÃO]`. Nenhuma nota tem recomendação.
3. Evidência só afirma o que os fatos mostram. Inferência cita os fatos em que se apoia e termina com a frase `Refutaria esta leitura:` seguida do que a contrariaria.
4. Fato com data de referência diferente da data base vem com `{{data:id}}` no mesmo parágrafo.
5. Palavra de direção ("alta", "queda", "estável") tem de concordar com o sinal do fato na tabela.
6. Proibido: hífen e travessão na prosa; adjetivos valorativos sem régua ("forte", "preocupante", "expressivo", "recorde", "robusto"); vocabulário de rating; previsão ("deverá", "tende a", "projeção"); faixa verbal de risco.
7. Temas vedados (constituição, art. 5): não nomeie instituição financeira nem trate de FGC, garantias de depósito, regimes de resolução ou Open Finance; não proponha tese nova. O validador mecânico bloqueia e ninguém reverte.
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

Versão 2, de 24/09/2026. Vale para todo agente, para o validador mecânico e para os revisores. Em conflito com qualquer outro documento, prevalece esta. Só o dono do projeto altera este texto, por PR próprio.

Por decisão do dono do projeto, nenhuma etapa deste projeto tem revisão humana. Quem cumpre o papel que seria de um editor é um conjunto de revisores independentes, todos agentes, somado a regras verificáveis por código. Onde a versão 1 pedia julgamento humano, esta versão proíbe o tema ou exige verificação mecânica.

## Art. 1. Números

1. Todo número publicado vem da camada gold determinística (inclusive campo calculado pelo pipeline e publicado na gold com a fórmula declarada, como a variação real deflacionada pelo IPCA) ou de um pacote de fatos derivado dela por fórmula declarada (diferença ou variação percentual entre dois valores da gold). Nenhum outro caminho.
2. Agente não calcula, estima, arredonda, converte nem digita número. O texto referencia fatos por identificador; o valor é inserido depois, mecanicamente, a partir do pacote.
3. Exceção existente: valor transcrito de documento primário (Fase 2) só vale se o código confirmar que o trecho literal citado contém o valor. Transcrição não é cálculo.
4. Revisão posterior da fonte não torna errada a nota antiga: a nota vale para a gold que a gerou, identificada por hash. A revisão é registrada, não apagada.

## Art. 2. Três classes de afirmação

Todo parágrafo declara uma classe. Parágrafo sem classe é devolvido.

- **Evidência**: afirma o que o dado mostra. Só contém fatos do pacote, cada um com fonte e data de referência, ou declara lacuna.
- **Inferência**: leitura sobre a evidência. Diz de que evidência parte e o que a refutaria.
- **Recomendação**: não existe nas notas do Observatório.

## Art. 3. Ausência

Dado não medido, não coletado ou não acessado é declarado como lacuna, com motivo. Nunca é estimado, interpolado ou preenchido por analogia. Lacuna do pacote aparece na nota.

## Art. 4. Rastreabilidade

Toda nota leva seu pacote de reprodutibilidade: hash dos arquivos gold, hash dos fatos, commit, comando de verificação, o registro do validador e o parecer de cada revisor. Qualquer leitor refaz cada número com o mesmo resultado.

## Art. 5. Temas vedados

Nenhuma nota trata dos temas abaixo. O validador mecânico bloqueia; não há exceção nem aprovação que a reverta.

1. Instituição financeira nomeada.
2. FGC, garantias de depósito, regimes de resolução, liquidação ou intervenção.
3. Open Finance e seus participantes.
4. Tese nova ou interpretação que vá além de ler os fatos do pacote.

O motivo é de governança: o dono do projeto é conselheiro do FGC e diretor da Associação Open Finance Brasil, e sem revisão humana não há quem se declare impedido. O tema fica fora em vez de ficar sem salvaguarda.

## Art. 6. Revisão independente

1. Cada nota passa por três revisões por agente, depois do validador mecânico: o validador constitucional, o revisor independente e o terceiro revisor.
2. Os revisores não veem os rascunhos, o raciocínio dos autores, as objeções do crítico nem o parecer um do outro.
3. As três revisões diferem em pelo menos três destas características: modelo, fornecedor, evidência recebida, mandato e forma de apresentação dos dados. As características de cada uma ficam registradas no manifesto da nota.
4. Nenhum revisor aprova número; a checagem de números é mecânica.
5. A nota só é aprovada por unanimidade. Revisor devolve se e só se apontar item grave (o leitor sairia com crença falsa sobre um fato, ou há violação desta constituição); a decisão é derivada dos itens por código. Itens moderados e leves são sugestões registradas e não bloqueiam. Qualquer devolução volta à revisão; esgotado o limite de rodadas, a nota é rejeitada e não é publicada.
6. Bloqueio do validador mecânico não é revertido por ninguém.

## Art. 7. Linguagem

Português do Brasil com acentuação correta. Sem hífen nem travessão na prosa; número negativo usa o sinal de menos. Sem adjetivo valorativo sobre número ("forte", "preocupante", "recorde") sem régua declarada no pacote. Sem vocabulário de rating, recomendação ou previsão.

## Art. 8. Validador mecânico

Código, sem modelo de linguagem. Decide aprovar, devolver ou bloquear, com motivo escrito por item. Bloqueia número digitado, fato inexistente, pacote adulterado, direção contrária ao sinal, número no recorte errado e tema vedado.

## Art. 9. Degraus de autonomia

1. **Degrau 1**: nota aprovada fica só no repositório (`notas/`).
2. **Degrau 2**: nota aprovada é publicada no site, quando o tipo de nota cumprir, de forma medida e registrada: pelo menos três ciclos consecutivos sem erro factual achado pelo auditor; os revisores, em conjunto, pegando pelo menos 90% dos erros semânticos plantados; e nenhuma rejeição indevida nos controles limpos.
3. Erro relevante publicado devolve o tipo de nota ao degrau 1 automaticamente e zera a contagem.

## Art. 10. Erro

1. **Erro factual**: número, data de referência, fonte, sinal, unidade, definição ou atribuição diferente do pacote.
2. **Erro relevante**: erro factual publicado, ou nota publicada sobre tema vedado.
3. O auditor confere todo mês cada nota aprovada contra a gold e a fonte primária. Erro achado por ele, por um revisor ou por leitor gera errata datada no mesmo endereço, sem apagar o texto original, e entra no registro público de erros.

## Art. 11. Fronteira

Agentes leem a gold publicada e escrevem só em `notas/`. Não escrevem no pipeline, na gold, em `public/` nem no ramo principal. Nada que um agente produza altera um número do Observatório.


# USUÁRIO

Data base: 2026-07 · sha256_fatos: e0c39bc7981548688ac604396222743f446cc2869ef97af64d0a5f7a4335e36c

| id | fato | valor | sinal | data de referência |
|---|---|---|---|---|
| saldo_total.nivel | Saldo da carteira de crédito, total | R$ 7,37 trilhões |  | 2026-07 |
| saldo_total.var_mes_pct | Saldo da carteira de crédito, total: variação no mês | +0,3% | + | 2026-07 |
| saldo_total.var_12m_pct | Saldo da carteira de crédito, total: variação em 12 meses, nominal | +9,5% | + | 2026-07 |
| saldo_total.var_12m_real_pct | Saldo da carteira de crédito, total: variação em 12 meses, real (IPCA) | +4,8% | + | 2026-07 |
| saldo_pf.nivel | Saldo da carteira de crédito, pessoas físicas | R$ 4,64 trilhões |  | 2026-07 |
| saldo_pf.var_mes_pct | Saldo da carteira de crédito, pessoas físicas: variação no mês | +0,8% | + | 2026-07 |
| saldo_pf.var_12m_pct | Saldo da carteira de crédito, pessoas físicas: variação em 12 meses, nominal | +10,8% | + | 2026-07 |
| saldo_pf.var_12m_real_pct | Saldo da carteira de crédito, pessoas físicas: variação em 12 meses, real (IPCA) | +6,1% | + | 2026-07 |
| saldo_pj.nivel | Saldo da carteira de crédito, pessoas jurídicas | R$ 2,73 trilhões |  | 2026-07 |
| saldo_pj.var_mes_pct | Saldo da carteira de crédito, pessoas jurídicas: variação no mês | −0,7% | − | 2026-07 |
| saldo_pj.var_12m_pct | Saldo da carteira de crédito, pessoas jurídicas: variação em 12 meses, nominal | +7,4% | + | 2026-07 |
| saldo_pj.var_12m_real_pct | Saldo da carteira de crédito, pessoas jurídicas: variação em 12 meses, real (IPCA) | +2,8% | + | 2026-07 |
| concessoes_total.nivel | Concessões de crédito no mês, total | R$ 736,8 bilhões |  | 2026-07 |
| concessoes_total.var_12m_pct | Concessões de crédito no mês, total: variação em 12 meses, nominal | +13,4% | + | 2026-07 |
| concessoes_total.var_12m_real_pct | Concessões de crédito no mês, total: variação em 12 meses, real (IPCA) | +8,6% | + | 2026-07 |
| concessoes_pf.nivel | Concessões de crédito no mês, pessoas físicas | R$ 406,4 bilhões |  | 2026-07 |
| concessoes_pf.var_12m_pct | Concessões de crédito no mês, pessoas físicas: variação em 12 meses, nominal | +11,2% | + | 2026-07 |
| concessoes_pf.var_12m_real_pct | Concessões de crédito no mês, pessoas físicas: variação em 12 meses, real (IPCA) | +6,5% | + | 2026-07 |
| concessoes_pj.nivel | Concessões de crédito no mês, pessoas jurídicas | R$ 330,4 bilhões |  | 2026-07 |
| concessoes_pj.var_12m_pct | Concessões de crédito no mês, pessoas jurídicas: variação em 12 meses, nominal | +16,2% | + | 2026-07 |
| concessoes_pj.var_12m_real_pct | Concessões de crédito no mês, pessoas jurídicas: variação em 12 meses, real (IPCA) | +11,2% | + | 2026-07 |
| taxa_total.nivel | Taxa média de juros das operações de crédito, total | 32,08% a.a. |  | 2026-07 |
| taxa_total.delta_mes_pp | Taxa média de juros das operações de crédito, total: diferença no mês | −1,25 p.p. | − | 2026-07 |
| taxa_total.delta_12m_pp | Taxa média de juros das operações de crédito, total: diferença em 12 meses | +0,33 p.p. | + | 2026-07 |
| taxa_pf.nivel | Taxa média de juros, pessoas físicas | 37,41% a.a. |  | 2026-07 |
| taxa_pf.delta_mes_pp | Taxa média de juros, pessoas físicas: diferença no mês | −1,97 p.p. | − | 2026-07 |
| taxa_pf.delta_12m_pp | Taxa média de juros, pessoas físicas: diferença em 12 meses | +1,00 p.p. | + | 2026-07 |
| taxa_pj.nivel | Taxa média de juros, pessoas jurídicas | 20,97% a.a. |  | 2026-07 |
| taxa_pj.delta_mes_pp | Taxa média de juros, pessoas jurídicas: diferença no mês | +0,24 p.p. | + | 2026-07 |
| taxa_pj.delta_12m_pp | Taxa média de juros, pessoas jurídicas: diferença em 12 meses | −0,62 p.p. | − | 2026-07 |
| spread_total.nivel | Spread médio das operações de crédito, total | 20,88 p.p. |  | 2026-07 |
| spread_total.delta_mes_pp | Spread médio das operações de crédito, total: diferença no mês | −0,98 p.p. | − | 2026-07 |
| spread_total.delta_12m_pp | Spread médio das operações de crédito, total: diferença em 12 meses | +0,31 p.p. | + | 2026-07 |
| spread_pf.nivel | Spread médio, pessoas físicas | 26,65 p.p. |  | 2026-07 |
| spread_pf.delta_mes_pp | Spread médio, pessoas físicas: diferença no mês | −1,87 p.p. | − | 2026-07 |
| spread_pf.delta_12m_pp | Spread médio, pessoas físicas: diferença em 12 meses | +0,96 p.p. | + | 2026-07 |
| spread_pj.nivel | Spread médio, pessoas jurídicas | 8,87 p.p. |  | 2026-07 |
| spread_pj.delta_mes_pp | Spread médio, pessoas jurídicas: diferença no mês | +0,88 p.p. | + | 2026-07 |
| spread_pj.delta_12m_pp | Spread médio, pessoas jurídicas: diferença em 12 meses | −0,53 p.p. | − | 2026-07 |
| inad_total.nivel | Inadimplência acima de 90 dias, total | 4,88% |  | 2026-07 |
| inad_total.delta_mes_pp | Inadimplência acima de 90 dias, total: diferença no mês | +0,30 p.p. | + | 2026-07 |
| inad_total.delta_12m_pp | Inadimplência acima de 90 dias, total: diferença em 12 meses | +0,92 p.p. | + | 2026-07 |
| inad_pf.nivel | Inadimplência acima de 90 dias, pessoas físicas | 5,81% |  | 2026-07 |
| inad_pf.delta_mes_pp | Inadimplência acima de 90 dias, pessoas físicas: diferença no mês | +0,39 p.p. | + | 2026-07 |
| inad_pf.delta_12m_pp | Inadimplência acima de 90 dias, pessoas físicas: diferença em 12 meses | +1,15 p.p. | + | 2026-07 |
| inad_pj.nivel | Inadimplência acima de 90 dias, pessoas jurídicas | 3,31% |  | 2026-07 |
| inad_pj.delta_mes_pp | Inadimplência acima de 90 dias, pessoas jurídicas: diferença no mês | +0,13 p.p. | + | 2026-07 |
| inad_pj.delta_12m_pp | Inadimplência acima de 90 dias, pessoas jurídicas: diferença em 12 meses | +0,52 p.p. | + | 2026-07 |
| credito_pib.nivel | Saldo da carteira de crédito em relação ao PIB | 55,60% |  | 2026-07 |
| credito_pib.delta_mes_pp | Saldo da carteira de crédito em relação ao PIB: diferença no mês | −0,15 p.p. | − | 2026-07 |
| credito_pib.delta_12m_pp | Saldo da carteira de crédito em relação ao PIB: diferença em 12 meses | +1,22 p.p. | + | 2026-07 |
| endividamento.nivel | Endividamento das famílias com o SFN em relação à renda de 12 meses | 49,75% |  | 2026-06 |
| endividamento.delta_mes_pp | Endividamento das famílias com o SFN em relação à renda de 12 meses: diferença no mês | −0,08 p.p. | − | 2026-06 |
| endividamento.delta_12m_pp | Endividamento das famílias com o SFN em relação à renda de 12 meses: diferença em 12 meses | +0,93 p.p. | + | 2026-06 |
| comprometimento.nivel | Comprometimento de renda das famílias com o serviço da dívida | 28,85% |  | 2026-06 |
| comprometimento.delta_mes_pp | Comprometimento de renda das famílias com o serviço da dívida: diferença no mês | +0,36 p.p. | + | 2026-06 |
| comprometimento.delta_12m_pp | Comprometimento de renda das famílias com o serviço da dívida: diferença em 12 meses | +1,68 p.p. | + | 2026-06 |

Séries com data própria (cite {{data:id}}): endividamento, comprometimento

Nota atual:

---
tipo: conjuntura
data_base: 2026-07
pacote_sha256: e0c39bc7981548688ac604396222743f446cc2869ef97af64d0a5f7a4335e36c
degrau: 1
declaracao_interesse:
---
# Crédito em {{data_base}}: juros das pessoas físicas caem no mês e seguem acima do mesmo mês do ano anterior; taxa e spread das pessoas jurídicas sobem no mês

[EVIDÊNCIA] Na data base {{data_base}}, o saldo total da carteira de crédito somou {{saldo_total.nivel}}, com alta de {{saldo_total.var_mes_pct|abs}} no mês e alta nominal de {{saldo_total.var_12m_pct|abs}} em doze meses. Deflacionado pelo IPCA, o saldo total teve alta de {{saldo_total.var_12m_real_pct|abs}} em doze meses. As concessões totais somaram {{concessoes_total.nivel}} no mês, com alta nominal de {{concessoes_total.var_12m_pct|abs}} e alta real de {{concessoes_total.var_12m_real_pct|abs}} em doze meses. O crédito em relação ao PIB ficou em {{credito_pib.nivel}}, com queda de {{credito_pib.delta_mes_pp|abs}} no mês e alta de {{credito_pib.delta_12m_pp|abs}} em doze meses. Fontes: {{fonte:saldo_total.nivel}}; {{fonte:concessoes_total.nivel}}; {{fonte:credito_pib.nivel}}.

[EVIDÊNCIA] A taxa média de juros total ficou em {{taxa_total.nivel}}, com queda de {{taxa_total.delta_mes_pp|abs}} no mês e alta de {{taxa_total.delta_12m_pp|abs}} em doze meses. O spread médio total ficou em {{spread_total.nivel}}, com queda de {{spread_total.delta_mes_pp|abs}} no mês e alta de {{spread_total.delta_12m_pp|abs}} em doze meses. A inadimplência acima de noventa dias total ficou em {{inad_total.nivel}}, com alta de {{inad_total.delta_mes_pp|abs}} no mês e alta de {{inad_total.delta_12m_pp|abs}} em doze meses. Fontes: {{fonte:taxa_total.nivel}}; {{fonte:spread_total.nivel}}; {{fonte:inad_total.nivel}}.

[EVIDÊNCIA] O saldo da carteira de crédito às pessoas físicas somou {{saldo_pf.nivel}}, com alta de {{saldo_pf.var_mes_pct|abs}} no mês e alta nominal de {{saldo_pf.var_12m_pct|abs}} em doze meses. Deflacionado pelo IPCA, o saldo às pessoas físicas teve alta de {{saldo_pf.var_12m_real_pct|abs}} em doze meses. As concessões às pessoas físicas somaram {{concessoes_pf.nivel}} no mês, com alta nominal de {{concessoes_pf.var_12m_pct|abs}} e alta real de {{concessoes_pf.var_12m_real_pct|abs}} em doze meses. Fontes: {{fonte:saldo_pf.nivel}}; {{fonte:concessoes_pf.nivel}}.

[EVIDÊNCIA] A taxa média de juros das pessoas físicas ficou em {{taxa_pf.nivel}}, com queda de {{taxa_pf.delta_mes_pp|abs}} no mês e alta de {{taxa_pf.delta_12m_pp|abs}} em doze meses. O spread médio das pessoas físicas ficou em {{spread_pf.nivel}}, com queda de {{spread_pf.delta_mes_pp|abs}} no mês e alta de {{spread_pf.delta_12m_pp|abs}} em doze meses. A inadimplência acima de noventa dias das pessoas físicas ficou em {{inad_pf.nivel}}, com alta de {{inad_pf.delta_mes_pp|abs}} no mês e alta de {{inad_pf.delta_12m_pp|abs}} em doze meses. Fontes: {{fonte:taxa_pf.nivel}}; {{fonte:spread_pf.nivel}}; {{fonte:inad_pf.nivel}}.

[EVIDÊNCIA] Com data de referência {{data:comprometimento.nivel}}, o comprometimento de renda das famílias com o serviço da dívida ficou em {{comprometimento.nivel}}, com alta de {{comprometimento.delta_mes_pp|abs}} no mês e alta de {{comprometimento.delta_12m_pp|abs}} em doze meses. Com data de referência {{data:endividamento.nivel}}, o endividamento das famílias com o SFN em relação à renda de doze meses ficou em {{endividamento.nivel}}, com queda de {{endividamento.delta_mes_pp|abs}} no mês e alta de {{endividamento.delta_12m_pp|abs}} em doze meses. Fontes: {{fonte:comprometimento.nivel}}; {{fonte:endividamento.nivel}}.

[EVIDÊNCIA] O saldo da carteira de crédito às pessoas jurídicas somou {{saldo_pj.nivel}}, com queda de {{saldo_pj.var_mes_pct|abs}} no mês e alta nominal de {{saldo_pj.var_12m_pct|abs}} em doze meses. Deflacionado pelo IPCA, o saldo às pessoas jurídicas teve alta de {{saldo_pj.var_12m_real_pct|abs}} em doze meses. As concessões às pessoas jurídicas somaram {{concessoes_pj.nivel}} no mês, com alta nominal de {{concessoes_pj.var_12m_pct|abs}} e alta real de {{concessoes_pj.var_12m_real_pct|abs}} em doze meses. Fontes: {{fonte:saldo_pj.nivel}}; {{fonte:concessoes_pj.nivel}}.

[EVIDÊNCIA] A taxa média de juros das pessoas jurídicas ficou em {{taxa_pj.nivel}}, com alta de {{taxa_pj.delta_mes_pp|abs}} no mês e queda de {{taxa_pj.delta_12m_pp|abs}} em doze meses. O spread médio das pessoas jurídicas ficou em {{spread_pj.nivel}}, com alta de {{spread_pj.delta_mes_pp|abs}} no mês e queda de {{spread_pj.delta_12m_pp|abs}} em doze meses. A inadimplência acima de noventa dias das pessoas jurídicas ficou em {{inad_pj.nivel}}, com alta de {{inad_pj.delta_mes_pp|abs}} no mês e alta de {{inad_pj.delta_12m_pp|abs}} em doze meses. Fontes: {{fonte:taxa_pj.nivel}}; {{fonte:spread_pj.nivel}}; {{fonte:inad_pj.nivel}}.

[EVIDÊNCIA] A variação mensal das concessões, total e por segmento, não está no pacote. Lacunas do pacote: {{lacunas}}.

[INFERÊNCIA] Esta leitura parte de três fatos em doze meses. A taxa média de juros das pessoas físicas teve alta de {{taxa_pf.delta_12m_pp|abs}} em doze meses. A inadimplência acima de noventa dias das pessoas físicas teve alta de {{inad_pf.delta_12m_pp|abs}} em doze meses. O comprometimento de renda das famílias teve alta de {{comprometimento.delta_12m_pp|abs}} em doze meses, com data de referência {{data:comprometimento.nivel}}. A taxa e a inadimplência das pessoas físicas e o comprometimento de renda das famílias estão acima do nível de doze meses antes. Isso indica menor folga das famílias para o serviço da dívida do que doze meses antes. Há fatos do pacote em outro sentido, que ficam registrados: a taxa das pessoas físicas teve queda de {{taxa_pf.delta_mes_pp|abs}} no mês, e o endividamento das famílias teve queda de {{endividamento.delta_mes_pp|abs}} no mês, com data de referência {{data:endividamento.nivel}}. Nenhum deles altera a comparação em doze meses em que a leitura se apoia. Refutaria esta leitura: variação em doze meses nula ou negativa do comprometimento de renda das famílias ou da inadimplência das pessoas físicas nos dados vigentes.

[INFERÊNCIA] Esta leitura parte de fatos do mês. O saldo às pessoas jurídicas teve queda de {{saldo_pj.var_mes_pct|abs}} no mês. A taxa das pessoas jurídicas teve alta de {{taxa_pj.delta_mes_pp|abs}} no mês, e o spread das pessoas jurídicas teve alta de {{spread_pj.delta_mes_pp|abs}} no mês. No agregado, a taxa total teve queda de {{taxa_total.delta_mes_pp|abs}} no mês, e o spread total teve queda de {{spread_total.delta_mes_pp|abs}} no mês. Só na taxa e no spread o segmento foi em sentido oposto ao do agregado. Essa combinação é compatível com condições de crédito às pessoas jurídicas menos favoráveis ao tomador no mês. O agregado reúne pessoas físicas e jurídicas, e parte da diferença reflete a queda da taxa e do spread das pessoas físicas no mesmo período. A inadimplência fica fora desta leitura sobre condições de crédito: a inadimplência das pessoas jurídicas teve alta de {{inad_pj.delta_mes_pp|abs}} no mês, e a inadimplência total também teve alta de {{inad_total.delta_mes_pp|abs}} no mês. A leitura vale só para a variação do mês. Em doze meses, a taxa das pessoas jurídicas teve queda de {{taxa_pj.delta_12m_pp|abs}}, o spread das pessoas jurídicas teve queda de {{spread_pj.delta_12m_pp|abs}}, e as concessões às pessoas jurídicas tiveram alta real de {{concessoes_pj.var_12m_real_pct|abs}}. Esses fatos não acompanham a leitura mensal. A leitura não é unânime: uma leitura independente dos mesmos fatos atribui ao segmento das pessoas jurídicas condições menos favoráveis sem restringir a conclusão ao mês. Refutaria esta leitura: variação mensal das concessões às pessoas jurídicas com alta, dado que não está no pacote, ou evidência de que a queda do saldo decorre de amortização ou quitação de operações e não de menor contratação.


Objeções do crítico:

OBJEÇÃO [moderada]: "Essa combinação é compatível com condições de crédito às pessoas jurídicas menos favoráveis ao tomador no mês, em sentido oposto ao do agregado." | Conclusão mais forte do que os fatos permitem: a combinação citada inclui a alta da inadimplência das pessoas jurídicas ({{inad_pj.delta_mes_pp}}), mas a inadimplência total também subiu no mês ({{inad_total.delta_mes_pp}}), logo nem todos os componentes vão em sentido oposto ao agregado; além disso, o agregado é composto pelos dois segmentos, e a divergência é em parte mecânica | Restringir "em sentido oposto ao do agregado" à taxa e ao spread, citando no mesmo parágrafo que a inadimplência total também subiu no mês
OBJEÇÃO [moderada]: "segmento das pessoas jurídicas vai em sentido oposto" (título) e segunda inferência | Seleção enviesada: omite fatos do mesmo segmento que apontam em outra direção e têm relevância comparável, como a queda da taxa ({{taxa_pj.delta_12m_pp}}) e do spread ({{spread_pj.delta_12m_pp}}) em doze meses e a alta real das concessões às pessoas jurídicas em doze meses ({{concessoes_pj.var_12m_real_pct}}), a maior entre os segmentos | Citar esses fatos na inferência e deixar explícito que a leitura vale só para a variação de um único mês; ajustar o título para indicar "no mês"
OBJEÇÃO [moderada]: "O custo do crédito às pessoas físicas recuou no mês, mas segue acima do nível de doze meses antes" | Inferência apoiada em fato não listado entre os que ela declara como base: a comparação com doze meses antes depende de {{taxa_pf.delta_12m_pp}}, que não aparece na frase "Esta leitura parte de" | Incluir {{taxa_pf.delta_12m_pp}} na lista de fatos de que a inferência parte
OBJEÇÃO [moderada]: "Refutaria esta leitura: uma revisão da série de comprometimento de renda que eliminasse a alta em doze meses" | O refutador não contraria a leitura sobre os fatos do pacote: pela constituição (art. 1, item 4) a nota vale para a gold que a gerou, e revisão posterior da fonte não a torna errada; o critério não é um teste da inferência | Substituir por condição observável que contrariaria a leitura com os dados vigentes, por exemplo queda do comprometimento de renda em doze meses ou inadimplência das pessoas físicas estável em doze meses
OBJEÇÃO [leve]: "Esta leitura parte da queda de {{taxa_pf.delta_mes_pp|abs}} da taxa das pessoas físicas no mês" | O fato citado como base não sustenta a conclusão ("menor folga das famílias"), que decorre só do comprometimento e da inadimplência em doze meses; a inferência também não menciona a queda do endividamento no mês ({{endividamento.delta_mes_pp}}), fato que atenua a leitura | Retirar a queda mensal da taxa da base ou explicar seu papel, e citar a queda mensal do endividamento com {{data:endividamento.nivel}}
OBJEÇÃO [leve]: "junto com alta da taxa ({{taxa_pj.delta_mes_pp}}), do spread ({{spread_pj.delta_mes_pp}}) e da inadimplência ({{inad_pj.delta_mes_pp}})" | A inadimplência não é condição de crédito oferecida ao tomador; incluí la como indício de "condições menos favoráveis ao tomador" sugere relação que os fatos não mostram | Separar a inadimplência da leitura sobre condições de oferta ou declarar que ela é citada só como coincidência no tempo
OBJEÇÃO [leve]: "juros das pessoas físicas recuam no mês" (título) | O título destaca a queda mensal da taxa das pessoas físicas, enquanto a própria nota mostra alta em doze meses da taxa, da inadimplência e do comprometimento no mesmo segmento; o leitor que lê só o título sai com leitura mais favorável que a do corpo | Indicar no título que a taxa das pessoas físicas segue acima do nível de doze meses antes, ou retirar o destaque


Leitura do replicador:

DESTAQUES_FAMILIAS: inad_pf.delta_mes_pp, inad_pf.delta_12m_pp, comprometimento.delta_mes_pp, taxa_pf.delta_mes_pp, saldo_pf.var_mes_pct
LEITURA_FAMILIAS: deterioração
DESTAQUES_EMPRESAS: saldo_pj.var_mes_pct, inad_pj.delta_mes_pp, spread_pj.delta_mes_pp, taxa_pj.delta_mes_pp, concessoes_pj.var_12m_real_pct
LEITURA_EMPRESAS: deterioração


Devoluções da rodada anterior (validador mecânico e revisores):

Parecer de um revisor independente (A), que devolveu:
C1: falha: "A leitura não é unânime: uma leitura independente dos mesmos fatos atribui ao segmento das pessoas jurídicas condições menos favoráveis sem restringir a conclusão ao mês." Essa segunda leitura entra na nota sem autor, sem dizer de que fatos parte e sem dizer o que a refutaria. Os fatos em doze meses que a própria nota cita apontam em sentido oposto (taxa PJ −0,62 p.p., spread PJ −0,53 p.p., concessões PJ com alta real de 11,2%), e ela não trata disso.
C2: falha: "Refutaria esta leitura: [...] evidência de que a queda do saldo decorre de amortização ou quitação de operações e não de menor contratação." A frase pressupõe que a queda de 0,7% no saldo PJ vem de menor contratação. É uma causa sem base no pacote: a variação mensal das concessões não está no pacote, como a própria nota declara, e a nota apoia a leitura das condições de crédito nessa causa sem declará-la.
C3: falha: "Só na taxa e no spread o segmento foi em sentido oposto ao do agregado." É falso diante do pacote. O saldo PJ teve queda de 0,7% no mês, e o saldo total teve alta de 0,3%, portanto o saldo também foi em sentido oposto ao agregado. O leitor sai com uma crença falsa sobre a comparação entre o segmento e o agregado, e a seleção reforça a leitura de condições menos favoráveis.
C4: ok
C5: falha: A nota traz para o texto publicado uma "leitura independente" externa ao pacote, e a conclusão dessa leitura (condições menos favoráveis às PJ fora do horizonte mensal) vai além dos fatos. Somada ao mecanismo de menor contratação para a queda do saldo, isso é interpretação além da leitura dos fatos do pacote (art. 5, item 4).
DECISÃO: devolver


Parecer de um revisor independente (B), que devolveu:
ITEM grave: "Só na taxa e no spread o segmento foi em sentido oposto ao do agregado." | O saldo da carteira às pessoas jurídicas teve queda de 0,7% no mês (fato saldo_pj.var_mes_pct), enquanto o saldo total teve alta de 0,3% no mês (fato saldo_total.var_mes_pct, citado no primeiro parágrafo da própria nota) — sinais opostos. Logo o saldo também diverge do agregado no mês, o que a frase nega ao restringir a divergência a taxa e spread. O leitor sai com a crença falsa de que só dois indicadores divergiram, contra fatos já citados na própria nota. | Reconhecer que o saldo também diverge no mês (por exemplo, listar as três séries que divergem: saldo, taxa e spread) ou remover a palavra "Só" e reformular sem a alegação de exclusividade.
ITEM grave: "A leitura não é unânime: uma leitura independente dos mesmos fatos atribui ao segmento das pessoas jurídicas condições menos favoráveis sem restringir a conclusão ao mês." | Essa frase afirma a existência de uma "leitura independente" que não consta da tabela de fatos nem é derivável dela; nenhum fato, fonte ou dado do pacote sustenta essa afirmação, e a classe Inferência exige dizer de que evidência a leitura parte. O leitor toma como estabelecido um dado (a existência de outra leitura, com outro alcance) que a evidência recebida não mostra. | Remover a frase; se a leitura tiver alcance maior que o mês, isso deve vir de fato do pacote, não da alegação de que outra leitura existe.
ITEM moderada: "A variação mensal das concessões, total e por segmento, não está no pacote. Lacunas do pacote: nenhuma lacuna no escopo." | O Art. 3 exige que dado ausente seja declarado como lacuna com motivo. A frase declara a ausência mas não diz o motivo, e a oração seguinte ("nenhuma lacuna no escopo") soa contraditória com a primeira, já que a variação mensal das concessões é, ela mesma, um dado ausente do pacote. | Indicar o motivo da ausência (por exemplo, dado não calculado pelo pipeline para este recorte) e ajustar a frase seguinte para não parecer negar a lacuna que acabou de declarar.
ITEM leve: "Isso indica menor folga das famílias para o serviço da dívida do que doze meses antes." | A síntese reúne, sem diferenciar, fatos rotulados "pessoas físicas" (taxa e inadimplência da carteira de crédito) com um fato rotulado "famílias" (comprometimento de renda), que vêm de bases distintas (carteira de crédito por tomador pessoa física vs. renda agregada das famílias). Isso pode sugerir ao leitor uma única série em vez de três. | Explicitar que são três séries distintas antes de sintetizar a leitura conjunta.
DECISÃO: devolver


Parecer de um revisor independente (C), que devolveu:
ITEM grave: Só na taxa e no spread o segmento foi em sentido oposto ao do agregado. | A própria nota registra que o saldo total teve alta de 0,3% no mês e que o saldo às pessoas jurídicas teve queda de 0,7% no mês: o saldo também foi em sentido oposto ao do agregado. A frase afirma o contrário, e o leitor sai acreditando que o saldo das pessoas jurídicas acompanhou o agregado no mês. Entre as variáveis mensais comparáveis do pacote, só a inadimplência seguiu a direção do agregado (alta de 0,13 p.p. no segmento, alta de 0,30 p.p. no total). Crença falsa sobre um fato citado na própria nota. | Corrigir a frase: saldo, taxa e spread das pessoas jurídicas foram em sentido oposto ao do agregado no mês, e só a inadimplência seguiu a mesma direção. Ou retirar o "só" e listar as variáveis comparadas.
ITEM grave: A leitura não é unânime: uma leitura independente dos mesmos fatos atribui ao segmento das pessoas jurídicas condições menos favoráveis sem restringir a conclusão ao mês. | A frase veicula uma conclusão (condições menos favoráveis às pessoas jurídicas além do mês) que a nota não sustenta em nenhum fato do pacote e que os fatos em doze meses citados na frase anterior contrariam: taxa das pessoas jurídicas com queda de 0,62 p.p., spread com queda de 0,53 p.p. e concessões com alta real de 11,2%. O leitor não sabe quem fez essa leitura, de que evidência ela parte nem o que a refutaria, e sai com a impressão de que existe leitura válida dos mesmos dados apontando aperto geral às pessoas jurídicas. Isso fere o Art. 2 (inferência sem evidência de partida e sem condição de refutação) e o Art. 5, item 4 (interpretação que vai além dos fatos do pacote). Divergência entre agentes do ciclo pertence ao manifesto, não ao texto publicado. | Retirar a frase. Se a divergência precisar ficar registrada, registrar no pacote de reprodutibilidade, não na nota.
ITEM moderada: Essa combinação é compatível com condições de crédito às pessoas jurídicas menos favoráveis ao tomador no mês. | O histórico mostra que jun/2026 foi o menor spread das pessoas jurídicas dos treze meses (7,99 p.p.) e um dos menores níveis de taxa (20,73% a.a.); em jul/2026 o spread (8,87 p.p.) e a taxa (20,97% a.a.) voltaram ao intervalo observado de jan a mai/2026. A alta do mês é reversão de um mês fora do padrão recente, não deslocamento para nível menos favorável. A nota registra os fatos em doze meses, mas não diz que a variação mensal parte de um mês atípico, e o leitor tende a ler "condições menos favoráveis" como aperto novo. | Incluir no pacote a diferença no mês de jun/2026 da taxa e do spread das pessoas jurídicas e dizer que a alta de jul/2026 sucede queda de magnitude semelhante no mês anterior, ou reduzir a leitura à constatação de reversão no mês.
ITEM moderada: As concessões às pessoas jurídicas tiveram alta real de 11,2%. Esses fatos não acompanham a leitura mensal. | Concessões no mês são série volátil e sazonal, e a variação em doze meses de um mês isolado compara um mês com outro mês, não mede tendência. No histórico, a variação em doze meses das concessões às pessoas jurídicas oscila entre −1,1% (nov/2025) e +24,6% (jun/2026) de um mês para outro, e a total entre +3,3% (fev/2026) e +19,6% (mar/2026). Usada como contrapeso à leitura mensal, essa variação pesa menos do que o texto sugere; o mesmo vale para a alta nominal de 13,4% das concessões totais na primeira evidência. | Qualificar que a variação em doze meses das concessões compara o mês com o mesmo mês do ano anterior e está sujeita à sazonalidade visível na série, ou apoiar o contrapeso em mais de um mês.
ITEM moderada: A variação mensal das concessões, total e por segmento, não está no pacote. Lacunas do pacote: nenhuma lacuna no escopo. | Os dois valores de jun/2026 e jul/2026 estão na gold e a variação mensal é derivável por fórmula declarada (Art. 1, item 1); a exclusão não é lacuna de dado, é escolha de escopo, e o texto oscila entre as duas coisas (declara ausência sem motivo e em seguida diz que não há lacuna). A leitura sobre pessoas jurídicas faz sua condição de refutação depender justamente do fato deixado de fora, o que o leitor desconfiado lê como seleção conveniente. | Incluir a variação mensal das concessões no pacote e apoiar ou refutar a leitura com ela; enquanto não estiver, dizer que é escolha de escopo, com motivo (Art. 3), em vez de tratar como lacuna e não lacuna na mesma linha.
ITEM leve: Isso indica menor folga das famílias para o serviço da dívida do que doze meses antes. | A conclusão se sustenta no comprometimento de renda e na inadimplência; a taxa média de juros das pessoas físicas é taxa das operações do mês, cuja queda de 1,97 p.p. no mês significa operações novas mais baratas em jul/2026 do que em jun/2026, e sua ligação com o serviço da dívida do estoque não é explicada. | Dizer o que a taxa mede e apoiar a leitura principalmente no comprometimento de renda e na inadimplência, mantendo a taxa como fato acessório.
DECISÃO: devolver


Devolva a nota revisada. data_base: 2026-07 · pacote_sha256: e0c39bc7981548688ac604396222743f446cc2869ef97af64d0a5f7a4335e36c
