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
  /** "cartao" (padrão): cartão com borda, usado dentro de painéis. "faixa": sem cartão, para a faixa de métricas da abertura (FaixaMetricas). */
  variante?: "cartao" | "faixa";
  /** Página e âncora do número, repassadas à citação. */
  endereco?: string;
  /**
   * Texto de revisões da própria página, para a ficha "Comprove este número" quando a página mostra revisões do mesmo dado
   * (por exemplo a tabela de revisões do ONS na EAR e na ENA) e o texto da ficha, que vem da gold, diz outra coisa. Vale só
   * para a linha "Revisões" da ficha; o resto da prova segue como está.
   */
  revisoes?: string;
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
  variante = "cartao",
  endereco,
  revisoes,
}: NumeroProps) {
  const ficha = evidencia && revisoes ? { ...evidencia, revisoes } : evidencia;
  const v = valor !== undefined ? valor : (evidencia?.valor_calculo ?? null);
  const ausente = v === null || !Number.isFinite(v);
  const u = unidadeDestaque(unidade ?? evidencia?.unidade, formato);
  const per = periodo ?? evidencia?.periodo;
  const textoPer = typeof per === "string" ? per : per ? textoPeriodo(per) : null;
  const vari = variacao ? descreverVariacao(variacao) : null;
  const corpo = tamanho === "grande" ? "text-[2rem]" : "text-2xl";

  if (variante === "faixa") {
    // medida da abertura: rótulo em frase, valor em serifa, unidade em sans, uma linha de contexto (período, natureza e prova) e a
    // variação, sem cartão nem faixa de cor; a cor de série, quando há, vira um marcador pequeno antes do rótulo. No celular a medida é
    // uma linha de lista (rótulo e contexto à esquerda, valor e unidade à direita); a partir de 640 px, uma coluna da faixa.
    return (
      <div role="group" aria-label={rotulo} data-metrica="" className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 sm:block">
        <p className="flex items-start gap-2 text-[0.8125rem] leading-snug text-carvao-muted sm:mb-1.5">
          {cor && <span aria-hidden="true" className="mt-[0.3em] inline-block h-2 w-2 shrink-0" style={{ background: cor }} />}
          <span>{rotulo}</span>
        </p>
        {ausente ? (
          <p className="col-start-2 row-span-2 row-start-1 inline-flex items-center gap-2 font-serif text-xl leading-none text-carvao-muted sm:block">
            <span
              aria-hidden="true"
              className="mr-2 inline-block h-4 w-4 border border-mineral align-middle"
              style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, transparent 1px 4px)" }}
            />
            sem dado
          </p>
        ) : (
          <p className="col-start-2 row-span-2 row-start-1 text-right font-serif text-[1.75rem] leading-none tabular-nums text-carvao sm:text-left sm:text-[2.25rem]">
            {valorDestaque(v, formato, casas)}
            {u && <span className="block pt-1 font-sans text-xs leading-tight text-carvao-muted sm:ml-1.5 sm:inline sm:pt-0 sm:text-sm">{u}</span>}
          </p>
        )}
        <div className="col-start-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-snug text-carvao-muted sm:mt-1.5">
          {textoPer && <span>{textoPer}</span>}
          <SeloNatureza natureza={natureza} texto />
          {ficha && <ComproveNumero evidencia={ficha} endereco={endereco} />}
        </div>
        {ausente && motivoAusencia && <p className="col-start-1 mt-1 text-xs leading-relaxed text-carvao-muted">{motivoAusencia}</p>}
        {vari && (
          <p className="col-start-1 mt-1 text-xs tabular-nums text-carvao-muted">
            <span aria-hidden="true">
              {vari.glifo && <span className="mr-1">{vari.glifo}</span>}
              {vari.texto} {variacao?.referencia}
            </span>
            <span className="sr-only">{vari.leitura}</span>
          </p>
        )}
        {nota && <div className="col-span-2 mt-1 text-xs leading-relaxed text-carvao-muted">{nota}</div>}
      </div>
    );
  }

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
      {ficha && (
        <div className="mt-auto pt-2">
          <ComproveNumero evidencia={ficha} endereco={endereco} />
        </div>
      )}
    </div>
  );
}
