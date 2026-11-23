"use client";

import { useRouter } from "next/navigation";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { URL_GEO } from "@/lib/energia/geo";

const CORES = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];

/**
 * Mapa das vendas por unidade da federação sobre a malha oficial do IBGE (a mesma do Setor Elétrico, com conta). Valores por
 * código IBGE da UF; estado sem valor aparece hachurado como sem dado, nunca como zero. Classes por quantis das 27 UFs. Tocar
 * num estado leva ao endereço com `?uf=`, e a página mostra a trajetória dele contra a do Brasil; a lista ordenada ao lado e a
 * tabela equivalente trazem os mesmos valores.
 */
export function MapaEstados({ titulo, valores, unidade, periodo, nota, selecionado, hrefs }: Readonly<{
  titulo: string;
  valores: Record<string, number | null>;
  unidade: string;
  periodo: string;
  nota: string;
  /** Código IBGE da UF escolhida, ou null. */
  selecionado: string | null;
  /** Endereço de cada UF (por código IBGE) e o de nenhuma (chave ""). */
  hrefs: Record<string, string>;
}>) {
  const router = useRouter();
  return (
    <MapaCoropletico
      semTabela
      titulo={titulo}
      fonteGeometria={URL_GEO.uf}
      valores={valores}
      cores={CORES}
      unidade={unidade}
      casas={1}
      rotuloRegiao={{ singular: "UF", plural: "UFs" }}
      rotulos
      periodo={periodo}
      nota={nota}
      altura={440}
      alturaCelular={340}
      selecionado={selecionado}
      onSelecionar={(id) => {
        const destino = hrefs[id ?? ""];
        if (destino) router.push(destino, { scroll: false });
      }}
    />
  );
}
