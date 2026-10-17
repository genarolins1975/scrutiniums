import type { Conceito } from "./conceitos";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

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

function montarConceitos(tx: TxIdioma): Conceito[] {
  return [
    {
      slug: "tarifa-social",
      sigla: "TSEE",
      nome: tx("Tarifa Social de Energia Elétrica", "Tarifa Social (social electricity tariff)"),
      grupo: "Inclusão", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase:
        tx("Política pública de descontos na fatura de energia elétrica para famílias de baixa renda e para idosos ou pessoas com deficiência que recebem o Benefício de Prestação Continuada (BPC), custeada pela Conta de Desenvolvimento Energético (CDE).", "Public policy of discounts on the electricity bill for low-income families and for elderly people or people with disabilities who receive the Continuous Cash Benefit (BPC), funded by the Energy Development Account (CDE)."),
      porQueImporta:
        tx("A distribuidora concede o desconto e é reembolsada pela CDE na medida do benefício concedido. Desde janeiro de 2022 a concessão é automática para as famílias com direito em que um membro é titular do contrato com a distribuidora; cada família tem o benefício em uma só unidade consumidora.", "The distribution utility grants the discount and is reimbursed by the CDE in the amount of the benefit granted. Since January 2022 the benefit is granted automatically to eligible families in which one member holds the contract with the distribution utility; each family has the benefit in a single consumer unit."),
      comoEMedido:
        tx("Nas faturas emitidas a partir de 5 de julho de 2025 (MPV nº 1.300/2025), o desconto é de 100% para o consumo até 80 kWh no mês, e a parcela acima disso não tem desconto. Neste observatório, o alcance é contado em unidades consumidoras (SCS da ANEEL) e em faturas (Beneficiários da CDE), nunca em famílias.", "On bills issued from Jul 5, 2025 (Provisional Measure MPV No. 1.300/2025), the discount is 100% for consumption up to 80 kWh in the month, and the portion above that has no discount. In this observatory, reach is counted in consumer units (ANEEL SCS) and in bills (CDE beneficiaries), never in families."),
      relacoes: [],
      fontes: [
        {
          orgao: "ANEEL",
          documento: tx("Página \"Tarifa Social\" no portal gov.br/aneel, acessada em 30/09/2026", "ANEEL page «Tarifa Social» on the gov.br/aneel portal, accessed on Sep 30, 2026"),
          url: PAGINA_ANEEL,
          trecho:
            // i18n: dado
            "[...] é uma política pública de descontos na fatura de energia elétrica para: famílias de baixa renda; e para idosos ou pessoas com deficiência que recebam o Benefício de Prestação Continuada da Assistência Social [...] Passa a existir apenas uma faixa de desconto para os beneficiários da Tarifa Social: 100% para o consumo até 80 kWh mensais. A parcela de consumo que ultrapassar 80 kWh não receberá desconto. [...] Esse desconto é custeado pela Conta de Desenvolvimento Energético [...] encargo setorial custeado principalmente pelos demais consumidores [...] A distribuidora concede o desconto e é reembolsada na exata medida do benefício concedido.",
          parafrase:
            tx("Em outras palavras: é um desconto na conta de luz para famílias de baixa renda e para quem recebe o BPC; desde a regra nova, o consumo até 80 kWh no mês é gratuito e o que passar disso é cobrado sem desconto; o desconto é pago pela CDE, um encargo custeado principalmente pelos demais consumidores, e a distribuidora que o concede é reembolsada no mesmo valor.", "In other words: it is a discount on the electricity bill for low-income families and for those who receive the BPC; under the new rule, consumption up to 80 kWh in the month is free and anything above that is charged without a discount; the discount is paid by the CDE, a charge funded mainly by the other consumers, and the distribution utility that grants it is reimbursed in the same amount."),
        },
        {
          orgao: "ANEEL",
          documento: tx("Mesma página, seções sobre requisitos e concessão automática, acessada em 30/09/2026", "Same page, sections on eligibility requirements and automatic granting, accessed on Sep 30, 2026"),
          url: PAGINA_ANEEL,
          trecho:
            // i18n: dado
            "[...] com renda familiar mensal por pessoa menor ou igual a meio salário-mínimo nacional [...] cada família terá direito ao benefício da Tarifa Social em apenas uma unidade consumidora; [...] a Tarifa Social é concedida automaticamente desde janeiro de 2022, para as famílias que têm direito e cujo um dos membros seja titular do contrato com a distribuidora.",
        },
      ],
      limitacoes: [
        tx("Unidade consumidora e fatura não são família: uma família pode não ser titular da conta da casa em que mora.", "A consumer unit or a bill is not a family: a family might not hold the account of the house it lives in."),
        tx("O critério de renda é um entre três; o BPC e o uso de equipamento médico também dão direito ao desconto.", "The income criterion is one of three; the BPC and the use of medical equipment also give the right to the discount."),
      ],
      vejaNoPortal: [
        { rotulo: tx("Tarifa Social: alcance por distribuidora, UF e mês", "Tarifa Social: reach by distribution utility, state and month"), href: "/setor-eletrico/inclusao-energetica/tarifa-social" },
        { rotulo: tx("Cobertura potencial (proxy)", "Potential coverage (proxy)"), href: "/setor-eletrico/inclusao-energetica/cobertura" },
      ],
    },
  ];
}
export const CONCEITOS_IDIOMAS = montarNosDoisIdiomas(montarConceitos);
export const CONCEITOS: Conceito[] = CONCEITOS_IDIOMAS.pt;
