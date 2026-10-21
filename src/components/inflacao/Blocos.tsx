import Link from "next/link";
import type { ReactNode } from "react";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { dataBr } from "@/lib/inflacao/formato";
import type { GoldInflacao } from "@/lib/inflacao/tipos";

/** Seção do painel: filete, título em serifa e subtítulo com unidade, período e universo. */
export function SecaoInflacao({ id, titulo, subtitulo, rotulo, children }: { id: string; titulo: string; subtitulo?: ReactNode; rotulo?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="familias-secao scroll-mt-24 border-t border-linha py-8 md:py-10">
      {rotulo && <p className="rotulo mb-2 text-bronze-dark">{rotulo}</p>}
      <h2 id={`${id}-h`} className="ed-h2 max-w-3xl font-serif text-carvao">{titulo}</h2>
      {subtitulo && <div className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{subtitulo}</div>}
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

/** Linha de fonte ao pé da figura: IBGE, IPCA, tabela, data de divulgação e de captura. */
export function FonteIpca({ g, extra }: { g: GoldInflacao; extra?: ReactNode }) {
  return (
    <p className="max-w-prose2 text-xs leading-relaxed text-mineral">
      Fonte:{" "}
      <a href={g.fonte.url_tabela} className="underline underline-offset-2" rel="noopener noreferrer">
        IBGE, IPCA, tabela {g.fonte.tabela} do SIDRA
      </a>
      , divulgada em {dataBr(g.fonte.divulgado_em)}; captura em {dataBr(g.capturado_em)}. {extra}
    </p>
  );
}

/** Nota material junto da figura: o que a medida não permite afirmar. Fica visível, nunca em dica. */
export function NotaInflacao({ titulo = "Leia com cuidado", children }: { titulo?: string; children: ReactNode }) {
  return (
    <aside className="max-w-prose2 border-l-2 border-bronze-soft bg-marfim px-4 py-3 text-sm leading-relaxed text-carvao">
      <p className="rotulo text-bronze-dark">{titulo}</p>
      <div className="mt-1 space-y-2">{children}</div>
    </aside>
  );
}

/** Arquivos para baixar (em /inflacao/series, com conta). */
export function DownloadsInflacao({ arquivos }: { arquivos: { nome: string; descricao: string }[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {arquivos.map((a) => {
        const href = `/inflacao/series/${a.nome}`;
        return (
          <li key={a.nome}>
            <a href={href} download className="inline-flex min-h-[44px] items-center text-bronze-dark underline underline-offset-4">
              {a.nome}
              <SeloComConta href={href} />
            </a>
            <span className="text-carvao-muted"> · {a.descricao}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Caminhos para as perguntas vizinhas, ao fim da página. */
export function ProximasInflacao({ itens }: { itens: { href: string; pergunta: string; motivo: string }[] }) {
  return (
    <ul className="grid gap-x-8 gap-y-4 md:grid-cols-3">
      {itens.map((i) => (
        <li key={i.href} className="border-t border-linha pt-3">
          <Link href={i.href} prefetch={prefetchDoLink(i.href)} className="font-serif text-lg leading-snug text-carvao underline decoration-linha underline-offset-4 hover:decoration-bronze">
            {i.pergunta}
            <SeloComConta href={i.href} />
          </Link>
          <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{i.motivo}</p>
        </li>
      ))}
    </ul>
  );
}
