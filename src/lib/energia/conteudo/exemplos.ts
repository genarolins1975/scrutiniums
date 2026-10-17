/**
 * "Exemplo real" de cada verbete: números do sistema lidos da gold no build.
 * Cada número traz o próprio selo de natureza (um valor publicado pela fonte é
 * OBSERVADO; média, soma, participação ou estatística da Scrutiniums é CALCULADO).
 * Sem dado, o verbete diz que o exemplo não está disponível. Quando o painel publica a
 * ficha de prova do número, o verbete usa também o exemplo com evidência
 * (evidencias-verbetes.ts); estes textos cobrem os verbetes sem ficha.
 */
import { gold, integra, lerGold } from "../gold";
import { idRecorte, rotuloRecorte } from "../agua";
import { dataBR, mesAno, nomeSubmercado, num, pct, reais } from "../formato";
import { tx } from "../idioma";
import { linhasRegulatorio } from "../perdas";
import type { Natureza } from "../tipos";
import type { AguaDetalheGold } from "../tipos-agua";
import type { GoldGeracaoDetalhe } from "../tipos-geracao";
import type { MercadoGold } from "../tipos-mercado";
import type { PerdasGold } from "../tipos-perdas";
import type { GoldRegulacao } from "../tipos-regulacao";

export type TrechoExemplo = { texto: string; natureza?: Natureza };
export type Exemplo = { partes: TrechoExemplo[]; href: string } | null;

const t = (texto: string, natureza?: Natureza): TrechoExemplo => ({ texto, natureza });

export function exemploDe(slug: string): Exemplo {
  const pld = gold.pld();
  const hid = gold.hidrologia();
  const carga = gold.carga();
  const ger = gold.geracao();
  const rede = gold.rede();
  const cmo = gold.cmo();
  switch (slug) {
    case "mcp": {
      if (!integra(pld)) return null;
      const se = pld.cartoes.find((c) => c.sm === "SE" && c.max_hora !== null);
      if (!se) return null;
      return {
        partes: [
          t(tx(`Na hora mais cara de ${dataBR(pld.dia_referencia)} no Sudeste/Centro-Oeste (${se.quando_max.slice(11, 13)}h), o PLD foi `, `In the most expensive hour of ${dataBR(pld.dia_referencia)} in the Southeast/Center-West (${se.quando_max.slice(11, 13)}:00), the PLD was `)),
          t(`${reais(se.max_hora)}/MWh`, "OBSERVADO"),
          t(tx(": segundo a CCEE, esse é o preço do Mercado de Curto Prazo naquela hora e submercado. Os resultados mensais da liquidação, por submercado, estão no módulo Mercado.", ": according to the CCEE, this is the price of the Short-Term Market in that hour and submarket. The monthly settlement results, by submarket, are in the Market module.")),
        ],
        href: "/setor-eletrico/pld#o-que-e",
      };
    }
    case "sin": {
      if (!integra(hid)) return null;
      const s = hid.subsistemas.find((x) => x.sm === "SIN");
      if (!s || s.ear.valor === null) return null;
      return {
        partes: [
          t(tx(`Em ${dataBR(s.ear.dia)}, a EAR do SIN, calculada pela soma das EAR dos quatro subsistemas dividida pela soma das EAR máximas, era `, `On ${dataBR(s.ear.dia)}, the EAR of the SIN, calculated as the sum of the EAR of the four subsystems divided by the sum of the maximum EAR, was `)),
          t(tx(`${pct(s.ear.valor)} da EAR máxima`, `${pct(s.ear.valor)} of the maximum EAR`), "CALCULADO"),
          t("."),
        ],
        href: "/setor-eletrico/agua-e-clima#ear",
      };
    }
    case "submercado": {
      if (!integra(pld)) return null;
      return {
        partes: [
          t(tx(`Em ${dataBR(pld.dia_referencia)}, a média diária do PLD foi `, `On ${dataBR(pld.dia_referencia)}, the daily average PLD was `)),
          t(pld.cartoes.map((c) => tx(`${reais(c.media_dia)} no ${c.nome}`, `${reais(c.media_dia)} in the ${nomeSubmercado(c.sm)}`)).join(", "), "CALCULADO"),
          t("."),
        ],
        href: "/setor-eletrico/pld#submercados",
      };
    }
    case "cmo":
    case "decomp": {
      if (!integra(cmo)) return null;
      const se = cmo.ultima_semana.find((x) => x.sm === "SE")!;
      return {
        partes: [
          t(tx(`Para a semana operativa identificada pelo ONS com a data ${dataBR(cmo.semana_referencia)}, o CMO publicado para o Sudeste/Centro-Oeste foi `, `For the operating week identified by the ONS with the date ${dataBR(cmo.semana_referencia)}, the CMO published for the Southeast/Center-West was `)),
          t(tx(`${reais(se.semanal)}/MWh (patamares leve ${reais(se.leve)}, médio ${reais(se.media)} e pesado ${reais(se.pesada)})`, `${reais(se.semanal)}/MWh (load levels light ${reais(se.leve)}, medium ${reais(se.media)} and heavy ${reais(se.pesada)})`), "OBSERVADO"),
          t("."),
        ],
        href: "/setor-eletrico/pld#cmo",
      };
    }
    case "ena":
    case "mlt": {
      if (!integra(hid)) return null;
      const s = hid.subsistemas.find((x) => x.sm === "S")!;
      return {
        partes: [
          t(tx(`Em ${dataBR(s.ena.dia)}, a ENA bruta do Sul foi `, `On ${dataBR(s.ena.dia)}, the gross ENA of the South was `)),
          t(tx(`${pct(s.ena.pct_mlt_dia, 1)} da MLT`, `${pct(s.ena.pct_mlt_dia, 1)} of the MLT`), "OBSERVADO"),
          t(tx("; no acumulado de 30 dias (soma da ENA sobre soma da MLT), ", "; over 30 days (sum of ENA over sum of MLT), ")),
          t(pct(s.ena.pct_mlt_30d, 1), "CALCULADO"),
          t("."),
        ],
        href: "/setor-eletrico/agua-e-clima/afluencia#p018",
      };
    }
    case "carga": {
      if (!integra(carga)) return null;
      const s = carga.subsistemas.find((x) => x.sm === "SIN")!;
      return {
        partes: [t(tx(`Em ${dataBR(carga.dia_referencia)}, a carga do SIN, soma dos quatro subsistemas, foi de `, `On ${dataBR(carga.dia_referencia)}, the load of the SIN, the sum of the four subsystems, was `)), t(tx(`${num(s.dia, 0)} MWmed`, `${num(s.dia, 0)} MWavg`), "CALCULADO"), t(".")],
        href: "/setor-eletrico/carga",
      };
    }
    case "geracao-centralizada": {
      if (!integra(ger)) return null;
      const m = ger.regioes.find((r) => r.rg === "SIN")?.["7d"];
      if (!m) return null;
      return {
        partes: [
          t(tx(`Nos 7 dias até ${dataBR(m.fim)}, a geração verificada do SIN foi de `, `In the 7 days to ${dataBR(m.fim)}, the verified generation of the SIN was `)),
          t(
            tx(`${num(m.total_mwmed, 0)} MWmed em média: ${pct(m.participacao.hidraulica)} hidráulica, ${pct(m.participacao.termica)} térmica, ${pct(m.participacao.eolica)} eólica e ${pct(m.participacao.solar)} solar`, `${num(m.total_mwmed, 0)} MWavg on average: ${pct(m.participacao.hidraulica)} hydro, ${pct(m.participacao.termica)} thermal, ${pct(m.participacao.eolica)} wind and ${pct(m.participacao.solar)} solar`),
            "CALCULADO",
          ),
          t("."),
        ],
        href: "/setor-eletrico/geracao",
      };
    }
    case "intercambio": {
      if (!integra(rede)) return null;
      const f = rede.fronteiras.find((x) => x.par === "NE_SE");
      if (!f || f.fluxo_dia === null) return null;
      return {
        partes: [t(tx(`Em ${dataBR(rede.dia_referencia)}, o fluxo médio diário do Nordeste para o Sudeste/Centro-Oeste foi de `, `On ${dataBR(rede.dia_referencia)}, the average daily flow from the Northeast to the Southeast/Center-West was `)), t(tx(`${num(f.fluxo_dia, 0)} MWmed`, `${num(f.fluxo_dia, 0)} MWavg`), "CALCULADO"), t(".")],
        href: "/setor-eletrico/rede",
      };
    }
    case "cvu": {
      const c = lerGold<GoldGeracaoDetalhe>("geracao_detalhe.json")?.termica?.cvu;
      const gas = c?.por_combustivel.find((x) => x.categoria === "gas");
      if (!c || !gas || gas.p50 === null) return null;
      return {
        partes: [
          t(tx(`Na semana operativa de ${dataBR(c.semana.inicio)}${c.semana.fim ? ` a ${dataBR(c.semana.fim)}` : ""}${c.semana.estudo ? ` (${c.semana.estudo})` : ""}, o CVU das ${num(gas.n, 0)} usinas a gás natural ia de `, `In the operating week of ${dataBR(c.semana.inicio)}${c.semana.fim ? ` to ${dataBR(c.semana.fim)}` : ""}${c.semana.estudo ? ` (${c.semana.estudo})` : ""}, the CVU of the ${num(gas.n, 0)} natural gas plants ranged from `)),
          t(tx(`${reais(gas.min)} a ${reais(gas.max)}/MWh`, `${reais(gas.min)} to ${reais(gas.max)}/MWh`), "OBSERVADO"),
          t(tx("; a mediana entre elas era ", "; the median among them was ")),
          t(`${reais(gas.p50)}/MWh`, "CALCULADO"),
          t(tx(". É o valor de cada usina considerado no Programa Mensal da Operação, não o CMO nem o PLD.", ". It is the value of each plant considered in the Monthly Operation Program, not the CMO or the PLD.")),
        ],
        href: "/setor-eletrico/geracao/termica#p022",
      };
    }
    case "newave": {
      if (!integra(pld)) return null;
      const se = pld.cartoes.find((c) => c.sm === "SE");
      if (!se || se.media_dia === null) return null;
      return {
        partes: [
          t(tx(`Em ${dataBR(pld.dia_referencia)}, a média das 24 horas do PLD no Sudeste/Centro-Oeste foi `, `On ${dataBR(pld.dia_referencia)}, the average of the 24 hours of the PLD in the Southeast/Center-West was `)),
          t(`${reais(se.media_dia)}/MWh`, "CALCULADO"),
          t(tx(". Segundo a CCEE, cada hora desse preço sai de um cálculo com os modelos Newave, Decomp e Dessem; o observatório não publica saídas do NEWAVE.", ". According to the CCEE, each hour of this price comes from a calculation with the Newave, Decomp and Dessem models; the observatory does not publish NEWAVE outputs.")),
        ],
        href: "/setor-eletrico/pld#hoje",
      };
    }
    case "acr": {
      const m = lerGold<MercadoGold>("mercado.json")?.livre_regulado?.ccee_mensal;
      const u = m ? [...m].reverse().find((x) => x.acl_mwmed !== null) : undefined;
      if (!u) return null;
      return {
        partes: [
          t(tx(`Em ${mesAno(u.mes)}, o consumo contabilizado pela CCEE na classe de agente Distribuidor, que o observatório lê como ACR, foi de `, `In ${mesAno(u.mes)}, the consumption accounted by the CCEE in the Distributor agent class, which the observatory reads as ACR, was `)),
          t(tx(`${num(u.acr_mwmed, 0)} MWmed`, `${num(u.acr_mwmed, 0)} MWavg`), "CALCULADO"),
          t(tx("; nas classes do ACL, sem a exportação, ", "; in the ACL classes, without exports, ")),
          t(tx(`${num(u.acl_mwmed, 0)} MWmed`, `${num(u.acl_mwmed, 0)} MWavg`), "CALCULADO"),
          t("."),
        ],
        href: "/setor-eletrico/mercado#livre-regulado",
      };
    }
    case "garantia-fisica": {
      const m = lerGold<MercadoGold>("mercado.json")?.mre_gsf?.mensal;
      const u = m ? [...m].reverse().find((x) => x.geracao_mre_mwmed !== null && x.gf_modulada_fdisp_mwmed !== null) : undefined;
      if (!u) return null;
      return {
        partes: [
          t(tx(`Em ${mesAno(u.mes)}, as usinas do MRE geraram `, `In ${mesAno(u.mes)}, the MRE plants generated `)),
          t(tx(`${num(u.geracao_mre_mwmed, 0)} MWmed`, `${num(u.geracao_mre_mwmed, 0)} MWavg`), "CALCULADO"),
          t(tx(" diante de uma garantia física modulada e ajustada pelo fator de disponibilidade de ", " against a physical guarantee modulated and adjusted by the availability factor of ")),
          t(tx(`${num(u.gf_modulada_fdisp_mwmed, 0)} MWmed`, `${num(u.gf_modulada_fdisp_mwmed, 0)} MWavg`), "CALCULADO"),
          t(
            tx(`: no mês, geraram ${u.geracao_mre_mwmed! < u.gf_modulada_fdisp_mwmed! ? "menos" : u.geracao_mre_mwmed! > u.gf_modulada_fdisp_mwmed! ? "mais" : "o mesmo"} que a garantia física. A razão entre as duas é o GSF publicado no painel.`, `: in the month, they generated ${u.geracao_mre_mwmed! < u.gf_modulada_fdisp_mwmed! ? "less" : u.geracao_mre_mwmed! > u.gf_modulada_fdisp_mwmed! ? "more" : "the same"} than the physical guarantee. The ratio between the two is the GSF published in the panel.`),
          ),
        ],
        href: "/setor-eletrico/mercado/mre-e-gsf#mre-gsf",
      };
    }
    case "mre": {
      const mensal = lerGold<MercadoGold>("mercado.json")?.mre_gsf?.mensal;
      const u = Array.isArray(mensal) ? mensal[mensal.length - 1] : undefined;
      if (!u || !Number.isFinite(u.geracao_mre_mwmed) || !Number.isFinite(u.gf_modulada_fdisp_mwmed)) return null;
      return {
        partes: [
          t(tx(`Em ${mesAno(u.mes)}, as usinas do MRE geraram, juntas, `, `In ${mesAno(u.mes)}, the MRE plants generated, together, `)),
          t(tx(`${num(u.geracao_mre_mwmed, 0)} MWmed`, `${num(u.geracao_mre_mwmed, 0)} MWavg`), "CALCULADO"),
          t(tx(", contra ", ", against ")),
          t(tx(`${num(u.gf_modulada_fdisp_mwmed, 0)} MWmed`, `${num(u.gf_modulada_fdisp_mwmed, 0)} MWavg`), "CALCULADO"),
          t(tx(" de garantia física modulada e ajustada pelo fator de disponibilidade. O mecanismo é esse conjunto que compartilha o risco da água; a razão entre os dois números é o GSF (ver o verbete GSF).", " of physical guarantee modulated and adjusted by the availability factor. The mechanism is this group that shares the water risk; the ratio between the two numbers is the GSF (see the GSF entry).")),
        ],
        href: "/setor-eletrico/mercado/mre-e-gsf#mre-gsf",
      };
    }
    case "ree": {
      const todos = lerGold<AguaDetalheGold>("agua_detalhe.json")?.armazenamento?.ree;
      const armazenam = todos?.filter((r) => !r.sem_armazenamento && r.ear_pct !== null).sort((a, b) => a.ear_pct! - b.ear_pct!);
      if (!todos || !armazenam || armazenam.length < 2) return null;
      const menor = armazenam[0];
      const maior = armazenam[armazenam.length - 1];
      const semArmazenamento = todos.filter((r) => r.sem_armazenamento).map((r) => rotuloRecorte("ree", r.nome));
      const nota = semArmazenamento.length ? tx(` (${semArmazenamento.length === 1 ? `o ${semArmazenamento[0]} não tem` : `${semArmazenamento.join(" e ")} não têm`} armazenamento, e por isso não tem percentual)`, ` (${semArmazenamento.length === 1 ? `${semArmazenamento[0]} has no` : `${semArmazenamento.join(" and ")} have no`} storage, and therefore no percentage)`) : "";
      return {
        partes: [
          t(tx(`Em ${dataBR(menor.dia)}, o ONS publicou a energia armazenada de `, `On ${dataBR(menor.dia)}, the ONS published the stored energy of `)),
          t(`${num(todos.length, 0)} REE`, "CALCULADO"),
          t(tx(`. Entre os ${num(armazenam.length, 0)} que têm armazenamento${nota}, a EAR variou de `, `. Among the ${num(armazenam.length, 0)} that have storage${nota}, the EAR ranged from `)),
          t(tx(`${pct(menor.ear_pct, 1)} da EAR máxima no ${rotuloRecorte("ree", menor.nome)} a ${pct(maior.ear_pct, 1)} no ${rotuloRecorte("ree", maior.nome)}`, `${pct(menor.ear_pct, 1)} of the maximum EAR in ${rotuloRecorte("ree", menor.nome)} to ${pct(maior.ear_pct, 1)} in ${rotuloRecorte("ree", maior.nome)}`), "OBSERVADO"),
          t(tx(": cada REE tem o próprio perímetro e a própria EAR máxima. O link abre o painel no REE de menor EAR.", ": each REE has its own perimeter and its own maximum EAR. The link opens the panel on the REE with the lowest EAR.")),
        ],
        href: `/setor-eletrico/agua-e-clima?rec=ree&ent=${encodeURIComponent(idRecorte("ree", menor.nome))}#p017`,
      };
    }
    case "perdas-tecnicas": {
      const n = lerGold<PerdasGold>("perdas.json")?.nacional;
      const u = n ? [...n].reverse().find((x) => x.universo === "concessionarias" && !x.parcial && x.taxa_tecnica_pct !== null) : undefined;
      if (!u) return null;
      return {
        partes: [
          t(tx(`Em ${u.ano}, nas concessionárias que publicam a separação técnica (${pct(u.cobertura_tecnica_pct, 1)} da energia injetada de referência), as perdas técnicas somaram `, `In ${u.ano}, at the concession holders that publish the technical split (${pct(u.cobertura_tecnica_pct, 1)} of the reference injected energy), technical losses amounted to `)),
          t(tx(`${pct(u.taxa_tecnica_pct, 1)} da energia injetada`, `${pct(u.taxa_tecnica_pct, 1)} of injected energy`), "ESTIMADO"),
          t(tx(": percentual estimado por modelo e aplicado à energia injetada, não medição.", ": a percentage estimated by model and applied to injected energy, not a measurement.")),
        ],
        href: "/setor-eletrico/perdas/composicao#composicao",
      };
    }
    case "percentual-regulatorio-de-perdas": {
      const g = lerGold<PerdasGold>("perdas.json");
      if (!g?.distribuidoras) return null;
      const l = [...linhasRegulatorio(g.distribuidoras)].sort((a, b) => b.atual - a.atual || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
      if (l.length < 2) return null;
      const max = l[0];
      const min = l[l.length - 1];
      // mediana dos mesmos percentuais (o valor típico que o intervalo entre os extremos não dá); uma casa, como o resto do observatório
      const ord = l.map((x) => x.atual).sort((a, b) => a - b);
      const meio = ord.length % 2 ? ord[(ord.length - 1) / 2] : (ord[ord.length / 2 - 1] + ord[ord.length / 2]) / 2;
      const ano = g.referencia?.ano;
      const comDado = g.distribuidoras.filter((d) => d.referencia?.ano === ano).length;
      return {
        partes: [
          t(tx(`No trecho mais recente de cada uma das ${num(l.length, 0)} distribuidoras com série, o percentual técnico regulatório implícito no SAMP vai de `, `In the most recent stretch of each of the ${num(l.length, 0)} distribution utilities with a series, the regulatory technical percentage implicit in SAMP ranges from `)),
          t(tx(`${num(min.atual, 1)}% (${min.rotulo}) a ${num(max.atual, 1)}% (${max.rotulo}), com mediana de ${num(meio, 1)}%, da energia injetada publicada`, `${num(min.atual, 1)}% (${min.rotulo}) to ${num(max.atual, 1)}% (${max.rotulo}), with a median of ${num(meio, 1)}%, of the published injected energy`), "ESTIMADO"),
          t(
            tx(
              `. As ${num(l.length, 0)} são as distribuidoras${comDado ? ` (de ${num(comDado, 0)} com dado de ${ano})` : ""} em que o observatório consegue inferir o percentual da série do SAMP. O percentual regulatório não técnico não está em base aberta acessível.`,
              `. The ${num(l.length, 0)} are the distribution utilities${comDado ? ` (of ${num(comDado, 0)} with data for ${ano})` : ""} for which the observatory can infer the percentage from the SAMP series. The non-technical regulatory percentage is not in an accessible open database.`,
            ),
          ),
        ],
        href: "/setor-eletrico/perdas/regulatorio#painel-regulatorio",
      };
    }
    case "agenda-regulatoria": {
      const a = lerGold<GoldRegulacao>("regulacao.json")?.agenda;
      if (!a?.disponivel || !a.por_ano) return null;
      const anos = Object.keys(a.por_ano).sort();
      if (!anos.length) return null;
      return {
        partes: [
          t(tx(`O Anexo I da agenda vigente${a.portaria ? ` (${a.portaria})` : ""} prevê `, `Annex I of the agenda in force${a.portaria ? ` (${a.portaria})` : ""} provides for `)),
          t(anos.map((x) => tx(`${num(a.por_ano![x], 0)} atividades para ${x}`, `${num(a.por_ano![x], 0)} activities for ${x}`)).join(" e "), "CALCULADO"),
          t(tx(". Cada uma é uma previsão de edição de norma, não norma editada.", ". Each one is a plan to issue a norm, not an issued norm.")),
        ],
        href: "/setor-eletrico/regulacao/consultas-e-agenda#p046",
      };
    }
    default:
      return null;
  }
}
