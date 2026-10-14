import Link from "next/link";
import { GuiaLeituraGas } from "./GuiaLeituraGas";
import type { ReactNode } from "react";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { fontesPorId, type Indicador } from "@/lib/gas/gold";
import { carimbo, num, periodoLegivel, sinal } from "@/lib/gas/formato";
import type { PaginaGas } from "@/lib/gas/navegacao";
import { GRUPOS_GAS } from "@/lib/gas/navegacao";

/** Abertura da página: grupo, pergunta como título, uma ou duas frases e a data dos dados. */
export function AberturaGas({ pagina, children, dadosAte }: { pagina: PaginaGas; children: ReactNode; dadosAte?: ReactNode }) {
  const grupo = GRUPOS_GAS.find((g) => g.id === pagina.grupo);
  return (
    <div className="cab-modulo gas-abertura">
      <p className="rotulo text-gas-dark">{grupo?.rotulo} · {pagina.rotulo}</p>
      <h1 className="ed-h1 mt-3 max-w-4xl font-serif text-carvao">{pagina.pergunta}</h1>
      <div className="ed-lead mt-4 max-w-prose2 space-y-3 text-carvao-muted">{children}</div>
      {dadosAte && <p className="mt-4 text-sm text-mineral">{dadosAte}</p>}
      <GuiaLeituraGas slug={pagina.slug} />
    </div>
  );
}

/** Seção da página: filete, título em serifa, subtítulo com unidade e universo. */
export function SecaoGas({ id, titulo, subtitulo, children }: { id: string; titulo: string; subtitulo?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="gas-secao scroll-mt-24 border-t border-linha py-8 md:py-10">
      <h2 id={`${id}-h`} className="ed-h2 max-w-3xl font-serif text-carvao">{titulo}</h2>
      {subtitulo && <div className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{subtitulo}</div>}
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

/** Valor com a unidade da gold, em pt-BR. "R$/13 kg" vira "R$ 114,33 por botijão"; percentuais ficam com o símbolo junto. */
export function valorComUnidade(v: number | string | null, unidade: string, casas: number, comSinal = false): { valor: string; unidade: string } {
  if (v === null || v === undefined) return { valor: "sem dado", unidade: "" };
  if (typeof v === "string") return { valor: v, unidade: "" };
  if (comSinal && unidade.startsWith("%")) return { valor: sinal(v, casas, "%"), unidade: unidade.slice(1).trim() };
  if (unidade.startsWith("R$ por ")) return { valor: `R$ ${num(v, casas)}`, unidade: unidade.slice(3) };
  if (unidade.startsWith("R$/")) return { valor: `R$ ${num(v, casas)}`, unidade: `por ${unidade.slice(3)}` };
  if (unidade.startsWith("US$/")) return { valor: `US$ ${num(v, casas)}`, unidade: `por ${unidade.slice(4)}` };
  if (unidade.startsWith("US$ ")) return { valor: `US$ ${num(v, casas)}`, unidade: unidade.slice(4) };
  if (unidade.startsWith("%")) return { valor: `${num(v, casas)}%`, unidade: unidade.slice(1).trim() };
  return { valor: num(v, casas), unidade };
}

/** "ANP", "ANP e BCB", "ANP, BCB e IBGE": órgãos distintos na ordem em que aparecem. */
function listaOrgaos(orgaos: string[]): string {
  const u = Array.from(new Set(orgaos));
  return u.length <= 1 ? (u[0] ?? "") : `${u.slice(0, -1).join(", ")} e ${u[u.length - 1]}`;
}

/**
 * Medida de destaque: rótulo, valor, unidade, período, recorte e natureza, com fonte e nota visíveis e detalhes de reprodução recolhidos.
 * Ausência aparece como "sem dado", nunca como zero.
 */
export function MedidaGas({ ind, casas = 1, rotulo, comparacao, variacao = false }: { ind: Indicador; casas?: number; rotulo?: string; comparacao?: ReactNode; variacao?: boolean }) {
  const { valor, unidade } = valorComUnidade(ind.valor, ind.unidade, casas, variacao);
  const fontes = fontesPorId(ind.fontes);
  return (
    <div className="min-w-0 border-t-2 border-gas pt-3">
      <p className="text-sm leading-snug text-carvao-muted">{rotulo ?? ind.rotulo}</p>
      <p className="mt-1 font-sans text-[1.75rem] tracking-tight leading-tight text-carvao [font-variant-numeric:tabular-nums]">
        {valor} {unidade && <span className="text-base text-carvao-muted">{unidade}</span>}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-mineral">
        {ind.recorte ? `${ind.recorte} · ` : ""}
        {periodoLegivel(ind.periodo)} · <SeloNatureza natureza={ind.natureza} texto />
      </p>
      {fontes.length > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
          {/* uma chamada só: a lista completa, com data de captura, fica em "Como este número é obtido" e em Dados */}
          Fonte:{" "}
          <Link href={fontes.length === 1 ? `/gas-natural/dados#fonte-${fontes[0].id}` : "/gas-natural/dados#fontes"} className="underline underline-offset-4">
            {fontes.length === 1 ? `${fontes[0].orgao}, ${fontes[0].conjunto}` : `${listaOrgaos(fontes.map((f) => f.orgao))}, ${fontes.length} conjuntos`}
          </Link>
        </p>
      )}
      {ind.nota && <p className="mt-1 border-l-2 border-gas pl-3 text-sm leading-relaxed text-carvao-muted">{ind.nota}</p>}
      {comparacao && <p className="mt-1 text-xs leading-relaxed text-carvao-muted">{comparacao}</p>}
      <details className="group mt-2">
        <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center text-xs text-gas-dark underline underline-offset-4 [&::-webkit-details-marker]:hidden">
          Como este número é obtido
        </summary>
        <div className="space-y-1.5 pb-2 text-xs leading-relaxed text-carvao-muted">
          {ind.formula && <p><span className="text-carvao">Fórmula:</span> {ind.formula}.</p>}
          <p>
            <span className="text-carvao">Fonte:</span>{" "}
            {fontes.map((f, i) => (
              <span key={f.id}>
                {i > 0 && "; "}
                <a href={f.pagina} className="underline underline-offset-2" rel="noopener noreferrer">{f.orgao}, {f.conjunto}</a>
                {f.capturado_em && `, capturado em ${carimbo(f.capturado_em)}`}
              </span>
            ))}
            .
          </p>
        </div>
      </details>
    </div>
  );
}

export function FaixaMedidas({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

/** Nota material junto da figura: o que a medida não permite afirmar. Fica visível, nunca em tooltip. */
export function NotaGas({ titulo = "Leia com cuidado", children }: { titulo?: string; children: ReactNode }) {
  return (
    <aside className="max-w-prose2 border-l-2 border-gas-soft bg-gas-fundo px-4 py-3 text-sm leading-relaxed text-carvao">
      <p className="rotulo text-gas-dark">{titulo}</p>
      <div className="mt-1 space-y-2">{children}</div>
    </aside>
  );
}

/** Linha de fonte ao pé da figura: órgão, conjunto e data de captura de cada conjunto usado. */
export function FonteFigura({ ids, extra }: { ids: string[]; extra?: ReactNode }) {
  const fontes = fontesPorId(ids);
  return (
    <p className="max-w-prose2 text-xs leading-relaxed text-mineral">
      Fonte:{" "}
      {fontes.map((f, i) => (
        <span key={f.id}>
          {i > 0 && "; "}
          <a href={f.pagina} className="underline underline-offset-2" rel="noopener noreferrer">{f.orgao}, {f.conjunto}</a>
          {f.capturado_em && ` (captura ${carimbo(f.capturado_em)})`}
        </span>
      ))}
      . {extra}
    </p>
  );
}

export type ColunaTabela = { id: string; rotulo: string; numero?: boolean; casas?: number; sufixo?: string };

/** Tabela no HTML do servidor, com rolagem só nela quando a largura não cabe. Números à direita, algarismos tabulares. */
export function TabelaGas({ titulo, colunas, linhas, nota }: { titulo: string; colunas: ColunaTabela[]; linhas: Record<string, string | number | null>[]; nota?: ReactNode }) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-sm text-carvao">{titulo}</figcaption>
      <div className="relative overflow-x-auto border-y border-linha" tabIndex={0} role="region" aria-label={titulo}>
        <table className="w-full min-w-[34rem] border-collapse text-sm [font-variant-numeric:tabular-nums]">
          <thead>
            <tr className="border-b border-linha text-left">
              {colunas.map((c) => (
                <th key={c.id} scope="col" className={`px-2 py-2 font-normal text-carvao-muted ${c.numero ? "text-right" : ""}`}>{c.rotulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-b border-linha last:border-b-0">
                {colunas.map((c, j) => {
                  const v = l[c.id];
                  const texto = v === null || v === undefined ? "sem dado" : typeof v === "number" ? `${num(v, c.casas ?? 1)}${c.sufixo ?? ""}` : v;
                  const Cel = j === 0 ? "th" : "td";
                  return (
                    <Cel key={c.id} scope={j === 0 ? "row" : undefined} className={`px-2 py-2 font-normal ${c.numero ? "text-right" : "text-left"} ${v === null || v === undefined ? "text-mineral" : "text-carvao"}`}>
                      {texto}
                    </Cel>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nota && <div className="mt-2 text-xs leading-relaxed text-mineral">{nota}</div>}
    </figure>
  );
}

/** Caminhos para as outras perguntas do observatório, ao fim de cada página. */
export function ProximasPerguntas({ itens }: { itens: { href: string; pergunta: string; motivo: string }[] }) {
  return (
    <ul className="grid gap-x-8 gap-y-4 md:grid-cols-3">
      {itens.map((i) => (
        <li key={i.href} className="border-t border-linha pt-3">
          <Link href={i.href} prefetch={false} className="font-serif text-lg leading-snug text-carvao underline decoration-linha underline-offset-4 hover:decoration-gas">
            {i.pergunta}
          </Link>
          <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{i.motivo}</p>
        </li>
      ))}
    </ul>
  );
}

/** Download das séries da página (arquivos em /gas/series, com conta). */
export function DownloadsGas({ series }: { series: { id: string; descricao: string }[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {series.map((s) => (
        <li key={s.id}>
          <a href={`/gas/series/${s.id}.csv`} download className="inline-flex min-h-[44px] items-center text-gas-dark underline underline-offset-4">
            {s.id}.csv
          </a>
          <span className="text-carvao-muted"> · {s.descricao}</span>
        </li>
      ))}
    </ul>
  );
}
