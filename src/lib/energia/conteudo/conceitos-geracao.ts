import type { Conceito } from "./conceitos";

/**
 * Verbetes do módulo geracao. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * Constrained-off: conferido em 07/10/2026 na Nota Técnica EPE-DEE-NT-096/2022-r0
 * (novembro de 2022), publicada pelo MME, que cita a definição e o método de referência da
 * REN ANEEL nº 1.030/2022, e na descrição do conjunto de dados do ONS. Capturas em
 * pipeline/energia/seed/documentos_aprenda/v20261007T211054Z (sha256 de cada original no
 * MANIFESTO.json). A REN não foi lida no original: o repositório de normas da ANEEL
 * respondeu 403 e o bloqueio não foi contornado; o verbete diz isso.
 */
const URL_NT_096 = "https://www.gov.br/mme/pt-br/assuntos/noticias/mme-publica-valores-de-garantias-fisicas-de-usinas-eolicas-para-2023/constrained-off-de-usinas-eolicas.pdf";

export const CONCEITOS: Conceito[] = [
  {
    slug: "constrained-off",
    nome: "Constrained-off",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-07",
    emUmaFrase:
      "Redução da produção de energia de usinas eolioelétricas despachadas centralizadamente, ou de conjuntos de usinas considerados na programação, decorrente de comando do ONS e originada fora das instalações das próprias usinas.",
    porQueImporta:
      "Em outubro de 2022, o MME pediu à EPE que avaliasse os efeitos do constrained-off nos montantes de garantia física das usinas eólicas elegíveis à revisão de 2022. Pela definição, a redução decorre de comando do ONS e nasce fora das instalações da usina; não é, portanto, falta de vento nem defeito da própria usina.",
    comoEMedido:
      "Em energia (MWh ou GWh) e em potência (MW), por usina ou conjunto, por razão do evento e por período. A energia não gerada é estimada, não medida: a REN ANEEL nº 1.030/2022 manda o ONS calcular a referência de geração dos eventos de indisponibilidade externa a partir da curva de produtividade da usina, que relaciona a potência de saída à velocidade do vento; até a curva existir, a referência é o segundo menor valor de energia gerada nos 10 períodos imediatamente anteriores coincidentes com o horário da restrição. No observatório, a energia não gerada é a referência estimada pelo ONS menos a geração verificada, só nas meias horas em que o ONS limitou a usina, e a taxa é a energia não gerada dividida pela soma da verificada com a não gerada.",
    relacoes: ["geracao-centralizada", "garantia-fisica"],
    fontes: [
      {
        orgao: "MME e EPE",
        documento: "Nota Técnica EPE-DEE-NT-096/2022-r0, Constrained-off de usinas eólicas, período definitivo (novembro de 2022), introdução, página 6",
        url: URL_NT_096,
        trecho:
          "De acordo com a REN ANEEL nº 1.030/2022, eventos de restrição de operação por constrained-off são definidos como “a redução da produção de energia por usinas eolioelétricas despachadas centralizadamente ou usinas/conjuntos de usinas eolioelétricas considerados na programação, decorrente de comando do Operador Nacional do Sistema – ONS, que tenham sido originados externamente às instalações das respectivas usinas”. A classificação dos eventos de restrição de operação é feita de acordo com a motivação em: razão de indisponibilidade externa, razão de atendimento a requisitos de confiabilidade elétrica e razão energética.",
        parafrase:
          "Em outras palavras: constrained-off é a redução de geração de usina eólica comandada pelo ONS por um motivo externo à usina, e cada evento é classificado por razão: indisponibilidade externa, confiabilidade elétrica ou razão energética.",
      },
      {
        orgao: "MME e EPE",
        documento: "Nota Técnica EPE-DEE-NT-096/2022-r0, Constrained-off de usinas eólicas, período definitivo (novembro de 2022), seção 2.1, páginas 8 e 9",
        url: URL_NT_096,
        trecho:
          "o ONS deverá calcular a referência de geração de energia decorrente de evento de restrição de operação por constrained-off das usinas ou [...] conjuntos de usinas eolioelétricas, classificado como razão de indisponibilidade externa, a partir da curva de produtividade da usina eolioelétrica, que relaciona a potência de saída da usina e a velocidade do vento. A curva de produtividade deverá ser elaborada a partir de dados medidos de geração e velocidade do vento pelo período de um ano, sendo revisada anualmente. Até a elaboração da curva de produtividade, será tomado como referência da frustração de geração de energia das usinas ou conjuntos de usinas eolioelétricas o segundo menor valor de energia gerada nos 10 (dez) períodos imediatamente anteriores coincidentes com o horário da restrição de operação em análise.",
        parafrase:
          "Em outras palavras: a energia que a usina deixou de gerar é calculada contra uma geração de referência, tirada da curva que liga o vento à potência da usina; enquanto a curva não existe, a referência é o segundo menor valor gerado nos dez períodos anteriores no mesmo horário.",
      },
      {
        orgao: "MME e EPE",
        documento: "Nota Técnica EPE-DEE-NT-096/2022-r0, Constrained-off de usinas eólicas, período definitivo (novembro de 2022), introdução, página 6, pedido do MME à EPE",
        url: URL_NT_096,
        trecho: "o MME solicitou à EPE a realização de análises dos efeitos do constrained-off nos montantes de garantias físicas das usinas eólicas elegíveis à revisão prevista para o ano de 2022.",
      },
      {
        orgao: "ONS",
        documento: "Portal de dados abertos, conjunto \"Dados de Restrição de Operação por Constrained-off de Usinas Eólicas\" (descrição)",
        url: "https://dados.ons.org.br/dataset/restricao_coff_eolica_usi",
        trecho: "Informações associadas à apuração das restrições de operação por Constrained-off nas usinas eólicas classificadas nas modalidades Tipo I, Tipo II-B e Tipo II-C",
      },
    ],
    limitacoes: [
      "A definição vale para usinas eolioelétricas, como a REN ANEEL nº 1.030/2022 a escreve e a EPE a cita. O painel mostra também usinas fotovoltaicas; a norma que define o evento para elas não foi consultada.",
      "A REN ANEEL nº 1.030/2022 não foi lida no original (o repositório de normas da ANEEL respondeu 403): a definição e o método de referência vêm da nota técnica, que os cita. O método descrito vale para os eventos de indisponibilidade externa; o aplicado pelo ONS às razões energética, de confiabilidade e de parecer de acesso não foi consultado.",
      "A energia não gerada é estimativa do ONS, calculada sobre uma referência de geração, não medição.",
    ],
    vejaNoPortal: [{ rotulo: "Geração: renováveis restringidas", href: "/setor-eletrico/geracao/restricoes#p023" }],
  },
];
