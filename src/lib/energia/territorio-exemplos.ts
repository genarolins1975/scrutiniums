import type { Submercado } from "./tipos";
import type { DistribuidoraTerritorio, GoldTerritorio, MunicipiosTerritorio } from "./tipos-territorio";
import { municipiosDoJson, type MunicipioT } from "./territorio";

/**
 * Exemplos do artefato "Um endereço, cinco áreas" da página Minha região: para cada submercado, o município mais populoso dele, com o
 * número de cada área que o atende, lido da gold territorial e do índice municipal publicados (os mesmos que a ficha do explorador lê).
 * Nada é estimado: cada valor fica na área da sua fonte (submercado, distribuidora, conjunto elétrico ou município), com a data dela.
 * A escolha do exemplo é uma regra fixa (maior população do IBGE no submercado), não um número escrito à mão.
 */

export type ExemploDistribuidora = {
  cnpj: string;
  sigla: string;
  municipiosNaArea: number;
  tarifa: { valor: number; data: string | null } | null;
  perdas: { pct: number; ano: number | null; parcial: boolean } | null;
  continuidade: { dec: number; fec: number | null; ano: number | null } | null;
};

export type ExemploTerritorio = {
  ibge: string;
  nome: string;
  uf: string;
  sm: Submercado;
  nomeSm: string;
  ufsDoSm: number;
  pldDia: { valor: number; dia: string | null } | null;
  ear: { pct: number; dia: string | null } | null;
  distribuidoras: ExemploDistribuidora[];
  conjuntos: { n: number; comValor: number; decMin: number | null; decMax: number | null; ano: number | null };
  municipio: { pop: number | null; mmgdUn: number | null; mmgdKw: number | null; usinasN: number; usinasMw: number };
};

const ORDEM: readonly Submercado[] = ["SE", "S", "NE", "N"];

function distribuidoraDoExemplo(d: DistribuidoraTerritorio): ExemploDistribuidora {
  const t = d.indicadores.tarifa;
  const p = d.indicadores.perdas;
  const q = d.indicadores.qualidade;
  return {
    cnpj: d.cnpj,
    sigla: d.sigla,
    municipiosNaArea: d.area.municipios,
    tarifa: t.disponivel && t.total_rs_mwh !== null ? { valor: t.total_rs_mwh, data: t.periodo.fim } : null,
    perdas: p.disponivel && p.taxa_total_pct !== null ? { pct: p.taxa_total_pct, ano: p.ano, parcial: p.parcial } : null,
    continuidade: q.disponivel && q.dec_h !== null ? { dec: q.dec_h, fec: q.fec, ano: q.ano } : null,
  };
}

export function exemplosTerritorio(g: GoldTerritorio, arq: MunicipiosTerritorio): ExemploTerritorio[] {
  const municipios = municipiosDoJson(arq);
  const porCnpj = new Map(g.distribuidoras.map((d) => [d.cnpj, d]));
  const posConj = new Map(arq.conjuntos.campos.map((c, i) => [c, i]));
  const decDoConjunto = (id: number): number | null => {
    const l = arq.conjuntos.linhas[String(id)] as unknown[] | undefined;
    const v = l ? l[posConj.get("dec_h") ?? -1] : null;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const out: ExemploTerritorio[] = [];
  for (const sm of ORDEM) {
    const s = g.submercados.find((x) => x.sm === sm);
    if (!s) continue;
    let melhor: MunicipioT | null = null;
    for (const m of municipios) if (m.sm === sm && m.pop !== null && (!melhor || (m.pop ?? 0) > (melhor.pop ?? 0))) melhor = m;
    if (!melhor) continue;
    const decs = melhor.conj.map(decDoConjunto).filter((x): x is number => x !== null);
    const pld = s.indicadores.pld_dia;
    const ear = s.indicadores.ear;
    out.push({
      ibge: melhor.ibge,
      nome: melhor.nome,
      uf: melhor.uf,
      sm,
      nomeSm: s.nome,
      ufsDoSm: s.ufs.length,
      pldDia: pld.disponivel && pld.valor !== null ? { valor: pld.valor, dia: pld.periodo.fim } : null,
      ear: ear.disponivel && ear.pct !== null ? { pct: ear.pct, dia: ear.periodo.fim } : null,
      distribuidoras: melhor.dist
        .map(([i]) => arq.distribuidoras[i]?.[0])
        .map((cnpj) => (cnpj ? porCnpj.get(cnpj) : undefined))
        .filter((d): d is DistribuidoraTerritorio => Boolean(d))
        .map(distribuidoraDoExemplo),
      conjuntos: {
        n: melhor.conj.length,
        comValor: decs.length,
        decMin: decs.length ? Math.min(...decs) : null,
        decMax: decs.length ? Math.max(...decs) : null,
        ano: arq.conjuntos.ano,
      },
      municipio: { pop: melhor.pop, mmgdUn: melhor.mmgd_un, mmgdKw: melhor.mmgd_kw, usinasN: melhor.usi_op_n, usinasMw: melhor.usi_op_mw },
    });
  }
  return out;
}
