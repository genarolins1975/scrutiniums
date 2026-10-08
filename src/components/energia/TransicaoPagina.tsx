import type { ReactNode } from "react";
import { TextoEnergia } from "@/components/energia/TextoEnergia";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { TransicaoLinkPainel } from "@/components/energia/TransicaoLinkPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { PAINEIS_TRANSICAO, ROTA_TRANSICAO, rotaPainel, type PainelTransicao } from "@/lib/energia/transicao";
import type { DocumentoFonte } from "@/lib/energia/tipos-transicao";

/**
 * Peças de servidor das páginas Transição e ambiente (a síntese em
 * /setor-eletrico/transicao e os painéis em /mmgd, /energia-estimada e /emissoes):
 * navegação entre as páginas, recorte (período, universo e unidade), rodapé com
 * downloads, link compartilhável e próxima pergunta, blocos dos modos Analisar e
 * Auditar, tabela simples de servidor e citação de documento da fonte.
 *
 * Por que várias páginas: o mapa, as séries, as tabelas e as fichas de prova do
 * P063 (cadastro e estimativa do ONS) e do P064, juntos, passariam da meta de cerca
 * de 600 KB de HTML por página (contrato, seção 5.1).
 */

/** Navegação entre a síntese e as páginas dos painéis; a atual leva aria-current. */
export function TransicaoNavegacao({ atual }: { atual: PainelTransicao | "sintese" }) {
  const itens = [{ href: ROTA_TRANSICAO, rotulo: "Síntese", id: "sintese" as const }, ...PAINEIS_TRANSICAO.map((p) => ({ href: rotaPainel(p.id), rotulo: p.rotulo, id: p.id }))];
  return (
    <nav aria-label="Páginas da transição e ambiente" className="pb-4">
      <ol className="flex flex-wrap gap-2 text-sm">
        {itens.map((i) => (
          <li key={i.id}>
            <Link
              href={i.href}
              aria-current={i.id === atual ? "page" : undefined}
              className={`inline-flex min-h-[44px] items-center border px-3 ${
                i.id === atual ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia hover:text-carvao"
              }`}
            >
              {i.rotulo}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function TransicaoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="transicao" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
        <Indisponivel
          titulo="Transição e ambiente indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold do módulo Transição e ambiente (public/energia/gold/transicao.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
      </main>
    </>
  );
}

/** Período, universo e unidade do painel, logo abaixo da resposta (anatomia da seção 7.2, item 3). */
export function TransicaoRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
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

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta (seção 7.2, itens 9 e 10). */
export function TransicaoSeguir({ ancora, href, pergunta, downloads }: { ancora: string; href: string; pergunta: string; downloads: { rotulo: string; url: string }[] }) {
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
        <TransicaoLinkPainel ancora={ancora} />
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

export function TransicaoAnalise({ titulo, children, id }: { titulo: string; children: ReactNode; id?: string }) {
  return (
    <div id={id} data-nivel="analisar" className="scroll-mt-28 space-y-3 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function TransicaoAuditoria({ titulo, children, id }: { titulo: string; children: ReactNode; id?: string }) {
  return (
    <div id={id} data-nivel="auditar" className="scroll-mt-28 space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function TransicaoSubtitulo({ children }: { children: ReactNode }) {
  return <h3 className="font-serif text-lg text-carvao">{children}</h3>;
}

/** Aviso que muda a leitura (grandeza, estimativa, fonte defasada): borda tracejada, rótulo em texto, nunca só cor. */
export function TransicaoAviso({ rotulo, children, alerta = false }: { rotulo: string; children: ReactNode; alerta?: boolean }) {
  return (
    <div role={alerta ? "status" : undefined} className="flex flex-wrap items-start gap-x-3 gap-y-1 border border-dashed border-mineral bg-papel px-4 py-3 text-sm leading-relaxed text-carvao">
      <span className="rotulo shrink-0 text-carvao">{rotulo}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

/** Trecho literal de documento da fonte, com órgão, título, data de consulta e endereço. */
export function TransicaoDocumento({ doc }: { doc: DocumentoFonte }) {
  const [a, m, d] = doc.consultado_em.slice(0, 10).split("-");
  return (
    <figure className="border-l-2 border-linha pl-4 text-sm">
      <blockquote className="leading-relaxed text-carvao">&ldquo;{doc.trecho}&rdquo;</blockquote>
      <figcaption className="mt-1 text-xs text-carvao-muted">
        {doc.orgao}, {doc.titulo}. Consultado em {d}/{m}/{a}.{" "}
        <a href={doc.url} className="break-all text-energia-dark underline underline-offset-4 hover:text-carvao">
          {doc.url}
        </a>
      </figcaption>
    </figure>
  );
}

/**
 * Tabela simples renderizada no servidor (controles, listas curtas): caption,
 * cabeçalhos com escopo, rolagem horizontal dentro do componente e números
 * alinhados à direita. Ausência chega como texto ("sem dado"), nunca como zero.
 */
export function TransicaoTabela({ titulo, colunas, linhas, numericas = [] }: { titulo: string; colunas: string[]; linhas: ReactNode[][]; numericas?: number[] }) {
  return (
    <div className="tabela-scroll" tabIndex={0} role="region" aria-label={`${titulo} (tabela rolável)`}>
      <table className="w-full min-w-[28rem] border-collapse text-xs tabular-nums">
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
            <tr key={k} className="border-b border-linha last:border-b-0">
              {l.map((c, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="px-2 py-1.5 text-left font-normal text-carvao">
                    {typeof c === "string" ? <TextoEnergia texto={c} competencia="curta" /> : c}
                  </th>
                ) : (
                  <td key={i} className={`px-2 py-1.5 text-carvao ${numericas.includes(i) ? "text-right" : "text-left"}`}>
                    {typeof c === "string" ? <TextoEnergia texto={c} competencia="curta" /> : c}
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
