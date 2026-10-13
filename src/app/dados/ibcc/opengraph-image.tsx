import { cartaoSocial, OG_TAMANHO, OG_TIPO } from "@/lib/og";
import { fmtPercentil, fmtRefMes } from "@/lib/dadosPublicos";
import { ibccPublico } from "@/lib/ibcc";

export const alt = "IBCC: Índice Brasileiro de Condições de Crédito";
export const size = OG_TAMANHO;
export const contentType = OG_TIPO;

export default function Image() {
  const d = ibccPublico();
  if (!d) return cartaoSocial({ rotulo: "Dados do crédito", titulo: "IBCC indisponível", rodape: "Scrutiniums" });
  return cartaoSocial({
    rotulo: "Dados do crédito · dado calculado",
    titulo: "Índice Brasileiro de Condições de Crédito (IBCC)",
    valor: d.atual.valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    detalhe: `percentil histórico ${fmtPercentil(d.percentil)} · ref. ${fmtRefMes(d.atual.ref)} · fase: ${d.fase}`,
    rodape: "Calculado sobre séries do BCB/SGS e do IBGE · base 100 = média histórica",
  });
}
