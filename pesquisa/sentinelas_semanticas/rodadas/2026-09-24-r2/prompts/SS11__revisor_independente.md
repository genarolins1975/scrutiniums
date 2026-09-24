<!-- papel: revisor_independente -->
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


# Papel: revisor independente (fidelidade)

Mandato: fidelidade da nota à evidência. Leia cada frase da nota e confira contra a tabela de fatos:

1. a definição de cada série está correta (o que a série mede, sobre qual base, com qual referência de tempo);
2. o horizonte de cada variação está correto (no mês, em doze meses, nominal ou real) e não foi trocado;
3. cada fato está atribuído ao segmento certo (famílias, empresas, total);
4. nenhuma frase afirma mais do que os fatos citados mostram;
5. nenhuma inferência vira causalidade sem fato que a sustente.

Evidência que você recebe: a tabela de fatos do pacote, com rótulo, valor, sinal e data de referência de cada fato.


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

Fatos do pacote (JSON):

{
 "data_base": "2026-07",
 "lacunas": [],
 "defasagens": [
  {
   "serie": "endividamento",
   "data_ref": "2026-06",
   "data_base": "2026-07",
   "nota": "divulgação com defasagem própria; citar com a data de referência do fato"
  },
  {
   "serie": "comprometimento",
   "data_ref": "2026-06",
   "data_base": "2026-07",
   "nota": "divulgação com defasagem própria; citar com a data de referência do fato"
  }
 ],
 "fatos": [
  {
   "id": "saldo_total.nivel",
   "rotulo": "Saldo da carteira de crédito, total",
   "tipo": "observado",
   "valor": 7372243.0,
   "unidade": "R$ milhões",
   "texto": "R$ 7,37 trilhões",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20539",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "saldo_total",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "saldo_total.var_mes_pct",
   "rotulo": "Saldo da carteira de crédito, total: variação no mês",
   "tipo": "calculado_pacote",
   "valor": 0.257708,
   "unidade": "%",
   "texto": "+0,3%",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20539",
   "formula": "variacao_pct",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "saldo_total",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "saldo_total",
     "campo": "obs",
     "ref": "2026-06-01"
    }
   ]
  },
  {
   "id": "saldo_total.var_12m_pct",
   "rotulo": "Saldo da carteira de crédito, total: variação em 12 meses, nominal",
   "tipo": "calculado_pipeline",
   "valor": 9.491,
   "unidade": "%",
   "texto": "+9,5%",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20539",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "saldo_total",
    "campo": "yoy",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "saldo_total.var_12m_real_pct",
   "rotulo": "Saldo da carteira de crédito, total: variação em 12 meses, real (IPCA)",
   "tipo": "calculado_pipeline",
   "valor": 4.833,
   "unidade": "%",
   "texto": "+4,8%",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20539 deflacionada pelo IPCA acumulado em 12 meses (IBGE via BCB/SGS 433)",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "saldo_total",
    "campo": "yoy_real",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "saldo_pf.nivel",
   "rotulo": "Saldo da carteira de crédito, pessoas físicas",
   "tipo": "observado",
   "valor": 4640730.0,
   "unidade": "R$ milhões",
   "texto": "R$ 4,64 trilhões",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20541",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "saldo_pf",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "saldo_pf.var_mes_pct",
   "rotulo": "Saldo da carteira de crédito, pessoas físicas: variação no mês",
   "tipo": "calculado_pacote",
   "valor": 0.826955,
   "unidade": "%",
   "texto": "+0,8%",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20541",
   "formula": "variacao_pct",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "saldo_pf",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "saldo_pf",
     "campo": "obs",
     "ref": "2026-06-01"
    }
   ]
  },
  {
   "id": "saldo_pf.var_12m_pct",
   "rotulo": "Saldo da carteira de crédito, pessoas físicas: variação em 12 meses, nominal",
   "tipo": "calculado_pipeline",
   "valor": 10.789,
   "unidade": "%",
   "texto": "+10,8%",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20541",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "saldo_pf",
    "campo": "yoy",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "saldo_pf.var_12m_real_pct",
   "rotulo": "Saldo da carteira de crédito, pessoas físicas: variação em 12 meses, real (IPCA)",
   "tipo": "calculado_pipeline",
   "valor": 6.076,
   "unidade": "%",
   "texto": "+6,1%",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20541 deflacionada pelo IPCA acumulado em 12 meses (IBGE via BCB/SGS 433)",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "saldo_pf",
    "campo": "yoy_real",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "saldo_pj.nivel",
   "rotulo": "Saldo da carteira de crédito, pessoas jurídicas",
   "tipo": "observado",
   "valor": 2731513.0,
   "unidade": "R$ milhões",
   "texto": "R$ 2,73 trilhões",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20540",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "saldo_pj",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "saldo_pj.var_mes_pct",
   "rotulo": "Saldo da carteira de crédito, pessoas jurídicas: variação no mês",
   "tipo": "calculado_pacote",
   "valor": -0.694824,
   "unidade": "%",
   "texto": "−0,7%",
   "sinal": "−",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20540",
   "formula": "variacao_pct",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "saldo_pj",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "saldo_pj",
     "campo": "obs",
     "ref": "2026-06-01"
    }
   ]
  },
  {
   "id": "saldo_pj.var_12m_pct",
   "rotulo": "Saldo da carteira de crédito, pessoas jurídicas: variação em 12 meses, nominal",
   "tipo": "calculado_pipeline",
   "valor": 7.354,
   "unidade": "%",
   "texto": "+7,4%",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20540",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "saldo_pj",
    "campo": "yoy",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "saldo_pj.var_12m_real_pct",
   "rotulo": "Saldo da carteira de crédito, pessoas jurídicas: variação em 12 meses, real (IPCA)",
   "tipo": "calculado_pipeline",
   "valor": 2.787,
   "unidade": "%",
   "texto": "+2,8%",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20540 deflacionada pelo IPCA acumulado em 12 meses (IBGE via BCB/SGS 433)",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "saldo_pj",
    "campo": "yoy_real",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "concessoes_total.nivel",
   "rotulo": "Concessões de crédito no mês, total",
   "tipo": "observado",
   "valor": 736820.0,
   "unidade": "R$ milhões",
   "texto": "R$ 736,8 bilhões",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20631",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "concessoes_total",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "concessoes_total.var_12m_pct",
   "rotulo": "Concessões de crédito no mês, total: variação em 12 meses, nominal",
   "tipo": "calculado_pipeline",
   "valor": 13.383,
   "unidade": "%",
   "texto": "+13,4%",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20631",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "concessoes_total",
    "campo": "yoy",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "concessoes_total.var_12m_real_pct",
   "rotulo": "Concessões de crédito no mês, total: variação em 12 meses, real (IPCA)",
   "tipo": "calculado_pipeline",
   "valor": 8.56,
   "unidade": "%",
   "texto": "+8,6%",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20631 deflacionada pelo IPCA acumulado em 12 meses (IBGE via BCB/SGS 433)",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "concessoes_total",
    "campo": "yoy_real",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "concessoes_pf.nivel",
   "rotulo": "Concessões de crédito no mês, pessoas físicas",
   "tipo": "observado",
   "valor": 406405.0,
   "unidade": "R$ milhões",
   "texto": "R$ 406,4 bilhões",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20633",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "concessoes_pf",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "concessoes_pf.var_12m_pct",
   "rotulo": "Concessões de crédito no mês, pessoas físicas: variação em 12 meses, nominal",
   "tipo": "calculado_pipeline",
   "valor": 11.228,
   "unidade": "%",
   "texto": "+11,2%",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20633",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "concessoes_pf",
    "campo": "yoy",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "concessoes_pf.var_12m_real_pct",
   "rotulo": "Concessões de crédito no mês, pessoas físicas: variação em 12 meses, real (IPCA)",
   "tipo": "calculado_pipeline",
   "valor": 6.496,
   "unidade": "%",
   "texto": "+6,5%",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20633 deflacionada pelo IPCA acumulado em 12 meses (IBGE via BCB/SGS 433)",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "concessoes_pf",
    "campo": "yoy_real",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "concessoes_pj.nivel",
   "rotulo": "Concessões de crédito no mês, pessoas jurídicas",
   "tipo": "observado",
   "valor": 330415.0,
   "unidade": "R$ milhões",
   "texto": "R$ 330,4 bilhões",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20632",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "concessoes_pj",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "concessoes_pj.var_12m_pct",
   "rotulo": "Concessões de crédito no mês, pessoas jurídicas: variação em 12 meses, nominal",
   "tipo": "calculado_pipeline",
   "valor": 16.152,
   "unidade": "%",
   "texto": "+16,2%",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20632",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "concessoes_pj",
    "campo": "yoy",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "concessoes_pj.var_12m_real_pct",
   "rotulo": "Concessões de crédito no mês, pessoas jurídicas: variação em 12 meses, real (IPCA)",
   "tipo": "calculado_pipeline",
   "valor": 11.211,
   "unidade": "%",
   "texto": "+11,2%",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20632 deflacionada pelo IPCA acumulado em 12 meses (IBGE via BCB/SGS 433)",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "concessoes_pj",
    "campo": "yoy_real",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "taxa_total.nivel",
   "rotulo": "Taxa média de juros das operações de crédito, total",
   "tipo": "observado",
   "valor": 32.08,
   "unidade": "% a.a.",
   "texto": "32,08% a.a.",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20714",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "taxa_total",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "taxa_total.delta_mes_pp",
   "rotulo": "Taxa média de juros das operações de crédito, total: diferença no mês",
   "tipo": "calculado_pacote",
   "valor": -1.25,
   "unidade": "p.p.",
   "texto": "−1,25 p.p.",
   "sinal": "−",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20714",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "taxa_total",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "taxa_total",
     "campo": "obs",
     "ref": "2026-06-01"
    }
   ]
  },
  {
   "id": "taxa_total.delta_12m_pp",
   "rotulo": "Taxa média de juros das operações de crédito, total: diferença em 12 meses",
   "tipo": "calculado_pacote",
   "valor": 0.33,
   "unidade": "p.p.",
   "texto": "+0,33 p.p.",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20714",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "taxa_total",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "taxa_total",
     "campo": "obs",
     "ref": "2025-07-01"
    }
   ]
  },
  {
   "id": "taxa_pf.nivel",
   "rotulo": "Taxa média de juros, pessoas físicas",
   "tipo": "observado",
   "valor": 37.41,
   "unidade": "% a.a.",
   "texto": "37,41% a.a.",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20716",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "taxa_pf",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "taxa_pf.delta_mes_pp",
   "rotulo": "Taxa média de juros, pessoas físicas: diferença no mês",
   "tipo": "calculado_pacote",
   "valor": -1.97,
   "unidade": "p.p.",
   "texto": "−1,97 p.p.",
   "sinal": "−",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20716",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "taxa_pf",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "taxa_pf",
     "campo": "obs",
     "ref": "2026-06-01"
    }
   ]
  },
  {
   "id": "taxa_pf.delta_12m_pp",
   "rotulo": "Taxa média de juros, pessoas físicas: diferença em 12 meses",
   "tipo": "calculado_pacote",
   "valor": 1.0,
   "unidade": "p.p.",
   "texto": "+1,00 p.p.",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20716",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "taxa_pf",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "taxa_pf",
     "campo": "obs",
     "ref": "2025-07-01"
    }
   ]
  },
  {
   "id": "taxa_pj.nivel",
   "rotulo": "Taxa média de juros, pessoas jurídicas",
   "tipo": "observado",
   "valor": 20.97,
   "unidade": "% a.a.",
   "texto": "20,97% a.a.",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20715",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "taxa_pj",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "taxa_pj.delta_mes_pp",
   "rotulo": "Taxa média de juros, pessoas jurídicas: diferença no mês",
   "tipo": "calculado_pacote",
   "valor": 0.24,
   "unidade": "p.p.",
   "texto": "+0,24 p.p.",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20715",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "taxa_pj",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "taxa_pj",
     "campo": "obs",
     "ref": "2026-06-01"
    }
   ]
  },
  {
   "id": "taxa_pj.delta_12m_pp",
   "rotulo": "Taxa média de juros, pessoas jurídicas: diferença em 12 meses",
   "tipo": "calculado_pacote",
   "valor": -0.62,
   "unidade": "p.p.",
   "texto": "−0,62 p.p.",
   "sinal": "−",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20715",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "taxa_pj",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "taxa_pj",
     "campo": "obs",
     "ref": "2025-07-01"
    }
   ]
  },
  {
   "id": "spread_total.nivel",
   "rotulo": "Spread médio das operações de crédito, total",
   "tipo": "observado",
   "valor": 20.88,
   "unidade": "p.p.",
   "texto": "20,88 p.p.",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20783",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "spread_total",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "spread_total.delta_mes_pp",
   "rotulo": "Spread médio das operações de crédito, total: diferença no mês",
   "tipo": "calculado_pacote",
   "valor": -0.98,
   "unidade": "p.p.",
   "texto": "−0,98 p.p.",
   "sinal": "−",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20783",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "spread_total",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "spread_total",
     "campo": "obs",
     "ref": "2026-06-01"
    }
   ]
  },
  {
   "id": "spread_total.delta_12m_pp",
   "rotulo": "Spread médio das operações de crédito, total: diferença em 12 meses",
   "tipo": "calculado_pacote",
   "valor": 0.31,
   "unidade": "p.p.",
   "texto": "+0,31 p.p.",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20783",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "spread_total",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "spread_total",
     "campo": "obs",
     "ref": "2025-07-01"
    }
   ]
  },
  {
   "id": "spread_pf.nivel",
   "rotulo": "Spread médio, pessoas físicas",
   "tipo": "observado",
   "valor": 26.65,
   "unidade": "p.p.",
   "texto": "26,65 p.p.",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20785",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "spread_pf",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "spread_pf.delta_mes_pp",
   "rotulo": "Spread médio, pessoas físicas: diferença no mês",
   "tipo": "calculado_pacote",
   "valor": -1.87,
   "unidade": "p.p.",
   "texto": "−1,87 p.p.",
   "sinal": "−",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20785",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "spread_pf",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "spread_pf",
     "campo": "obs",
     "ref": "2026-06-01"
    }
   ]
  },
  {
   "id": "spread_pf.delta_12m_pp",
   "rotulo": "Spread médio, pessoas físicas: diferença em 12 meses",
   "tipo": "calculado_pacote",
   "valor": 0.96,
   "unidade": "p.p.",
   "texto": "+0,96 p.p.",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20785",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "spread_pf",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "spread_pf",
     "campo": "obs",
     "ref": "2025-07-01"
    }
   ]
  },
  {
   "id": "spread_pj.nivel",
   "rotulo": "Spread médio, pessoas jurídicas",
   "tipo": "observado",
   "valor": 8.87,
   "unidade": "p.p.",
   "texto": "8,87 p.p.",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20784",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "spread_pj",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "spread_pj.delta_mes_pp",
   "rotulo": "Spread médio, pessoas jurídicas: diferença no mês",
   "tipo": "calculado_pacote",
   "valor": 0.88,
   "unidade": "p.p.",
   "texto": "+0,88 p.p.",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20784",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "spread_pj",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "spread_pj",
     "campo": "obs",
     "ref": "2026-06-01"
    }
   ]
  },
  {
   "id": "spread_pj.delta_12m_pp",
   "rotulo": "Spread médio, pessoas jurídicas: diferença em 12 meses",
   "tipo": "calculado_pacote",
   "valor": -0.53,
   "unidade": "p.p.",
   "texto": "−0,53 p.p.",
   "sinal": "−",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20784",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "spread_pj",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "spread_pj",
     "campo": "obs",
     "ref": "2025-07-01"
    }
   ]
  },
  {
   "id": "inad_total.nivel",
   "rotulo": "Inadimplência acima de 90 dias, total",
   "tipo": "observado",
   "valor": 4.88,
   "unidade": "%",
   "texto": "4,88%",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 21082",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "inad_total",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "inad_total.delta_mes_pp",
   "rotulo": "Inadimplência acima de 90 dias, total: diferença no mês",
   "tipo": "calculado_pacote",
   "valor": 0.3,
   "unidade": "p.p.",
   "texto": "+0,30 p.p.",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 21082",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "inad_total",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "inad_total",
     "campo": "obs",
     "ref": "2026-06-01"
    }
   ]
  },
  {
   "id": "inad_total.delta_12m_pp",
   "rotulo": "Inadimplência acima de 90 dias, total: diferença em 12 meses",
   "tipo": "calculado_pacote",
   "valor": 0.92,
   "unidade": "p.p.",
   "texto": "+0,92 p.p.",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 21082",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "inad_total",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "inad_total",
     "campo": "obs",
     "ref": "2025-07-01"
    }
   ]
  },
  {
   "id": "inad_pf.nivel",
   "rotulo": "Inadimplência acima de 90 dias, pessoas físicas",
   "tipo": "observado",
   "valor": 5.81,
   "unidade": "%",
   "texto": "5,81%",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 21084",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "inad_pf",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "inad_pf.delta_mes_pp",
   "rotulo": "Inadimplência acima de 90 dias, pessoas físicas: diferença no mês",
   "tipo": "calculado_pacote",
   "valor": 0.39,
   "unidade": "p.p.",
   "texto": "+0,39 p.p.",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 21084",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "inad_pf",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "inad_pf",
     "campo": "obs",
     "ref": "2026-06-01"
    }
   ]
  },
  {
   "id": "inad_pf.delta_12m_pp",
   "rotulo": "Inadimplência acima de 90 dias, pessoas físicas: diferença em 12 meses",
   "tipo": "calculado_pacote",
   "valor": 1.15,
   "unidade": "p.p.",
   "texto": "+1,15 p.p.",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 21084",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "inad_pf",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "inad_pf",
     "campo": "obs",
     "ref": "2025-07-01"
    }
   ]
  },
  {
   "id": "inad_pj.nivel",
   "rotulo": "Inadimplência acima de 90 dias, pessoas jurídicas",
   "tipo": "observado",
   "valor": 3.31,
   "unidade": "%",
   "texto": "3,31%",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 21083",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "inad_pj",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "inad_pj.delta_mes_pp",
   "rotulo": "Inadimplência acima de 90 dias, pessoas jurídicas: diferença no mês",
   "tipo": "calculado_pacote",
   "valor": 0.13,
   "unidade": "p.p.",
   "texto": "+0,13 p.p.",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 21083",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "inad_pj",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "inad_pj",
     "campo": "obs",
     "ref": "2026-06-01"
    }
   ]
  },
  {
   "id": "inad_pj.delta_12m_pp",
   "rotulo": "Inadimplência acima de 90 dias, pessoas jurídicas: diferença em 12 meses",
   "tipo": "calculado_pacote",
   "valor": 0.52,
   "unidade": "p.p.",
   "texto": "+0,52 p.p.",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 21083",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "inad_pj",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "inad_pj",
     "campo": "obs",
     "ref": "2025-07-01"
    }
   ]
  },
  {
   "id": "credito_pib.nivel",
   "rotulo": "Saldo da carteira de crédito em relação ao PIB",
   "tipo": "observado",
   "valor": 55.6,
   "unidade": "%",
   "texto": "55,60%",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20622",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "credito_pib",
    "campo": "obs",
    "ref": "2026-07-01"
   }
  },
  {
   "id": "credito_pib.delta_mes_pp",
   "rotulo": "Saldo da carteira de crédito em relação ao PIB: diferença no mês",
   "tipo": "calculado_pacote",
   "valor": -0.15,
   "unidade": "p.p.",
   "texto": "−0,15 p.p.",
   "sinal": "−",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20622",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "credito_pib",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "credito_pib",
     "campo": "obs",
     "ref": "2026-06-01"
    }
   ]
  },
  {
   "id": "credito_pib.delta_12m_pp",
   "rotulo": "Saldo da carteira de crédito em relação ao PIB: diferença em 12 meses",
   "tipo": "calculado_pacote",
   "valor": 1.22,
   "unidade": "p.p.",
   "texto": "+1,22 p.p.",
   "sinal": "+",
   "data_ref": "2026-07",
   "fonte": "BCB/SGS 20622",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "credito_pib",
     "campo": "obs",
     "ref": "2026-07-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "credito_pib",
     "campo": "obs",
     "ref": "2025-07-01"
    }
   ]
  },
  {
   "id": "endividamento.nivel",
   "rotulo": "Endividamento das famílias com o SFN em relação à renda de 12 meses",
   "tipo": "observado",
   "valor": 49.75,
   "unidade": "%",
   "texto": "49,75%",
   "data_ref": "2026-06",
   "fonte": "BCB/SGS 29037",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "endividamento",
    "campo": "obs",
    "ref": "2026-06-01"
   }
  },
  {
   "id": "endividamento.delta_mes_pp",
   "rotulo": "Endividamento das famílias com o SFN em relação à renda de 12 meses: diferença no mês",
   "tipo": "calculado_pacote",
   "valor": -0.08,
   "unidade": "p.p.",
   "texto": "−0,08 p.p.",
   "sinal": "−",
   "data_ref": "2026-06",
   "fonte": "BCB/SGS 29037",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "endividamento",
     "campo": "obs",
     "ref": "2026-06-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "endividamento",
     "campo": "obs",
     "ref": "2026-05-01"
    }
   ]
  },
  {
   "id": "endividamento.delta_12m_pp",
   "rotulo": "Endividamento das famílias com o SFN em relação à renda de 12 meses: diferença em 12 meses",
   "tipo": "calculado_pacote",
   "valor": 0.93,
   "unidade": "p.p.",
   "texto": "+0,93 p.p.",
   "sinal": "+",
   "data_ref": "2026-06",
   "fonte": "BCB/SGS 29037",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "endividamento",
     "campo": "obs",
     "ref": "2026-06-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "endividamento",
     "campo": "obs",
     "ref": "2025-06-01"
    }
   ]
  },
  {
   "id": "comprometimento.nivel",
   "rotulo": "Comprometimento de renda das famílias com o serviço da dívida",
   "tipo": "observado",
   "valor": 28.85,
   "unidade": "%",
   "texto": "28,85%",
   "data_ref": "2026-06",
   "fonte": "BCB/SGS 29034",
   "origem": {
    "arquivo": "pulse.json",
    "serie": "comprometimento",
    "campo": "obs",
    "ref": "2026-06-01"
   }
  },
  {
   "id": "comprometimento.delta_mes_pp",
   "rotulo": "Comprometimento de renda das famílias com o serviço da dívida: diferença no mês",
   "tipo": "calculado_pacote",
   "valor": 0.36,
   "unidade": "p.p.",
   "texto": "+0,36 p.p.",
   "sinal": "+",
   "data_ref": "2026-06",
   "fonte": "BCB/SGS 29034",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "comprometimento",
     "campo": "obs",
     "ref": "2026-06-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "comprometimento",
     "campo": "obs",
     "ref": "2026-05-01"
    }
   ]
  },
  {
   "id": "comprometimento.delta_12m_pp",
   "rotulo": "Comprometimento de renda das famílias com o serviço da dívida: diferença em 12 meses",
   "tipo": "calculado_pacote",
   "valor": 1.68,
   "unidade": "p.p.",
   "texto": "+1,68 p.p.",
   "sinal": "+",
   "data_ref": "2026-06",
   "fonte": "BCB/SGS 29034",
   "formula": "diferenca",
   "insumos": [
    {
     "arquivo": "pulse.json",
     "serie": "comprometimento",
     "campo": "obs",
     "ref": "2026-06-01"
    },
    {
     "arquivo": "pulse.json",
     "serie": "comprometimento",
     "campo": "obs",
     "ref": "2025-06-01"
    }
   ]
  }
 ]
}

Nota final:

# Conjuntura do crédito, jul/2026

*Evidência.* O saldo da carteira de crédito do sistema financeiro chegou a R$ 7,37 trilhões em jul/2026, com alta de 9,5% em doze meses em termos nominais e de 4,8% descontada a inflação medida pelo IPCA. Em doze meses, em termos nominais, a carteira das pessoas físicas teve alta de 10,8%, e a das pessoas jurídicas, alta de 7,4%. A carteira de crédito no mês mostra padrão misto de comportamento entre segmentos.

*Evidência.* As concessões somaram R$ 736,8 bilhões no mês, com alta de 13,4% sobre o mesmo mês do ano anterior; nas pessoas jurídicas, alta de 16,2%, e nas pessoas físicas, alta de 11,2%.

*Evidência.* A taxa média de juros das operações de crédito ficou em 32,08% a.a., com queda de 1,25 p.p. no mês e alta de 0,33 p.p. em doze meses. No mês, nas pessoas físicas a taxa teve queda de 1,97 p.p.; nas pessoas jurídicas, alta de 0,24 p.p. O spread médio ficou em 20,88 p.p., com queda de 0,98 p.p. no mês e alta de 0,31 p.p. em doze meses.

*Evidência.* A inadimplência acima de noventa dias ficou em 4,88%, alta de 0,92 p.p. em doze meses e de 0,30 p.p. no mês. Nas pessoas físicas, a inadimplência ficou em 5,81%, alta de 1,15 p.p. em doze meses; nas pessoas jurídicas, em 3,31%, alta de 0,52 p.p. em doze meses.

*Evidência.* O endividamento das famílias com o sistema financeiro foi de 49,75% da renda acumulada em doze meses em jun/2026, e o comprometimento de renda com o serviço da dívida, de 28,85% em jun/2026, alta de 1,68 p.p. em doze meses.

*Inferência.* A inadimplência subiu em doze meses nos dois segmentos: nas pessoas físicas, +1,15 p.p.; nas pessoas jurídicas, +0,52 p.p.; o que indica que a alta não se restringe a um segmento. Os fatos do pacote não identificam a causa. Refutaria esta leitura: variação em doze meses igual a zero ou negativa na inadimplência de um dos dois segmentos.

## Fontes dos números

| Fato | Valor | Data de referência | Fonte |
|---|---|---|---|
| Saldo da carteira de crédito, total | R$ 7,37 trilhões | jul/2026 | BCB/SGS 20539 |
| Saldo da carteira de crédito, total: variação em 12 meses, nominal | +9,5% | jul/2026 | BCB/SGS 20539 |
| Saldo da carteira de crédito, total: variação em 12 meses, real (IPCA) | +4,8% | jul/2026 | BCB/SGS 20539 deflacionada pelo IPCA acumulado em 12 meses (IBGE via BCB/SGS 433) |
| Saldo da carteira de crédito, pessoas físicas: variação em 12 meses, nominal | +10,8% | jul/2026 | BCB/SGS 20541 |
| Saldo da carteira de crédito, pessoas jurídicas: variação em 12 meses, nominal | +7,4% | jul/2026 | BCB/SGS 20540 |
| Saldo da carteira de crédito, pessoas físicas: variação no mês | +0,8% | jul/2026 | BCB/SGS 20541 |
| Saldo da carteira de crédito, pessoas jurídicas: variação no mês | −0,7% | jul/2026 | BCB/SGS 20540 |
| Concessões de crédito no mês, total | R$ 736,8 bilhões | jul/2026 | BCB/SGS 20631 |
| Concessões de crédito no mês, total: variação em 12 meses, nominal | +13,4% | jul/2026 | BCB/SGS 20631 |
| Concessões de crédito no mês, pessoas jurídicas: variação em 12 meses, nominal | +16,2% | jul/2026 | BCB/SGS 20632 |
| Concessões de crédito no mês, pessoas físicas: variação em 12 meses, nominal | +11,2% | jul/2026 | BCB/SGS 20633 |
| Taxa média de juros das operações de crédito, total | 32,08% a.a. | jul/2026 | BCB/SGS 20714 |
| Taxa média de juros das operações de crédito, total: diferença no mês | −1,25 p.p. | jul/2026 | BCB/SGS 20714 |
| Taxa média de juros das operações de crédito, total: diferença em 12 meses | +0,33 p.p. | jul/2026 | BCB/SGS 20714 |
| Taxa média de juros, pessoas físicas: diferença no mês | −1,97 p.p. | jul/2026 | BCB/SGS 20716 |
| Taxa média de juros, pessoas jurídicas: diferença no mês | +0,24 p.p. | jul/2026 | BCB/SGS 20715 |
| Spread médio das operações de crédito, total | 20,88 p.p. | jul/2026 | BCB/SGS 20783 |
| Spread médio das operações de crédito, total: diferença no mês | −0,98 p.p. | jul/2026 | BCB/SGS 20783 |
| Spread médio das operações de crédito, total: diferença em 12 meses | +0,31 p.p. | jul/2026 | BCB/SGS 20783 |
| Inadimplência acima de 90 dias, total | 4,88% | jul/2026 | BCB/SGS 21082 |
| Inadimplência acima de 90 dias, total: diferença em 12 meses | +0,92 p.p. | jul/2026 | BCB/SGS 21082 |
| Inadimplência acima de 90 dias, total: diferença no mês | +0,30 p.p. | jul/2026 | BCB/SGS 21082 |
| Inadimplência acima de 90 dias, pessoas físicas | 5,81% | jul/2026 | BCB/SGS 21084 |
| Inadimplência acima de 90 dias, pessoas físicas: diferença em 12 meses | +1,15 p.p. | jul/2026 | BCB/SGS 21084 |
| Inadimplência acima de 90 dias, pessoas jurídicas | 3,31% | jul/2026 | BCB/SGS 21083 |
| Inadimplência acima de 90 dias, pessoas jurídicas: diferença em 12 meses | +0,52 p.p. | jul/2026 | BCB/SGS 21083 |
| Endividamento das famílias com o SFN em relação à renda de 12 meses | 49,75% | jun/2026 | BCB/SGS 29037 |
| Comprometimento de renda das famílias com o serviço da dívida | 28,85% | jun/2026 | BCB/SGS 29034 |
| Comprometimento de renda das famílias com o serviço da dívida: diferença em 12 meses | +1,68 p.p. | jun/2026 | BCB/SGS 29034 |

Os dados do BCB são revisados nas divulgações seguintes; os números desta nota valem para a gold identificada no pacote de reprodutibilidade.

Pacote de fatos `e0c39bc798154868`, data base jul/2026. Verificação: `python3 -m pesquisa.fatos_conjuntura --verificar pacote.json`.

