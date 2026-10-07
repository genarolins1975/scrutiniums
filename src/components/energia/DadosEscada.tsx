import { num } from "@/lib/energia/formato";
import { DEFINICAO_ETAPA_LEITOR, ESTADOS_ESCADA, ROTULO_ESTADO_DADOS, type ResumoCatalogo } from "@/lib/energia/dados";
import type { CatalogoDados } from "@/lib/energia/tipos-dados";

/**
 * A escada do catálogo (P067): as cinco etapas, da listagem oficial à base publicada, cada uma
 * com a contagem de conjuntos que a alcançaram (cumulativa, porque cada etapa exige as
 * anteriores), a contagem dos que pararam nela, a definição e o critério. A barra é só
 * redundância visual: os números e as definições estão em texto. Servidor, sem estado.
 */
export function DadosEscada({ cat, resumo }: { cat: CatalogoDados; resumo: ResumoCatalogo }) {
  const total = resumo.total || 1;
  return (
    <ol className="space-y-px border border-linha bg-linha" aria-label="Escada de estados do catálogo, do catalogado ao publicado" data-escada="true">
      {ESTADOS_ESCADA.map((s, i) => {
        const cum = resumo.cumulativo[s];
        const ex = resumo.exato[s];
        return (
          <li key={s} className="grid gap-x-6 gap-y-2 bg-superficie p-4 lg:grid-cols-[13rem_minmax(0,1fr)]" data-estado={s}>
            <div>
              <p className="rotulo text-mineral">
                Etapa {i + 1}: {ROTULO_ESTADO_DADOS[s]}
              </p>
              <p className="mt-1 font-serif text-2xl tabular-nums text-carvao">
                {num(cum, 0)} <span className="font-sans text-sm text-mineral">de {num(resumo.total, 0)}</span>
              </p>
              <p className="text-xs text-carvao-muted">
                {num(ex, 0)} {ex === 1 ? "parou" : "pararam"} nesta etapa
              </p>
            </div>
            <div className="min-w-0">
              <div aria-hidden="true" className="h-2 w-full bg-papel">
                <div className="h-full" style={{ width: `${(100 * cum) / total}%`, background: `var(--escala-seq-${i + 1})` }} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-carvao">{DEFINICAO_ETAPA_LEITOR[s] ?? cat.definicoes_estado[s]}</p>
              <p className="mt-1 text-xs leading-relaxed text-carvao-muted" data-nivel="analisar">
                Definição técnica: {cat.definicoes_estado[s]} Critério verificado: {cat.criterios_estado[s]}.
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
