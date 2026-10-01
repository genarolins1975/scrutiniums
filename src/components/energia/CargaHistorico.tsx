"use client";

import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";

/**
 * Histórico mensal do SIN desde o início da série, com as mudanças de regime do ONS
 * marcadas. Por que um componente cliente só para isto: o intervalo do zoom vai para a
 * URL (?hde=, ?hate=), como o da série diária, para que o link compartilhado e o
 * voltar do navegador reproduzam o trecho ampliado. Os dados já viajavam ao cliente
 * (o gráfico é cliente), então o peso da página não muda.
 */
const ESQUEMA = {
  hde: campo(tiposUrl.mes(), ""),
  hate: campo(tiposUrl.mes(), ""),
};

export function CargaHistorico({
  titulo,
  dados,
  cor,
  marcos,
}: {
  titulo: string;
  dados: { m: string; SIN: number | null }[];
  cor: string;
  marcos: { x: string; rotulo: string }[];
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const intervalo = v.hde && v.hate ? { inicio: v.hde, fim: v.hate } : null;
  return (
    <GraficoLinhas
      titulo={titulo}
      dados={dados}
      chaveX="m"
      formatoX="mes"
      series={[{ id: "SIN", rotulo: "SIN", cor }]}
      unidade="MWmed"
      casas={0}
      marcos={marcos}
      zoom
      intervalo={intervalo}
      onIntervalo={(i) => definir({ hde: i?.inicio ?? "", hate: i?.fim ?? "" })}
    />
  );
}
