import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GRUPOS_REF, type CapitalSaude, type DadosSaude, type ObsC, type RefC } from "./payload";
import { ROTULO_FONTE } from "./rotulos";
import type { GoldSaude, StatusDado } from "./tipos";

export { GRUPOS_REF };
export type { CapitalSaude, DadosSaude, ObsC, RefC };

/**
 * Leitura da gold de Saúde no build (página estática) e payload compacto do cliente. Arquivo ausente ou ilegível devolve null:
 * a página mostra a indisponibilidade com o motivo, nunca um número de reserva. Cada página recebe só os indicadores de que precisa.
 */
const ARQUIVO = join(process.cwd(), "public", "eficiencia", "gold", "saude_capitais.json");
export const ARQUIVO_GOLD_SAUDE = "/eficiencia/gold/saude_capitais.json";

let cache: GoldSaude | null | undefined;

export function goldSaude(): GoldSaude | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(ARQUIVO, "utf-8")) as GoldSaude;
  } catch {
    cache = null;
  }
  return cache;
}

export const INDICADORES_DA_PAGINA: Record<"gastos" | "rede" | "resultados" | "comparar" | "panorama", string[]> = {
  gastos: ["ctx.populacao.residente", "sau.despesa.funcao_saude", "sau.despesa.por_habitante", "sau.despesa.subfuncao", "sau.despesa.natureza", "sau.despesa.por_fonte", "sau.asps.percentual_aplicado", "sau.asps.valor_aplicado", "sau.asps.base_receita"],
  rede: ["ctx.populacao.residente", "sau.rede.ubs_publicas", "sau.rede.ubs_publicas_por_10mil", "sau.rede.ubs_retrato", "sau.aps.equipes", "sau.aps.equipes_por_10mil", "sau.aps.cobertura_potencial"],
  resultados: ["ctx.populacao.residente", "sau.icsap.internacoes", "sau.icsap.taxa", "sau.icsap.participacao", "sau.icsap.grupos", "sau.ctx.cobertura_planos"],
  comparar: ["ctx.populacao.residente", "sau.despesa.funcao_saude", "sau.despesa.por_habitante", "sau.asps.percentual_aplicado", "sau.rede.ubs_publicas_por_10mil", "sau.aps.equipes_por_10mil", "sau.aps.cobertura_potencial", "sau.icsap.taxa", "sau.icsap.internacoes", "sau.icsap.participacao"],
  panorama: ["ctx.populacao.residente", "sau.despesa.funcao_saude", "sau.despesa.por_habitante", "sau.asps.percentual_aplicado", "sau.rede.ubs_publicas_por_10mil", "sau.aps.equipes_por_10mil", "sau.aps.cobertura_potencial", "sau.icsap.taxa", "sau.icsap.participacao"],
};

/** 12 algarismos significativos bastam à exibição e ao CSV do cliente; a gold e os CSV do servidor guardam a precisão original. */
const p12 = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v.toPrecision(Math.abs(v) >= 1e9 ? 15 : 12)));

export function dadosSaude(g: GoldSaude, pagina: keyof typeof INDICADORES_DA_PAGINA): DadosSaude {
  const incluidos = new Set(INDICADORES_DA_PAGINA[pagina]);
  const capitais = g.universo.capitais.map((c) => ({ id: c.id, cod: c.cod_ibge, nome: c.nome, uf: c.uf, regiao: c.regiao }));
  const posCap = new Map(capitais.map((c, i) => [c.cod, i]));
  const indicadores = g.indicadores.map((f) => f.id).filter((id) => incluidos.has(id));
  const posInd = new Map(indicadores.map((id, i) => [id, i]));
  const status = Object.keys(g.status) as StatusDado[];
  const posStatus = new Map(status.map((s, i) => [s, i]));
  const componentes: string[] = [];
  const posComp = new Map<string, number>();
  const notas: string[] = [];
  const posNota = new Map<string, number>();
  const situacoes: string[] = [];
  const posSit = new Map<string, number>();
  const idx = (mapa: Map<string, number>, lista: string[], v: string) => {
    let i = mapa.get(v);
    if (i === undefined) {
      i = lista.length;
      lista.push(v);
      mapa.set(v, i);
    }
    return i;
  };
  const obs: ObsC[] = [];
  for (const o of g.observacoes) {
    if (!incluidos.has(o.indicador)) continue;
    obs.push([
      posInd.get(o.indicador)!,
      posCap.get(o.ente)!,
      o.ano,
      o.componente ? idx(posComp, componentes, o.componente) : -1,
      p12(o.valor),
      posStatus.get(o.status)!,
      o.nota ? idx(posNota, notas, o.nota) : -1,
      o.participacao ?? null,
      o.elegivel_comparacao ? 1 : 0,
      o.nota_material ? 1 : 0,
      o.conferencia ? idx(posSit, situacoes, o.conferencia.situacao) : -1,
      o.conferencia?.motivo_inelegibilidade ? idx(posNota, notas, o.conferencia.motivo_inelegibilidade) : -1,
      ((o.quebra_serie ? 1 : 0) | (o.conferencia?.quebra_serie ? 2 : 0)) as 0 | 1 | 2 | 3,
      o.calculo ? p12(o.calculo.numerador) : null,
      o.calculo ? p12(o.calculo.denominador) : null,
      o.minimo_pct ?? null,
    ]);
  }
  const refs: RefC[] = [];
  for (const r of g.referencias) {
    if (!incluidos.has(r.indicador) || r.capitais_com_valor === 0) continue;
    refs.push([
      posInd.get(r.indicador)!,
      r.componente ? idx(posComp, componentes, r.componente) : -1,
      r.ano,
      GRUPOS_REF.indexOf(r.grupo),
      r.capitais_no_grupo,
      r.capitais_com_valor,
      r.n,
      p12(r.media),
      p12(r.mediana),
      p12(r.minimo),
      p12(r.maximo),
      p12(r.q1),
      p12(r.q3),
      r.quartis_exibicao ? 1 : 0,
      p12(r.soma_numerador),
      p12(r.soma_denominador),
      p12(r.razao_agregada),
      r.capitais_minimo.map((c) => posCap.get(c)!),
      r.capitais_maximo.map((c) => posCap.get(c)!),
    ]);
  }
  return {
    capitais,
    regioes: g.universo.regioes,
    indicadores,
    componentes,
    status,
    notas,
    situacoes,
    obs,
    refs,
    externas: g.referencias_externas.filter((e) => incluidos.has(e.indicador)),
    fichas: g.indicadores.filter((f) => incluidos.has(f.id)),
    rotulos: { subfuncoes: g.subfuncoes, natureza: g.categorias_natureza, fontes: g.fontes_recurso, grupos: g.grupos_icsap, equipes: g.tipos_equipe, ubs: g.componentes_ubs },
    basePopulacional: Object.fromEntries(
      g.observacoes.filter((o) => o.indicador === "ctx.populacao.residente" && o.base_populacional).map((o) => [o.ano, o.base_populacional as string]),
    ),
    basesDoDenominador: (() => {
      const mapa: Record<string, Record<number, string>> = {};
      for (const o of g.observacoes) {
        if (!o.base_populacional || o.indicador === "ctx.populacao.residente" || !incluidos.has(o.indicador)) continue;
        const k = `${o.indicador}|${o.componente ?? ""}`;
        (mapa[k] ??= {})[o.ano] ??= o.base_populacional;
      }
      return mapa;
    })(),
    fontes: Object.fromEntries(
      g.fontes.map((f) => {
        const caps = f.capturas;
        const datas = caps.map((c) => c.capturado_em).filter((d): d is string => !!d).sort();
        const paginas = Array.from(new Set(caps.map((c) => c.pagina).filter((x): x is string => !!x)));
        return [f.id, { nome: ROTULO_FONTE[f.id] ?? f.id, url: paginas.join(" "), capturado_em: datas.length ? datas[datas.length - 1].slice(0, 10) : "" }];
      }),
    ),
    meta: { gerado_em: g.meta.gerado_em, dados_capturados_ate: g.meta.dados_capturados_ate, hash_dados: g.meta.hash_dados, versao_catalogo: g.meta.versao_catalogo },
  };
}
