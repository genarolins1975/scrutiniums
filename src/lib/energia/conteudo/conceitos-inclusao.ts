import type { Conceito } from "./conceitos";

/**
 * Verbetes do módulo inclusao. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * "tarifa-social": página da ANEEL "Tarifa Social" (gov.br/aneel), acessada em
 * 30/09/2026 (a página informa atualização em 04/07/2025). Os trechos abaixo foram
 * conferidos literalmente no texto da página nesse acesso; a paráfrase não
 * acrescenta nada que eles não digam.
 */
const PAGINA_ANEEL = "https://www.gov.br/aneel/pt-br/assuntos/tarifas/tarifa-social";

export const CONCEITOS: Conceito[] = [
  {
    slug: "tarifa-social",
    sigla: "TSEE",
    nome: "Tarifa Social de Energia Elétrica",
    grupo: "Inclusão",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase:
      "Política pública de descontos na fatura de energia elétrica para famílias de baixa renda e para idosos ou pessoas com deficiência que recebem o Benefício de Prestação Continuada (BPC), custeada pela Conta de Desenvolvimento Energético (CDE).",
    porQueImporta:
      "A distribuidora concede o desconto e é reembolsada pela CDE na medida do benefício concedido. Desde janeiro de 2022 a concessão é automática para as famílias com direito em que um membro é titular do contrato com a distribuidora; cada família tem o benefício em uma só unidade consumidora.",
    comoEMedido:
      "Nas faturas emitidas a partir de 5 de julho de 2025 (MPV nº 1.300/2025), o desconto é de 100% para o consumo até 80 kWh no mês, e a parcela acima disso não tem desconto. Neste observatório, o alcance é contado em unidades consumidoras (SCS da ANEEL) e em faturas (Beneficiários da CDE), nunca em famílias.",
    relacoes: [],
    fontes: [
      {
        orgao: "ANEEL",
        documento: "Página \"Tarifa Social\" no portal gov.br/aneel, acessada em 30/09/2026",
        url: PAGINA_ANEEL,
        trecho:
          "[...] é uma política pública de descontos na fatura de energia elétrica para: famílias de baixa renda; e para idosos ou pessoas com deficiência que recebam o Benefício de Prestação Continuada da Assistência Social [...] Passa a existir apenas uma faixa de desconto para os beneficiários da Tarifa Social: 100% para o consumo até 80 kWh mensais. A parcela de consumo que ultrapassar 80 kWh não receberá desconto. [...] Esse desconto é custeado pela Conta de Desenvolvimento Energético [...] encargo setorial custeado principalmente pelos demais consumidores [...] A distribuidora concede o desconto e é reembolsada na exata medida do benefício concedido.",
        parafrase:
          "Em outras palavras: é um desconto na conta de luz para famílias de baixa renda e para quem recebe o BPC; desde a regra nova, o consumo até 80 kWh no mês é gratuito e o que passar disso é cobrado sem desconto; o desconto é pago pela CDE, um encargo custeado principalmente pelos demais consumidores, e a distribuidora que o concede é reembolsada no mesmo valor.",
      },
      {
        orgao: "ANEEL",
        documento: "Mesma página, seções sobre requisitos e concessão automática, acessada em 30/09/2026",
        url: PAGINA_ANEEL,
        trecho:
          "[...] com renda familiar mensal por pessoa menor ou igual a meio salário-mínimo nacional [...] cada família terá direito ao benefício da Tarifa Social em apenas uma unidade consumidora; [...] a Tarifa Social é concedida automaticamente desde janeiro de 2022, para as famílias que têm direito e cujo um dos membros seja titular do contrato com a distribuidora.",
      },
    ],
    limitacoes: [
      "Unidade consumidora e fatura não são família: uma família pode não ser titular da conta da casa em que mora.",
      "O critério de renda é um entre três; o BPC e o uso de equipamento médico também dão direito ao desconto.",
    ],
    vejaNoPortal: [
      { rotulo: "Tarifa Social: alcance por distribuidora, UF e mês", href: "/setor-eletrico/inclusao-energetica/tarifa-social" },
      { rotulo: "Cobertura potencial (proxy)", href: "/setor-eletrico/inclusao-energetica/cobertura" },
    ],
  },
];
