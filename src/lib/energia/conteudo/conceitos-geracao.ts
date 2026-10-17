import type { Conceito, FonteOficial } from "./conceitos";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

/**
 * Verbetes do módulo geracao. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * Constrained-off: conferido em 07/10/2026 no texto compilado da REN ANEEL nº 1.030/2022
 * (Título II, eólicas, e Título II-A, centrais fotovoltaicas), lido da cópia pública do Internet
 * Archive de 08/01/2025 em pipeline/energia/seed/documentos_aprenda/v20261007T215553Z (sha256
 * do original e do recorte no MANIFESTO.json). O endereço oficial da ANEEL responde 403 a
 * requisições automatizadas e não foi contornado; o canal é o mesmo que o módulo Regulação usa
 * para as normas da ANEEL (modulos/regulacao.md, seção 5). A nota técnica da EPE de novembro de
 * 2022 (v20261007T211054Z), que cita a mesma norma, fica como fonte do pedido do MME sobre a
 * garantia física.
 */
const URL_REN_1030 = "https://www2.aneel.gov.br/cedoc/ren20221030.pdf";
const URL_NT_096 = "https://www.gov.br/mme/pt-br/assuntos/noticias/mme-publica-valores-de-garantias-fisicas-de-usinas-eolicas-para-2023/constrained-off-de-usinas-eolicas.pdf";

function montarConceitos(tx: TxIdioma): Conceito[] {
  const ren1030 = (dispositivo: string, trecho: string, parafrase?: string): FonteOficial => ({
    orgao: "ANEEL",
    documento: tx(`Resolução Normativa nº 1.030, de 26 de julho de 2022, ${dispositivo} (texto compilado, lido na cópia do Internet Archive de 08/01/2025)`, `Normative Resolution (REN) No. 1.030 of Jul 26, 2022, ${dispositivo} (consolidated text, read in the Internet Archive copy of Jan 8, 2025)`),
    url: URL_REN_1030,
    trecho,
    parafrase,
  });
  return [
    {
      slug: "constrained-off",
      nome: "Constrained-off",
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-07",
      emUmaFrase:
        tx("Redução da produção de energia de usinas eólicas ou fotovoltaicas despachadas centralizadamente, ou de conjuntos de usinas considerados na programação, por comando do Operador Nacional do Sistema Elétrico (ONS), em evento originado fora das instalações das próprias usinas.", "Reduction in the energy output of centrally dispatched wind or photovoltaic plants, or of groups of plants considered in the scheduling, by order of the National Electric System Operator (ONS), in an event originating outside the plants' own facilities."),
      porQueImporta:
        tx("Quem arca com a energia que a usina deixou de gerar depende da razão do evento. A REN ANEEL nº 1.030/2022 classifica cada evento em indisponibilidade externa, confiabilidade elétrica ou razão energética, e, nos eventos ocorridos a partir de 1º de outubro de 2021 nas eólicas e de 1º de abril de 2024 nas fotovoltaicas, só a indisponibilidade externa gera pagamento, por Encargo de Serviço de Sistema (ESS), valorado ao PLD do submercado e devido apenas depois que o tempo acumulado de restrição no ano civil passa de 78 horas nas eólicas e de 30 horas e 30 minutos nas fotovoltaicas; o ONS pode atualizar esses limites. Os eventos anteriores a esses marcos seguem regras próprias da norma. A EPE avaliou, a pedido do MME, os efeitos do constrained-off nos montantes de garantia física das eólicas elegíveis à revisão de 2022.", "Who bears the energy the plant did not generate depends on the reason for the event. REN ANEEL No. 1.030/2022 classifies each event as external unavailability, electrical reliability or energy reason, and, for events from Oct 1, 2021 at wind plants and from Apr 1, 2024 at photovoltaic plants, only external unavailability generates payment, through the System Service Charge (ESS), valued at the PLD of the submarket and due only after the accumulated restriction time in the calendar year exceeds 78 hours at wind plants and 30 hours and 30 minutes at photovoltaic plants; the ONS might update these limits. Events before these milestones follow specific rules of the norm. At the request of the MME, the EPE assessed the effects of constrained-off on the physical guarantee amounts of the wind plants eligible for the 2022 review."),
      emPalavrasSimples:
        tx("O ONS manda uma usina eólica ou fotovoltaica gerar menos, por um motivo que está fora da própria usina. A REN classifica cada evento de eólica em uma de três razões: indisponibilidade de uma instalação externa, requisito de confiabilidade elétrica de equipamento externo ou impossibilidade de alocar a geração na carga (razão energética).", "The ONS orders a wind or photovoltaic plant to generate less, for a reason that lies outside the plant itself. The REN classifies each wind event under one of three reasons: unavailability of an external facility, an electrical reliability requirement of external equipment, or the impossibility of allocating the generation to the load (energy reason)."),
      comoEMedidoResumo:
        tx("A energia que a usina deixou de gerar não é medida: é estimada contra uma geração de referência que o ONS calcula. O observatório soma, nas meias horas em que o ONS limitou a usina, o quanto a referência passou do que foi gerado.", "The energy the plant did not generate is not measured: it is estimated against a reference generation that the ONS calculates. In the half hours in which the ONS limited the plant, the observatory adds up how much the reference exceeded what was generated."),
      comoEMedido:
        tx("Nos eventos de indisponibilidade externa, a referência das eólicas sai da curva de produtividade da usina, que liga a potência de saída à velocidade do vento, e, até a curva existir, é o segundo menor valor de energia gerada nos 10 períodos anteriores coincidentes com o horário da restrição; nas fotovoltaicas, é a média aritmética entre o quinto e o sexto valores ordenados desses 10 períodos até a função de produtividade existir. A REN descreve a referência só para a indisponibilidade externa.\n\nMétodo do observatório sobre os dados do ONS, que publica por meia hora a geração de referência e a verificada: a energia não gerada é, em cada meia hora em que o ONS limitou a usina, o maior valor entre zero e a referência menos a geração verificada, vezes 0,5 hora, somado por razão e por mês (MWh e GWh); a potência cortada é a soma dos cortes simultâneos das usinas numa meia hora (MW); a taxa é a energia não gerada dividida pela soma da geração verificada com a não gerada.", "In external unavailability events, the wind plant reference comes from the plant's productivity curve, which links output power to wind speed, and, until the curve exists, it is the second lowest value of energy generated in the 10 previous periods coinciding with the time of the restriction; at photovoltaic plants, it is the arithmetic mean of the fifth and sixth ordered values of these 10 periods until the productivity function exists. The REN describes the reference only for external unavailability.\n\nObservatory method on ONS data, which publishes the reference and the verified generation by half hour: the energy not generated is, in each half hour in which the ONS limited the plant, the greater of zero and the reference minus the verified generation, times 0.5 hour, summed by reason and by month (MWh and GWh); the curtailed power is the sum of simultaneous cuts of the plants in a half hour (MW); the rate is the energy not generated divided by the sum of verified and not generated energy."),
      relacoesNotas: {
        "geracao-centralizada": tx("A definição vale para usinas despachadas centralizadamente, ou para conjuntos considerados na programação (REN, art. 13).", "The definition applies to centrally dispatched plants, or to groups considered in the scheduling (REN, art. 13)."),
        "garantia-fisica": tx("A EPE avaliou, a pedido do MME, o efeito do constrained-off sobre os montantes de garantia física das eólicas (nota técnica 096/2022).", "At the request of the MME, the EPE assessed the effect of constrained-off on the physical guarantee amounts of wind plants (technical note 096/2022)."),
        ess: tx("A indisponibilidade externa, acima do limite de horas, é paga por Encargo de Serviço de Sistema (REN, art. 16).", "External unavailability, above the hour limit, is paid through the System Service Charge (REN, art. 16)."),
      },
      relacoes: ["geracao-centralizada", "garantia-fisica", "ess"],
      fontes: [
        ren1030(
          tx("art. 13, caput e §§ 1º e 2º (eólicas)", "art. 13, caput and §§ 1 and 2 (wind plants)"),
          // i18n: dado
          "Art. 13. Para efeitos deste Título, eventos de restrição de operação por Constrained-off são definidos como a redução da produção de energia por usinas eolioelétricas despachadas centralizadamente ou usinas/conjuntos de usinas eolioelétricas considerados na programação, decorrente de comando do ONS, que tenham sido originados externamente às instalações das respectivas usinas. § 1º Considera-se instalações externas às respectivas usinas ou conjuntos de usinas, as instalações de transmissão classificadas como Rede Básica e Demais Instalações de Transmissão – DITs no âmbito da distribuição. § 2º Não se considera instalações externas às respectivas usinas ou conjuntos de usinas aquelas de uso exclusivo ou compartilhado do gerador, sob sua gestão ou de terceiros.",
          tx("Em outras palavras: constrained-off é a redução de geração comandada pelo ONS por um motivo que nasce fora da usina. São externas as instalações de transmissão da Rede Básica e as demais instalações de transmissão da distribuição; não são externas as instalações de uso exclusivo ou compartilhado do próprio gerador.", "In other words: constrained-off is a generation reduction ordered by the ONS for a reason that arises outside the plant. The transmission facilities of the Basic Network and the other transmission facilities of distribution are external; facilities for the exclusive or shared use of the generator itself are not."),
        ),
        ren1030(
          tx("art. 14 (eólicas)", "art. 14 (wind plants)"),
          // i18n: dado
          "Art. 14. O ONS deverá classificar os eventos de restrição de operação por Constrained-off de usinas ou conjuntos de usinas eolioelétricas de acordo com sua motivação em: I - Razão de indisponibilidade externa: motivados por indisponibilidades em instalações externas às respectivas usinas ou conjuntos de usinas conforme definições do art. 13. II - Razão de atendimento a requisitos de confiabilidade elétrica: motivados por razões de confiabilidade elétrica dos equipamentos pertencentes a instalações externas às respectivas usinas ou conjuntos de usinas conforme definições do art. 13 e que não tenham origem em indisponibilidades dos respectivos equipamentos. III - Razão energética: motivados pela impossibilidade de alocação de geração de energia na carga.",
          tx("Em outras palavras: o ONS classifica cada evento em uma de três razões: indisponibilidade em instalação externa, requisito de confiabilidade elétrica de equipamento externo ou impossibilidade de alocar a geração na carga.", "In other words: the ONS classifies each event under one of three reasons: unavailability of an external facility, an electrical reliability requirement of external equipment, or the impossibility of allocating the generation to the load."),
        ),
        ren1030(
          tx("art. 15, caput e § 5º (eólicas)", "art. 15, caput and § 5 (wind plants)"),
          // i18n: dado
          "Art. 15. O ONS deverá calcular a referência de geração de energia decorrente de evento de restrição de operação por Constrained-off das usinas ou conjuntos de usinas eolioelétricas, classificado como razão de indisponibilidade externa, conforme inciso I do art. 14, a partir da curva de produtividade da usina eolioelétrica, que relaciona a potência de saída da usina e a velocidade do vento. [...] § 5º Até a elaboração da curva de produtividade, será considerado como referência da frustração de geração de energia das usinas ou conjuntos de usinas eolioelétricas o segundo menor valor de energia gerada nos 10 (dez) períodos imediatamente anteriores coincidentes com o horário da restrição de operação em análise.",
          tx("Em outras palavras: a geração de referência dos eventos de indisponibilidade externa vem da curva que liga o vento à potência da usina; enquanto a curva não existe, é o segundo menor valor gerado nos dez períodos anteriores no mesmo horário.", "In other words: the reference generation for external unavailability events comes from the curve that links wind to the plant's power; while the curve does not exist, it is the second lowest value generated in the ten previous periods at the same time of day."),
        ),
        ren1030(
          tx("art. 16, caput e §§ 2º e 5º (eólicas)", "art. 16, caput and §§ 2 and 5 (wind plants)"),
          // i18n: dado
          "Art. 16. Os pagamentos dos montantes financeiros relativos aos eventos de restrição de operação por Constrained-off das usinas ou conjunto de usinas eolioelétricas, classificados como razão de indisponibilidade externa, conforme inciso I do art. 14, serão realizados por meio de Encargo de Serviço de Sistema – ESS pela CCEE [...] § 2º O pagamento de ESS é devido somente nas situações em que a soma dos tempos, acumulados desde o início do ano civil, de restrição de operação por Constrained-off da respectiva usina ou conjunto de usinas eolioelétricas, classificada como razão de indisponibilidade externa, conforme inciso I do art. 14, superar 78h (setenta e oito horas). [...] § 5º A valoração do ESS deverá se dar pelo Preço de Liquidação das Diferenças – PLD do submercado da usina ou do conjunto de usinas eolioelétricas no respectivo período de comercialização.",
          tx("Em outras palavras: só os eventos de indisponibilidade externa são pagos, por ESS, e só quando o tempo acumulado de restrição da usina no ano passa de 78 horas; o valor é calculado ao PLD do submercado.", "In other words: only external unavailability events are paid, through the ESS, and only when the plant's accumulated restriction time in the year exceeds 78 hours; the amount is calculated at the PLD of the submarket."),
        ),
        ren1030(
          tx("arts. 18 e 20-F (a partir de quando valem as regras de pagamento)", "arts. 18 and 20-F (from when the payment rules apply)"),
          // i18n: dado
          "Art. 18. Somente eventos de restrição de operação por Constrained-off das usinas ou conjuntos de usinas eolioelétricas classificados como razão de indisponibilidade externa, conforme inciso I do art. 14, ocorridos a partir de 1º de outubro de 2021, estarão sujeitos ao tratamento estabelecido nos arts. 13 a 17 desta Resolução. [...] Art. 20-F Somente eventos de restrição de operação por constrained-off das Centrais Geradoras Fotovoltaicas ou conjuntos de Centrais Geradoras Fotovoltaicas classificados como razão de indisponibilidade externa, conforme inciso I do art. 20-B, ocorridos a partir de 1º de abril de 2024, estarão sujeitos ao tratamento estabelecido nos arts. 20-A a 20-E deste normativo.",
          tx("Em outras palavras: o tratamento de pagamento da norma só vale para eventos de indisponibilidade externa, a partir de 1º de outubro de 2021 nas eólicas e de 1º de abril de 2024 nas fotovoltaicas; antes dessas datas valem regras específicas dos arts. 19 e 20-G.", "In other words: the payment treatment of the norm only applies to external unavailability events, from Oct 1, 2021 at wind plants and from Apr 1, 2024 at photovoltaic plants; before these dates, specific rules of arts. 19 and 20-G apply."),
        ),
        ren1030(
          tx("arts. 20-A, 20-C § 5º e 20-D § 2º (centrais fotovoltaicas, Título II-A)", "arts. 20-A, 20-C § 5 and 20-D § 2 (photovoltaic plants, Title II-A)"),
          // i18n: dado
          "Art. 20-A Para efeitos deste Título, eventos de restrição de operação por constrained-off são definidos como a redução da produção de energia por Centrais Geradoras Fotovoltaicas despachadas centralizadamente ou conjuntos de Centrais Geradoras Fotovoltaicas considerados na programação, decorrente de comando do Operador Nacional do Sistema Elétrico – ONS, que tenham sido originados externamente às instalações das respectivas Centrais Geradoras Fotovoltaicas. [...] a média aritmética entre os quinto e sexto valores ordenados de energia gerada nos 10 (dez) períodos imediatamente anteriores coincidentes com o horário da restrição de operação em análise. [...] superar 30 horas e 30 minutos.",
          tx("Em outras palavras: para as centrais fotovoltaicas vale a mesma definição e a mesma lógica de razões e de pagamento, com referência própria (média do quinto e do sexto valores ordenados dos dez períodos anteriores, até a função de produtividade existir) e limite de 30 horas e 30 minutos no ano.", "In other words: for photovoltaic plants the same definition and the same logic of reasons and payment apply, with their own reference (mean of the fifth and sixth ordered values of the ten previous periods, until the productivity function exists) and a limit of 30 hours and 30 minutes in the year."),
        ),
        {
          orgao: tx("MME e EPE", "MME and EPE"),
          documento: tx("Nota Técnica EPE-DEE-NT-096/2022-r0, Constrained-off de usinas eólicas, período definitivo (novembro de 2022), introdução, página 6, pedido do MME à EPE", "EPE Technical Note EPE-DEE-NT-096/2022-r0, Constrained-off of wind plants, final period (November 2022), introduction, page 6, request from the MME to the EPE"),
          url: URL_NT_096,
          // i18n: dado
          trecho: "o MME solicitou à EPE a realização de análises dos efeitos do constrained-off nos montantes de garantias físicas das usinas eólicas elegíveis à revisão prevista para o ano de 2022.",
        },
        {
          orgao: "ONS",
          documento: tx("Portal de dados abertos, conjunto \"Dados de Restrição de Operação por Constrained-off de Usinas Eólicas\" (descrição)", "Open data portal, dataset «Dados de Restrição de Operação por Constrained-off de Usinas Eólicas» (description)"),
          url: "https://dados.ons.org.br/dataset/restricao_coff_eolica_usi",
          // i18n: dado
          trecho: "Informações associadas à apuração das restrições de operação por Constrained-off nas usinas eólicas classificadas nas modalidades Tipo I, Tipo II-B e Tipo II-C",
        },
      ],
      limitacoes: [
        tx("A REN ANEEL nº 1.030/2022 foi lida no texto compilado da cópia do Internet Archive de 08/01/2025, porque o endereço oficial da ANEEL responde 403 a requisições automatizadas e o bloqueio não foi contornado; alterações posteriores a essa data não estão cobertas.", "REN ANEEL No. 1.030/2022 was read in the consolidated text of the Internet Archive copy of Jan 8, 2025, because ANEEL's official address returns 403 to automated requests and the block was not circumvented; amendments after that date are not covered."),
        tx("A REN descreve a geração de referência só para os eventos de indisponibilidade externa. Como o ONS calcula a referência das razões de confiabilidade elétrica e energética não foi conferido, e a energia não gerada que o painel publica por essas razões herda essa lacuna.", "The REN describes the reference generation only for external unavailability events. How the ONS calculates the reference for the electrical reliability and energy reasons was not checked, and the energy not generated that the panel publishes for these reasons inherits this gap."),
        tx("A energia não gerada é estimativa sobre uma referência de geração, não medição. A regra do observatório (referência menos verificada, só nas meias horas com geração limitada) é método do observatório sobre os dados do ONS.", "The energy not generated is an estimate against a reference generation, not a measurement. The observatory's rule (reference minus verified, only in the half hours with limited generation) is the observatory's method on ONS data."),
      ],
      vejaNoPortal: [{ rotulo: tx("Geração: renováveis restringidas", "Generation: curtailed renewables"), href: "/setor-eletrico/geracao/restricoes#p023" }],
    },
  ];
}
export const CONCEITOS_IDIOMAS = montarNosDoisIdiomas(montarConceitos);
export const CONCEITOS: Conceito[] = CONCEITOS_IDIOMAS.pt;
