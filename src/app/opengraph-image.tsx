import { cartaoSocial, OG_TAMANHO, OG_TIPO } from "@/lib/og";
import { ACESSO, listaObservatorios } from "@/lib/acesso";

export const alt = "Scrutiniums: observatórios com dados oficiais, fonte e data em cada número";
export const size = OG_TAMANHO;
export const contentType = OG_TIPO;

export default function Image() {
  return cartaoSocial({
    rotulo: "Scrutiniums",
    titulo: "Da informação dispersa ao conhecimento verificável",
    detalhe: `Observatórios de ${listaObservatorios()}.`,
    rodape: `Dados oficiais, fonte e data em cada número. ${ACESSO.curto}`,
  });
}
