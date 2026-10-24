"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Nome } from "@/components/i18n/Nome";
import { useSessao } from "@/components/acesso/sessao";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { hrefNoIdioma } from "@/lib/i18n-href";
import type { Idioma } from "@/lib/idioma";
import { resolverContexto, type ContextoRota, type IndiceContexto, type ObservatorioResumo } from "@/lib/observatorios/contextoPuro";
import type { ObservatorioId } from "@/lib/observatorios/lista";

/**
 * Peças do cabeçalho que dependem do endereço: o seletor de coleção, as abas dos observatórios e a trilha. Resolvem o
 * contexto no navegador, a cada navegação, com o índice que o servidor mandou (contextoPuro.ts): um cabeçalho num layout
 * não se refaz ao navegar entre páginas irmãs, e a coleção atual tem de seguir a página aberta. No HTML do servidor valem o
 * mesmo índice e o endereço da renderização (`caminho`), então a primeira tela já sai certa, inclusive sem JavaScript.
 */
type Base = { indice: IndiceContexto; caminho: string | null };
const ContextoBase = createContext<Base | null>(null);

/**
 * Provedor do índice para as peças de um cabeçalho (CabecalhoPlataforma): o índice vai uma vez só no fluxo RSC da página,
 * em vez de uma por peça. Fora dele, cada peça recebe o índice pelas props.
 */
export function ProvedorContexto({ indice, caminho, children }: Base & { children: ReactNode }) {
  return <ContextoBase.Provider value={{ indice, caminho }}>{children}</ContextoBase.Provider>;
}

const VAZIO: IndiceContexto = { observatorios: [], paineis: [] };

function useBase(props: Partial<Base>): Base {
  const doProvedor = useContext(ContextoBase);
  return { indice: props.indice ?? doProvedor?.indice ?? VAZIO, caminho: props.caminho !== undefined ? props.caminho : doProvedor?.caminho ?? null };
}

function useContexto(indice: IndiceContexto, caminho: string | null, rotaFixa?: string): ContextoRota | null {
  const navegador = usePathname();
  const atual = rotaFixa ?? navegador ?? caminho;
  return useMemo(() => (atual ? resolverContexto(atual, indice) : null), [atual, indice]);
}

const tx = <T,>(pt: T, en: T, idioma: Idioma): T => (idioma === "en" ? en : pt);

/** Destino de um observatório para quem tem conta: a entrada própria ou a sua seção na escolha pós login (destinoObservatorio). */
const entradaDe = (o: ObservatorioResumo) => o.entrada ?? `/app/observatorios#obs-${o.id}`;

// ------------------------------------------------------------------ seletor

export function SeletorColecoes({
  padrao,
  idioma,
  onDark = false,
  children: menu,
  ...props
}: Partial<Base> & {
  /** Coleção a marcar quando o endereço não está no registro (o domínio que a página declarou). */
  padrao: { observatorio: ObservatorioId; colecao: string } | null;
  idioma: Idioma;
  onDark?: boolean;
  /** O fim do menu ("Escolher na minha conta"), igual em toda página. */
  children: ReactNode;
}) {
  const { indice, caminho } = useBase(props);
  const ctx = useContexto(indice, caminho);
  const obsPadrao = padrao ? indice.observatorios.find((o) => o.id === padrao.observatorio) ?? null : null;
  const observatorioAtual = ctx?.observatorio ?? obsPadrao;
  const colecaoAtual = ctx ? ctx.colecao : obsPadrao?.colecoes.find((c) => c.id === padrao?.colecao) ?? null;
  const rotulo = colecaoAtual?.nome ?? observatorioAtual?.nomeCurto ?? null;
  const cor = onDark ? "text-marfim" : "text-carvao";
  return (
    <>
      <summary
        className={`rotulo flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 ${cor} hover:text-energia-dark [&::-webkit-details-marker]:hidden`}
        aria-label={
          colecaoAtual
            ? tx(`Coleção atual: ${colecaoAtual.nome}. Trocar de coleção ou de observatório`, `Current collection: ${colecaoAtual.nome}. Switch collection or observatory`, idioma)
            : observatorioAtual
              ? tx(`Observatório atual: ${observatorioAtual.nome}. Trocar de coleção ou de observatório`, `Current observatory: ${observatorioAtual.nome}. Switch collection or observatory`, idioma)
              : tx("Trocar de observatório", "Switch observatory", idioma)
        }
      >
        {/* nome longo ("Dívida e crédito das famílias") não empurra a conta para fora da linha da marca no celular */}
        <span className="max-w-[11rem] truncate sm:max-w-[16rem]">{rotulo ? <Nome>{rotulo}</Nome> : tx("Observatórios", "Observatories", idioma)}</span>
        <span aria-hidden="true" className="text-xs transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      {/* no celular o menu ocupa a largura útil (fixo, 1rem de margem) para não sair da tela; no desktop, duas colunas */}
      <div className="bp-seletor-painel fixed inset-x-4 z-40 mt-1 hidden max-h-[80vh] overflow-y-auto border border-linha bg-superficie p-2 shadow-[0_8px_24px_rgba(26,29,33,0.12)] group-open:block sm:absolute sm:inset-x-auto sm:left-0 sm:w-[34rem]">
        <div className="sm:columns-2 sm:gap-2">
          {indice.observatorios.map((o) => (
            <div key={o.id} className="break-inside-avoid pb-1">
              <Link
                href={entradaDe(o)}
                prefetch={false}
                aria-current={!colecaoAtual && observatorioAtual?.id === o.id ? "true" : undefined}
                className="rotulo sel-item sel-obs"
              >
                <Nome>{o.nomeCurto}</Nome>
              </Link>
              <ul>
                {o.colecoes.map((c) => {
                  const eAtual = colecaoAtual?.id === c.id && observatorioAtual?.id === o.id;
                  return (
                    <li key={c.id}>
                      <Link
                        href={hrefNoIdioma(c.href, idioma)}
                        prefetch={false}
                        aria-current={eAtual ? "true" : undefined}
                        className="sel-item sel-col"
                      >
                        <Nome>{c.nome}</Nome>
                        {eAtual && <span className="sr-only">{tx(" (atual)", " (current)", idioma)}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        {menu}
      </div>
    </>
  );
}

// -------------------------------------------------------------------- abas

export function AbasObservatorios({
  padrao,
  abas,
  rotulo,
  ...props
}: Partial<Base> & {
  padrao: ObservatorioId | null;
  abas: { id: ObservatorioId; href: string; rotulo: string }[];
  rotulo: string;
}) {
  const { indice, caminho } = useBase(props);
  const ctx = useContexto(indice, caminho);
  const corrente = ctx?.observatorio.id ?? padrao;
  return (
    <nav aria-label={rotulo} className="obs-dominios">
      {abas.map(({ id, href, rotulo: nome }) => (
        <Link key={id} href={href} prefetch={false} aria-current={corrente === id ? "true" : undefined}>
          <Nome>{nome}</Nome>
        </Link>
      ))}
    </nav>
  );
}

// ------------------------------------------------------------------ trilha

export type ItemExtra = { titulo: string; href?: string };

/**
 * Trilha "Observatórios / Observatório / Coleção / Página", lida do registro. A raiz e o observatório seguem a sessão: com
 * conta, a escolha pós login e a entrada do observatório; sem conta (e enquanto a sessão não responde, como no HTML do
 * servidor), a página aberta do observatório (/perguntas/<id>). `extras` continua a trilha abaixo da coleção, para páginas
 * fora do registro que pertencem a ela (os dados abertos do Crédito).
 */
export function TrilhaCliente({
  rota,
  extras = [],
  idioma,
  className,
  ...props
}: Partial<Base> & {
  rota?: string;
  extras?: ItemExtra[];
  idioma: Idioma;
  className?: string;
}) {
  const { indice, caminho } = useBase(props);
  const ctx = useContexto(indice, caminho, rota);
  const logado = useSessao();
  if (!ctx) return null;
  const o = ctx.observatorio;
  const porta = `/perguntas/${o.id}`;
  const h = (href: string) => hrefNoIdioma(href, idioma);
  type Peca = { chave: string; conteudo: ReactNode; href?: string };
  const pecas: Peca[] = [
    { chave: "raiz", conteudo: tx("Observatórios", "Observatories", idioma), href: logado ? "/app/observatorios" : h(porta) },
    { chave: o.id, conteudo: <Nome>{o.nomeCurto}</Nome>, href: logado ? entradaDe(o) : h(porta) },
  ];
  if (ctx.colecao) pecas.push({ chave: ctx.colecao.id, conteudo: <Nome>{ctx.colecao.nome}</Nome>, href: h(ctx.colecao.href) });
  if (ctx.pagina) pecas.push({ chave: ctx.pagina.rota, conteudo: ctx.pagina.titulo, href: h(ctx.pagina.rota) });
  for (const e of extras) pecas.push({ chave: `extra:${e.titulo}`, conteudo: e.titulo, href: e.href });
  // a última peça é a página aberta: sem link, com aria-current; quando o endereço fica abaixo dela (sem registro próprio), segue link
  const ultimaEhAtual = extras.length > 0 ? !extras[extras.length - 1].href : ctx.exato;
  const link = "inline-flex min-h-[32px] items-center underline decoration-linha underline-offset-4 hover:text-carvao hover:decoration-carvao [@media(pointer:coarse)]:min-h-[44px]";
  return (
    <nav aria-label={tx("Você está em", "You are here", idioma)} className={className ? `trilha ${className}` : "trilha"} data-trilha="">
      <ol className="flex flex-wrap items-center gap-x-2 text-[13px] leading-5 text-carvao-muted">
        {pecas.map((p, i) => {
          const ultima = i === pecas.length - 1;
          return (
            <li key={p.chave} className="inline-flex items-center gap-x-2">
              {i > 0 && <span aria-hidden="true" className="text-mineral">/</span>}
              {ultima && ultimaEhAtual ? (
                <span aria-current="page" className="inline-flex min-h-[32px] items-center text-carvao [@media(pointer:coarse)]:min-h-[44px]">{p.conteudo}</span>
              ) : p.href ? (
                // numa página aberta, destino com conta leva o selo antes do clique (SeloComConta só aparece nelas)
                <Link href={p.href} prefetch={prefetchDoLink(p.href)} className={link}>{p.conteudo}<SeloComConta href={p.href} /></Link>
              ) : (
                <span className="inline-flex min-h-[32px] items-center">{p.conteudo}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
