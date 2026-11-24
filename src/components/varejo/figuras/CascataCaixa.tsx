import { por100, reais } from "@/lib/varejo/formato";
import type { PassoDaCascata } from "@/lib/varejo/comparador";
import { COR_DESCEU, COR_SUBIU, HACHURA, HACHURA_AUSENCIA } from "./escala";

const COR_PATAMAR = "var(--serie-4)";

/** O que cada passo é, em palavras simples (o sinal é o da demonstração: negativo consumiu caixa). */
const EXPLICA: Partial<Record<PassoDaCascata["id"], string>> = {
  "antes-do-giro": "lucro, depreciação e demais itens da operação",
  estoques: "comprar mais estoque consome caixa",
  fornecedores: "pagar fornecedor consome; alongar o prazo libera",
  recebiveis: "vender a prazo consome; receber ou antecipar libera",
  operacional: "como a companhia apresenta",
  convenio: "o banco pagou o fornecedor; a companhia paga o banco e mostra no financiamento",
  "apos-convenio": "declarado menos os pagamentos de convênio",
  investimentos: "lojas, centros de distribuição e sistemas",
  "apos-investimentos": "antes de dívida, juros e dividendos",
};

/** Domínio comum de várias cascatas, em R$ por R$ 100: do menor ao maior ponto que alguma delas toca, com o zero dentro. */
export function dominioDasCascatas(cascatas: readonly (readonly PassoDaCascata[] | null)[]): [number, number] {
  const pontos = cascatas.flatMap((c) => (c ?? []).flatMap((p) => [p.de, p.ate])).filter((v): v is number => v !== null);
  return [Math.min(0, ...pontos), Math.max(0, ...pontos)];
}

/**
 * A cascata do caixa de uma companhia, por R$ 100 de receita líquida, de cima para baixo: os patamares (barras a partir do zero) e,
 * entre eles, os passos que somaram ou tiraram caixa (barras suspensas, do patamar anterior ao seguinte: azul quando liberou, sépia
 * quando consumiu, e o sinal sempre escrito). O passo do convênio de fornecedores vem hachurado e com a explicação: é ele que separa
 * o caixa operacional declarado do que sobra quando a compra de mercadoria volta para a operação. Linha que a companhia não
 * apresenta é estado dito ("não apresenta"), nunca zero. Várias cascatas lado a lado usam o mesmo `dominio`, para se compararem.
 */
export function CascataCaixa({ passos, dominio, titulo }: Readonly<{ passos: readonly PassoDaCascata[]; dominio: readonly [number, number]; titulo: string }>) {
  const [min, max] = dominio;
  const amplitude = max - min || 1;
  const x = (v: number) => (100 * (v - min)) / amplitude;
  const descricao = `${titulo}: ${passos.map((p) => `${p.rotulo}, ${p.por100 === null ? "não apresenta" : por100(p.por100)}`).join("; ")}.`;
  return (
    <div data-figura-varejo="cascata-caixa" data-cascata-caixa="" className="min-w-0">
      <ol aria-label={descricao}>
        {passos.map((p) => {
          const total = p.tipo === "total";
          const convenio = p.id === "convenio";
          const ausente = p.por100 === null || p.de === null || p.ate === null;
          const a = ausente ? 0 : x(Math.min(p.de as number, p.ate as number));
          const largura = ausente ? 0 : Math.abs(x(p.ate as number) - x(p.de as number));
          const cor = total ? COR_PATAMAR : (p.por100 as number) < 0 ? COR_DESCEU : COR_SUBIU;
          return (
            <li key={p.id} data-passo-da-cascata={p.id} data-ausente={ausente ? "" : undefined} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-1.5 ${total ? "border-t border-carvao" : "border-t border-linha"} ${convenio && !ausente ? "bg-marfim" : ""}`}>
              <p className={`min-w-0 text-sm leading-snug text-carvao ${total ? "font-medium" : "pl-3"}`}>
                {p.rotulo}
                <span className="block text-xs font-normal text-carvao-muted">{EXPLICA[p.id]}</span>
              </p>
              <p className={`text-right tabular-nums text-carvao ${total ? "numero-p" : "text-sm"}`}>
                {ausente ? (
                  <span className="font-sans text-xs italic text-mineral">{convenio || p.id === "apos-convenio" ? "não apresenta" : "sem dado"}</span>
                ) : (
                  <>
                    {!total && (p.por100 as number) > 0 ? "+" : ""}
                    {por100(p.por100)}
                    <span className="block font-sans text-xs text-carvao-muted">{reais(p.reais)}</span>
                  </>
                )}
              </p>
              <span aria-hidden="true" className="relative col-span-2 mt-1 block h-3.5">
                <span className="absolute inset-y-[-3px] w-px bg-mineral" style={{ left: `${x(0)}%` }} />
                {ausente ? (
                  <span className="absolute inset-y-0.5 left-0 right-0" style={{ backgroundImage: HACHURA_AUSENCIA }} />
                ) : (
                  <span className="absolute inset-y-0 min-w-[2px]" style={{ left: `${a}%`, width: `${largura}%`, background: cor, ...(convenio ? { backgroundImage: HACHURA } : {}) }} />
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Legenda comum das cascatas. */
export function LegendaDaCascata({ comConvenio }: Readonly<{ comConvenio: boolean }>) {
  return (
    <ul className="t-meta flex flex-wrap gap-x-6 gap-y-1 text-carvao-muted" aria-label="Como ler a cascata">
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-3 w-5 shrink-0" style={{ background: COR_PATAMAR }} />
        patamar do caixa, a partir do zero
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-3 w-5 shrink-0" style={{ background: COR_SUBIU }} />
        passo que liberou caixa
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-3 w-5 shrink-0" style={{ background: COR_DESCEU }} />
        passo que consumiu caixa
      </li>
      {comConvenio && (
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-5 shrink-0" style={{ background: COR_DESCEU, backgroundImage: HACHURA }} />
          hachura: pagamentos de convênio, o ajuste
        </li>
      )}
    </ul>
  );
}
