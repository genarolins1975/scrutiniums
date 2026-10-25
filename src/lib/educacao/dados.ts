/**
 * Leitura da gold do painel Educação nos municípios, somente no servidor (public/educacao/gold). Nada aqui inventa
 * número: tudo vem da gold (pipeline/educacao/gold.py). Este módulo só escolhe o recorte que cada página manda ao
 * navegador: a versão aperitivo recebe o Ideb mais recente do município pedido; o painel completo, o município, a UF, o
 * porte e o Brasil. O arquivo de cada UF é lido só quando um município dela é pedido (ou para os arquivos para baixar).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { UF_DO_PREFIXO } from "@/lib/previdencia/dados";
import type { MapaEducacaoGold, ArquivoUf, Etapa, GoldEducacao, MunicipioGold, Rede, Serie } from "./tipos";

export { UF_DO_PREFIXO };
export const ARQUIVO_GOLD = join("public", "educacao", "gold", "educacao.json");
export const PASTA_UF = join("public", "educacao", "gold", "municipios");
export const SIGLAS = [...new Set(Object.values(UF_DO_PREFIXO))];

let cache: GoldEducacao | null = null;
const cacheUf = new Map<string, ArquivoUf | null>();

export function goldEducacao(): GoldEducacao {
  cache ??= JSON.parse(readFileSync(join(process.cwd(), ARQUIVO_GOLD), "utf-8")) as GoldEducacao;
  return cache;
}

export function arquivoUf(uf: string): ArquivoUf | null {
  if (!SIGLAS.includes(uf)) return null;
  if (!cacheUf.has(uf)) {
    try {
      cacheUf.set(uf, JSON.parse(readFileSync(join(process.cwd(), PASTA_UF, `${uf}.json`), "utf-8")) as ArquivoUf);
    } catch {
      cacheUf.set(uf, null);
    }
  }
  return cacheUf.get(uf) ?? null;
}

export type ConsultaMunicipio =
  | { estado: "vazia" }
  | { estado: "invalida"; codigo: string | null }
  | { estado: "ok"; m: MunicipioGold; uf: string; arquivo: ArquivoUf };

/** Só o código IBGE de sete dígitos de um município da gold; o resto é consulta inválida, nunca um palpite. */
export function consultarMunicipio(ibge: string | string[] | undefined): ConsultaMunicipio {
  const valor = (Array.isArray(ibge) ? ibge[0] : ibge)?.trim() ?? "";
  if (valor === "") return { estado: "vazia" };
  if (!/^\d{7}$/.test(valor)) return { estado: "invalida", codigo: null };
  const uf = UF_DO_PREFIXO[valor.slice(0, 2)];
  const arquivo = uf ? arquivoUf(uf) : null;
  const m = arquivo?.municipios.find((x) => x.id === valor);
  if (!uf || !arquivo || !m) return { estado: "invalida", codigo: valor };
  return { estado: "ok", m, uf, arquivo };
}

/** O Ideb do ano mais recente da edição (o último da lista), ou null quando a rede não o tem. */
export function idebRecente(s: Serie | null | undefined): number | null {
  return s ? s.ideb[s.ideb.length - 1] : null;
}

/** Anos em que a série tem Ideb publicado. */
export function anosComIdeb(s: Serie | null | undefined, anos: number[]): number[] {
  return s ? anos.filter((_, i) => s.ideb[i] !== null) : [];
}

/** Posição da rede municipal do município entre as redes municipais da UF com Ideb no ano mais recente (1 = maior). */
export function posicaoNaUf(arquivo: ArquivoUf, etapa: Etapa, id: string): { posicao: number; total: number } | null {
  const valores = arquivo.municipios.flatMap((m) => {
    const v = idebRecente(m[etapa].municipal);
    return v === null ? [] : [{ id: m.id, v }];
  });
  const meu = valores.find((x) => x.id === id);
  if (!meu) return null;
  return { posicao: valores.filter((x) => x.v > meu.v).length + 1, total: valores.length };
}

/** Os números de manchete do tema (abertura do painel, camada aberta e "Para você"): um leitor só, sem divergência. */
export function manchete(g: GoldEducacao = goldEducacao()) {
  const k = g.ideb.anos.length - 1;
  const c = g.censo.brasil;
  return {
    ano: g.ideb.ano,
    ai: g.ideb.brasil.ai.municipal.ideb[k],
    af: g.ideb.brasil.af.municipal.ideb[k],
    aiPublica: g.ideb.brasil.ai.publica.ideb[k],
    comIdebAi: g.cobertura.ai.municipal.com_ideb,
    municipios: g.municipios.total,
    censoAno: g.censo.ano,
    matMunicipal: c.mat_municipal,
    matPublica: c.mat_publica,
    escMunicipal: c.esc_municipal,
  };
}

/** Rótulo do porte pelo id da gold. */
export function rotuloPorte(g: GoldEducacao, id: string | null): string | null {
  return id ? g.portes.find((p) => p.id === id)?.rotulo ?? null : null;
}

/** Série da rede numa etapa, ou null. */
export const serie = (m: MunicipioGold, etapa: Etapa, rede: Rede): Serie | null => m[etapa][rede];

let cacheMapa: MapaEducacaoGold | null = null;
export function mapaEducacao(): MapaEducacaoGold {
  cacheMapa ??= JSON.parse(readFileSync(join(process.cwd(), "public", "educacao", "gold", "mapa.json"), "utf-8")) as MapaEducacaoGold;
  return cacheMapa;
}
