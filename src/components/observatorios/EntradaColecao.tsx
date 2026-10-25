import Link from "@/components/i18n/LinkIdioma";
import type { ReactNode } from "react";
import { ACENTO } from "@/components/home/acentos";
import { RotuloContexto } from "@/components/layout/RotuloContexto";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { NumeroEscala } from "@/components/observatorios/NumeroEscala";
import { SeloProntidao, type Prontidao } from "@/components/observatorios/SeloProntidao";
import type { Dominio } from "@/lib/dominios";
import type { Idioma } from "@/lib/idioma";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

/**
 * Molde único das páginas de entrada (Iniciativa 4 do parecer de UX de 21/10/2026; skill observatorio-layout, §4 "Página de
 * entrada"). Todas as fatias saem do servidor, nesta ordem, cada uma marcada com `data-fatia` para o teste conferir:
 *
 *  1. `abertura`: RotuloContexto, H1 pergunta (até 60 caracteres) e uma frase (até 220). Opcionalmente, `seu-municipio` traz o extrato escolhido antes dos números (pedido Educação, 25/10/2026).
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

/** Texto fixo do molde nos dois idiomas: só o Setor Elétrico tem irmã inglesa (/en/setor-eletrico), que usa o mesmo componente. */
const t = (idioma: Idioma, pt: string, en: string) => (idioma === "en" ? en : pt);

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
  destaque,
  aoLadoDoRotulo,
  frescor,
  escala,
  notaEscala = "Os números vêm de fontes e períodos diferentes e não se somam nem se comparam entre si.",
  figuraEscala,
  consulta,
  paraVoce,
  seuMunicipio,
  destinos,
  secaoPropria,
  artefato,
  caminhos,
  caminhosAVista,
  recolhidos,
  convite,
  metodo,
  frescorMetodo,
  idTitulo = "entrada-titulo",
  idPrincipal = "conteudo",
  classe,
  principal = true,
  idioma = "pt",
  metodoLargo = false,
}: Readonly<{
  tipo: TipoEntrada;
  /** Endereço público da página: o RotuloContexto lê o observatório e a coleção do registro por ele. */
  rota: string;
  acento: Dominio["acento"];
  /** H1: a pergunta da página. */
  titulo: ReactNode;
  /** Uma frase, até 220 caracteres. */
  frase: ReactNode;
  /** Artefato prioritário, logo após o título da entrada. */
  destaque?: ReactNode;
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
  /** Extrato escolhido pelo leitor, antes da escala nacional (Educação, pedido de 25/10/2026). */
  seuMunicipio?: ReactNode;
  destinos?: ReactNode;
  secaoPropria?: ReactNode;
  /** Um ModeloDidatico. */
  artefato?: ReactNode;
  caminhos?: readonly CaminhoEntrada[];
  /** Quantas perguntas ficam à vista; o resto vai para "Mais perguntas", no HTML (sem o valor, todas à vista). */
  caminhosAVista?: number;
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
  /** Idioma dos textos fixos do molde; os links internos seguem o idioma da página (LinkIdioma). */
  idioma?: Idioma;
  /** Método sem a largura de leitura: quando ele traz grade ou tabela (fontes e atualidade do Setor Elétrico). */
  metodoLargo?: boolean;
}>) {
  const a = ACENTO[acento];
  return (
    <Raiz principal={principal} id={principal ? idPrincipal : undefined} className={classe ? `bg-papel ${classe}` : "bg-papel"} tipo={tipo}>
      <section aria-labelledby={idTitulo} className="border-b border-linha bg-marfim" data-fatia="abertura">
        {frescor}
        <div className="mx-auto max-w-page px-6 pb-10 pt-8 md:pb-12 md:pt-12">
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
            <RotuloContexto rota={rota} className="flex items-center gap-3 text-mineral" marca={<span aria-hidden="true" className={`h-[3px] w-8 shrink-0 ${a.filete}`} />} />
            {aoLadoDoRotulo}
          </div>
          <h1 id={idTitulo} className="mt-5 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.1] text-carvao [text-wrap:balance]">
            {titulo}
          </h1>
          {destaque}
          <p className="mt-6 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">{frase}</p>
          {seuMunicipio && <div data-fatia="seu-municipio">{seuMunicipio}</div>}
          {escala && escala.length > 0 && <Escala escala={escala} nota={notaEscala} idioma={idioma} />}
          {figuraEscala}
        </div>
      </section>

      {consulta && <div data-fatia="consulta">{consulta}</div>}
      {paraVoce && <div data-fatia="para-voce">{paraVoce}</div>}
      {destinos && <div data-fatia="destinos">{destinos}</div>}
      {secaoPropria && <div data-fatia="secao-propria">{secaoPropria}</div>}
      {artefato && <div data-fatia="artefato">{artefato}</div>}
      {caminhos && caminhos.length > 0 && <Caminhos caminhos={caminhos} hover={a.hover} idioma={idioma} aVista={caminhosAVista} />}
      {recolhidos && (
        <div data-fatia="recolhidos" className="mx-auto max-w-page px-6 pt-6">
          {recolhidos}
        </div>
      )}
      {convite && <div data-fatia="convite">{convite}</div>}

      <div className="mx-auto max-w-page px-6 pb-10 pt-6 md:pb-12">
        <details className="border-t border-linha pt-4" data-fatia="metodo">
          <summary className="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao">{t(idioma, "Método e fontes", "Method and sources")}</summary>
          <div className={`mt-2 space-y-3 text-sm leading-relaxed text-carvao-muted ${metodoLargo ? "" : "max-w-prose2"}`}>{metodo}</div>
          {frescorMetodo && <div className="mt-6">{frescorMetodo}</div>}
        </details>
      </div>
    </Raiz>
  );
}

/** Fatia 2: de um a quatro números de escala, cada um com a sua prova e o painel de onde vem. */
export function Escala({ escala, nota, idioma = "pt" }: Readonly<{ escala: readonly NumeroPorta[]; nota?: string | null; idioma?: Idioma }>) {
  return (
    <div data-fatia="escala">
      <h2 className="sr-only">{t(idioma, "O tema em números", "The topic in numbers")}</h2>
      <dl className={`mt-6 grid md:mt-10 gap-px border border-linha bg-linha sm:grid-cols-2 ${escala.length >= 4 ? "lg:grid-cols-4" : escala.length === 3 ? "lg:grid-cols-3" : ""}`}>
        {escala.map((n) => (
          <div key={n.rotulo} className="flex flex-col bg-papel p-4 sm:p-5" data-numero-escala="">
            <dt className="text-sm leading-snug text-carvao-muted">{n.rotulo}</dt>
            <dd className="mt-2">
              <NumeroEscala n={n} grande idioma={idioma} />
            </dd>
            {n.nota && <dd className="mt-3 border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">{n.nota}</dd>}
            <dd className="mt-auto pt-1 sm:pt-3">
              <Link href={n.href} prefetch={false} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4">
                {t(idioma, "Ver no painel", "See in the panel")}
                <SeloComConta href={n.href} idioma={idioma} />
              </Link>
            </dd>
          </div>
        ))}
      </dl>
      {nota && <p className="mt-3 text-xs leading-relaxed text-mineral">{nota}</p>}
    </div>
  );
}

/** Fatia 7: perguntas para começar, cada uma com a resposta curta e o número do destino, quando ele tem. Com `aVista`, as primeiras
 *  ficam à vista e o resto em "Mais perguntas", no HTML. */
function Caminhos({ caminhos, hover, idioma, aVista }: Readonly<{ caminhos: readonly CaminhoEntrada[]; hover: string; idioma: Idioma; aVista?: number }>) {
  const corte = aVista && aVista < caminhos.length ? aVista : caminhos.length;
  const resto = caminhos.slice(corte);
  return (
    <section aria-labelledby="caminhos-titulo" className="mx-auto max-w-page px-6 py-10 md:py-12" data-fatia="caminhos">
      <h2 id="caminhos-titulo" className={H2}>
        {t(idioma, "Perguntas para começar", "Questions to start with")}
      </h2>
      <GradeCaminhos caminhos={caminhos.slice(0, corte)} hover={hover} idioma={idioma} classe="mt-6" />
      {resto.length > 0 && (
        <details className="group/mais mt-4">
          <summary className="flex min-h-[44px] cursor-pointer items-center text-sm text-carvao-muted hover:text-carvao">
            <span className="group-open/mais:hidden">
              {t(idioma, "Mais perguntas", "More questions")} ({resto.length})
            </span>
            <span className="hidden group-open/mais:inline">{t(idioma, "Menos perguntas", "Fewer questions")}</span>
          </summary>
          <GradeCaminhos caminhos={resto} hover={hover} idioma={idioma} classe="mt-2" />
        </details>
      )}
    </section>
  );
}

function GradeCaminhos({ caminhos, hover, idioma, classe }: Readonly<{ caminhos: readonly CaminhoEntrada[]; hover: string; idioma: Idioma; classe: string }>) {
  const n = caminhos.length;
  const quatro = n === 4 || n === 8;
  return (
    <>
      {/* quatro ou oito perguntas fecham linhas de quatro no desktop; as demais quantidades, linhas de três */}
      <ul className={`${classe} grid gap-px border border-linha bg-linha sm:grid-cols-2 ${quatro ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {caminhos.map((c, i) => (
          // o último item ocupa o que sobra da linha, em duas e em três colunas, para não deixar célula vazia
          <li
            key={c.href + c.pergunta}
            className={`bg-papel ${i === n - 1 && !quatro ? `${n % 2 === 1 ? "sm:col-span-2" : ""} ${n % 3 === 2 ? "lg:col-span-2" : n % 3 === 1 ? "lg:col-span-3" : "lg:col-span-1"}` : ""}`}
          >
            <Link href={c.href} prefetch={false} className="group flex h-full min-h-[44px] flex-col p-4 sm:p-5">
              {c.rotulo && <span className="rotulo text-mineral">{c.rotulo}</span>}
              <span className={`mt-2 font-serif text-lg leading-snug text-carvao ${hover}`}>
                {c.pergunta}
                <SeloComConta href={c.href} idioma={idioma} className="font-sans" />
              </span>
              <span className="mt-1 text-sm leading-relaxed text-carvao-muted">{c.resumo}</span>
              {c.numero && (
                <span className="mt-3 block border-t border-linha pt-3">
                  <span className="block text-xs text-carvao-muted">{c.numero.rotulo}</span>
                  <NumeroEscala n={c.numero} idioma={idioma} />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Fatia 4 numa entrada de coleção: os destinos de primeiro nível, até oito à vista e o resto em "Mais destinos". `extra` vai entre o
 * título e a grade (a busca da coleção). `mais` troca a lista do resto por um conteúdo próprio da coleção, dentro do mesmo <details>
 * (o índice completo do Setor Elétrico, com o detalhe de cada página), com `n` destinos no rótulo.
 */
export function DestinosColecao({
  itens,
  titulo,
  descricao,
  extra,
  mais,
  id,
  idioma = "pt",
}: Readonly<{
  itens: readonly DestinoEntrada[];
  titulo?: string;
  descricao?: ReactNode;
  extra?: ReactNode;
  mais?: { n: number; rotulo?: string; conteudo: ReactNode };
  /** id da seção, quando a coleção já tem uma âncora para os destinos. */
  id?: string;
  idioma?: Idioma;
}>) {
  const aVista = itens.slice(0, DESTINOS_A_VISTA);
  const resto = itens.slice(DESTINOS_A_VISTA);
  const nMais = mais ? mais.n : resto.length;
  return (
    <section id={id} aria-labelledby="destinos-titulo" className="mx-auto max-w-page scroll-mt-24 px-6 py-10 md:py-12">
      <h2 id="destinos-titulo" className={H2}>
        {titulo ?? t(idioma, "Por onde seguir", "Where to go next")}
      </h2>
      {descricao && <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{descricao}</p>}
      {extra}
      <ul className="mt-6 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-4">
        {aVista.map((d, i) => (
          <CartaoDestino key={d.href + d.titulo} d={d} classe={i === aVista.length - 1 ? fechaLinha(aVista.length) : ""} idioma={idioma} />
        ))}
      </ul>
      {nMais > 0 && (
        <details className="group/mais mt-4">
          <summary className="flex min-h-[44px] cursor-pointer items-center text-sm text-carvao-muted hover:text-carvao">
            <span className="group-open/mais:hidden">
              {mais?.rotulo ?? t(idioma, "Mais destinos", "More destinations")} ({nMais})
            </span>
            <span className="hidden group-open/mais:inline">{t(idioma, "Menos destinos", "Fewer destinations")}</span>
          </summary>
          {mais ? (
            <div className="mt-2">{mais.conteudo}</div>
          ) : (
            <ul className="mt-2 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-4">
              {resto.map((d, i) => (
                <CartaoDestino key={d.href + d.titulo} d={d} classe={i === resto.length - 1 ? fechaLinha(resto.length) : ""} idioma={idioma} />
              ))}
            </ul>
          )}
        </details>
      )}
    </section>
  );
}

/** O último cartão ocupa o que sobra da linha, em duas e em quatro colunas, para a grade não deixar célula vazia. */
function fechaLinha(n: number): string {
  const sm = n % 2 === 1 ? "sm:col-span-2" : "";
  const lg = ["lg:col-span-1", "lg:col-span-4", "lg:col-span-3", "lg:col-span-2"][n % 4];
  return `${sm} ${lg}`;
}

function CartaoDestino({ d, classe = "", idioma }: Readonly<{ d: DestinoEntrada; classe?: string; idioma: Idioma }>) {
  const corpo = (
    <>
      <span className="flex flex-wrap items-baseline gap-x-2 font-serif text-lg leading-snug text-carvao">
        {d.titulo}
        {d.prontidao !== "preparacao" && <SeloComConta href={d.href} idioma={idioma} className="font-sans" />}
        {d.prontidao && d.prontidao !== "publicado" && <SeloProntidao valor={d.prontidao} />}
      </span>
      {d.pergunta && <span className="mt-1 block text-sm leading-relaxed text-carvao-muted">{d.pergunta}</span>}
      {d.numero && (
        <span className="mt-3 block border-t border-linha pt-3">
          <span className="block text-xs text-carvao-muted">{d.numero.rotulo}</span>
          <NumeroEscala n={d.numero} idioma={idioma} />
        </span>
      )}
    </>
  );
  // destino em preparação nunca é link
  return (
    <li className={`bg-papel ${classe}`}>
      {d.prontidao === "preparacao" ? (
        <span className="flex h-full flex-col p-4 sm:p-5">{corpo}</span>
      ) : (
        <Link href={d.href} prefetch={false} className="group flex h-full min-h-[44px] flex-col p-4 hover:bg-marfim sm:p-5">
          {corpo}
        </Link>
      )}
    </li>
  );
}
