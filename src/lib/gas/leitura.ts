export const LEITURAS_GAS: Record<string, { titulo: string; texto: string; atalhos: [string, string][] }> = {
  "producao": {
    "titulo": "Como ler a unidade",
    "texto": "Milhões de metros cúbicos por dia expressam a média do mês. Produção não é reserva e não mede quanto chegou ao consumidor.",
    "atalhos": [
      [
        "evolucao",
        "Evolução"
      ],
      [
        "estados",
        "Estados"
      ],
      [
        "anual",
        "Anos"
      ]
    ]
  },
  "aproveitamento": {
    "titulo": "Destino não é causa",
    "texto": "Reinjeção é o retorno do gás ao reservatório e pode fazer parte da operação do campo. Não equivale a queima ou perda. Um mês sem uma das parcelas fica sem balanço, e um mês reprovado na conferência não exibe as parcelas.",
    "atalhos": [
      [
        "explorar",
        "Explorar um mês"
      ],
      [
        "estados",
        "Estados"
      ],
      [
        "conferencia",
        "Conferir o balanço"
      ]
    ]
  },
  "importacao": {
    "titulo": "Qual é o denominador?",
    "texto": "A participação importada usa como base o gás importado mais o gás disponível da produção nacional. Essa soma não mede demanda final. Os registros da ANP em volume e do Comex Stat em massa permanecem separados.",
    "atalhos": [
      [
        "volume",
        "Volume"
      ],
      [
        "origem",
        "Origem"
      ],
      [
        "anos",
        "Anos"
      ]
    ]
  },
  "precos": {
    "titulo": "Mesma unidade, bases diferentes",
    "texto": "MMBtu mede energia; metros cúbicos medem volume. A série brasileira inclui impostos. As referências internacionais têm outra base tributária e outros pontos de entrega. A mesma moeda e unidade não eliminam essas diferenças.",
    "atalhos": [
      [
        "internacional",
        "Referências internacionais"
      ],
      [
        "regioes",
        "Regiões"
      ],
      [
        "mercados",
        "Mercados"
      ]
    ]
  },
  "gas-de-cozinha": {
    "titulo": "O que a pesquisa mede",
    "texto": "O preço é o cobrado do consumidor pelas revendas pesquisadas pela ANP, no botijão de 13 kg. Não é uma tarifa regulada. A correção pela inflação usa o IPCA geral, com a base indicada no gráfico.",
    "atalhos": [
      [
        "sua-uf",
        "Escolher meu estado"
      ],
      [
        "historico",
        "Nominal e corrigido"
      ],
      [
        "estados",
        "Mapa e tabela"
      ]
    ]
  },
  "gnv-e-gas-encanado": {
    "titulo": "Preço e inflação são medidas distintas",
    "texto": "O preço do GNV é observado na pesquisa de postos. Para o gás encanado, esta página mostra a variação do IPCA, não uma tarifa nacional. A tarifa depende da distribuidora, da faixa de consumo e das regras locais.",
    "atalhos": [
      [
        "sua-uf",
        "Escolher meu estado"
      ],
      [
        "inflacao",
        "Inflação residencial"
      ],
      [
        "estados",
        "Mapa e tabela"
      ]
    ]
  },
  "mercado": {
    "titulo": "Quem faz o quê",
    "texto": "O carregador contrata capacidade para movimentar gás. A transportadora opera a malha. A distribuidora presta o serviço local. Uma empresa pode atuar em mais de uma malha, por isso as contagens por transportadora não devem ser somadas.",
    "atalhos": [
      [
        "carregadores",
        "Carregadores"
      ],
      [
        "por-transportadora",
        "Transportadoras"
      ],
      [
        "entre-agentes",
        "Vendas"
      ]
    ]
  },
  "infraestrutura": {
    "titulo": "Entradas distintas",
    "texto": "Produção nacional e importação são entradas distintas. O gás nacional pode passar por escoamento e processamento; o importado chega por gasoduto ou como GNL, que passa por regaseificação. Um ato de autorização não comprova operação atual.",
    "atalhos": [
      [
        "transporte",
        "Transporte"
      ],
      [
        "autorizacoes",
        "Autorizações"
      ],
      [
        "gnl",
        "Terminais"
      ]
    ]
  },
  "regulacao": {
    "titulo": "Duas esferas de competência",
    "texto": "A ANP regula as atividades de sua competência federal; os estados organizam os serviços locais de gás canalizado. O texto oficial de cada ato é a referência para sua aplicação.",
    "atalhos": [
      [
        "quem",
        "Competências"
      ],
      [
        "marcos",
        "Marcos legais"
      ],
      [
        "lacunas",
        "Limites"
      ]
    ]
  },
  "dados": {
    "titulo": "Como conferir uma medida",
    "texto": "Encontre o período, a unidade e a fonte. A fórmula explica a transformação feita pelo observatório. O arquivo original e seu hash permitem identificar a captura utilizada.",
    "atalhos": [
      [
        "fontes",
        "Fontes"
      ],
      [
        "series",
        "Downloads"
      ],
      [
        "indicadores",
        "Indicadores"
      ]
    ]
  },
  "metodologia": {
    "titulo": "Observado, calculado ou ausente",
    "texto": "Um valor observado foi publicado pela fonte. Um valor calculado resulta de uma fórmula declarada. Uma lacuna não é uma medição de zero. Quando a cobertura é insuficiente, a comparação fica indisponível.",
    "atalhos": [
      [
        "regras",
        "Regras"
      ],
      [
        "validacoes",
        "Validações"
      ],
      [
        "glossario",
        "Glossário"
      ]
    ]
  }
};
