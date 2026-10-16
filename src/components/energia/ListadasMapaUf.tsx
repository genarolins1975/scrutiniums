"use client";

import { useMemo } from "react";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { NAO_SE_APLICA, quebrasQuantis } from "@/lib/energia/escalas";
import { codigoUf } from "@/lib/energia/expansao";
import { URL_GEO } from "@/lib/energia/geo";

const CORES = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];

/**
 * Potência sob controle de uma companhia por UF, na malha oficial do IBGE. UF sem usina sob controle é "não se aplica" (a companhia
 * não tem ativo ali), nunca zero nem ausência de dado. Classes por quantis das UFs com potência, porque a distribuição é muito
 * assimétrica (uma usina grande domina).
 */
export function ListadasMapaUf({ porUf, titulo, periodo, nota }: { porUf: { uf: string; mw_controle: number }[]; titulo: string; periodo: string; nota: string }) {
  const valores = useMemo(() => {
    const v: Record<string, number | typeof NAO_SE_APLICA> = {};
    for (const s of ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"]) {
      const c = codigoUf(s);
      if (c) v[c] = NAO_SE_APLICA;
    }
    for (const x of porUf) {
      const c = codigoUf(x.uf);
      if (c) v[c] = x.mw_controle;
    }
    return v;
  }, [porUf]);
  const classes = useMemo(() => quebrasQuantis(porUf.map((x) => x.mw_controle), Math.min(5, Math.max(2, porUf.length)), { casas: 0 }), [porUf]);
  return (
    <MapaCoropletico
      titulo={titulo}
      fonteGeometria={URL_GEO.uf}
      valores={valores}
      cores={CORES}
      classificacao={classes}
      unidade="MW"
      casas={0}
      rotuloRegiao={{ singular: "UF", plural: "UF" }}
      corNaoSeAplica="var(--cor-linha)"
      rotulos
      periodo={periodo}
      nota={nota}
      altura={440}
      alturaCelular={340}
    />
  );
}
