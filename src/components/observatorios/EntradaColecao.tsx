import Link from "next/link";
import type { ReactNode } from "react";
import { ACENTO } from "@/components/home/acentos";
import { RotuloContexto } from "@/components/layout/RotuloContexto";
import { NumeroEscala } from "@/components/observatorios/NumeroEscala";
import { SeloProntidao, type Prontidao } from "@/components/observatorios/SeloProntidao";
import type { Dominio } from "@/lib/dominios";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

/**
 * Molde único das páginas de entrada (Iniciativa 4 do parecer de UX de 21/10/2026; skill observatorio-layout, §4 "Página de
 * entrada"). Todas as fatias saem do servidor, nesta ordem, cada uma marcada com `data-fatia` para o teste conferir:
 *
 *  1. `abertura`: RotuloContexto, H1 pergunta (até 60 caracteres) e uma frase (até 220). Nada mais antes dos números.
 *  2. `escala`: de um a quatro números (NumeroEscala), cada um com fonte, período, nota opcional e "Ver no painel"; na versão
 *     aperitivo, no lugar dela, a `consulta` do leitor (o caso dele, com fonte e período).
 *  3. `para-voce`: o bloco ParaVoce.
 *  4. `destinos`: as coleções (entrada de observatório) ou os destinos de primeiro nível (entrada de coleção).
 *  5. `secao-propria`: no máximo uma seção da coleção (o percurso da Energia, a régua das capitais), entre os destinos e o artefato.
 *  6. `artefato`: um ModeloDidatico.
 *  7. `caminhos`: "Perguntas para começar", cada uma com resposta curta e, quando o destino tem, o número lido dele.
 *  8. `recolhidos`: o resto do conteúdo de hoje, em Recolhido (<details> com o conteúdo no HTML), nunca apagado.
 *  9. `convite`: na versão aperitivo, o ConviteAperitivo.
 * 10. `metodo`: um único <details> no fim, com método, fontes, downloads e a faixa de frescor variante método.
 *
 * `tipo="aperitivo"` usa só abertura, consulta, convite e método. Orçamento de comprimento (aceite da iniciativa): entrada
 * até 6.500 px a 1440 e 11.000 a 390; aperitivo até 2.500 e 4.500; o primeiro número com o topo abaixo de 900 px a 1440.
 */

export type TipoEntrada = "observatorio" | "colecao" | "aperitivo";

/** Pergunta para começar: o destino, a resposta curta e, quando o destino tem número, o número lido da mesma base. */
export type CaminhoEntrada = { pergunta: string; resumo: string; href: string; rotulo?: string; numero?: NumeroPorta };

/** Destino de primeiro nível de uma coleção: a pergunta que ele responde e, quando há, o número lido da mesma base. */
export type DestinoEntrada = { titulo: string; href: string; pergunta?: string; numero?: NumeroPorta; prontidao?: Prontidao };

/** Até oito destinos à vista; o resto em "Mais destinos", no HTML. */
export const DESTINOS_A_VISTA = 8;

const H2 = "font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao";

function Raiz({ principal, id, className, tipo, children }: { principal: boolean; id?: string; className: string; tipo: TipoEntrada; children: ReactNode }) {
  return principal ? (
    <main id={id} className={className} data-entrada={tipo}>
      {children}
    </main>
  ) : (
    <div className={className} data-entrada={tipo}>
      {children}
    </div>
  );
}

export function EntradaColecao({
  tipo,
  rota,
  acento,
  titulo,
  frase,
  aoLadoDoRotulo,
  frescor,
  escala,
  notaEscala = "Os números vêm de fontes e períodos diferentes e não se somam nem se comparam entre si.",
  figuraEscala,
  consulta,
  paraVoce,
  destinos,
  secaoPropria,
  artefato,
  caminhos,
  recolhidos,
  convite,
  metodo,
  frescorMetodo,
  idTitulo = "entrada-titulo",
  idPrincipal = "conteudo",
  classe,
  principal = true,
}: Readonly<{
  tipo: TipoEntrada;
  /** Endereço público da página: o RotuloContexto lê o observatório e a coleção do registro por ele. */
  rota: string;
  acento: Dominio["acento"];
  /** H1: a pergunta da página. */
  titulo: ReactNode;
  /** Uma frase, até 220 caracteres. */
  frase: ReactNode;
  /** O que vai à direita do rótulo (a parceria técnica). */
  aoLadoDoRotulo?: ReactNode;
  /** FaixaFrescor variante linha, no alto da abertura. */
  frescor?: ReactNode;
  escala?: readonly NumeroPorta[];
  notaEscala?: string | null;
  /** Figura da escala (a gravura de abertura da Energia), depois dos números. */
  figuraEscala?: ReactNode;
  /** Aperitivo: a consulta do leitor, no lugar da escala. */
  consulta?: ReactNode;
  paraVoce?: ReactNode;
  destinos?: ReactNode;
  secaoPropria?: ReactNode;
  /** Um ModeloDidatico. */
  artefato?: ReactNode;
  caminhos?: readonly CaminhoEntrada[];
  recolhidos?: ReactNode;
  convite?: ReactNode;
  metodo: ReactNode;
  frescorMetodo?: ReactNode;
  idTitulo?: string;
  /** id do <main>, o alvo do link "Ir para o conteúdo" do layout da coleção. */
  idPrincipal?: string;
  /** Classe extra do <main>, para as variáveis de estilo da coleção (por exemplo, pv-root). */
  classe?: string;
  /** false quando o layout da coleção já abre o <main> (Agronegócio): a entrada vira um <div> dentro dele, com o mesmo data-entrada. */
  principal?: boolean;
}>) {
  const a = ACENTO[acento];
  return (
    <Raiz principal={principal} id={principal ? idPrincipal : undefined} className={classe ? `bg-papel ${classe}` : "bg-papel"} tipo={tipo}>
      <section aria-labelledby={idTitulo} className="border-b border-linha bg-marfim" data-fatia="abertura">
        {frescor}
        <div className="mx-auto max-w-page px-6 pb-12 pt-10 md:pb-14 md:pt-12">
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
            <RotuloContexto rota={rota} className="flex items-center gap-3 text-mineral" marca={<span aria-hidden="true" className={`h-[3px] w-8 shrink-0 ${a.filete}`} />} />
            {aoLadoDoRotulo}
          </div>
          <h1 id={idTitulo} className="mt-5 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.1] text-carvao [text-wrap:balance]">
            {titulo}
          </h1>
          <p className="mt-6 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">{frase}</p>
          {escala && escala.length > 0 && <Escala escala={escala} nota={notaEscala} />}
          {figuraEscala}
        </div>
      </section>

      {consulta && <div data-fatia="consulta">{consulta}</div>}
      {paraVoce && <div data-fatia="para-voce">{paraVoce}</div>}
      {destinos && <div data-fatia="destinos">{destinos}</div>}
      {secaoPropria && <div data-fatia="secao-propria">{secaoPropria}</div>}
      {artefato && <div data-fatia="artefato">{artefato}</div>}
      {caminhos && caminhos.length > 0 && <Caminhos caminhos={caminhos} hover={a.hover} />}
      {recolhidos && (
        <div data-fatia="recolhidos" className="mx-auto max-w-page px-6 pt-6">
          {recolhidos}
        </div>
      )}
      {convite && <div data-fatia="convite">{convite}</div>}

      <div className="mx-auto max-w-page px-6 pb-14 pt-6 md:pb-16">
        <details className="border-t border-linha pt-4" data-fatia="metodo">
          <summary className="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao">Método e fontes</summary>
          <div className="mt-2 max-w-prose2 space-y-3 text-sm leading-relaxed text-carvao-muted">{metodo}</div>
          {frescorMetodo && <div className="mt-6">{frescorMetodo}</div>}
        </details>
      </div>
    </Raiz>
  );
}

/** Fatia 2: de um a quatro números de escala, cada um com a sua prova e o painel de onde vem. */
export function Escala({ escala, nota }: Readonly<{ escala: readonly NumeroPorta[]; nota?: string | null }>) {
  return (
    <div data-fatia="escala">
      <h2 className="sr-only">O tema em números</h2>
      <dl className={`mt-10 grid gap-px border border-linha bg-linha sm:grid-cols-2 ${escala.length >= 4 ? "lg:grid-cols-4" : escala.length === 3 ? "lg:grid-cols-3" : ""}`}>
        {escala.map((n) => (
          <div key={n.rotulo} className="flex flex-col bg-papel p-5" data-numero-escala="">
            <dt className="text-sm leading-snug text-carvao-muted">{n.rotulo}</dt>
            <dd className="mt-2">
              <NumeroEscala n={n} grande />
            </dd>
            {n.nota && <dd className="mt-3 border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">{n.nota}</dd>}
            <dd className="mt-auto pt-3">
              <Link href={n.href} prefetch={false} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4">
                Ver no painel
              </Link>
            </dd>
          </div>
        ))}
      </dl>
      {nota && <p className="mt-3 text-xs leading-relaxed text-mineral">{nota}</p>}
    </div>
  );
}

/** Fatia 7: perguntas para começar, cada uma com a resposta curta e o número do destino, quando ele tem. */
function Caminhos({ caminhos, hover }: Readonly<{ caminhos: readonly CaminhoEntrada[]; hover: string }>) {
  const n = caminhos.length;
  return (
    <section aria-labelledby="caminhos-titulo" className="mx-auto max-w-page px-6 py-14 md:py-16" data-fatia="caminhos">
      <h2 id="caminhos-titulo" className={H2}>
        Perguntas para começar
      </h2>
      <ul className="mt-6 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-3">
        {caminhos.map((c, i) => (
          // o último item ocupa o que sobra da linha, em duas e em três colunas, para não deixar célula vazia
          <li
            key={c.href + c.pergunta}
            className={`bg-papel ${i === n - 1 ? `${n % 2 === 1 ? "sm:col-span-2" : ""} ${n % 3 === 2 ? "lg:col-span-2" : n % 3 === 1 ? "lg:col-span-3" : "lg:col-span-1"}` : ""}`}
          >
            <Link href={c.href} prefetch={false} className="group flex h-full min-h-[44px] flex-col p-5">
              {c.rotulo && <span className="rotulo text-mineral">{c.rotulo}</span>}
              <span className={`mt-2 font-serif text-lg leading-snug text-carvao ${hover}`}>{c.pergunta}</span>
              <span className="mt-1 text-sm leading-relaxed text-carvao-muted">{c.resumo}</span>
              {c.numero && (
                <span className="mt-3 block border-t border-linha pt-3">
                  <span className="block text-xs text-carvao-muted">{c.numero.rotulo}</span>
                  <NumeroEscala n={c.numero} />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Fatia 4 numa entrada de coleção: os destinos de primeiro nível, até oito à vista e o resto em "Mais destinos". */
export function DestinosColecao({
  itens,
  titulo = "Por onde seguir",
  descricao,
}: Readonly<{ itens: readonly DestinoEntrada[]; titulo?: string; descricao?: ReactNode }>) {
  const aVista = itens.slice(0, DESTINOS_A_VISTA);
  const resto = itens.slice(DESTINOS_A_VISTA);
  return (
    <section aria-labelledby="destinos-titulo" className="mx-auto max-w-page px-6 py-14 md:py-16">
      <h2 id="destinos-titulo" className={H2}>
        {titulo}
      </h2>
      {descricao && <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{descricao}</p>}
      <ul className="mt-6 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-4">
        {aVista.map((d) => (
          <CartaoDestino key={d.href + d.titulo} d={d} />
        ))}
      </ul>
      {resto.length > 0 && (
        <details className="group/mais mt-4">
          <summary className="flex min-h-[44px] cursor-pointer items-center text-sm text-carvao-muted hover:text-carvao">
            <span className="group-open/mais:hidden">Mais destinos ({resto.length})</span>
            <span className="hidden group-open/mais:inline">Menos destinos</span>
          </summary>
          <ul className="mt-2 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-4">
            {resto.map((d) => (
              <CartaoDestino key={d.href + d.titulo} d={d} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function CartaoDestino({ d }: Readonly<{ d: DestinoEntrada }>) {
  const corpo = (
    <>
      <span className="flex flex-wrap items-baseline gap-x-2 font-serif text-lg leading-snug text-carvao">
        {d.titulo}
        {d.prontidao && d.prontidao !== "publicado" && <SeloProntidao valor={d.prontidao} />}
      </span>
      {d.pergunta && <span className="mt-1 block text-sm leading-relaxed text-carvao-muted">{d.pergunta}</span>}
      {d.numero && (
        <span className="mt-3 block border-t border-linha pt-3">
          <span className="block text-xs text-carvao-muted">{d.numero.rotulo}</span>
          <NumeroEscala n={d.numero} />
        </span>
      )}
    </>
  );
  // destino em preparação nunca é link
  return (
    <li className="bg-papel">
      {d.prontidao === "preparacao" ? (
        <span className="flex h-full flex-col p-5">{corpo}</span>
      ) : (
        <Link href={d.href} prefetch={false} className="group flex h-full min-h-[44px] flex-col p-5 hover:bg-marfim">
          {corpo}
        </Link>
      )}
    </li>
  );
}
