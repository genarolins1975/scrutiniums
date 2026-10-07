import type { Conceito, FonteOficial } from "./conceitos";

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

const ren1030 = (dispositivo: string, trecho: string, parafrase?: string): FonteOficial => ({
  orgao: "ANEEL",
  documento: `Resolução Normativa nº 1.030, de 26 de julho de 2022, ${dispositivo} (texto compilado, lido na cópia do Internet Archive de 08/01/2025)`,
  url: URL_REN_1030,
  trecho,
  parafrase,
});

export const CONCEITOS: Conceito[] = [
  {
    slug: "constrained-off",
    nome: "Constrained-off",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-07",
    emUmaFrase:
      "Redução da produção de energia de usinas eólicas ou fotovoltaicas despachadas centralizadamente, ou de conjuntos de usinas considerados na programação, por comando do Operador Nacional do Sistema Elétrico (ONS), em evento originado fora das instalações das próprias usinas.",
    porQueImporta:
      "Quem arca com a energia que a usina deixou de gerar depende da razão do evento. A REN ANEEL nº 1.030/2022 classifica cada evento em indisponibilidade externa, confiabilidade elétrica ou razão energética, e só a indisponibilidade externa gera pagamento, por Encargo de Serviço de Sistema (ESS), valorado ao PLD do submercado e devido apenas depois que o tempo acumulado de restrição no ano civil passa de 78 horas nas eólicas e de 30 horas e 30 minutos nas fotovoltaicas; o ONS pode atualizar esses limites. A EPE avaliou, a pedido do MME, os efeitos do constrained-off nos montantes de garantia física das eólicas elegíveis à revisão de 2022.",
    comoEMedido:
      "Em energia (MWh ou GWh) e em potência (MW), por usina ou conjunto, por razão e por período. A energia não gerada é estimada contra uma geração de referência que o ONS calcula. Nos eventos de indisponibilidade externa, a referência das eólicas sai da curva de produtividade da usina, que liga a potência de saída à velocidade do vento, e, até a curva existir, é o segundo menor valor de energia gerada nos 10 períodos anteriores coincidentes com o horário da restrição; nas fotovoltaicas, é a média aritmética entre o quinto e o sexto valores ordenados desses 10 períodos até a função de produtividade existir. A REN descreve a referência só para a indisponibilidade externa. No observatório, a energia não gerada é a referência estimada pelo ONS menos a geração verificada, nas meias horas em que o ONS limitou a usina, somada por razão e por mês, e a taxa é a energia não gerada dividida pela soma da verificada com a não gerada.",
    relacoes: ["geracao-centralizada", "garantia-fisica", "ess"],
    fontes: [
      ren1030(
        "art. 13, caput e §§ 1º e 2º (eólicas)",
        "Art. 13. Para efeitos deste Título, eventos de restrição de operação por Constrained-off são definidos como a redução da produção de energia por usinas eolioelétricas despachadas centralizadamente ou usinas/conjuntos de usinas eolioelétricas considerados na programação, decorrente de comando do ONS, que tenham sido originados externamente às instalações das respectivas usinas. § 1º Considera-se instalações externas às respectivas usinas ou conjuntos de usinas, as instalações de transmissão classificadas como Rede Básica e Demais Instalações de Transmissão – DITs no âmbito da distribuição. § 2º Não se considera instalações externas às respectivas usinas ou conjuntos de usinas aquelas de uso exclusivo ou compartilhado do gerador, sob sua gestão ou de terceiros.",
        "Em outras palavras: constrained-off é a redução de geração comandada pelo ONS por um motivo que nasce fora da usina. São externas as instalações de transmissão da Rede Básica e as demais instalações de transmissão da distribuição; não são externas as instalações de uso exclusivo ou compartilhado do próprio gerador.",
      ),
      ren1030(
        "art. 14 (eólicas)",
        "Art. 14. O ONS deverá classificar os eventos de restrição de operação por Constrained-off de usinas ou conjuntos de usinas eolioelétricas de acordo com sua motivação em: I - Razão de indisponibilidade externa: motivados por indisponibilidades em instalações externas às respectivas usinas ou conjuntos de usinas conforme definições do art. 13. II - Razão de atendimento a requisitos de confiabilidade elétrica: motivados por razões de confiabilidade elétrica dos equipamentos pertencentes a instalações externas às respectivas usinas ou conjuntos de usinas conforme definições do art. 13 e que não tenham origem em indisponibilidades dos respectivos equipamentos. III - Razão energética: motivados pela impossibilidade de alocação de geração de energia na carga.",
        "Em outras palavras: o ONS classifica cada evento em uma de três razões: indisponibilidade em instalação externa, requisito de confiabilidade elétrica de equipamento externo ou impossibilidade de alocar a geração na carga.",
      ),
      ren1030(
        "art. 15, caput e § 5º (eólicas)",
        "Art. 15. O ONS deverá calcular a referência de geração de energia decorrente de evento de restrição de operação por Constrained-off das usinas ou conjuntos de usinas eolioelétricas, classificado como razão de indisponibilidade externa, conforme inciso I do art. 14, a partir da curva de produtividade da usina eolioelétrica, que relaciona a potência de saída da usina e a velocidade do vento. [...] § 5º Até a elaboração da curva de produtividade, será considerado como referência da frustração de geração de energia das usinas ou conjuntos de usinas eolioelétricas o segundo menor valor de energia gerada nos 10 (dez) períodos imediatamente anteriores coincidentes com o horário da restrição de operação em análise.",
        "Em outras palavras: a geração de referência dos eventos de indisponibilidade externa vem da curva que liga o vento à potência da usina; enquanto a curva não existe, é o segundo menor valor gerado nos dez períodos anteriores no mesmo horário.",
      ),
      ren1030(
        "art. 16, caput e §§ 2º e 5º (eólicas)",
        "Art. 16. Os pagamentos dos montantes financeiros relativos aos eventos de restrição de operação por Constrained-off das usinas ou conjunto de usinas eolioelétricas, classificados como razão de indisponibilidade externa, conforme inciso I do art. 14, serão realizados por meio de Encargo de Serviço de Sistema – ESS pela CCEE [...] § 2º O pagamento de ESS é devido somente nas situações em que a soma dos tempos, acumulados desde o início do ano civil, de restrição de operação por Constrained-off da respectiva usina ou conjunto de usinas eolioelétricas, classificada como razão de indisponibilidade externa, conforme inciso I do art. 14, superar 78h (setenta e oito horas). [...] § 5º A valoração do ESS deverá se dar pelo Preço de Liquidação das Diferenças – PLD do submercado da usina ou do conjunto de usinas eolioelétricas no respectivo período de comercialização.",
        "Em outras palavras: só os eventos de indisponibilidade externa são pagos, por ESS, e só quando o tempo acumulado de restrição da usina no ano passa de 78 horas; o valor é calculado ao PLD do submercado.",
      ),
      ren1030(
        "arts. 20-A, 20-C § 5º e 20-D § 2º (centrais fotovoltaicas, Título II-A)",
        "Art. 20-A Para efeitos deste Título, eventos de restrição de operação por constrained-off são definidos como a redução da produção de energia por Centrais Geradoras Fotovoltaicas despachadas centralizadamente ou conjuntos de Centrais Geradoras Fotovoltaicas considerados na programação, decorrente de comando do Operador Nacional do Sistema Elétrico – ONS, que tenham sido originados externamente às instalações das respectivas Centrais Geradoras Fotovoltaicas. [...] a média aritmética entre os quinto e sexto valores ordenados de energia gerada nos 10 (dez) períodos imediatamente anteriores coincidentes com o horário da restrição de operação em análise. [...] superar 30 horas e 30 minutos.",
        "Em outras palavras: para as centrais fotovoltaicas vale a mesma definição e a mesma lógica de razões e de pagamento, com referência própria (média do quinto e do sexto valores ordenados dos dez períodos anteriores, até a função de produtividade existir) e limite de 30 horas e 30 minutos no ano.",
      ),
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
      "A REN ANEEL nº 1.030/2022 foi lida no texto compilado da cópia do Internet Archive de 08/01/2025, porque o endereço oficial da ANEEL responde 403 a requisições automatizadas e o bloqueio não foi contornado; alterações posteriores a essa data não estão cobertas.",
      "A REN descreve a geração de referência só para os eventos de indisponibilidade externa. Como o ONS calcula a referência das razões de confiabilidade elétrica e energética não foi conferido, e a energia não gerada que o painel publica por essas razões herda essa lacuna.",
      "A energia não gerada é estimativa sobre uma referência de geração, não medição. A regra do observatório (referência menos verificada, só nas meias horas com geração limitada) é método do observatório sobre os dados do ONS.",
    ],
    vejaNoPortal: [{ rotulo: "Geração: renováveis restringidas", href: "/setor-eletrico/geracao/restricoes#p023" }],
  },
];
