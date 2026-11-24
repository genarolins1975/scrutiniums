import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GRUPOS, type Grupo } from "./desastres";
import { municipiosIbge } from "./focosMunicipio";
import { NOME_UF } from "./queimadas";

/**
 * Ficha "O meu município já teve desastre reconhecido?", montada no servidor a
 * partir da gold municipal (public/territorio/gold/desastres_municipios.json),
 * gerada por pipeline/territorio/run.py da mesma base do Atlas Digital de
 * Desastres que alimenta o painel (os municípios reconciliam com a série
 * nacional ano a ano, na validação do pipeline). A gold inteira não vai ao
 * navegador.
 *
 * Estados, nunca trocados entre si:
 * - município sem registro na base no período: "nenhum registro", nunca "nenhum
 *   desastre" (só entra o que o município registrou no sistema da Defesa Civil);
 * - danos humanos sem registro desde 2013: indisponível (null), não zero;
 * - gold ausente: a ficha não existe (null).
 */

type LinhaGold = { r: string[]; n: number; d: [number, number, number, number, number] | null };

export type GoldDesastresMunicipios = {
  capturadoEm: string;
  dataReferencia: string;
  fonte: { nome: string; pagina: string; manual: string; licenca: string; cobertura_eventos: { inicio: string; fim: string }; ultimo_registro_na_base: string };
  periodo: { inicio: number; fim: number };
  danosDesde: number;
  tipos: Record<string, string>;
  grupoDoTipo: Record<string, Grupo>;
  linhas: Record<string, LinhaGold>;
  ressalvas: string[];
};

export type Reconhecimento = { data: string; tipo: string; grupo: Grupo };

export type FichaDesastres = {
  id: string;
  nome: string;
  uf: string;
  nomeUf: string;
  periodo: { inicio: number; fim: number };
  anosNoPeriodo: number;
  /** Registros com reconhecimento federal, do mais antigo ao mais recente. */
  reconhecimentos: Reconhecimento[];
  /** Registros do período sem reconhecimento (não pedidos, negados ou pendentes). */
  semReconhecimento: number;
  porAno: { ano: number; porGrupo: Record<Grupo, number>; total: number }[];
  porGrupo: Record<Grupo, number>;
  anosComReconhecimento: number;
  /** Posição no estado pelo número de reconhecimentos (empates dividem a posição); null sem reconhecimento. */
  posicaoUf: number | null;
  estado: {
    municipios: number;
    comReconhecimento: number;
    reconhecimentos: number;
  };
  danos: { desde: number; obitos: number; desabrigados: number; desalojados: number; registros: number; semDanoInformado: number } | null;
  fonte: { nome: string; pagina: string; capturadoEm: string; ultimoRegistro: string; ressalvas: string[] };
};

let cache: GoldDesastresMunicipios | null | undefined;

export function lerDesastresMunicipios(): GoldDesastresMunicipios | null {
  if (cache === undefined) {
    const caminho = join(process.cwd(), "public", "territorio", "gold", "desastres_municipios.json");
    cache = existsSync(caminho) ? (JSON.parse(readFileSync(caminho, "utf-8")) as GoldDesastresMunicipios) : null;
  }
  return cache;
}

const zeros = (): Record<Grupo, number> => Object.fromEntries(GRUPOS.map((g) => [g, 0])) as Record<Grupo, number>;

/** Ficha do município pelo código IBGE; null quando o código não é de município do índice ou a gold não existe. */
export function fichaDesastres(id: string): FichaDesastres | null {
  if (!/^\d{7}$/.test(id)) return null;
  const ibge = municipiosIbge().get(id);
  const g = lerDesastresMunicipios();
  if (!ibge || !g) return null;
  const linha = g.linhas[id];

  const reconhecimentos: Reconhecimento[] = (linha?.r ?? []).map((item) => {
    const [data, tipo] = item.split(" ");
    return { data, tipo: g.tipos[tipo] ?? tipo, grupo: g.grupoDoTipo[tipo] ?? "outros" };
  });

  const porAno = [];
  for (let ano = g.periodo.inicio; ano <= g.periodo.fim; ano++) {
    const porGrupo = zeros();
    for (const r of reconhecimentos) if (r.data.startsWith(String(ano))) porGrupo[r.grupo] += 1;
    porAno.push({ ano, porGrupo, total: GRUPOS.reduce((s, gr) => s + porGrupo[gr], 0) });
  }
  const porGrupo = zeros();
  for (const r of reconhecimentos) porGrupo[r.grupo] += 1;

  // o estado pela mesma gold: todos os municípios do índice, com ou sem registro
  const daUf = [...municipiosIbge().entries()].filter(([, m]) => m.uf === ibge.uf).map(([cod]) => ({ cod, v: g.linhas[cod]?.r.length ?? 0 }));
  const comRec = daUf.filter((m) => m.v > 0).sort((a, b) => b.v - a.v);
  let posicaoUf: number | null = null;
  if (reconhecimentos.length > 0) posicaoUf = 1 + comRec.filter((m) => m.v > reconhecimentos.length).length;

  const d = linha?.d ?? null;
  return {
    id,
    nome: ibge.nome,
    uf: ibge.uf,
    nomeUf: NOME_UF[ibge.uf] ?? ibge.uf,
    periodo: g.periodo,
    anosNoPeriodo: g.periodo.fim - g.periodo.inicio + 1,
    reconhecimentos,
    semReconhecimento: linha?.n ?? 0,
    porAno,
    porGrupo,
    anosComReconhecimento: porAno.filter((a) => a.total > 0).length,
    posicaoUf,
    estado: {
      municipios: daUf.length,
      comReconhecimento: comRec.length,
      reconhecimentos: comRec.reduce((s, m) => s + m.v, 0),
    },
    danos: d ? { desde: g.danosDesde, obitos: d[0], desabrigados: d[1], desalojados: d[2], registros: d[3], semDanoInformado: d[4] } : null,
    fonte: { nome: g.fonte.nome, pagina: g.fonte.pagina, capturadoEm: g.capturadoEm, ultimoRegistro: g.fonte.ultimo_registro_na_base, ressalvas: g.ressalvas },
  };
}
