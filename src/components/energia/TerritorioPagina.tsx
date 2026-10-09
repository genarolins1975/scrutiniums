import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { TerritorioLinkPainel } from "@/components/energia/TerritorioLinkPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";

/**
 * Peças de servidor da página Minha região (/setor-eletrico/territorio, P002): estado de
 * ausência da gold, recorte (período, universo e unidade), avisos, tabelas simples dos
 * modos Analisar e Auditar e o rodapé com downloads, link compartilhável e próxima
 * pergunta. O explorador (mapa, ficha e tabelas interativas) é o componente cliente
 * TerritorioExplorador.
 */

/** Ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function TerritorioIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="territorio" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo="Minha região indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold do módulo Território (public/energia/gold/territorio.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
      </main>
    </>
  );
}

export function TerritorioRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Unidade</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Aviso que muda a leitura: borda tracejada, rótulo em texto, nunca só cor. */
export function TerritorioAviso({ rotulo, children, nivel }: { rotulo: string; children: ReactNode; nivel?: "analisar" }) {
  return (
    <div data-nivel={nivel} className="flex flex-wrap items-start gap-x-3 gap-y-1 border border-dashed border-mineral bg-papel px-4 py-3 text-sm leading-relaxed text-carvao">
      <span className="rotulo shrink-0 text-carvao">{rotulo}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

export function TerritorioAnalise({ titulo, children, id }: { titulo: string; children: ReactNode; id?: string }) {
  return (
    <div id={id} data-nivel="analisar" className="scroll-mt-28 space-y-3 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function TerritorioAuditoria({ titulo, children, id }: { titulo: string; children: ReactNode; id?: string }) {
  return (
    <div id={id} data-nivel="auditar" className="scroll-mt-28 space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

/**
 * Tabela simples de servidor (compatibilidade, catálogo, controles, conferências):
 * caption, cabeçalhos com escopo, rolagem horizontal dentro do componente e números à
 * direita. Ausência chega como texto ("sem dado"), nunca como zero.
 */
export function TerritorioTabela({ titulo, colunas, linhas, numericas = [] }: { titulo: string; colunas: string[]; linhas: ReactNode[][]; numericas?: number[] }) {
  return (
    <div className="tabela-scroll" tabIndex={0} role="region" aria-label={`${titulo} (tabela rolável)`}>
      <table className="w-full min-w-[28rem] border-collapse text-xs tabular-nums [&_td]:px-2 [&_td]:py-1.5 [&_td]:text-carvao">
        <caption className="pb-2 text-left text-sm font-medium text-carvao">{titulo}</caption>
        <thead>
          <tr>
            {colunas.map((c, i) => (
              <th key={c} scope="col" className={`border-b border-linha px-2 py-1.5 font-medium text-mineral ${numericas.includes(i) ? "text-right" : "text-left"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, k) => (
            <tr key={k} className="border-b border-linha align-top last:border-b-0">
              {l.map((c, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="px-2 py-1.5 text-left font-normal text-carvao">
                    {c}
                  </th>
                ) : (
                  <td key={i} className={numericas.includes(i) ? "text-right" : "text-left"}>
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta (seção 7.2, itens 9 e 10). */
export function TerritorioSeguir({ ancora, href, pergunta, downloads }: { ancora: string; href: string; pergunta: string; downloads: { rotulo: string; url: string }[] }) {
  return (
    <div className="space-y-3 border-t border-linha pt-3">
      {downloads.length > 0 && (
        <div>
          <p className="rotulo text-mineral">Baixar os dados deste painel</p>
          <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {downloads.map((d) => (
              <li key={d.url}>
                <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {d.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <TerritorioLinkPainel ancora={ancora} />
        <p className="text-sm">
          <span className="rotulo mr-2 text-mineral">Próxima pergunta</span>
          <Link href={href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {pergunta}
          </Link>
        </p>
      </div>
    </div>
  );
}
