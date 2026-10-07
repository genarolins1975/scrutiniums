import { statSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { ExpansaoLinkPainel } from "@/components/energia/ExpansaoLinkPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { PAINEIS_EXPANSAO, ROTA_EXPANSAO, painel, proximoPainel, rotaPainel, type PainelExpansao } from "@/lib/energia/expansao";
import { datasLegiveis, num } from "@/lib/energia/formato";
import type { Download } from "@/lib/energia/tipos";

/**
 * Peças de servidor das páginas da Expansão da oferta e da rede (a síntese em
 * /setor-eletrico/expansao e um painel por página em /carteira, /cronograma,
 * /geracao-e-transmissao e /cenarios): navegação entre as páginas, recorte (período,
 * universo e unidade), rodapé com downloads, link compartilhável e próxima pergunta,
 * blocos dos modos Analisar e Auditar e o aviso de ausência legítima da fonte.
 *
 * Por que um painel por página: a gold tem cerca de 390 KB, e os mapas, as séries, as
 * tabelas e as fichas de prova dos quatro painéis juntos passariam da meta de cerca de
 * 600 KB de HTML por página (contrato, seção 5.1). Cada página leva só o recorte que
 * mostra; os arquivos grandes (pontos das usinas, linhas da EPE) carregam sob demanda.
 */

/**
 * Tamanho do arquivo publicado (lido do disco no build), para o botão de carga sob demanda
 * dizer quanto vai baixar. Arquivo ausente devolve null: o botão não promete tamanho.
 */
export function tamanhoPublicado(url: string): string | null {
  try {
    const b = statSync(join(process.cwd(), "public", url)).size;
    return b >= 1e6 ? `${num(b / 1e6, 1)} MB` : `${num(b / 1e3, 0)} KB`;
  } catch {
    return null;
  }
}

/** Navegação entre a síntese e os quatro painéis; o atual leva aria-current. */
export function ExpansaoNavegacao({ atual }: { atual: PainelExpansao | "sintese" }) {
  const itens = [{ href: ROTA_EXPANSAO, rotulo: "Síntese", id: "sintese" as const }, ...PAINEIS_EXPANSAO.map((p) => ({ href: rotaPainel(p.id), rotulo: p.rotulo, id: p.id }))];
  return (
    <nav aria-label="Páginas da expansão" className="pb-4">
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
export function ExpansaoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="expansao" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
        <Indisponivel
          titulo="Expansão indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold do módulo Expansão (public/energia/gold/expansao.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
      </main>
    </>
  );
}

/** Período, universo e unidade do painel, logo abaixo da resposta (anatomia da seção 7.2, item 3). */
export function ExpansaoRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
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

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta (seção 7.2, itens 9 e 10). */
export function ExpansaoSeguir({ id, downloads }: { id: PainelExpansao; downloads: Download[] }) {
  const prox = painel(proximoPainel(id));
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
        <ExpansaoLinkPainel ancora={id} />
        <p className="text-sm">
          <span className="rotulo mr-2 text-mineral">Próxima pergunta</span>
          <Link href={rotaPainel(prox.id)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {prox.pergunta}
          </Link>
        </p>
      </div>
    </div>
  );
}

export function ExpansaoAnalise({ titulo, children, id }: { titulo: string; children: ReactNode; id?: string }) {
  return (
    <div id={id} data-nivel="analisar" className="scroll-mt-28 space-y-3 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function ExpansaoAuditoria({ titulo, children, id }: { titulo: string; children: ReactNode; id?: string }) {
  return (
    <div id={id} data-nivel="auditar" className="scroll-mt-28 space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function ExpansaoSubtitulo({ children }: { children: ReactNode }) {
  return <h3 className="font-serif text-lg text-carvao">{children}</h3>;
}

/** Nota curta de leitura sob um gráfico (sem caixa: a visualização domina). */
export function ExpansaoNota({ children }: { children: ReactNode }) {
  return <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{children}</p>;
}

/**
 * Ausência legítima da fonte (seção 2.3): o que falta, a evidência do bloqueio, a
 * alternativa usada e a dependência. Nunca "em breve": é o estado real da fonte.
 */
export function ExpansaoAusencia({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div role="note" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm leading-relaxed text-carvao">
      <p className="rotulo flex items-center gap-2 text-carvao">
        <span aria-hidden="true" className="inline-block h-2.5 w-2.5 border border-carvao" />
        {titulo}
      </p>
      <div className="mt-1.5 space-y-1.5">{children}</div>
    </div>
  );
}

/** Lista das limitações publicadas pela proveniência (texto da gold, sem reescrita). */
export function ExpansaoLimitacoes({ itens }: { itens: readonly string[] }) {
  if (!itens.length) return null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
      {itens.map((x) => (
        <li key={x}>{datasLegiveis(x)}</li>
      ))}
    </ul>
  );
}

/** Tabela simples de servidor (poucas linhas, sem interação), com cabeçalhos e unidade. */
export function ExpansaoTabelaSimples({ titulo, cabecalho, linhas }: { titulo: string; cabecalho: string[]; linhas: ReactNode[][] }) {
  return (
    <div className="tabela-scroll" tabIndex={0} role="region" aria-label={`${titulo} (tabela rolável)`}>
      <table className="w-full border-collapse text-sm tabular-nums">
        <caption className="pb-2 text-left text-sm font-medium text-carvao">{titulo}</caption>
        <thead>
          <tr className="border-b border-linha text-left text-xs text-mineral">
            {cabecalho.map((c) => (
              <th key={c} scope="col" className="px-2 py-1.5 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-b border-linha align-top text-carvao">
              {l.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="px-2 py-1.5 text-left font-normal">
                    {c}
                  </th>
                ) : (
                  <td key={j} className="px-2 py-1.5">
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
