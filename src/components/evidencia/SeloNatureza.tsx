import type { Natureza } from "@/lib/energia/tipos";
import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";

/**
 * Selo da taxonomia de natureza do dado. Forma (glifo), borda, rótulo e cor ao
 * mesmo tempo: a cor nunca é o único portador da categoria. Rótulo e definição são lidos no idioma da página (getters com tx),
 * também nos outros observatórios que usam o selo; em português não mudam. O inglês é o mesmo de NATUREZA_EN (src/lib/energia/i18n/aprenda.ts).
 */
export const NATUREZAS: Record<Natureza, { rotulo: string; glifo: string; borda: string; cor: string; definicao: string }> = {
  OBSERVADO: {
    get rotulo() { return textoNatureza("OBSERVADO").rotulo; },
    glifo: "●",
    borda: "border-solid",
    cor: "text-natureza-observado border-natureza-observado",
    get definicao() { return textoNatureza("OBSERVADO").definicao; },
  },
  CALCULADO: {
    get rotulo() { return textoNatureza("CALCULADO").rotulo; },
    glifo: "◆",
    borda: "border-solid",
    cor: "text-natureza-calculado border-natureza-calculado",
    get definicao() { return textoNatureza("CALCULADO").definicao; },
  },
  ESTIMADO: {
    get rotulo() { return textoNatureza("ESTIMADO").rotulo; },
    glifo: "◐",
    borda: "border-solid",
    cor: "text-natureza-estimado border-natureza-estimado",
    get definicao() { return textoNatureza("ESTIMADO").definicao; },
  },
  PREVISTO: {
    get rotulo() { return textoNatureza("PREVISTO").rotulo; },
    glifo: "◌",
    borda: "border-dashed",
    cor: "text-natureza-previsto border-natureza-previsto",
    get definicao() { return textoNatureza("PREVISTO").definicao; },
  },
  CENARIO: {
    get rotulo() { return textoNatureza("CENARIO").rotulo; },
    glifo: "◇",
    borda: "border-dotted",
    cor: "text-natureza-cenario border-natureza-cenario",
    get definicao() { return textoNatureza("CENARIO").definicao; },
  },
};

/**
 * Rótulo e definição de uma natureza no idioma pedido. Componente de cliente passa o idioma de useIdioma(); servidor usa o da
 * página (padrão).
 */
export function textoNatureza(n: Natureza, idioma: Idioma = idiomaEnergia()): { rotulo: string; definicao: string } {
  switch (n) {
    case "OBSERVADO":
      return { rotulo: tx("Observado", "Observed", idioma), definicao: tx("Valor publicado diretamente pela fonte oficial ou primária.", "Value published directly by the official or primary source.", idioma) };
    case "CALCULADO":
      return { rotulo: tx("Calculado", "Calculated", idioma), definicao: tx("Transformação determinística feita pela Scrutiniums, com fórmula publicada.", "Deterministic transformation made by Scrutiniums, with a published formula.", idioma) };
    case "ESTIMADO":
      return { rotulo: tx("Estimado", "Estimated", idioma), definicao: tx("Valor obtido por procedimento estatístico, com incerteza.", "Value obtained by a statistical procedure, with uncertainty.", idioma) };
    case "PREVISTO":
      return { rotulo: tx("Previsto", "Forecast", idioma), definicao: tx("Valor para período futuro, sempre com modelo, versão e dados de origem.", "Value for a future period, always with model, version and source data.", idioma) };
    case "CENARIO":
      return { rotulo: tx("Cenário", "Scenario", idioma), definicao: tx("Simulação condicional a uma hipótese declarada. Não é previsão.", "Simulation conditional on a declared hypothesis. It is not a forecast.", idioma) };
  }
}

/**
 * `compacto`: só o glifo com borda, para cabeçalho de coluna; o rótulo segue para leitor de tela e dica.
 * `texto`: glifo e rótulo em texto corrido, sem caixa, para a linha de contexto de uma medida da abertura; a forma continua sendo
 * portadora da categoria e a cor nunca é o único sinal.
 */
export function SeloNatureza({
  natureza,
  compacto = false,
  texto = false,
  idioma = idiomaEnergia(),
}: {
  natureza: Natureza;
  compacto?: boolean;
  texto?: boolean;
  /** Idioma do rótulo; componente de cliente passa o de useIdioma(). Sem ele, vale o da página. */
  idioma?: Idioma;
}) {
  const n = { ...NATUREZAS[natureza], ...textoNatureza(natureza, idioma) };
  if (texto) {
    return (
      <span className={`inline-flex items-center gap-1 whitespace-nowrap ${n.cor.split(" ")[0]}`} title={`${n.rotulo}: ${n.definicao}`} data-natureza={natureza}>
        <span aria-hidden="true">{n.glifo}</span>
        <span className="sr-only">{tx("Natureza do dado: ", "Nature of the data: ", idioma)}</span>
        {n.rotulo}
      </span>
    );
  }
  return (
    <span
      className={`rotulo relative inline-flex items-center gap-1.5 whitespace-nowrap border bg-superficie px-1.5 py-0.5 !text-xs ${n.borda} ${n.cor}`}
      title={`${n.rotulo}: ${n.definicao}`}
      data-natureza={natureza}
    >
      <span aria-hidden="true">{n.glifo}</span>
      <span className="sr-only">{tx("Natureza do dado: ", "Nature of the data: ", idioma)}</span>
      {compacto ? <span className="sr-only">{n.rotulo}</span> : n.rotulo}
    </span>
  );
}
