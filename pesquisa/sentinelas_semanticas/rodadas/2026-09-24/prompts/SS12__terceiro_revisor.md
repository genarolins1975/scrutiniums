<!-- papel: terceiro_revisor -->
# SISTEMA

# Regras comuns aos revisores

Você é um revisor independente do Observatório Brasileiro de Crédito. Não existe revisão humana neste projeto: o seu parecer, junto com o de outros dois revisores que você não conhece, decide se a nota é publicada. A constituição anexa prevalece sobre qualquer outra instrução.

1. Você recebe só a nota final e a evidência indicada no seu papel. Não recebe rascunhos, raciocínio dos autores, objeções do crítico nem o parecer dos outros revisores. Não tente adivinhá-los.
2. Os números da nota já foram conferidos por código contra a gold. Você não aprova nem reprova número. Seu trabalho é o que o código não vê: definição, horizonte, atribuição, causalidade, seleção, omissão, tom e temas vedados.
3. Uma nota aprovada vai a público sem que nenhuma pessoa a leia antes. Na dúvida, devolva, com o motivo.
4. Responda só no formato abaixo, sem comentário fora dele:

    ITEM [grave|moderada|leve]: <trecho da nota> | <problema> | <o que resolveria>
    DECISÃO: aprovar | devolver

Sem nenhum problema, escreva apenas `DECISÃO: aprovar`. Qualquer item grave obriga `DECISÃO: devolver`.


# Papel: terceiro revisor (leitor cético)

Mandato: ler a nota como um leitor bem informado e desconfiado, que não confia em quem a escreveu. Pergunte, para cada parágrafo:

1. o que um leitor entenderia de errado ao ler isto, mesmo que cada número esteja certo;
2. que fato da série, visível no histórico que você recebe, contraria a leitura e foi omitido (sazonalidade, reversão recente, mês atípico);
3. se a nota escolheu o horizonte de tempo que favorece a própria conclusão;
4. se há juízo sobre instituição, recomendação, previsão ou tese nova disfarçada de leitura;
5. se algum tema vedado aparece, mesmo de forma indireta.

Evidência que você recebe: o histórico bruto das séries na gold (últimos meses, valor e variação em doze meses publicados pelo pipeline), sem a tabela de fatos pronta que os autores usaram. Você vê o dado de outro ângulo de propósito.


# Constituição editorial

# Constituição editorial do Observatório Brasileiro de Crédito

Versão 2, de 24/09/2026. Vale para todo agente, para o validador mecânico e para os revisores. Em conflito com qualquer outro documento, prevalece esta. Só o dono do projeto altera este texto, por PR próprio.

Por decisão do dono do projeto, nenhuma etapa deste projeto tem revisão humana. Quem cumpre o papel que seria de um editor é um conjunto de revisores independentes, todos agentes, somado a regras verificáveis por código. Onde a versão 1 pedia julgamento humano, esta versão proíbe o tema ou exige verificação mecânica.

## Art. 1. Números

1. Todo número publicado vem da camada gold determinística ou de um pacote de fatos derivado dela por fórmula declarada (diferença ou variação percentual entre dois valores da gold). Nenhum outro caminho.
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
5. A nota só é aprovada por unanimidade. Qualquer devolução volta à revisão; esgotado o limite de rodadas, a nota é rejeitada e não é publicada.
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

Histórico publicado na gold até 2026-07 (valores como estão na gold; yoy = variação em doze meses publicada pelo pipeline).

Saldo da carteira de crédito, total [R$ milhões; BCB/SGS 20539]
  2025-07: 6733209.0 (yoy 10.941)
  2025-08: 6774436.0 (yoy 10.417)
  2025-09: 6852705.0 (yoy 10.234)
  2025-10: 6923886.0 (yoy 10.339)
  2025-11: 7004223.0 (yoy 10.031)
  2025-12: 7137252.0 (yoy 10.405)
  2026-01: 7130762.0 (yoy 10.298)
  2026-02: 7157783.0 (yoy 9.926)
  2026-03: 7240557.0 (yoy 10.098)
  2026-04: 7259766.0 (yoy 9.599)
  2026-05: 7305306.0 (yoy 9.586)
  2026-06: 7353293.0 (yoy 9.691)
  2026-07: 7372243.0 (yoy 9.491)

Saldo da carteira de crédito, pessoas físicas [R$ milhões; BCB/SGS 20541]
  2025-07: 4188808.0 (yoy 11.825)
  2025-08: 4228171.0 (yoy 11.535)
  2025-09: 4262888.0 (yoy 11.253)
  2025-10: 4326256.0 (yoy 11.571)
  2025-11: 4387321.0 (yoy 11.646)
  2025-12: 4435517.0 (yoy 11.855)
  2026-01: 4476542.0 (yoy 11.549)
  2026-02: 4501299.0 (yoy 11.576)
  2026-03: 4553022.0 (yoy 11.643)
  2026-04: 4574368.0 (yoy 11.257)
  2026-05: 4597152.0 (yoy 11.215)
  2026-06: 4602668.0 (yoy 10.748)
  2026-07: 4640730.0 (yoy 10.789)

Saldo da carteira de crédito, pessoas jurídicas [R$ milhões; BCB/SGS 20540]
  2025-07: 2544400.0 (yoy 9.514)
  2025-08: 2546265.0 (yoy 8.611)
  2025-09: 2589817.0 (yoy 8.596)
  2025-10: 2597630.0 (yoy 8.346)
  2025-11: 2616902.0 (yoy 7.425)
  2025-12: 2701735.0 (yoy 8.105)
  2026-01: 2654220.0 (yoy 8.249)
  2026-02: 2656484.0 (yoy 7.239)
  2026-03: 2687535.0 (yoy 7.576)
  2026-04: 2685397.0 (yoy 6.885)
  2026-05: 2708154.0 (yoy 6.927)
  2026-06: 2750625.0 (yoy 7.965)
  2026-07: 2731513.0 (yoy 7.354)

Concessões de crédito no mês, total [R$ milhões; BCB/SGS 20631]
  2025-07: 649848.0 (yoy 4.755)
  2025-08: 643637.0 (yoy 2.645)
  2025-09: 700052.0 (yoy 9.529)
  2025-10: 691661.0 (yoy 6.518)
  2025-11: 652949.0 (yoy 5.265)
  2025-12: 804310.0 (yoy 14.996)
  2026-01: 649474.0 (yoy 9.728)
  2026-02: 610505.0 (yoy 3.306)
  2026-03: 742227.0 (yoy 19.623)
  2026-04: 692959.0 (yoy 7.507)
  2026-05: 701433.0 (yoy 8.206)
  2026-06: 748669.0 (yoy 16.761)
  2026-07: 736820.0 (yoy 13.383)

Concessões de crédito no mês, pessoas físicas [R$ milhões; BCB/SGS 20633]
  2025-07: 365381.0 (yoy 3.957)
  2025-08: 367634.0 (yoy 5.914)
  2025-09: 378569.0 (yoy 8.775)
  2025-10: 393377.0 (yoy 9.664)
  2025-11: 378650.0 (yoy 10.449)
  2025-12: 407588.0 (yoy 13.655)
  2026-01: 364450.0 (yoy 7.901)
  2026-02: 337956.0 (yoy 2.965)
  2026-03: 397284.0 (yoy 17.734)
  2026-04: 378710.0 (yoy 8.513)
  2026-05: 377057.0 (yoy 8.286)
  2026-06: 385986.0 (yoy 10.233)
  2026-07: 406405.0 (yoy 11.228)

Concessões de crédito no mês, pessoas jurídicas [R$ milhões; BCB/SGS 20632]
  2025-07: 284467.0 (yoy 5.799)
  2025-08: 276003.0 (yoy -1.408)
  2025-09: 321483.0 (yoy 10.431)
  2025-10: 298284.0 (yoy 2.634)
  2025-11: 274299.0 (yoy -1.141)
  2025-12: 396721.0 (yoy 16.406)
  2026-01: 285024.0 (yoy 12.156)
  2026-02: 272549.0 (yoy 3.733)
  2026-03: 344943.0 (yoy 21.874)
  2026-04: 314249.0 (yoy 6.319)
  2026-05: 324375.0 (yoy 8.113)
  2026-06: 362683.0 (yoy 24.616)
  2026-07: 330415.0 (yoy 16.152)

Taxa média de juros das operações de crédito, total [% a.a.; BCB/SGS 20714]
  2025-07: 31.75 (yoy 14.456)
  2025-08: 31.87 (yoy 15.513)
  2025-09: 31.47 (yoy 14.478)
  2025-10: 32.04 (yoy 14.674)
  2025-11: 32.2 (yoy 13.181)
  2025-12: 31.87 (yoy 11.825)
  2026-01: 32.45 (yoy 8.601)
  2026-02: 32.63 (yoy 6.878)
  2026-03: 32.84 (yoy 4.786)
  2026-04: 33.36 (yoy 5.469)
  2026-05: 33.1 (yoy 4.416)
  2026-06: 33.33 (yoy 4.647)
  2026-07: 32.08 (yoy 1.039)

Taxa média de juros, pessoas físicas [% a.a.; BCB/SGS 20716]
  2025-07: 36.41 (yoy 12.307)
  2025-08: 36.6 (yoy 13.948)
  2025-09: 36.5 (yoy 13.003)
  2025-10: 36.79 (yoy 13.549)
  2025-11: 37.89 (yoy 15.027)
  2025-12: 37.73 (yoy 14.091)
  2026-01: 38.03 (yoy 11.754)
  2026-02: 38.34 (yoy 8.52)
  2026-03: 38.45 (yoy 7.312)
  2026-04: 38.93 (yoy 6.921)
  2026-05: 38.74 (yoy 5.76)
  2026-06: 39.38 (yoy 6.895)
  2026-07: 37.41 (yoy 2.746)

Taxa média de juros, pessoas jurídicas [% a.a.; BCB/SGS 20715]
  2025-07: 21.59 (yoy 19.084)
  2025-08: 21.5 (yoy 18.588)
  2025-09: 20.55 (yoy 17.765)
  2025-10: 21.66 (yoy 16.202)
  2025-11: 20.43 (yoy 7.3)
  2025-12: 19.9 (yoy 4.462)
  2026-01: 20.99 (yoy -0.897)
  2026-02: 20.79 (yoy 1.514)
  2026-03: 21.12 (yoy -3.164)
  2026-04: 21.72 (yoy 1.07)
  2026-05: 21.24 (yoy 1.191)
  2026-06: 20.73 (yoy -1.567)
  2026-07: 20.97 (yoy -2.872)

Spread médio das operações de crédito, total [p.p.; BCB/SGS 20783]
  2025-07: 20.57 (yoy 11.009)
  2025-08: 20.77 (yoy 12.514)
  2025-09: 20.53 (yoy 12.309)
  2025-10: 20.9 (yoy 14.333)
  2025-11: 21.23 (yoy 15.193)
  2025-12: 20.87 (yoy 18.445)
  2026-01: 21.42 (yoy 15.784)
  2026-02: 21.81 (yoy 11.732)
  2026-03: 21.54 (yoy 10.179)
  2026-04: 22.07 (yoy 9.257)
  2026-05: 21.77 (yoy 6.143)
  2026-06: 21.86 (yoy 5.4)
  2026-07: 20.88 (yoy 1.507)

Spread médio, pessoas físicas [p.p.; BCB/SGS 20785]
  2025-07: 25.69 (yoy 8.626)
  2025-08: 25.98 (yoy 10.6)
  2025-09: 25.93 (yoy 10.481)
  2025-10: 26.2 (yoy 12.737)
  2025-11: 27.4 (yoy 16.398)
  2025-12: 27.25 (yoy 19.675)
  2026-01: 27.52 (yoy 18.723)
  2026-02: 28.07 (yoy 12.731)
  2026-03: 27.81 (yoy 11.732)
  2026-04: 28.41 (yoy 10.545)
  2026-05: 28.08 (yoy 7.958)
  2026-06: 28.52 (yoy 8.689)
  2026-07: 26.65 (yoy 3.737)

Spread médio, pessoas jurídicas [p.p.; BCB/SGS 20784]
  2025-07: 9.4 (yoy 17.207)
  2025-08: 9.33 (yoy 17.211)
  2025-09: 8.8 (yoy 18.28)
  2025-10: 9.32 (yoy 17.38)
  2025-11: 8.48 (yoy 9.702)
  2025-12: 7.85 (yoy 12.626)
  2026-01: 8.87 (yoy 1.954)
  2026-02: 8.81 (yoy 6.788)
  2026-03: 8.45 (yoy 2.673)
  2026-04: 8.84 (yoy 3.634)
  2026-05: 8.49 (yoy -0.702)
  2026-06: 7.99 (yoy -9.615)
  2026-07: 8.87 (yoy -5.638)

Inadimplência acima de 90 dias, total [%; BCB/SGS 21082]
  2025-07: 3.96 (yoy 20.0)
  2025-08: 4.14 (yoy 24.324)
  2025-09: 4.09 (yoy 22.455)
  2025-10: 4.18 (yoy 26.667)
  2025-11: 4.24 (yoy 29.664)
  2025-12: 4.2 (yoy 36.364)
  2026-01: 4.44 (yoy 32.934)
  2026-02: 4.64 (yoy 36.07)
  2026-03: 4.52 (yoy 31.395)
  2026-04: 4.64 (yoy 26.431)
  2026-05: 4.74 (yoy 27.419)
  2026-06: 4.58 (yoy 22.133)
  2026-07: 4.88 (yoy 23.232)

Inadimplência acima de 90 dias, pessoas físicas [%; BCB/SGS 21084]
  2025-07: 4.66 (yoy 23.28)
  2025-08: 4.92 (yoy 28.796)
  2025-09: 4.89 (yoy 27.676)
  2025-10: 4.99 (yoy 31.662)
  2025-11: 5.12 (yoy 36.533)
  2025-12: 5.12 (yoy 41.047)
  2026-01: 5.38 (yoy 38.303)
  2026-02: 5.56 (yoy 40.404)
  2026-03: 5.39 (yoy 33.747)
  2026-04: 5.51 (yoy 29.647)
  2026-05: 5.62 (yoy 28.899)
  2026-06: 5.42 (yoy 22.902)
  2026-07: 5.81 (yoy 24.678)

Inadimplência acima de 90 dias, pessoas jurídicas [%; BCB/SGS 21083]
  2025-07: 2.79 (yoy 10.714)
  2025-08: 2.85 (yoy 11.765)
  2025-09: 2.77 (yoy 8.203)
  2025-10: 2.82 (yoy 11.905)
  2025-11: 2.75 (yoy 10.0)
  2025-12: 2.7 (yoy 22.172)
  2026-01: 2.87 (yoy 18.107)
  2026-02: 3.07 (yoy 21.825)
  2026-03: 3.06 (yoy 22.892)
  2026-04: 3.15 (yoy 15.809)
  2026-05: 3.25 (yoy 21.723)
  2026-06: 3.18 (yoy 19.101)
  2026-07: 3.31 (yoy 18.638)

Saldo da carteira de crédito em relação ao PIB [%; BCB/SGS 20622]
  2025-07: 54.38 (yoy 2.43)
  2025-08: 54.45 (yoy 2.081)
  2025-09: 54.71 (yoy 1.919)
  2025-10: 55.0 (yoy 2.307)
  2025-11: 55.35 (yoy 1.99)
  2025-12: 56.03 (yoy 2.095)
  2026-01: 55.67 (yoy 1.997)
  2026-02: 55.64 (yoy 1.998)
  2026-03: 55.85 (yoy 2.233)
  2026-04: 55.68 (yoy 1.997)
  2026-05: 55.74 (yoy 2.256)
  2026-06: 55.75 (yoy 2.331)
  2026-07: 55.6 (yoy 2.243)

Endividamento das famílias com o SFN em relação à renda de 12 meses [%; BCB/SGS 29037]
  2025-06: 48.82 (yoy 2.348)
  2025-07: 48.78 (yoy 1.773)
  2025-08: 48.93 (yoy 1.641)
  2025-09: 49.11 (yoy 2.015)
  2025-10: 49.46 (yoy 2.635)
  2025-11: 49.63 (yoy 2.69)
  2025-12: 49.7 (yoy 2.58)
  2026-01: 49.92 (yoy 2.632)
  2026-02: 49.81 (yoy 2.49)
  2026-03: 49.85 (yoy 2.005)
  2026-04: 49.88 (yoy 1.942)
  2026-05: 49.83 (yoy 1.964)
  2026-06: 49.75 (yoy 1.905)

Comprometimento de renda das famílias com o serviço da dívida [%; BCB/SGS 29034]
  2025-06: 27.17 (yoy 2.995)
  2025-07: 27.32 (yoy 2.978)
  2025-08: 27.55 (yoy 3.068)
  2025-09: 27.77 (yoy 4.832)
  2025-10: 27.92 (yoy 5.798)
  2025-11: 27.89 (yoy 5.684)
  2025-12: 28.09 (yoy 4.813)
  2026-01: 28.23 (yoy 5.691)
  2026-02: 28.27 (yoy 5.289)
  2026-03: 28.24 (yoy 4.748)
  2026-04: 28.38 (yoy 4.646)
  2026-05: 28.49 (yoy 4.781)
  2026-06: 28.85 (yoy 6.183)

Nota final:

# Conjuntura do crédito, jul/2026

*Evidência.* O saldo da carteira de crédito do sistema financeiro chegou a R$ 7,37 trilhões em jul/2026, com alta de 9,5% em doze meses em termos nominais e de 4,8% descontada a inflação. No mês, a carteira das pessoas físicas teve alta de 0,8%, e a das pessoas jurídicas, queda de 0,7%.

*Evidência.* As concessões somaram R$ 736,8 bilhões no mês, com alta de 13,4% sobre o mesmo mês do ano anterior; nas pessoas jurídicas, alta de 16,2%, e nas pessoas físicas, alta de 11,2%.

*Evidência.* A taxa média de juros das operações de crédito ficou em 32,08% a.a., com queda de 1,25 p.p. no mês. O spread médio ficou em 20,88 p.p., com queda de 0,98 p.p.

*Evidência.* A inadimplência acima de noventa dias subiu para 4,88%, alta de 0,92 p.p. no mês e de 0,30 p.p. em doze meses. Nas pessoas físicas, a inadimplência ficou em 5,81%; nas pessoas jurídicas, em 3,31%.

*Evidência.* O endividamento das famílias com o sistema financeiro foi de 49,75% da renda acumulada em doze meses em jun/2026, e o comprometimento de renda com o serviço da dívida, de 28,85% em jun/2026.

*Inferência.* A alta da inadimplência em jul/2026 ocorreu com a queda da taxa média de juros no mês (−1,25 p.p.), o que sugere que a piora da qualidade da carteira não veio do custo do crédito no período. Refutaria esta leitura: revisão da inadimplência na próxima divulgação do BCB, ou alta da taxa média nas modalidades de maior peso.

## Fontes dos números

| Fato | Valor | Data de referência | Fonte |
|---|---|---|---|
| Saldo da carteira de crédito, total | R$ 7,37 trilhões | jul/2026 | BCB/SGS 20539 |
| Saldo da carteira de crédito, total: variação em 12 meses, nominal | +9,5% | jul/2026 | BCB/SGS 20539 |
| Saldo da carteira de crédito, total: variação em 12 meses, real (IPCA) | +4,8% | jul/2026 | BCB/SGS 20539 |
| Saldo da carteira de crédito, pessoas físicas: variação no mês | +0,8% | jul/2026 | BCB/SGS 20541 |
| Saldo da carteira de crédito, pessoas jurídicas: variação no mês | −0,7% | jul/2026 | BCB/SGS 20540 |
| Concessões de crédito no mês, total | R$ 736,8 bilhões | jul/2026 | BCB/SGS 20631 |
| Concessões de crédito no mês, total: variação em 12 meses, nominal | +13,4% | jul/2026 | BCB/SGS 20631 |
| Concessões de crédito no mês, pessoas jurídicas: variação em 12 meses, nominal | +16,2% | jul/2026 | BCB/SGS 20632 |
| Concessões de crédito no mês, pessoas físicas: variação em 12 meses, nominal | +11,2% | jul/2026 | BCB/SGS 20633 |
| Taxa média de juros das operações de crédito, total | 32,08% a.a. | jul/2026 | BCB/SGS 20714 |
| Taxa média de juros das operações de crédito, total: diferença no mês | −1,25 p.p. | jul/2026 | BCB/SGS 20714 |
| Spread médio das operações de crédito, total | 20,88 p.p. | jul/2026 | BCB/SGS 20783 |
| Spread médio das operações de crédito, total: diferença no mês | −0,98 p.p. | jul/2026 | BCB/SGS 20783 |
| Inadimplência acima de 90 dias, total | 4,88% | jul/2026 | BCB/SGS 21082 |
| Inadimplência acima de 90 dias, total: diferença no mês | +0,30 p.p. | jul/2026 | BCB/SGS 21082 |
| Inadimplência acima de 90 dias, total: diferença em 12 meses | +0,92 p.p. | jul/2026 | BCB/SGS 21082 |
| Inadimplência acima de 90 dias, pessoas físicas | 5,81% | jul/2026 | BCB/SGS 21084 |
| Inadimplência acima de 90 dias, pessoas jurídicas | 3,31% | jul/2026 | BCB/SGS 21083 |
| Endividamento das famílias com o SFN em relação à renda de 12 meses | 49,75% | jun/2026 | BCB/SGS 29037 |
| Comprometimento de renda das famílias com o serviço da dívida | 28,85% | jun/2026 | BCB/SGS 29034 |

Os dados do BCB são revisados nas divulgações seguintes; os números desta nota valem para a gold identificada no pacote de reprodutibilidade.

Pacote de fatos `22a616c90b1aa5b5`, data base jul/2026. Verificação: `python3 -m pesquisa.fatos_conjuntura --verificar pacote.json`.

