import { num } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { DEFINICAO_ETAPA_LEITOR, ESTADOS_ESCADA, ROTULO_ESTADO_DADOS, type ResumoCatalogo } from "@/lib/energia/dados";
import type { CatalogoDados } from "@/lib/energia/tipos-dados";

/**
 * As cinco etapas do catálogo, da listagem oficial à base publicada, com a definição de leitor, a definição técnica e o critério que o
 * pipeline verifica (nível Analisar). A contagem de cada etapa é cumulativa, porque cada etapa exige as anteriores: diz quantos
 * conjuntos chegaram a ela ou além, e os números não se somam. Não há barra nem fatia: o estado de cada conjunto está na lista, e o
 * histórico dele, no detalhe. Servidor, sem estado.
 */
export function DadosEscada({ cat, resumo }: { cat: CatalogoDados; resumo: ResumoCatalogo }) {
  return (
    <ol className="divide-y divide-linha border-y border-linha" aria-label={tx("Etapas do catálogo, do catalogado ao publicado", "Catalog stages, from cataloged to published")} data-escada="true">
      {ESTADOS_ESCADA.map((s, i) => (
        <li key={s} className="grid gap-x-6 gap-y-1 py-3 md:grid-cols-[15rem_minmax(0,1fr)]" data-estado={s}>
          <div>
            <p className="rotulo text-mineral">
              {tx("Etapa", "Stage")} {i + 1}: {ROTULO_ESTADO_DADOS[s]}
            </p>
            <p className="mt-0.5 font-serif text-xl tabular-nums text-carvao">
              {num(resumo.cumulativo[s], 0)}{" "}
              <span className="font-sans text-sm text-mineral">
                {tx(`de ${num(resumo.total, 0)} chegaram a esta etapa ou além`, `of ${num(resumo.total, 0)} reached this stage or beyond`)}
              </span>
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-carvao">
              {DEFINICAO_ETAPA_LEITOR[s] ?? <TrechoPortugues regiao="dados-etapa-definicao">{cat.definicoes_estado[s]}</TrechoPortugues>}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-carvao-muted">
              {tx("Definição técnica:", "Technical definition:")} <TrechoPortugues regiao="dados-etapa-definicao">{cat.definicoes_estado[s]}</TrechoPortugues>{" "}
              {tx("Critério verificado:", "Criterion checked:")} <TrechoPortugues regiao="dados-etapa-criterio">{cat.criterios_estado[s]}</TrechoPortugues>.
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
