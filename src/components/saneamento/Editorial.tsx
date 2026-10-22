import Link from "next/link";
import type { ReactNode } from "react";
import { SeloProntidao } from "@/components/observatorios/SeloProntidao";
import { ROTA, ROTULO_SITUACAO, eixoDoCapitulo, type Situacao } from "@/lib/saneamento/capitulos";
import { MARCA_AUTODECLARADO, RESSALVA_AUTODECLARADO } from "@/lib/saneamento/autodeclarado";

/**
 * Peças editoriais do Observatório do Saneamento. Todas no servidor.
 * Cada capítulo abre com pergunta, síntese factual e recorte; cada figura
 * leva fonte e o que os dados permitem e não permitem concluir.
 */

export function Abertura({
  capitulo,
  rotuloExtra,
  titulo,
  texto,
  recorte,
  situacao,
  pendencia,
}: {
  capitulo?: number;
  rotuloExtra?: string;
  titulo: string;
  texto: ReactNode;
  recorte: ReactNode;
  situacao?: Situacao;
  pendencia?: string;
}) {
  const eixo = capitulo ? eixoDoCapitulo(capitulo) : undefined;
  return (
    <header className="mb-10 border-b border-linha pb-8">
      <p className="rotulo text-obee-dark">
        {eixo ? `Eixo ${eixo.id} · ${eixo.rotulo}` : "Saneamento"}
        {capitulo ? ` · Capítulo ${capitulo}` : ""}
        {rotuloExtra ? ` · ${rotuloExtra}` : ""}
      </p>
      <h1 className="mt-4 max-w-4xl font-serif text-[2rem] leading-tight text-carvao [text-wrap:balance] md:text-[2.75rem]">{titulo}</h1>
      <div className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">{texto}</div>
      <p className="mt-5 max-w-prose2 text-sm leading-relaxed text-carvao">
        <span className="rotulo mr-2 text-mineral">Recorte</span>
        {recorte}
      </p>
      {situacao && situacao !== "publicado" && (
        <p className="mt-4 max-w-prose2 border-l-2 border-aviso pl-4 text-sm leading-relaxed text-carvao-muted">
          <span className="font-medium text-carvao">{ROTULO_SITUACAO[situacao]}.</span> {pendencia}
        </p>
      )}
    </header>
  );
}

export function Secao({
  id,
  titulo,
  texto,
  children,
}: {
  id?: string;
  titulo: string;
  texto?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-titulo` : undefined} className="mt-10 scroll-mt-24 border-t border-linha pt-10 md:mt-12 md:pt-12">
      <h2 id={id ? `${id}-titulo` : undefined} className="max-w-3xl font-serif text-[1.6rem] leading-snug text-carvao [text-wrap:balance] md:text-[1.9rem]">
        {titulo}
      </h2>
      {texto && <div className="mt-3 max-w-prose2 text-[0.95rem] leading-relaxed text-carvao-muted">{texto}</div>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export type ItemNumero = {
  rotulo: string;
  valor: string;
  unidade?: string;
  contexto: ReactNode;
};

/** Faixa de medidas com rótulo preciso, valor, recorte e referência. Sem setas e sem cor de julgamento. */
export function Numeros({ itens, colunas = 3 }: { itens: ItemNumero[]; colunas?: 2 | 3 | 4 }) {
  const grade = colunas === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : colunas === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <dl className={`grid gap-x-8 border-t border-carvao ${grade}`}>
      {itens.map((n) => (
        <div key={n.rotulo} className="border-b border-linha py-5">
          <dt className="text-sm leading-snug text-carvao-muted">{n.rotulo}</dt>
          <dd className="mt-2">
            <span className="font-serif text-[2rem] leading-none tabular-nums text-carvao">{n.valor}</span>
            {n.unidade && <span className="ml-1.5 text-sm text-carvao-muted">{n.unidade}</span>}
          </dd>
          <dd className="mt-2 text-xs leading-relaxed text-carvao-muted">{n.contexto}</dd>
        </div>
      ))}
    </dl>
  );
}

/** O que os dados permitem observar e o que não permitem concluir, fora de tooltip. */
export function Ressalva({ permite, naoPermite }: { permite: ReactNode; naoPermite: ReactNode }) {
  return (
    <div className="mt-6 grid grid-cols-1 max-w-4xl gap-x-8 gap-y-3 border-l-2 border-obee pl-4 text-sm leading-relaxed sm:grid-cols-2">
      <p>
        <span className="rotulo block text-obee-dark">Permite observar</span>
        <span className="text-carvao">{permite}</span>
      </p>
      <p>
        <span className="rotulo block text-mineral">Não permite concluir</span>
        <span className="text-carvao">{naoPermite}</span>
      </p>
    </div>
  );
}

/** Marca de valor financeiro declarado pelo prestador ao SINISA, junto ao número (src/lib/saneamento/autodeclarado.ts). */
export function MarcaAutodeclarado({ className = "" }: { className?: string }) {
  return (
    <span data-autodeclarado="" className={`block text-xs leading-snug text-carvao-muted ${className}`}>
      {MARCA_AUTODECLARADO}
    </span>
  );
}

/** A explicação da marca, uma vez por capítulo, perto do primeiro valor financeiro. */
export function RessalvaAutodeclarado({ children }: { children?: ReactNode }) {
  return (
    <aside
      aria-label="Valores financeiros autodeclarados"
      data-ressalva-autodeclarado=""
      className="mt-6 max-w-prose2 border-l-2 border-aviso pl-4 text-sm leading-relaxed text-carvao"
    >
      <p className="font-medium">Valores autodeclarados ao SINISA, sem conferência com demonstrações financeiras auditadas</p>
      <p className="mt-1 text-carvao-muted">{RESSALVA_AUTODECLARADO}</p>
      {children && <div className="mt-1 text-carvao-muted">{children}</div>}
    </aside>
  );
}

export function Nota({ children, titulo }: { children: ReactNode; titulo?: string }) {
  return (
    <aside className="mt-6 max-w-prose2 border-l-2 border-linha pl-4 text-sm leading-relaxed text-carvao-muted">
      {titulo && <p className="mb-1 font-medium text-carvao">{titulo}</p>}
      {children}
    </aside>
  );
}

export function Fonte({ children, metodo = true }: { children: ReactNode; metodo?: boolean }) {
  return (
    <p className="mt-4 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
      <span className="rotulo mr-1.5 text-mineral">Fonte</span>
      {children}
      {metodo && (
        <>
          {" "}
          <Link className="text-obee-dark underline underline-offset-2" href={`${ROTA}/metodologia`}>
            Método, conferências e arquivos
          </Link>
          .
        </>
      )}
    </p>
  );
}

export function SeloSituacao({ situacao }: { situacao: Situacao }) {
  // a forma única da plataforma (SeloProntidao): glifo e texto, nunca só cor
  return <SeloProntidao valor={situacao === "em_preparacao" ? "preparacao" : situacao} />;
}

/** Bloco para estado indisponível: diz o que falta e o que continua utilizável. */
export function Indisponivel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="border border-dashed border-linha bg-superficie p-5 text-sm leading-relaxed text-carvao-muted">
      <p className="font-medium text-carvao">{titulo}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/**
 * Atalhos para as seções de uma página longa, logo depois da abertura. No celular os atalhos ficam numa linha que rola só dentro da
 * barra (a página não rola de lado); no desktop quebram em linhas. Cada item aponta para o `id` de uma `Secao`; o teste
 * `saneamento-entrada` confere que a lista cobre todas as seções da página, na ordem, e que nenhum atalho aponta para âncora ausente.
 */
export function NestaPagina({ itens }: { itens: { id: string; rotulo: string }[] }) {
  return (
    <nav aria-label="Nesta página" data-nesta-pagina="" className="mb-10 border-y border-linha py-3">
      <p className="rotulo text-mineral">
        Nesta página · {itens.length} seções
      </p>
      <ol className="tabela-scroll mt-2 flex gap-2 pb-1 lg:flex-wrap">
        {itens.map((x, i) => (
          <li key={x.id} className="shrink-0">
            <a
              href={`#${x.id}`}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap border border-linha bg-superficie px-3 text-sm text-carvao hover:border-obee hover:text-obee-dark"
            >
              <span aria-hidden="true" className="text-xs tabular-nums text-mineral">
                {i + 1}
              </span>
              {x.rotulo}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
