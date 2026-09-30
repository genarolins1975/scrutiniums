import type { ReactNode } from "react";
import type { Natureza, Periodo } from "@/lib/energia/tipos";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import {
  descreverVariacao,
  textoPeriodo,
  unidadeDestaque,
  valorDestaque,
  type Evidencia,
  type FormatoNumero,
  type Variacao,
} from "@/lib/energia/evidencia";

/**
 * Número de destaque (KPI) do Setor Elétrico: rótulo, valor formatado em pt-BR,
 * unidade, período, selo de natureza, variação opcional e o "Comprove este
 * número" acoplado. No máximo quatro por contexto (seção 7.1): número grande só
 * para o indicador principal de cada bloco.
 *
 * SobreEsteDado x ComproveNumero: o primeiro é a proveniência da SÉRIE (fonte,
 * frequência, cobertura histórica, transformações, revisões do conjunto) e mora
 * no rodapé do PainelEvidencia; o segundo prova ESTE número (valor antes do
 * arredondamento, arquivo e sha256, chaves de origem, numerador e denominador,
 * testes, reconciliação, reprodução e citação) e mora ao lado do próprio número.
 * Um KPI que vem de uma série tem os dois; o Numero só acopla o segundo.
 *
 * Sem estado nem efeito: renderiza no servidor e pode ser usado em Server
 * Components (o diálogo é o único pedaço cliente). Ausência aparece como "sem
 * dado" com hachura, nunca como zero; a variação decide a direção sobre o valor
 * já arredondado e diz alta ou queda em palavras, sem pintar bom ou ruim.
 */

export type NumeroProps = {
  rotulo: string;
  /** Valor na unidade exibida. Omitido, vem de `evidencia.valor_calculo`. null é ausência. */
  valor?: number | null;
  formato?: FormatoNumero;
  casas?: number;
  /** Omitida, vem de `evidencia.unidade` ("R$/MWh" com formato reais vira "/MWh"). */
  unidade?: string;
  /** Período de referência; omitido, vem de `evidencia.periodo`. Texto é exibido como está. */
  periodo?: Periodo | string;
  natureza: Natureza;
  variacao?: Variacao;
  evidencia?: Evidencia | null;
  /** Por que não há valor (exibido só na ausência). */
  motivoAusencia?: string;
  /** Limitação material que muda a leitura (período parcial, defasagem, estimativa). */
  nota?: ReactNode;
  /** Faixa superior de identificação (ex.: "var(--serie-sm-se)"); nunca a cor do texto. */
  cor?: string;
  tamanho?: "grande" | "medio";
  /** Página e âncora do número, repassadas à citação. */
  endereco?: string;
};

export function Numero({
  rotulo,
  valor,
  formato = "num",
  casas = 1,
  unidade,
  periodo,
  natureza,
  variacao,
  evidencia,
  motivoAusencia,
  nota,
  cor,
  tamanho = "grande",
  endereco,
}: NumeroProps) {
  const v = valor !== undefined ? valor : (evidencia?.valor_calculo ?? null);
  const ausente = v === null || !Number.isFinite(v);
  const u = unidadeDestaque(unidade ?? evidencia?.unidade, formato);
  const per = periodo ?? evidencia?.periodo;
  const textoPer = typeof per === "string" ? per : per ? textoPeriodo(per) : null;
  const vari = variacao ? descreverVariacao(variacao) : null;
  const corpo = tamanho === "grande" ? "text-[2rem]" : "text-2xl";

  return (
    <div role="group" aria-label={rotulo} className="relative flex h-full flex-col border border-linha bg-superficie p-5">
      {cor && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]" style={{ background: cor }} />}
      <p className="rotulo text-mineral">{rotulo}</p>
      {ausente ? (
        <p className="mt-3 inline-flex items-center gap-2 font-serif text-xl leading-none text-carvao-muted">
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 border border-mineral"
            style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, transparent 1px 4px)" }}
          />
          sem dado
        </p>
      ) : (
        <p className={`mt-3 font-serif ${corpo} leading-none tabular-nums text-carvao`}>
          {valorDestaque(v, formato, casas)}
          {u && <span className="ml-1 font-sans text-sm text-mineral">{u}</span>}
        </p>
      )}
      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral">
        {textoPer && <span>{textoPer}</span>}
        <SeloNatureza natureza={natureza} />
      </p>
      {ausente && motivoAusencia && <p className="mt-2 text-xs leading-relaxed text-carvao-muted">{motivoAusencia}</p>}
      {vari && (
        <p className="mt-2 text-sm tabular-nums text-carvao-muted">
          <span aria-hidden="true">
            {vari.glifo && <span className="mr-1">{vari.glifo}</span>}
            {vari.texto} {variacao?.referencia}
          </span>
          <span className="sr-only">{vari.leitura}</span>
        </p>
      )}
      {/* div, não p: a nota é ReactNode e pode trazer parágrafo ou lista (p dentro de p é HTML inválido) */}
      {nota && <div className="mt-3 border-t border-linha pt-3 text-xs leading-relaxed text-carvao-muted">{nota}</div>}
      {evidencia && (
        <div className="mt-auto pt-2">
          <ComproveNumero evidencia={evidencia} endereco={endereco} />
        </div>
      )}
    </div>
  );
}
