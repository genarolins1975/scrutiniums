import type { Agregado, Municipio } from "./tipos";
import { MEDIDAS, agregarMedida, type Medida } from "./medidas";
import { razaoPct } from "./municipios";

/**
 * Referências territoriais (Brasil, regiões, UFs) de cada medida, calculadas no
 * servidor a partir das fontes agregadas oficiais, para que a mesma medida não
 * tenha dois números na plataforma:
 *  - Censo: tabulações do IBGE em cada nível (agregados.json);
 *  - SINISA: consolidação oficial do Ministério das Cidades (os mesmos arquivos do OBEE);
 *  - NR 8: não há agregado oficial; soma de numeradores e denominadores municipais.
 */

export type Referencia = { pct: number | null; contagem: number | null; origem: string };
export type MapaReferencias = Record<string, Record<string, Referencia>>;

function censoPct(a: Agregado, num: (a: Agregado) => number | null | undefined): Referencia {
  const mor = a.censo2022.moradores;
  const n = num(a);
  return { pct: razaoPct(n, mor?.agua.total ?? null), contagem: n ?? null, origem: "Tabulação do IBGE no nível do território" };
}

function referenciaDe(med: Medida, a: Agregado, membros: readonly Municipio[]): Referencia {
  if (med.id.startsWith("des-")) {
    const [num, den] = a.desigualdades?.[med.id.slice(4)] ?? [null, null];
    return { pct: razaoPct(num, den), contagem: den != null && den > 0 ? num : null, origem: "Tabulação do IBGE no nível do território, Censo 2022" };
  }
  const mor = a.censo2022.moradores;
  switch (med.id) {
    case "c22-agua-sem-ligacao":
      return censoPct(a, () => mor?.agua.sem_ligacao);
    case "c22-agua-ligacao-outra-fonte":
      return censoPct(a, () => mor?.agua.lig_outra);
    case "c22-esgoto-sem-rede":
      return censoPct(a, () => (mor?.esgoto.total != null && mor.esgoto.rede != null ? mor.esgoto.total - mor.esgoto.rede : null));
    case "c22-esgoto-sem-rede-nem-septica":
      return censoPct(a, () => mor?.esgoto.sem_rede_nem_septica);
    case "sinisa-agua-atendida":
      return {
        pct: a.sinisa.agua.indicadores.IAG0001 ?? null,
        contagem: a.sinisa.agua.pop_atendida,
        origem: "Consolidação oficial do SINISA (IAG0001 e população atendida do módulo)",
      };
    case "sinisa-esgoto-atendida":
      return {
        pct: a.sinisa.esgoto.indicadores.IES0001 ?? null,
        contagem: a.sinisa.esgoto.pop_atendida,
        origem: "Consolidação oficial do SINISA (IES0001 e população atendida do módulo)",
      };
    case "sinisa-agua-nao-atendida": {
      const v = a.sinisa.agua.indicadores.IAG0001;
      const dfe = a.cobertura_sinisa.agua_dfe0001;
      const at = a.sinisa.agua.pop_atendida;
      return {
        pct: v == null ? null : 100 - v,
        contagem: dfe != null && at != null ? dfe - at : null,
        origem: "Consolidação oficial do SINISA (IAG0001 e população do módulo)",
      };
    }
    case "sinisa-esgoto-nao-atendida": {
      const v = a.sinisa.esgoto.indicadores.IES0001;
      return { pct: v == null ? null : 100 - v, contagem: null, origem: "Consolidação oficial do SINISA (IES0001)" };
    }
    case "sinisa-esgoto-tratado-coletado":
      return { pct: a.sinisa.esgoto.indicadores.IES2004 ?? null, contagem: null, origem: "Consolidação oficial do SINISA (IES2004)" };
    case "sinisa-esgoto-tratado-consumido":
      return { pct: a.sinisa.esgoto.indicadores.IES2003 ?? null, contagem: null, origem: "Consolidação oficial do SINISA (IES2003)" };
    case "evolucao-agua-rede": {
      const p22 = razaoPct(mor?.agua.rede, mor?.agua.total);
      const p10 = razaoPct(a.censo2010?.agua_rede, a.censo2010?.moradores);
      return { pct: p22 == null || p10 == null ? null : p22 - p10, contagem: null, origem: "Tabulações do IBGE de 2010 e 2022" };
    }
    case "evolucao-esgoto-rede": {
      const p22 = razaoPct(mor?.esgoto.rede_pluvial, mor?.esgoto.total);
      const p10 = razaoPct(a.censo2010?.esgoto_rede_pluvial, a.censo2010?.esgoto_moradores);
      return { pct: p22 == null || p10 == null ? null : p22 - p10, contagem: null, origem: "Tabulações do IBGE de 2010 e 2022" };
    }
    default: {
      const r = agregarMedida(med, membros);
      return { pct: r.pct, contagem: r.contagem, origem: `Soma de numeradores e denominadores de ${r.municipios} municípios` };
    }
  }
}

export function referencias(agregados: readonly Agregado[], municipios: readonly Municipio[], ids?: readonly string[]): MapaReferencias {
  const out: MapaReferencias = {};
  for (const med of MEDIDAS) {
    if (ids && !ids.includes(med.id)) continue;
    out[med.id] = {};
    for (const a of agregados) {
      const membros = a.id === "BR" ? municipios : municipios.filter((m) => m.uf === a.id || m.regiao === a.id);
      out[med.id][a.id] = referenciaDe(med, a, membros);
    }
  }
  return out;
}
