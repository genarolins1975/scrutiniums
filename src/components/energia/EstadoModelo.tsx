import type { EstadoModelo as E } from "@/lib/energia/tipos";
import type { SituacaoModelo } from "@/lib/energia/previsoes";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import type { Idioma } from "@/lib/idioma";

/**
 * Estado de um modelo no registro (pesquisa, validação, produção, aposentado) e a situação que o leitor precisa distinguir (pesquisa,
 * referência experimental, produção). O selo é neutro: a forma da borda e o rótulo carregam a diferença, e nenhuma cor sugere aprovação
 * ou reprovação (a produção não ganha um verde, a pesquisa não ganha um alerta).
 */
function info(e: E, idioma: Idioma): { rotulo: string; borda: string; texto: string } {
  switch (e) {
    case "PESQUISA":
      return { rotulo: tx("Pesquisa", "Research", idioma), borda: "border-dashed", texto: tx("Não pode aparecer como previsão oficial.", "Cannot appear as an official forecast.", idioma) };
    case "VALIDACAO":
      return { rotulo: tx("Validação", "Validation", idioma), borda: "border-dotted", texto: tx("Só na área técnica, marcado como em validação.", "Only in the technical area, marked as under validation.", idioma) };
    case "PRODUCAO":
      return { rotulo: tx("Produção", "Production", idioma), borda: "border-solid", texto: tx("Alimenta a previsão principal.", "Feeds the main forecast.", idioma) };
    case "APOSENTADO":
      return { rotulo: tx("Aposentado", "Retired", idioma), borda: "border-double border-4", texto: tx("Previsões antigas permanecem no arquivo.", "Old forecasts remain in the archive.", idioma) };
  }
}

const BORDA_SITUACAO: Record<SituacaoModelo["id"], string> = {
  pesquisa: "border-dashed",
  experimental: "border-dotted",
  validacao: "border-dotted",
  producao: "border-solid",
  aposentado: "border-double border-4",
};

const CAIXA = "rotulo border border-carvao-muted bg-superficie px-1.5 py-0.5 !text-xs text-carvao";

/** Usado no servidor e em componente de cliente: quem é de cliente passa o idioma de useIdioma(). */
export function EstadoModelo({ estado, comTexto = false, idioma = idiomaEnergia() }: { estado: E; comTexto?: boolean; idioma?: Idioma }) {
  const i = info(estado, idioma);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={`${CAIXA} ${i.borda}`}>
        <span className="sr-only">{tx("Estado do modelo: ", "Model status: ", idioma)}</span>
        {i.rotulo}
      </span>
      {comTexto && <span className="text-xs text-carvao-muted">{i.texto}</span>}
    </span>
  );
}

/** Situação do modelo (pesquisa, referência experimental ou produção), com a definição ao lado quando `comTexto`. */
export function SituacaoDoModelo({ situacao, comTexto = false, idioma = idiomaEnergia() }: { situacao: SituacaoModelo; comTexto?: boolean; idioma?: Idioma }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={`${CAIXA} ${BORDA_SITUACAO[situacao.id]}`} data-situacao={situacao.id}>
        <span className="sr-only">{tx("Situação do modelo: ", "Model situation: ", idioma)}</span>
        {situacao.rotulo}
      </span>
      {comTexto && <span className="text-xs text-carvao-muted">{situacao.definicao}</span>}
    </span>
  );
}
