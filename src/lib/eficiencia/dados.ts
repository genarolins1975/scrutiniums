import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GoldEducacao, IndicadorId, StatusDado } from "./tipos";
import type { DadosPainel, ObsCompacta } from "./consulta";

/**
 * Leitura da gold do painel no build (página estática). Arquivo ausente ou
 * ilegível devolve null: a página mostra o estado de indisponibilidade com o
 * motivo, nunca um número de reserva.
 */
const ARQUIVO = join(process.cwd(), "public", "eficiencia", "gold", "educacao_capitais.json");

let cache: GoldEducacao | null | undefined;

export function goldEducacao(): GoldEducacao | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(ARQUIVO, "utf-8")) as GoldEducacao;
  } catch {
    cache = null;
  }
  return cache;
}

/**
 * Payload do cliente: só o recorte que a página exibe, em tuplas e com textos
 * repetidos deduplicados (o registro detalhado de cada valor fica no CSV e na
 * gold, acessíveis pelos links de download).
 */
export function dadosPainel(g: GoldEducacao): DadosPainel {
  const capitais = g.universo.capitais.map((c) => ({ id: c.id, cod: c.cod_ibge, nome: c.nome, uf: c.uf, regiao: c.regiao }));
  const posCap = new Map(capitais.map((c, i) => [c.cod, i]));
  const indicadores = g.indicadores.map((f) => f.id) as IndicadorId[];
  const posInd = new Map(indicadores.map((id, i) => [id, i]));
  const posEtapa = new Map(g.etapas.map((e, i) => [e.id, i]));
  const status = Object.keys(g.status) as StatusDado[];
  const posStatus = new Map(status.map((s, i) => [s, i]));
  const componentes: string[] = [];
  const posComp = new Map<string, number>();
  const notas: string[] = [];
  const posNota = new Map<string, number>();
  const idx = <T,>(mapa: Map<T, number>, lista: T[], v: T) => {
    let i = mapa.get(v);
    if (i === undefined) {
      i = lista.length;
      lista.push(v);
      mapa.set(v, i);
    }
    return i;
  };
  const obs: ObsCompacta[] = g.observacoes.map((o) => [
    posInd.get(o.indicador)!,
    posCap.get(o.ente)!,
    o.ano,
    o.etapa ? posEtapa.get(o.etapa)! : -1,
    o.componente ? idx(posComp, componentes, o.componente) : -1,
    o.valor,
    posStatus.get(o.status)!,
    o.nota ? idx(posNota, notas, o.nota) : -1,
    o.participacao ?? null,
    o.conferencia_rreo?.comparavel === false ? 0 : 1,
  ]);
  const fontes: DadosPainel["fontes"] = {};
  for (const f of g.fontes) {
    const c = f.capturas[f.capturas.length - 1];
    fontes[f.id] = { instituicao: c.instituicao, conjunto: c.conjunto, pagina: c.pagina, capturado_em: c.capturado_em };
  }
  return {
    capitais,
    regioes: g.universo.regioes,
    etapas: g.etapas,
    fichas: g.indicadores,
    subfuncoes: g.subfuncoes,
    anos: g.periodos,
    indicadores,
    componentes,
    status,
    notas,
    obs,
    fontes,
    meta: { gerado_em: g.meta.gerado_em, versao_pipeline: g.meta.versao_pipeline, versao_codigo: g.meta.versao_codigo, hash_dados: g.meta.hash_dados },
    excluidos: g.universo.excluidos.map((e) => ({ nome: e.nome, uf: e.uf, motivo: e.motivo })),
  };
}
