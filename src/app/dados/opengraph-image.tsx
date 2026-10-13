import { cartaoSocial, OG_TAMANHO, OG_TIPO } from "@/lib/og";
import { fmtRefMes, indicadoresPublicos } from "@/lib/dadosPublicos";

export const alt = "O crédito no Brasil em números: séries oficiais do Banco Central";
export const size = OG_TAMANHO;
export const contentType = OG_TIPO;

export default function Image() {
  const inds = indicadoresPublicos();
  const ref = inds.map((i) => i.ref).sort().at(-1);
  return cartaoSocial({
    rotulo: "Dados abertos do crédito",
    titulo: "O crédito no Brasil em números",
    detalhe: inds.map((i) => i.tituloCurto).join(" · "),
    rodape: `Fonte: BCB/SGS${ref ? ` · referência mais recente ${fmtRefMes(ref)}` : ""}`,
  });
}
