import type { RedeGold } from "./tipos";
import { dataBR, num, reais } from "./formato";

/** "O que mudou" da amplitude entre submercados, a partir do resumo calculado no pipeline. */
export function textoAmplitude(r: RedeGold["resumo_amplitude"]): string {
  if (!r) return "Sem série de PLD comum aos quatro submercados nesta publicação.";
  const partes = [`Em ${dataBR(r.dia)}, a diferença foi de ${reais(r.valor)}/MWh.`];
  if (r.media_30d !== null) {
    partes.push(
      `Média dos 30 dias até essa data: ${reais(r.media_30d)}/MWh${r.media_30d_anterior !== null ? `, contra ${reais(r.media_30d_anterior)}/MWh nos 30 dias anteriores` : ""};` +
        ` maior diferença dos 30 dias: ${reais(r.maior_30d.valor)}/MWh em ${dataBR(r.maior_30d.dia)}.`,
    );
  }
  return partes.join(" ");
}

/** "O que mudou" dos fluxos: média de 30 dias por fronteira contra os 30 dias anteriores. */
export function textoFluxos30d(r: RedeGold): string {
  const itens = r.fronteiras
    .filter((f) => f.fluxo_media_30d !== null)
    .map((f) => `${f.nome} ${num(f.fluxo_media_30d, 0)}${f.fluxo_media_30d_anterior != null ? ` (antes ${num(f.fluxo_media_30d_anterior, 0)})` : ""}`);
  if (!itens.length) return "Sem 30 dias completos de fluxo nesta publicação.";
  return `Média dos 30 dias até ${dataBR(r.dia_referencia)} contra os 30 dias anteriores, em MWmed: ${itens.join("; ")}.`;
}
