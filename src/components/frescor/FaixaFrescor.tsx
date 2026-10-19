import type { Idioma } from "@/lib/idioma";
import { dadosFrescor } from "@/lib/frescor/dominios";
import type { DominioFrescorId } from "@/lib/frescor";
import { FaixaFrescorCliente, type VarianteFaixa } from "./FaixaFrescorCliente";

/**
 * Faixa de frescor de uma entrada de observatório (componente de servidor).
 * Lê no build as datas que cada domínio publica (src/lib/frescor/limiares.json)
 * e entrega ao cliente, que calcula a situação na hora da leitura.
 *
 * - variante "linha": primeira tela, logo abaixo da navegação do observatório;
 *   uma fonte mostra os quatro campos; várias mostram o resumo e "Por fonte".
 * - variante "metodo": a lista completa por fonte, com nota e regra, no rodapé
 *   de método ou de fontes da entrada.
 */
export function FaixaFrescor({
  dominios,
  variante = "linha",
  idioma = "pt",
  conteiner,
  className,
}: {
  dominios: readonly DominioFrescorId[];
  variante?: VarianteFaixa;
  idioma?: Idioma;
  conteiner?: string;
  className?: string;
}) {
  return <FaixaFrescorCliente dados={dadosFrescor(dominios)} variante={variante} idioma={idioma} conteiner={conteiner} className={className} />;
}
