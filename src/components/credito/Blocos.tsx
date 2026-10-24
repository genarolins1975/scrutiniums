import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import { paginaCredito, type PaginaCredito } from "@/lib/credito/navegacao";

/**
 * Casca das páginas Next do Crédito: visita registrada (sem dado pessoal), cabeçalho comum com a navegação do módulo,
 * conteúdo, "Para ir além" e rodapé. A apresentação aberta (/observatorio-do-credito) tem casca própria e não usa esta.
 */
export function CascaCredito({
  atual,
  children,
  molde = false,
}: {
  atual: PaginaCredito["slug"];
  children: ReactNode;
  /** Página no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o PaginaPainel abre o próprio <main id="conteudo">. */
  molde?: boolean;
}) {
  const pagina = paginaCredito(atual);
  return (
    <div className="flex min-h-screen flex-col bg-papel">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-bronze focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao"
      >
        Pular para o conteúdo
      </a>
      <MarcaVisita secao={pagina.secao} />
      <header>
        <CabecalhoPlataforma colecao="credito" destinoConta={pagina.href} />
        <NavegacaoColecao colecao="credito" />
      </header>
      {molde ? (
        <div className="flex-1 pb-10">{children}</div>
      ) : (
        <main id="conteudo" className="ed-pagina flex-1 pb-16">
          {children}
        </main>
      )}
      <ParaIrAlem mapa={mapaParaIrAlem()} />
      <Footer />
    </div>
  );
}

/** Abertura da página: rótulo do módulo, título com a pergunta, uma frase do que a página mostra e a linha de fonte. */
export function AberturaCredito({ titulo, children, fonte }: { titulo: string; children: ReactNode; fonte?: ReactNode }) {
  return (
    <div className="max-w-prose2 pb-8 pt-10 md:pt-14">
      <p className="rotulo text-bronze-dark">Observatório de Crédito</p>
      <h1 className="mt-4 font-serif text-[clamp(1.9rem,4.4vw,2.9rem)] leading-[1.12] tracking-[-0.012em] text-carvao">{titulo}</h1>
      <div className="mt-5 space-y-3 text-base leading-relaxed text-carvao-muted md:text-[1.0625rem]">{children}</div>
      {fonte && <p className="mt-5 text-sm leading-relaxed text-mineral">{fonte}</p>}
    </div>
  );
}

/**
 * Aviso de que a taxa publicada não é o custo efetivo total. Fica à vista, junto do número, nunca em dica de cursor.
 */
export function AvisoCet({ className = "" }: { className?: string }) {
  return (
    <aside aria-label="Taxa de juros não é o CET" data-aviso-cet="" className={`border-l-2 border-bronze bg-marfim px-4 py-3 text-sm leading-relaxed text-carvao ${className}`}>
      <p className="font-medium">Taxa de juros não é o custo total do empréstimo (CET).</p>
      <p className="mt-1 text-carvao-muted">
        A taxa publicada pelo Banco Central é só a de juros. Tarifas, seguros e tributos (como o IOF) ficam fora dela e entram no Custo Efetivo Total, o
        CET, que o banco é obrigado a informar no contrato. O que você paga de fato pode ser maior que a taxa mostrada aqui.
      </p>
    </aside>
  );
}

/** Seção com título em forma de pergunta ou descrição curta. */
export function SecaoCredito({ id, titulo, subtitulo, children }: { id: string; titulo: string; subtitulo?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-titulo`} className="border-t border-linha py-10">
      <h2 id={`${id}-titulo`} className="font-serif text-[clamp(1.45rem,3vw,1.9rem)] leading-tight text-carvao">
        {titulo}
      </h2>
      {subtitulo && <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{subtitulo}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Selo de natureza do número: publicado pela fonte ou calculado aqui. */
export function Natureza({ tipo }: { tipo: "observado" | "calculado" }) {
  return (
    <span className={`rotulo ${tipo === "observado" ? "text-natureza-observado" : "text-natureza-calculado"}`}>
      {tipo === "observado" ? "Publicado pelo Banco Central" : "Calculado aqui"}
    </span>
  );
}
