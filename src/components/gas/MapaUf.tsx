"use client";

import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { URL_GEO } from "@/lib/energia/geo";
import { ESCALA_GAS } from "@/lib/gas/cores";

/**
 * Mapa por UF do gás sobre a malha oficial do IBGE (a mesma do Setor Elétrico). Valores por código IBGE da UF; UF sem valor
 * aparece hachurada como sem dado, nunca como zero. Classes por quantis, uma por cor da escala do domínio.
 */
export function MapaUf({ titulo, valores, unidade, casas = 2, periodo, nota, semTabela }: {
  titulo: string;
  valores: Record<string, number | null>;
  unidade: string;
  casas?: number;
  periodo?: string;
  nota?: string;
  /** Dentro da FiguraAnalitica, que traz a tabela por UF do servidor: o mapa não repete a sua. */
  semTabela?: boolean;
}) {
  return (
    <MapaCoropletico
      titulo={titulo}
      fonteGeometria={URL_GEO.uf}
      valores={valores}
      cores={ESCALA_GAS}
      unidade={unidade}
      casas={casas}
      rotuloRegiao={{ singular: "UF", plural: "UFs" }}
      rotulos
      periodo={periodo}
      nota={nota}
      altura={460}
      alturaCelular={340}
      semTabela={semTabela}
    />
  );
}
