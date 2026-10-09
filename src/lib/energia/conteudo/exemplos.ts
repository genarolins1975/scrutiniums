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
import { dataBR, mesAno, num, pct, reais } from "../formato";
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
          t(`Na hora mais cara de ${dataBR(pld.dia_referencia)} no Sudeste/Centro-Oeste (${se.quando_max.slice(11, 13)}h), o PLD foi `),
          t(`${reais(se.max_hora)}/MWh`, "OBSERVADO"),
          t(": segundo a CCEE, esse é o preço do Mercado de Curto Prazo naquela hora e submercado. Os resultados mensais da liquidação, por submercado, estão no módulo Mercado."),
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
          t(`Em ${dataBR(s.ear.dia)}, a EAR do SIN, calculada pela soma das EAR dos quatro subsistemas dividida pela soma das EAR máximas, era `),
          t(`${pct(s.ear.valor)} da EAR máxima`, "CALCULADO"),
          t("."),
        ],
        href: "/setor-eletrico/agua-e-clima#ear",
      };
    }
    case "submercado": {
      if (!integra(pld)) return null;
      return {
        partes: [
          t(`Em ${dataBR(pld.dia_referencia)}, a média diária do PLD foi `),
          t(pld.cartoes.map((c) => `${reais(c.media_dia)} no ${c.nome}`).join(", "), "CALCULADO"),
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
          t(`Para a semana operativa identificada pelo ONS com a data ${dataBR(cmo.semana_referencia)}, o CMO publicado para o Sudeste/Centro-Oeste foi `),
          t(`${reais(se.semanal)}/MWh (patamares leve ${reais(se.leve)}, médio ${reais(se.media)} e pesado ${reais(se.pesada)})`, "OBSERVADO"),
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
          t(`Em ${dataBR(s.ena.dia)}, a ENA bruta do Sul foi `),
          t(`${pct(s.ena.pct_mlt_dia, 1)} da MLT`, "OBSERVADO"),
          t("; no acumulado de 30 dias (soma da ENA sobre soma da MLT), "),
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
        partes: [t(`Em ${dataBR(carga.dia_referencia)}, a carga do SIN, soma dos quatro subsistemas, foi de `), t(`${num(s.dia, 0)} MWmed`, "CALCULADO"), t(".")],
        href: "/setor-eletrico/carga",
      };
    }
    case "geracao-centralizada": {
      if (!integra(ger)) return null;
      const m = ger.regioes.find((r) => r.rg === "SIN")?.["7d"];
      if (!m) return null;
      return {
        partes: [
          t(`Nos 7 dias até ${dataBR(m.fim)}, a geração verificada do SIN foi de `),
          t(
            `${num(m.total_mwmed, 0)} MWmed em média: ${pct(m.participacao.hidraulica)} hidráulica, ${pct(m.participacao.termica)} térmica, ${pct(m.participacao.eolica)} eólica e ${pct(m.participacao.solar)} solar`,
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
        partes: [t(`Em ${dataBR(rede.dia_referencia)}, o fluxo médio diário do Nordeste para o Sudeste/Centro-Oeste foi de `), t(`${num(f.fluxo_dia, 0)} MWmed`, "CALCULADO"), t(".")],
        href: "/setor-eletrico/rede",
      };
    }
    case "cvu": {
      const c = lerGold<GoldGeracaoDetalhe>("geracao_detalhe.json")?.termica?.cvu;
      const gas = c?.por_combustivel.find((x) => x.categoria === "gas");
      if (!c || !gas || gas.p50 === null) return null;
      return {
        partes: [
          t(`Na semana operativa de ${dataBR(c.semana.inicio)}${c.semana.fim ? ` a ${dataBR(c.semana.fim)}` : ""}${c.semana.estudo ? ` (${c.semana.estudo})` : ""}, o CVU das ${num(gas.n, 0)} usinas a gás natural ia de `),
          t(`${reais(gas.min)} a ${reais(gas.max)}/MWh`, "OBSERVADO"),
          t("; a mediana entre elas era "),
          t(`${reais(gas.p50)}/MWh`, "CALCULADO"),
          t(". É o valor de cada usina considerado no Programa Mensal da Operação, não o CMO nem o PLD."),
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
          t(`Em ${dataBR(pld.dia_referencia)}, a média das 24 horas do PLD no Sudeste/Centro-Oeste foi `),
          t(`${reais(se.media_dia)}/MWh`, "CALCULADO"),
          t(". Segundo a CCEE, cada hora desse preço sai de um cálculo com os modelos Newave, Decomp e Dessem; o observatório não publica saídas do NEWAVE."),
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
          t(`Em ${mesAno(u.mes)}, o consumo contabilizado pela CCEE na classe de agente Distribuidor, que o observatório lê como ACR, foi de `),
          t(`${num(u.acr_mwmed, 0)} MWmed`, "CALCULADO"),
          t("; nas classes do ACL, sem a exportação, "),
          t(`${num(u.acl_mwmed, 0)} MWmed`, "CALCULADO"),
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
          t(`Em ${mesAno(u.mes)}, as usinas do MRE geraram `),
          t(`${num(u.geracao_mre_mwmed, 0)} MWmed`, "CALCULADO"),
          t(" diante de uma garantia física modulada e ajustada pelo fator de disponibilidade de "),
          t(`${num(u.gf_modulada_fdisp_mwmed, 0)} MWmed`, "CALCULADO"),
          t(
            `: no mês, geraram ${u.geracao_mre_mwmed! < u.gf_modulada_fdisp_mwmed! ? "menos" : u.geracao_mre_mwmed! > u.gf_modulada_fdisp_mwmed! ? "mais" : "o mesmo"} que a garantia física. A razão entre as duas é o GSF publicado no painel.`,
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
          t(`Em ${mesAno(u.mes)}, as usinas do MRE geraram, juntas, `),
          t(`${num(u.geracao_mre_mwmed, 0)} MWmed`, "CALCULADO"),
          t(", contra "),
          t(`${num(u.gf_modulada_fdisp_mwmed, 0)} MWmed`, "CALCULADO"),
          t(" de garantia física modulada e ajustada pelo fator de disponibilidade. O mecanismo é esse conjunto que compartilha o risco da água; a razão entre os dois números é o GSF (ver o verbete GSF)."),
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
      const nota = semArmazenamento.length ? ` (${semArmazenamento.length === 1 ? `o ${semArmazenamento[0]} não tem` : `${semArmazenamento.join(" e ")} não têm`} armazenamento, e por isso não tem percentual)` : "";
      return {
        partes: [
          t(`Em ${dataBR(menor.dia)}, o ONS publicou a energia armazenada de `),
          t(`${num(todos.length, 0)} REE`, "CALCULADO"),
          t(`. Entre os ${num(armazenam.length, 0)} que têm armazenamento${nota}, a EAR variou de `),
          t(`${pct(menor.ear_pct, 1)} da EAR máxima no ${rotuloRecorte("ree", menor.nome)} a ${pct(maior.ear_pct, 1)} no ${rotuloRecorte("ree", maior.nome)}`, "OBSERVADO"),
          t(": cada REE tem o próprio perímetro e a própria EAR máxima. O link abre o painel no REE de menor EAR."),
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
          t(`Em ${u.ano}, nas concessionárias que publicam a separação técnica (${pct(u.cobertura_tecnica_pct, 1)} da energia injetada de referência), as perdas técnicas somaram `),
          t(`${pct(u.taxa_tecnica_pct, 1)} da energia injetada`, "ESTIMADO"),
          t(": percentual estimado por modelo e aplicado à energia injetada, não medição."),
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
          t(`No trecho mais recente de cada uma das ${num(l.length, 0)} distribuidoras com série, o percentual técnico regulatório implícito no SAMP vai de `),
          t(`${num(min.atual, 1)}% (${min.rotulo}) a ${num(max.atual, 1)}% (${max.rotulo}), com mediana de ${num(meio, 1)}%, da energia injetada publicada`, "ESTIMADO"),
          t(
            `. As ${num(l.length, 0)} são as distribuidoras${comDado ? ` (de ${num(comDado, 0)} com dado de ${ano})` : ""} em que o observatório consegue inferir o percentual da série do SAMP. O percentual regulatório não técnico não está em base aberta acessível.`,
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
          t(`O Anexo I da agenda vigente${a.portaria ? ` (${a.portaria})` : ""} prevê `),
          t(anos.map((x) => `${num(a.por_ano![x], 0)} atividades para ${x}`).join(" e "), "CALCULADO"),
          t(". Cada uma é uma previsão de edição de norma, não norma editada."),
        ],
        href: "/setor-eletrico/regulacao/consultas-e-agenda#p046",
      };
    }
    default:
      return null;
  }
}
