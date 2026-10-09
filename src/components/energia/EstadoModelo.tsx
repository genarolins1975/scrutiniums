import type { EstadoModelo as E } from "@/lib/energia/tipos";
import type { SituacaoModelo } from "@/lib/energia/previsoes";

/**
 * Estado de um modelo no registro (pesquisa, validação, produção, aposentado) e a situação que o leitor precisa distinguir (pesquisa,
 * referência experimental, produção). O selo é neutro: a forma da borda e o rótulo carregam a diferença, e nenhuma cor sugere aprovação
 * ou reprovação (a produção não ganha um verde, a pesquisa não ganha um alerta).
 */
const INFO: Record<E, { rotulo: string; borda: string; texto: string }> = {
  PESQUISA: { rotulo: "Pesquisa", borda: "border-dashed", texto: "Não pode aparecer como previsão oficial." },
  VALIDACAO: { rotulo: "Validação", borda: "border-dotted", texto: "Só na área técnica, marcado como em validação." },
  PRODUCAO: { rotulo: "Produção", borda: "border-solid", texto: "Alimenta a previsão principal." },
  APOSENTADO: { rotulo: "Aposentado", borda: "border-double border-4", texto: "Previsões antigas permanecem no arquivo." },
};

const BORDA_SITUACAO: Record<SituacaoModelo["id"], string> = {
  pesquisa: "border-dashed",
  experimental: "border-dotted",
  validacao: "border-dotted",
  producao: "border-solid",
  aposentado: "border-double border-4",
};

const CAIXA = "rotulo border border-carvao-muted bg-superficie px-1.5 py-0.5 !text-xs text-carvao";

export function EstadoModelo({ estado, comTexto = false }: { estado: E; comTexto?: boolean }) {
  const i = INFO[estado];
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={`${CAIXA} ${i.borda}`}>
        <span className="sr-only">Estado do modelo: </span>
        {i.rotulo}
      </span>
      {comTexto && <span className="text-xs text-carvao-muted">{i.texto}</span>}
    </span>
  );
}

/** Situação do modelo (pesquisa, referência experimental ou produção), com a definição ao lado quando `comTexto`. */
export function SituacaoDoModelo({ situacao, comTexto = false }: { situacao: SituacaoModelo; comTexto?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={`${CAIXA} ${BORDA_SITUACAO[situacao.id]}`} data-situacao={situacao.id}>
        <span className="sr-only">Situação do modelo: </span>
        {situacao.rotulo}
      </span>
      {comTexto && <span className="text-xs text-carvao-muted">{situacao.definicao}</span>}
    </span>
  );
}
