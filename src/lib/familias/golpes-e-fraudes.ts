/**
 * Leitura da gold do painel "Golpes e fraudes" (Observatório das Famílias, coleção Dívida e crédito das famílias):
 * public/obs/data/gold/fraudes.json (curadoria documentada em FONTES_FRAUDES.md, METODOLOGIA_FRAUDES.md e
 * DICIONARIO_DADOS_FRAUDES.md) e as séries mensais de crédito de pulse.json para o explorador. Só servidor.
 *
 * O contrato de evidência é o mesmo do painel de apostas (src/lib/familias/apostas.ts): grau de A a E e situação de cada número saem
 * da gold; nada é escrito à mão e nenhuma fonte é somada a outra.
 */
import { lerPublico } from "@/lib/perguntas/leitura";
import { cadeiaDaBase, estudosDaBase, linhaDoTempoDaBase, niveisDaBase, seriesDeCredito, sinteseDaBase } from "./apostas";

export const ROTA_GOLPES = "/divida-das-familias/golpes-e-fraudes";
export const TITULO_GOLPES = "Golpes e fraudes";
export const PERGUNTA_GOLPES = "Quanto se perde com golpes e fraudes financeiras?";
export const DESCRICAO_GOLPES =
  "Perdas reportadas, ocorrências registradas, tentativas detectadas e devoluções no Pix: o que cada número de golpes e fraudes mede, com o grau de evidência de cada um e sem somar fontes que se sobrepõem.";
export const SECAO_GOLPES = "familias:golpes-e-fraudes";
/** A série completa do MED, mês a mês, está no painel do Pix, na aplicação do Crédito. */
export const PAINEL_PIX = "/observatorio/pix";

export type DadosGolpes = ReturnType<typeof dadosGolpes>;

export function dadosGolpes() {
  const F = lerPublico("obs", "data", "gold", "fraudes.json");
  const credito = seriesDeCredito(F.explorador.indicadores);
  return { F, credito, sintese: sinteseDaBase(F), niveis: niveisDaBase(F), cadeia: cadeiaDaBase(F), estudos: estudosDaBase(F), linhaDoTempo: linhaDoTempoDaBase(F) };
}
