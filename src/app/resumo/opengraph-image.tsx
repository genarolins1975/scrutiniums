import { cartaoSocial, OG_TAMANHO, OG_TIPO } from "@/lib/og";
import { fmtPercentil, fmtRefMes, resumoDiario } from "@/lib/dadosPublicos";
import { publicadoEmBrasilia } from "@/lib/frescor";

export const alt = "Resumo do crédito no Brasil: diagnóstico do dia e IBCC";
export const size = OG_TAMANHO;
export const contentType = OG_TIPO;

export default function Image() {
  const r = resumoDiario();
  if (!r) return cartaoSocial({ rotulo: "Resumo do crédito", titulo: "O crédito no Brasil hoje", rodape: "Fonte: BCB/SGS" });
  return cartaoSocial({
    rotulo: "Resumo do crédito",
    titulo: r.frase,
    rodape: `IBCC ${r.ibcc.atual.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}, percentil ${fmtPercentil(r.ibcc.percentil)} · ref. ${fmtRefMes(r.refDiagnostico)} · publicação de ${publicadoEmBrasilia(r.geradoEm).slice(0, 10)} · BCB/SGS`,
  });
}
