/**
 * Tipos e conversão da gold de focos por município (public/territorio/gold/queimadas_municipios.json).
 * Sem acesso a disco: usado tanto na página (build) quanto na busca do navegador.
 */
export type PeriodoMunicipal = "ultimoAnoCompleto" | "acumuladoAnoCorrente" | "mesmoPeriodoAnoAnterior";

/** Focos por município (public/territorio/gold/queimadas_municipios.json), em linhas compactas. */
export type GoldQueimadasMunicipios = {
  capturadoEm: string;
  dataReferencia: string;
  sateliteReferencia: string;
  periodos: Record<PeriodoMunicipal, { periodo: { inicio: string; fim: string }; origem: string; focos: number } | null>;
  campos: string[];
  linhas: (string | number | null)[][];
  semMunicipio: Record<PeriodoMunicipal, { focos: number; nomesNaFonte: Record<string, number> } | null>;
  equivalenciasUsadas: Record<string, string>;
  municipiosIbge: number;
  fonteArea: { fonte: string; unidade: string; url: string; sha256: string; bytes: number; capturadoEm: string };
  ressalvas: string[];
};

export type FocosMunicipio = {
  id: string;
  nome: string;
  uf: string;
  areaKm2: number;
  focos: Record<PeriodoMunicipal, number | null>;
  /** Focos do último ano completo por 1.000 km² de área (Censo 2022). */
  porMilKm2: number | null;
};

export const URL_QUEIMADAS_MUNICIPIOS = "/territorio/gold/queimadas_municipios.json";

/** Linhas compactas em objetos; a densidade usa o último ano completo e a área do Censo 2022. */
export function municipiosDeFocos(g: GoldQueimadasMunicipios): FocosMunicipio[] {
  const i = (c: string) => g.campos.indexOf(c);
  const [iId, iNome, iUf, iArea] = [i("id"), i("nome"), i("uf"), i("areaKm2")];
  const iP = {
    ultimoAnoCompleto: i("focos_ultimoAnoCompleto"),
    acumuladoAnoCorrente: i("focos_acumuladoAnoCorrente"),
    mesmoPeriodoAnoAnterior: i("focos_mesmoPeriodoAnoAnterior"),
  };
  return g.linhas.map((l) => {
    const focos = {
      ultimoAnoCompleto: l[iP.ultimoAnoCompleto] as number | null,
      acumuladoAnoCorrente: l[iP.acumuladoAnoCorrente] as number | null,
      mesmoPeriodoAnoAnterior: l[iP.mesmoPeriodoAnoAnterior] as number | null,
    };
    const area = l[iArea] as number;
    return {
      id: l[iId] as string,
      nome: l[iNome] as string,
      uf: l[iUf] as string,
      areaKm2: area,
      focos,
      porMilKm2: focos.ultimoAnoCompleto == null || !(area > 0) ? null : (1000 * focos.ultimoAnoCompleto) / area,
    };
  });
}

/** Piso de focos para entrar no ranking por área: abaixo dele, poucos focos num município pequeno dominam a lista. */
export const PISO_FOCOS_DENSIDADE = 100;

/** Menor número de municípios que, somados do maior para o menor, chegam à metade dos focos do período. */
export function municipiosParaMetade(itens: FocosMunicipio[], total: number): number | null {
  if (!(total > 0)) return null;
  const ordem = itens.map((m) => m.focos.ultimoAnoCompleto ?? 0).sort((a, b) => b - a);
  let soma = 0;
  for (let i = 0; i < ordem.length; i++) {
    soma += ordem[i];
    if (2 * soma >= total) return i + 1;
  }
  return null;
}
