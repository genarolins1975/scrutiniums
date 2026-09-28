import type { Natureza } from "@/lib/energia/tipos";

/**
 * Selo da taxonomia de natureza do dado. Forma (glifo), borda, rótulo e cor ao
 * mesmo tempo: a cor nunca é o único portador da categoria.
 */
export const NATUREZAS: Record<Natureza, { rotulo: string; glifo: string; borda: string; cor: string; definicao: string }> = {
  OBSERVADO: {
    rotulo: "Observado",
    glifo: "●",
    borda: "border-solid",
    cor: "text-natureza-observado border-natureza-observado",
    definicao: "Valor publicado diretamente pela fonte oficial ou primária.",
  },
  CALCULADO: {
    rotulo: "Calculado",
    glifo: "◆",
    borda: "border-solid",
    cor: "text-natureza-calculado border-natureza-calculado",
    definicao: "Transformação determinística feita pela Scrutiniums, com fórmula publicada.",
  },
  ESTIMADO: {
    rotulo: "Estimado",
    glifo: "◐",
    borda: "border-solid",
    cor: "text-natureza-estimado border-natureza-estimado",
    definicao: "Valor obtido por procedimento estatístico, com incerteza.",
  },
  PREVISTO: {
    rotulo: "Previsto",
    glifo: "◌",
    borda: "border-dashed",
    cor: "text-natureza-previsto border-natureza-previsto",
    definicao: "Valor para período futuro, sempre com modelo, versão e dados de origem.",
  },
  CENARIO: {
    rotulo: "Cenário",
    glifo: "◇",
    borda: "border-dotted",
    cor: "text-natureza-cenario border-natureza-cenario",
    definicao: "Simulação condicional a uma hipótese declarada. Não é previsão.",
  },
};

/** `compacto`: só o glifo com borda, para cabeçalho de coluna; o rótulo segue para leitor de tela e dica. */
export function SeloNatureza({ natureza, compacto = false }: { natureza: Natureza; compacto?: boolean }) {
  const n = NATUREZAS[natureza];
  return (
    <span
      className={`rotulo inline-flex items-center gap-1.5 whitespace-nowrap border bg-superficie px-1.5 py-0.5 !text-[0.66rem] ${n.borda} ${n.cor}`}
      title={`${n.rotulo}: ${n.definicao}`}
    >
      <span aria-hidden="true">{n.glifo}</span>
      <span className="sr-only">Natureza do dado: </span>
      {compacto ? <span className="sr-only">{n.rotulo}</span> : n.rotulo}
    </span>
  );
}
