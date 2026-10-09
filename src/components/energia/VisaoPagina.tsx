import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { VisaoLinkPainel } from "@/components/energia/VisaoLinkPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { PAINEIS_VISAO, datasLegiveis, type IdPainelVisao } from "@/lib/energia/visao";
import type { ControleVisao } from "@/lib/energia/tipos-visao";

/**
 * Peças de servidor da Visão geral (/setor-eletrico/visao-geral): sumário dos quatro
 * painéis, resposta curta, recorte (período, universo e unidade), avisos de ausência e
 * defasagem, rodapé com downloads, link compartilhável e próxima pergunta, e os blocos
 * dos modos Analisar e Auditar.
 *
 * Os quatro painéis ficam numa página só porque a Visão geral é o resumo de poucos minutos
 * (seção 9.1); o peso fica abaixo da meta de cerca de 600 KB de HTML porque séries longas,
 * históricos e as regras completas estão nos CSV de download e nos módulos de origem.
 */

/** Sumário dos painéis com a pergunta de cada um; o atual (se houver) leva aria-current. */
export function VisaoNavegacao() {
  return (
    <nav aria-label="Painéis da visão geral" className="pb-4">
      <ol className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {PAINEIS_VISAO.map((p) => (
          <li key={p.id}>
            <a
              href={`#${p.id}`}
              className="flex min-h-[44px] flex-col justify-center border border-linha bg-superficie px-3 py-2 text-carvao-muted hover:border-energia hover:text-carvao"
            >
              <span className="rotulo text-mineral">{p.rotulo}</span>
              <span className="mt-0.5 text-carvao">{p.pergunta}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Resposta factual curta do painel (seção 7.2, item 2), sempre derivada da gold. */
export function VisaoResposta({ painel, children }: { painel: IdPainelVisao; children: ReactNode }) {
  return (
    <div data-resposta={painel} className="border-l-2 border-energia pl-4 text-base leading-relaxed text-carvao md:text-lg">
      {children}
    </div>
  );
}

/** Período, universo e unidade do painel, logo abaixo da resposta (seção 7.2, item 3). */
export function VisaoRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5 leading-relaxed">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5 leading-relaxed">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Unidade</dt>
        <dd className="mt-0.5 leading-relaxed">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Aviso que muda a leitura (fonte defasada, ausência legítima, datas diferentes). */
export function VisaoAviso({ children, tipo = "nota" }: { children: ReactNode; tipo?: "nota" | "alerta" }) {
  return (
    <div
      role={tipo === "alerta" ? "note" : undefined}
      className={`border-l-2 pl-3 text-sm leading-relaxed ${tipo === "alerta" ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`}
    >
      {children}
    </div>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta (seção 7.2, itens 9 e 10). */
export function VisaoSeguir({ ancora, proximo, downloads }: { ancora: string; proximo: { href: string; pergunta: string }; downloads: { rotulo: string; url: string }[] }) {
  const unicos = downloads.filter((d, i) => downloads.findIndex((x) => x.url === d.url) === i);
  return (
    <div className="space-y-3 border-t border-linha pt-3">
      {unicos.length > 0 && (
        <div>
          <p className="rotulo text-mineral">Baixar os dados deste painel</p>
          <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {unicos.map((d) => (
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
        <VisaoLinkPainel ancora={ancora} />
        <p className="text-sm">
          <span className="rotulo mr-2 text-mineral">Próxima pergunta</span>
          <Link href={proximo.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {proximo.pergunta}
          </Link>
        </p>
      </div>
    </div>
  );
}

export function VisaoAnalise({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="analisar" className="scroll-mt-28 space-y-4 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function VisaoAuditoria({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="auditar" className="scroll-mt-28 space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

/** Controles de execução publicados na gold (não são testes): nome, resultado com palavra e detalhe. */
export function VisaoControles({ controles }: { controles: ControleVisao[] }) {
  const rot = { aprovado: "aprovado", ressalva: "com ressalva", reprovado: "reprovado" } as const;
  return (
    <ul className="space-y-1.5 text-sm text-carvao-muted">
      {controles.map((c) => (
        <li key={c.nome} className="leading-relaxed [overflow-wrap:anywhere]">
          <span className={c.resultado === "aprovado" ? "text-carvao" : "text-aviso"}>{rot[c.resultado] ?? c.resultado}</span>: {c.nome}. {datasLegiveis(c.detalhe)}
        </li>
      ))}
    </ul>
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function VisaoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="visao-geral" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo="Visão geral indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold da visão geral (public/energia/gold/sintese.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
        <p className="mt-6 text-sm">
          <Link href="/setor-eletrico" className="text-energia-dark underline underline-offset-4">
            Voltar ao mapa do observatório
          </Link>
        </p>
      </main>
    </>
  );
}
