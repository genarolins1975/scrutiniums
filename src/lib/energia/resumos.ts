import type { RedeGold } from "./tipos";
import { dataBR, num, reais } from "./formato";
import { fronteiraEn } from "./i18n/entrada-visao";
import { tx } from "./idioma";

/** "O que mudou" da amplitude entre submercados, a partir do resumo calculado no pipeline. */
export function textoAmplitude(r: RedeGold["resumo_amplitude"]): string {
  if (!r) return tx("Sem série de PLD comum aos quatro submercados nesta publicação.", "No PLD series common to the four submarkets in this publication.");
  const partes = [tx(`Em ${dataBR(r.dia)}, a diferença foi de ${reais(r.valor)}/MWh.`, `On ${dataBR(r.dia)}, the difference was ${reais(r.valor)}/MWh.`)];
  if (r.media_30d !== null) {
    partes.push(
      tx(
        `Média dos 30 dias até essa data: ${reais(r.media_30d)}/MWh${r.media_30d_anterior !== null ? `, contra ${reais(r.media_30d_anterior)}/MWh nos 30 dias anteriores` : ""};` +
          ` maior diferença dos 30 dias: ${reais(r.maior_30d.valor)}/MWh em ${dataBR(r.maior_30d.dia)}.`,
        `Average of the 30 days through that date: ${reais(r.media_30d)}/MWh${r.media_30d_anterior !== null ? `, versus ${reais(r.media_30d_anterior)}/MWh in the previous 30 days` : ""};` +
          ` largest difference in the 30 days: ${reais(r.maior_30d.valor)}/MWh on ${dataBR(r.maior_30d.dia)}.`,
      ),
    );
  }
  return partes.join(" ");
}

/** "O que mudou" dos fluxos: média de 30 dias por fronteira contra os 30 dias anteriores. */
export function textoFluxos30d(r: RedeGold): string {
  const itens = r.fronteiras
    .filter((f) => f.fluxo_media_30d !== null)
    .map((f) =>
      tx(
        `${f.nome} ${num(f.fluxo_media_30d, 0)}${f.fluxo_media_30d_anterior != null ? ` (antes ${num(f.fluxo_media_30d_anterior, 0)})` : ""}`,
        `${fronteiraEn(f.nome)} ${num(f.fluxo_media_30d, 0)}${f.fluxo_media_30d_anterior != null ? ` (previously ${num(f.fluxo_media_30d_anterior, 0)})` : ""}`,
      ),
    );
  if (!itens.length) return tx("Sem 30 dias completos de fluxo nesta publicação.", "No 30 complete days of flow in this publication.");
  return tx(
    `Média dos 30 dias até ${dataBR(r.dia_referencia)} contra os 30 dias anteriores, em MWmed: ${itens.join("; ")}.`,
    `Average of the 30 days through ${dataBR(r.dia_referencia)} versus the previous 30 days, in MWavg: ${itens.join("; ")}.`,
  );
}
