<!-- papel: revisor_independente -->
# SISTEMA

# Regras comuns aos revisores

Você é um revisor independente do Observatório Brasileiro de Crédito. Não existe revisão humana neste projeto: o seu parecer, junto com o de outros dois revisores que você não conhece, decide se a nota é publicada. A constituição anexa prevalece sobre qualquer outra instrução.

1. Você recebe só a nota final e a evidência indicada no seu papel. Não recebe rascunhos, raciocínio dos autores, objeções do crítico nem o parecer dos outros revisores. Não tente adivinhá-los.
2. Os números da nota já foram conferidos por código contra a gold. Você não aprova nem reprova número. Seu trabalho é o que o código não vê: definição, horizonte, atribuição, causalidade, seleção, omissão, tom e temas vedados.
3. Uma nota aprovada vai a público sem que nenhuma pessoa a leia antes. Classifique cada problema pela consequência para o leitor:
    - **grave**: o leitor sai com uma crença falsa sobre um fato, ou a nota viola a constituição. Exemplos: definição, horizonte ou segmento trocados; causa, previsão, recomendação ou juízo sem régua; omissão que inverte a leitura de um fato citado; tema vedado.
    - **moderada**: a leitura está certa, mas ficaria mais completa com outro fato ou horizonte disponível na evidência.
    - **leve**: redação, ordem, clareza.
   Na dúvida entre grave e moderada, classifique como grave e diga por quê.
4. Só item grave devolve a nota. A decisão é derivada dos seus itens por código: com pelo menos um item grave a nota volta à revisão; sem item grave ela segue, e os itens moderados e leves ficam registrados como sugestões. Não use a decisão para bloquear por item moderado.
5. Responda só no formato abaixo, sem comentário fora dele:

    ITEM [grave|moderada|leve]: <trecho da nota> | <problema> | <o que resolveria>
    DECISÃO: aprovar | devolver

Sem nenhum problema, escreva apenas `DECISÃO: aprovar`.


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

# Crédito em jul/2026: juros das pessoas físicas caem no mês e seguem acima de doze meses antes; saldo das pessoas jurídicas cai e taxa e spread do segmento sobem no mês

*Evidência.* Na data base jul/2026, o saldo total da carteira de crédito somou R$ 7,37 trilhões, com alta de 0,3% no mês e alta nominal de 9,5% em doze meses. Deflacionado pelo IPCA, o saldo total teve alta de 4,8% em doze meses. As concessões totais somaram R$ 736,8 bilhões no mês, com alta nominal de 13,4% e alta real de 8,6% em doze meses, na comparação do mês com o mesmo mês do ano anterior. O crédito em relação ao PIB ficou em 55,60%, com queda de 0,15 p.p. no mês e alta de 1,22 p.p. em doze meses. Fontes: BCB/SGS 20539; BCB/SGS 20631; BCB/SGS 20622.

*Evidência.* A taxa média de juros total ficou em 32,08% a.a., com queda de 1,25 p.p. no mês e alta de 0,33 p.p. em doze meses. O spread médio total ficou em 20,88 p.p., com queda de 0,98 p.p. no mês e alta de 0,31 p.p. em doze meses. A inadimplência acima de noventa dias total ficou em 4,88%, com alta de 0,30 p.p. no mês e alta de 0,92 p.p. em doze meses. Fontes: BCB/SGS 20714; BCB/SGS 20783; BCB/SGS 21082.

*Evidência.* O saldo da carteira de crédito às pessoas físicas somou R$ 4,64 trilhões, com alta de 0,8% no mês e alta nominal de 10,8% em doze meses. Deflacionado pelo IPCA, o saldo às pessoas físicas teve alta de 6,1% em doze meses. As concessões às pessoas físicas somaram R$ 406,4 bilhões no mês, com alta nominal de 11,2% e alta real de 6,5% em doze meses, na comparação do mês com o mesmo mês do ano anterior. Fontes: BCB/SGS 20541; BCB/SGS 20633.

*Evidência.* A taxa média de juros das pessoas físicas ficou em 37,41% a.a., com queda de 1,97 p.p. no mês e alta de 1,00 p.p. em doze meses. O spread médio das pessoas físicas ficou em 26,65 p.p., com queda de 1,87 p.p. no mês e alta de 0,96 p.p. em doze meses. A inadimplência acima de noventa dias das pessoas físicas ficou em 5,81%, com alta de 0,39 p.p. no mês e alta de 1,15 p.p. em doze meses. Fontes: BCB/SGS 20716; BCB/SGS 20785; BCB/SGS 21084.

*Evidência.* Com data de referência jun/2026, o comprometimento de renda das famílias com o serviço da dívida ficou em 28,85%, com alta de 0,36 p.p. no mês e alta de 1,68 p.p. em doze meses. Com data de referência jun/2026, o endividamento das famílias com o SFN em relação à renda de doze meses ficou em 49,75%, com queda de 0,08 p.p. no mês e alta de 0,93 p.p. em doze meses. Fontes: BCB/SGS 29034; BCB/SGS 29037.

*Evidência.* O saldo da carteira de crédito às pessoas jurídicas somou R$ 2,73 trilhões, com queda de 0,7% no mês e alta nominal de 7,4% em doze meses. Deflacionado pelo IPCA, o saldo às pessoas jurídicas teve alta de 2,8% em doze meses. As concessões às pessoas jurídicas somaram R$ 330,4 bilhões no mês, com alta nominal de 16,2% e alta real de 11,2% em doze meses, na comparação do mês com o mesmo mês do ano anterior. Fontes: BCB/SGS 20540; BCB/SGS 20632.

*Evidência.* A taxa média de juros das pessoas jurídicas ficou em 20,97% a.a., com alta de 0,24 p.p. no mês e queda de 0,62 p.p. em doze meses. O spread médio das pessoas jurídicas ficou em 8,87 p.p., com alta de 0,88 p.p. no mês e queda de 0,53 p.p. em doze meses. A inadimplência acima de noventa dias das pessoas jurídicas ficou em 3,31%, com alta de 0,13 p.p. no mês e alta de 0,52 p.p. em doze meses. Fontes: BCB/SGS 20715; BCB/SGS 20784; BCB/SGS 21083.

*Evidência.* O pacote de fatos desta nota não inclui a variação mensal das concessões, total e por segmento, nem a variação da taxa e do spread em meses anteriores ao da data base. Motivo: o pacote traz, para as concessões, só o nível do mês e as variações em doze meses e, para taxa e spread, só a diferença no mês da data base e a diferença em doze meses. É recorte do pacote, e esta nota não se apoia nesses dados. Lacunas de dado declaradas no pacote: nenhuma lacuna no escopo.

*Inferência.* Esta leitura parte de duas séries distintas, comparadas em doze meses. A inadimplência acima de noventa dias da carteira de crédito às pessoas físicas teve alta de 1,15 p.p. em doze meses. O comprometimento de renda das famílias com o serviço da dívida, medido em relação à renda das famílias, teve alta de 1,68 p.p. em doze meses, com data de referência jun/2026. As duas séries estão acima do nível de doze meses antes, e no mês também tiveram alta: de 0,39 p.p. a inadimplência das pessoas físicas e de 0,36 p.p. o comprometimento de renda. Isso indica menor folga das famílias para o serviço da dívida do que doze meses antes. A taxa média de juros das pessoas físicas, terceira série, teve alta de 1,00 p.p. em doze meses, mas fica como fato acessório, porque a ligação dela com o serviço da dívida já contratada não está no pacote. Há fatos do pacote em outro sentido, que ficam registrados: a taxa das pessoas físicas teve queda de 1,97 p.p. no mês, e o endividamento das famílias teve queda de 0,08 p.p. no mês, com data de referência jun/2026. Nenhum deles altera a comparação em doze meses em que a leitura se apoia. Refutaria esta leitura: variação em doze meses nula ou negativa do comprometimento de renda das famílias ou da inadimplência das pessoas físicas nos dados vigentes.

*Inferência.* Esta leitura parte de fatos do mês. O saldo às pessoas jurídicas teve queda de 0,7% no mês, e o saldo total teve alta de 0,3%. A taxa das pessoas jurídicas teve alta de 0,24 p.p. no mês, e a taxa total teve queda de 1,25 p.p. O spread das pessoas jurídicas teve alta de 0,88 p.p. no mês, e o spread total teve queda de 0,98 p.p. Saldo, taxa e spread do segmento foram em sentido oposto ao do agregado no mês. A inadimplência seguiu a direção do agregado: a das pessoas jurídicas teve alta de 0,13 p.p. no mês, e a total teve alta de 0,30 p.p. O agregado reúne pessoas físicas e jurídicas, e parte da diferença é mecânica: no mesmo mês, o saldo das pessoas físicas teve alta de 0,8%, a taxa das pessoas físicas teve queda de 1,97 p.p. e o spread das pessoas físicas teve queda de 1,87 p.p. A alta da taxa e do spread das pessoas jurídicas é compatível com condições de crédito ao segmento menos favoráveis ao tomador do que no mês anterior. A inadimplência fica fora desta leitura, porque não é condição oferecida ao tomador. A queda do saldo também fica fora, porque o pacote não traz a variação mensal das concessões e a causa da queda não se identifica com os fatos disponíveis. Como o pacote não traz a variação da taxa e do spread em meses anteriores, a leitura não distingue deslocamento para nível menos favorável de reversão de variação do mês anterior. A leitura vale só para a variação do mês. Em doze meses, a taxa das pessoas jurídicas teve queda de 0,62 p.p. e o spread das pessoas jurídicas teve queda de 0,53 p.p., fatos que não acompanham a leitura mensal. As concessões às pessoas jurídicas tiveram alta real de 11,2% em doze meses, comparação de um único mês com o mesmo mês do ano anterior. Refutaria esta leitura: evidência de que a alta mensal da taxa e do spread das pessoas jurídicas decorre de mudança na composição das operações do mês, e não de custo maior em operações do mesmo tipo.

## Fontes dos números

| Fato | Valor | Data de referência | Fonte |
|---|---|---|---|
| Saldo da carteira de crédito, total | R$ 7,37 trilhões | jul/2026 | BCB/SGS 20539 |
| Saldo da carteira de crédito, total: variação no mês | +0,3% | jul/2026 | BCB/SGS 20539 |
| Saldo da carteira de crédito, total: variação em 12 meses, nominal | +9,5% | jul/2026 | BCB/SGS 20539 |
| Saldo da carteira de crédito, total: variação em 12 meses, real (IPCA) | +4,8% | jul/2026 | BCB/SGS 20539 deflacionada pelo IPCA acumulado em 12 meses (IBGE via BCB/SGS 433) |
| Concessões de crédito no mês, total | R$ 736,8 bilhões | jul/2026 | BCB/SGS 20631 |
| Concessões de crédito no mês, total: variação em 12 meses, nominal | +13,4% | jul/2026 | BCB/SGS 20631 |
| Concessões de crédito no mês, total: variação em 12 meses, real (IPCA) | +8,6% | jul/2026 | BCB/SGS 20631 deflacionada pelo IPCA acumulado em 12 meses (IBGE via BCB/SGS 433) |
| Saldo da carteira de crédito em relação ao PIB | 55,60% | jul/2026 | BCB/SGS 20622 |
| Saldo da carteira de crédito em relação ao PIB: diferença no mês | −0,15 p.p. | jul/2026 | BCB/SGS 20622 |
| Saldo da carteira de crédito em relação ao PIB: diferença em 12 meses | +1,22 p.p. | jul/2026 | BCB/SGS 20622 |
| Taxa média de juros das operações de crédito, total | 32,08% a.a. | jul/2026 | BCB/SGS 20714 |
| Taxa média de juros das operações de crédito, total: diferença no mês | −1,25 p.p. | jul/2026 | BCB/SGS 20714 |
| Taxa média de juros das operações de crédito, total: diferença em 12 meses | +0,33 p.p. | jul/2026 | BCB/SGS 20714 |
| Spread médio das operações de crédito, total | 20,88 p.p. | jul/2026 | BCB/SGS 20783 |
| Spread médio das operações de crédito, total: diferença no mês | −0,98 p.p. | jul/2026 | BCB/SGS 20783 |
| Spread médio das operações de crédito, total: diferença em 12 meses | +0,31 p.p. | jul/2026 | BCB/SGS 20783 |
| Inadimplência acima de 90 dias, total | 4,88% | jul/2026 | BCB/SGS 21082 |
| Inadimplência acima de 90 dias, total: diferença no mês | +0,30 p.p. | jul/2026 | BCB/SGS 21082 |
| Inadimplência acima de 90 dias, total: diferença em 12 meses | +0,92 p.p. | jul/2026 | BCB/SGS 21082 |
| Saldo da carteira de crédito, pessoas físicas | R$ 4,64 trilhões | jul/2026 | BCB/SGS 20541 |
| Saldo da carteira de crédito, pessoas físicas: variação no mês | +0,8% | jul/2026 | BCB/SGS 20541 |
| Saldo da carteira de crédito, pessoas físicas: variação em 12 meses, nominal | +10,8% | jul/2026 | BCB/SGS 20541 |
| Saldo da carteira de crédito, pessoas físicas: variação em 12 meses, real (IPCA) | +6,1% | jul/2026 | BCB/SGS 20541 deflacionada pelo IPCA acumulado em 12 meses (IBGE via BCB/SGS 433) |
| Concessões de crédito no mês, pessoas físicas | R$ 406,4 bilhões | jul/2026 | BCB/SGS 20633 |
| Concessões de crédito no mês, pessoas físicas: variação em 12 meses, nominal | +11,2% | jul/2026 | BCB/SGS 20633 |
| Concessões de crédito no mês, pessoas físicas: variação em 12 meses, real (IPCA) | +6,5% | jul/2026 | BCB/SGS 20633 deflacionada pelo IPCA acumulado em 12 meses (IBGE via BCB/SGS 433) |
| Taxa média de juros, pessoas físicas | 37,41% a.a. | jul/2026 | BCB/SGS 20716 |
| Taxa média de juros, pessoas físicas: diferença no mês | −1,97 p.p. | jul/2026 | BCB/SGS 20716 |
| Taxa média de juros, pessoas físicas: diferença em 12 meses | +1,00 p.p. | jul/2026 | BCB/SGS 20716 |
| Spread médio, pessoas físicas | 26,65 p.p. | jul/2026 | BCB/SGS 20785 |
| Spread médio, pessoas físicas: diferença no mês | −1,87 p.p. | jul/2026 | BCB/SGS 20785 |
| Spread médio, pessoas físicas: diferença em 12 meses | +0,96 p.p. | jul/2026 | BCB/SGS 20785 |
| Inadimplência acima de 90 dias, pessoas físicas | 5,81% | jul/2026 | BCB/SGS 21084 |
| Inadimplência acima de 90 dias, pessoas físicas: diferença no mês | +0,39 p.p. | jul/2026 | BCB/SGS 21084 |
| Inadimplência acima de 90 dias, pessoas físicas: diferença em 12 meses | +1,15 p.p. | jul/2026 | BCB/SGS 21084 |
| Comprometimento de renda das famílias com o serviço da dívida | 28,85% | jun/2026 | BCB/SGS 29034 |
| Comprometimento de renda das famílias com o serviço da dívida: diferença no mês | +0,36 p.p. | jun/2026 | BCB/SGS 29034 |
| Comprometimento de renda das famílias com o serviço da dívida: diferença em 12 meses | +1,68 p.p. | jun/2026 | BCB/SGS 29034 |
| Endividamento das famílias com o SFN em relação à renda de 12 meses | 49,75% | jun/2026 | BCB/SGS 29037 |
| Endividamento das famílias com o SFN em relação à renda de 12 meses: diferença no mês | −0,08 p.p. | jun/2026 | BCB/SGS 29037 |
| Endividamento das famílias com o SFN em relação à renda de 12 meses: diferença em 12 meses | +0,93 p.p. | jun/2026 | BCB/SGS 29037 |
| Saldo da carteira de crédito, pessoas jurídicas | R$ 2,73 trilhões | jul/2026 | BCB/SGS 20540 |
| Saldo da carteira de crédito, pessoas jurídicas: variação no mês | −0,7% | jul/2026 | BCB/SGS 20540 |
| Saldo da carteira de crédito, pessoas jurídicas: variação em 12 meses, nominal | +7,4% | jul/2026 | BCB/SGS 20540 |
| Saldo da carteira de crédito, pessoas jurídicas: variação em 12 meses, real (IPCA) | +2,8% | jul/2026 | BCB/SGS 20540 deflacionada pelo IPCA acumulado em 12 meses (IBGE via BCB/SGS 433) |
| Concessões de crédito no mês, pessoas jurídicas | R$ 330,4 bilhões | jul/2026 | BCB/SGS 20632 |
| Concessões de crédito no mês, pessoas jurídicas: variação em 12 meses, nominal | +16,2% | jul/2026 | BCB/SGS 20632 |
| Concessões de crédito no mês, pessoas jurídicas: variação em 12 meses, real (IPCA) | +11,2% | jul/2026 | BCB/SGS 20632 deflacionada pelo IPCA acumulado em 12 meses (IBGE via BCB/SGS 433) |
| Taxa média de juros, pessoas jurídicas | 20,97% a.a. | jul/2026 | BCB/SGS 20715 |
| Taxa média de juros, pessoas jurídicas: diferença no mês | +0,24 p.p. | jul/2026 | BCB/SGS 20715 |
| Taxa média de juros, pessoas jurídicas: diferença em 12 meses | −0,62 p.p. | jul/2026 | BCB/SGS 20715 |
| Spread médio, pessoas jurídicas | 8,87 p.p. | jul/2026 | BCB/SGS 20784 |
| Spread médio, pessoas jurídicas: diferença no mês | +0,88 p.p. | jul/2026 | BCB/SGS 20784 |
| Spread médio, pessoas jurídicas: diferença em 12 meses | −0,53 p.p. | jul/2026 | BCB/SGS 20784 |
| Inadimplência acima de 90 dias, pessoas jurídicas | 3,31% | jul/2026 | BCB/SGS 21083 |
| Inadimplência acima de 90 dias, pessoas jurídicas: diferença no mês | +0,13 p.p. | jul/2026 | BCB/SGS 21083 |
| Inadimplência acima de 90 dias, pessoas jurídicas: diferença em 12 meses | +0,52 p.p. | jul/2026 | BCB/SGS 21083 |

Os dados do BCB são revisados nas divulgações seguintes; os números desta nota valem para a gold identificada no pacote de reprodutibilidade.

Pacote de fatos `e0c39bc798154868`, data base jul/2026. Verificação: `python3 -m pesquisa.fatos_conjuntura --verificar pacote.json`.

