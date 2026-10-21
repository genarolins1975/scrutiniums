/**
 * Rótulo dos exemplos sintéticos do Aprenda (seção 9.16): valores hipotéticos que ensinam
 * uma relação e nunca se confundem com dado observado. O mesmo texto aparece em todo
 * quadro sintético e é conferido nos testes.
 */
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import type { Idioma } from "@/lib/idioma";

export const ROTULO_SINTETICO = "Exemplo sintético"; // i18n: dado (forma portuguesa; rotuloSintetico() escolhe o idioma)
export const AVISO_SINTETICO = "Valores hipotéticos, escolhidos para ensinar. Não são dados do observatório e não entram em nenhum indicador."; // i18n: dado (forma portuguesa; avisoSintetico() escolhe o idioma)

/** Rótulo do exemplo sintético no idioma da página ("Synthetic example"). */
export function rotuloSintetico(idioma: Idioma = idiomaEnergia()): string {
  return tx(ROTULO_SINTETICO, "Synthetic example", idioma);
}

/** Aviso do exemplo sintético no idioma da página. */
export function avisoSintetico(idioma: Idioma = idiomaEnergia()): string {
  return tx(AVISO_SINTETICO, "Hypothetical values, chosen for teaching. They are not observatory data and do not enter any indicator.", idioma);
}
