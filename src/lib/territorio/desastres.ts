/**
 * Leitura da gold de desastres do Território e Clima (public/territorio/gold/desastres.json),
 * gerada por pipeline/territorio/run.py a partir do Atlas Digital de Desastres no Brasil
 * (Sedec/MIDR e Ceped/UFSC). Unidade: registro municipal com reconhecimento federal de
 * situação de emergência ou estado de calamidade pública; não é evento nem portaria.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const GRUPOS = ["secas_estiagens", "chuvas_inundacoes_enxurradas_alagamentos", "movimentos_de_massa", "outros"] as const;
export type Grupo = (typeof GRUPOS)[number];

/** Rótulos curtos para gráficos; os completos, com os códigos COBRADE, vêm da gold. */
export const ROTULO_CURTO: Record<Grupo, string> = {
  secas_estiagens: "Secas e estiagens",
  chuvas_inundacoes_enxurradas_alagamentos: "Chuvas, inundações e enxurradas",
  movimentos_de_massa: "Deslizamentos e outros movimentos de massa",
  outros: "Outros tipos",
};

export type LinhaAno = {
  ano: number;
  registros_municipais: number;
  registros_reconhecidos: number | null;
  por_grupo_reconhecidos: Record<Grupo, number> | null;
  municipios_distintos_com_reconhecimento: number | null;
  municipios_distintos_com_registro: number;
};

export type UfDesastres = { registros_reconhecidos: number; municipios_distintos: number; por_grupo: Record<Grupo, number> };

export type GoldDesastres = {
  capturadoEm: string;
  dataReferencia: string;
  fonte: { nome: string; pagina: string; manual: string; painel_oficial: string; licenca: string; cobertura_eventos: { inicio: string; fim: string }; ultimo_registro_na_base: string; cadencia: string };
  originais: Record<string, { url: string; arquivo: string; sha256: string; bytes: number; last_modified: string | null; capturado_em: string }>;
  bloqueios: { url: string; situacao: string }[];
  unidade: string;
  ano_de_referencia: string;
  grupos: Record<Grupo, string>;
  serie_anual: LinhaAno[];
  por_uf: {
    ultimo_ano_completo: { ano: number; ufs: Record<string, UfDesastres> };
    ano_corrente: { ano: number; disponivel: boolean; motivo: string | null; ufs: Record<string, UfDesastres> | null };
  };
  danos_humanos: {
    publicar: string;
    serie: { ano: number; registros: number; registros_sem_nenhum_dano_humano_informado: number; obitos: number; desabrigados: number; desalojados: number; publicavel: boolean }[];
  };
  ressalvas: string[];
};

let cache: GoldDesastres | null = null;

export function lerDesastres(): GoldDesastres {
  cache ??= JSON.parse(readFileSync(join(process.cwd(), "public", "territorio", "gold", "desastres.json"), "utf-8")) as GoldDesastres;
  return cache;
}

/** Série com reconhecimento federal: a contagem só existe de 2003 em diante. */
export function serieReconhecida(g: GoldDesastres): (LinhaAno & { registros_reconhecidos: number; por_grupo_reconhecidos: Record<Grupo, number>; municipios_distintos_com_reconhecimento: number })[] {
  return g.serie_anual.filter((a) => a.registros_reconhecidos !== null) as ReturnType<typeof serieReconhecida>;
}
