import type { ReactNode } from "react";
import { diaBr, textoCurado } from "@/lib/varejo/formato";
import { ROTULO_NATUREZA, tituloDaFonte, urlSegura, type NaturezaCurada } from "@/lib/varejo/grupos";
import type { FonteCuradoria } from "@/lib/varejo/tipos";
import { LINK } from "./comum";

/**
 * A natureza de um número da curadoria, sempre por extenso e com uma marca de forma diferente para cada estado (cheia para o
 * divulgado, vazada e tracejada para a estimativa da fonte, losango para a conta nossa): a leitura não depende de cor.
 */
export function MarcaNatureza({ natureza, curta = false }: Readonly<{ natureza: NaturezaCurada; curta?: boolean }>) {
  const texto = curta && natureza === "estimado_pela_fonte" ? "estimado" : ROTULO_NATUREZA[natureza];
  return (
    <span data-natureza-dado={natureza} className="inline-flex items-center gap-1.5 whitespace-nowrap text-carvao">
      <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
        {natureza === "divulgado" && <circle cx="5" cy="5" r="4" fill="currentColor" />}
        {natureza === "estimado_pela_fonte" && <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.2 1.6" />}
        {natureza === "calculado" && <path d="M5 0.8 9.2 5 5 9.2 0.8 5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />}
        {natureza === "nao_informada" && <path d="M1.5 5h7" stroke="currentColor" strokeWidth="1.5" />}
      </svg>
      {texto}
    </span>
  );
}

/** A legenda das marcas de natureza, para ficar junto da tabela que as usa. */
export function LegendaNatureza({ naturezas }: Readonly<{ naturezas: readonly NaturezaCurada[] }>) {
  const EXPLICA: Record<NaturezaCurada, string> = {
    divulgado: "publicado pela empresa ou em demonstração",
    estimado_pela_fonte: "a fonte declara que estimou o valor",
    calculado: "conta da Scrutiniums sobre valores divulgados",
    nao_informada: "a curadoria não registrou a natureza",
  };
  return (
    <ul className="t-meta flex flex-wrap gap-x-6 gap-y-1 text-carvao-muted" aria-label="Natureza de cada dado" data-legenda-natureza="">
      {naturezas.map((n) => (
        <li key={n} className="flex items-baseline gap-2">
          <MarcaNatureza natureza={n} />
          <span>{EXPLICA[n]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Uma fonte da curadoria: título com o link que abre o documento, página, período e data da consulta. */
export function FonteDocumento({ f, prefixo }: Readonly<{ f: FonteCuradoria | undefined | null; prefixo?: string }>) {
  const titulo = tituloDaFonte(f);
  if (!f || !titulo) return <span data-sem-fonte="">fonte não registrada na curadoria</span>;
  const url = urlSegura(f.url);
  const pagina = f.pagina === undefined || f.pagina === null || String(f.pagina).trim() === "" ? null : textoCurado(String(f.pagina));
  return (
    <span data-fonte-documento="">
      {prefixo}
      {url ? (
        <a href={url} rel="noopener noreferrer" target="_blank" className={LINK}>
          {textoCurado(titulo)}
        </a>
      ) : (
        textoCurado(titulo)
      )}
      {pagina ? `, ${/^\d/.test(pagina) ? "p. " : ""}${pagina}` : ""}
      {f.periodo ? `. Período: ${textoCurado(f.periodo)}` : ""}
      {f.consultado_em ? `. Consultado em ${diaBr(f.consultado_em)}` : ""}.
    </span>
  );
}

/** Par rótulo e conteúdo dos capítulos da ficha e dos quadros de conceito: rótulo em caixa alta pequena, texto na medida de leitura. */
export function Campo({ rotulo, children, className = "" }: Readonly<{ rotulo: string; children: ReactNode; className?: string }>) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="rotulo text-mineral">{rotulo}</dt>
      <dd className="mt-1.5 text-sm leading-relaxed text-carvao">{children}</dd>
    </div>
  );
}

/** Estado explícito de ausência dentro de um texto: "não divulgado", nunca zero nem traço. */
export function NaoDivulgado({ children = "não divulgado" }: Readonly<{ children?: ReactNode }>) {
  return (
    <span className="italic text-mineral" data-nao-divulgado="">
      {children}
    </span>
  );
}
