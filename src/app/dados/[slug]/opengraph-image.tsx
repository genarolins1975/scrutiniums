import { cartaoSocial, OG_TAMANHO, OG_TIPO } from "@/lib/og";
import { INDICADORES, fmtRefMes, fmtValor, indicadorPorSlug } from "@/lib/dadosPublicos";

export const alt = "Indicador do crédito com valor atual, fonte e referência";
export const size = OG_TAMANHO;
export const contentType = OG_TIPO;

export function generateStaticParams() {
  return INDICADORES.map((i) => ({ slug: i.slug }));
}

export default function Image({ params }: { params: { slug: string } }) {
  const i = indicadorPorSlug(params.slug);
  if (!i) return cartaoSocial({ rotulo: "Dados do crédito", titulo: "Indicador indisponível", rodape: "Fonte: BCB/SGS" });
  return cartaoSocial({
    rotulo: "Dados do crédito · dado observado",
    titulo: i.titulo,
    valor: fmtValor(i, i.valor),
    detalhe: `referência ${fmtRefMes(i.ref)}`,
    rodape: `Fonte: ${i.fonte}, série ${i.serieCodigo}`,
  });
}
