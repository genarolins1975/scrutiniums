import { DuasCamadasEnergia } from "@/components/energia/ComercializacaoDidatica";
import { LeiturasIntegradas } from "@/components/energia/LeiturasIntegradas";
import Image from "next/image";
import { PercursoVisualEnergia } from "@/components/energia/PercursoVisualEnergia";
import { ETAPAS_ENERGIA_IDIOMAS } from "@/lib/energia/percurso-visual";
import { PerguntasExploraveis, LaboratorioEnergia } from "@/components/energia/ExploracaoInicial";
import "./atlas-inicial.css";
import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/energia/LinkSemPrefetch";
import type { ReactNode } from "react";
import { BuscaObservatorio } from "@/components/energia/BuscaObservatorio";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { DetalheDoNivel } from "@/components/energia/DetalheDoNivel";
import { LinkPorDistribuidora, SuaDistribuidora } from "@/components/energia/EscolhaDistribuidora";
import { LegendaDeSiglas } from "@/components/energia/LegendaSiglas";
import { MapaConceitual } from "@/components/energia/MapaConceitual";
import { RedirecionaAncoraAntiga } from "@/components/energia/RedirecionaAncoraAntiga";
import { NATUREZAS, SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { conjuntoLegivel, descreverVariacao, valorDestaque } from "@/lib/energia/evidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { ParaVoce } from "@/components/observatorios/ParaVoce";
import { ArteFoto, ArtePrancha } from "@/components/observatorios/ArteParaVoce";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { LINKEDIN_URL } from "@/lib/contato";
import { conceito, conceitos } from "@/lib/energia/conteudo/conceitos";
import { DATASETS_INTEGRADOS } from "@/lib/energia/datasets";
import { dataBR, carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  escolhasDeDistribuidora,
  estadoDoDestino,
  indiceBusca,
  linhasAtualidade,
  nomeDoPeriodoEmCurso,
  periodoLegivel,
  refinosDePeriodo,
  regraDeAtualidade,
  resumoAtualidade,
  type LinhaAtualidade,
  type PublicacaoAtualidade,
} from "@/lib/energia/home";
import {
  denominadorDePerdas,
  descreverDenominador,
  evidenciaComDenominadorNomeado,
  sinaisDaInicial,
  sinaisDeInclusao,
  universoPerdas,
  type FiguraReferencia,
  type SinalAusente,
  type SinalDisponivel,
  type SinalHome,
} from "@/lib/energia/home-sinais";
import {
  ANCORAS_VISAO_GERAL,
  CAMINHOS_INTENCAO,
  CARTOES,
  FAIXAS_MAPA,
  LIGACOES,
  NOS_MAPA,
  O_QUE_O_MAPA_NAO_DIZ,
  ORDEM_FAIXAS,
  PERGUNTAS_COTIDIANAS,
  PERGUNTAS_DE_INCLUSAO,
  PERGUNTAS_PRIORITARIAS,
  ROTULOS_FAIXA,
  TIPOS_LIGACAO,
  TRANSVERSAIS,
  TRILHAS,
  type NoMapa,
  type PerguntaPrioritaria,
} from "@/lib/energia/mapa";
import { metrica } from "@/lib/energia/metricas";
import { DESTINOS_NAVEGACAO, GRUPOS_NAVEGACAO, destino, listaPorExtenso, type DestinoNavegacao } from "@/lib/energia/navegacao";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import type { QualidadeGold } from "@/lib/energia/tipos-qualidade";
import type { Natureza } from "@/lib/energia/tipos";
import { listaEmPortugues, orgaosDasFontes } from "@/lib/energia/dados";
import { SIGLAS, legendaDeSiglas } from "@/lib/energia/siglas";
import { publicacaoDados } from "@/lib/energia/dados-servidor";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { ORGAOS_EN, comNomesProprios, legendaDeOrgaosEn, listaEn, traduzDaGold, traduzModeloDaGold } from "@/lib/energia/i18n/entrada-visao";
import { RotuloContexto } from "@/components/layout/RotuloContexto";

export const dynamic = "force-static";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico", {
    title: { absolute: tx("Setor Elétrico · Scrutiniums", "Setor Elétrico, Brazil's power sector · Scrutiniums") },
    description: tx(
      "Entenda a energia que move o Brasil: como água, geração, rede, consumo, preço, contratos e tarifa se ligam, a pergunta que cada página responde, trilhas por interesse, como conferir cada número e a data de cada fonte.",
      "Understand the energy that powers Brazil: how water, generation, the grid, consumption, prices, contracts and tariffs connect, the question each page answers, learning paths by interest, how to check every number and the date of each source.",
    ),
    alternates: { canonical: "/setor-eletrico" },
  }, anterior);
}

const ORDEM_NATUREZAS: Natureza[] = ["OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO"];

const link = "inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";
const linkTexto = "text-energia-dark underline underline-offset-4 hover:text-carvao";

/** Nomes e réguas que parecem iguais e não são; cada item usa só o que está conferido nos verbetes e nas unidades. */
function nomesEReguas(): [string, ReactNode][] {
  return [
    [
      tx("PLD e tarifa", "PLD and tariff"),
      tx(
        <>
          O <Termo slug="pld">PLD</Termo> é o preço das diferenças liquidadas no mercado de curto prazo. A conta de quem é atendido pela distribuidora segue a{" "}
          <Termo slug="tarifa-te-tusd">TE e a TUSD</Termo>, homologadas pela ANEEL.
        </>,
        <>
          The <Termo slug="pld">PLD</Termo> is the price of the differences settled in the short-term market. The bill of a consumer served by a distribution utility follows the{" "}
          <Termo slug="tarifa-te-tusd">TE and TUSD</Termo> (energy tariff and distribution system use tariff), approved by ANEEL.
        </>,
      ),
    ],
    [
      tx("CMO e PLD", "CMO and PLD"),
      tx(
        <>
          O <Termo slug="cmo">CMO</Termo> é o custo marginal publicado pelo ONS; o PLD é calculado pela CCEE com base no CMO, dentro de limites. Não são o mesmo número.
        </>,
        <>
          The <Termo slug="cmo">CMO</Termo> (marginal operating cost) is published by ONS; the PLD is calculated by CCEE based on the CMO, within limits. They are not the same number.
        </>,
      ),
    ],
    [
      tx("Subsistema e submercado", "Subsystem and submarket"),
      tx(
        <>
          O ONS publica por subsistema; a CCEE calcula o PLD por <Termo slug="submercado">submercado</Termo>. Os conjuntos usados aqui identificam as regiões pelos mesmos códigos (N, NE, S e SE).
        </>,
        <>
          ONS publishes by subsystem; CCEE calculates the PLD by <Termo slug="submercado">submarket</Termo>. The datasets used here identify the regions by the same codes (N, NE, S and SE).
        </>,
      ),
    ],
    [
      tx("% da EAR máxima e % da MLT", "% of maximum EAR and % of MLT"),
      tx(
        <>
          A <Termo slug="ear">EAR</Termo> aparece em percentual da capacidade de armazenamento; a <Termo slug="ena">ENA</Termo>, em percentual da média de longo termo. As réguas são diferentes e os
          percentuais não se comparam entre si.
        </>,
        <>
          Stored energy (<Termo slug="ear">EAR</Termo>) appears as a percentage of storage capacity; natural inflow energy (<Termo slug="ena">ENA</Termo>), as a percentage of the long-term average (MLT).
          The yardsticks are different and the percentages cannot be compared with each other.
        </>,
      ),
    ],
    [
      tx("MWmed, MWh e MW", "MWavg, MWh and MW"),
      tx(
        <>
          <Unidade u="MWmed" /> é energia de um período dividida pelas horas do período; MWh é energia; MW é potência, a capacidade num instante. Capacidade instalada não é energia gerada.
        </>,
        <>
          <Unidade u="MWmed" /> (average megawatts) is the energy of a period divided by the hours in the period; MWh is energy; MW is power, the capacity at an instant. Installed capacity is not
          energy generated.
        </>,
      ),
    ],
  ];
}

/* ------------------------------------------------------------------ peças da página */

/** Seção da página: linha fina em cima, título em serifa e o conteúdo. O id é a âncora que outras páginas usam. */
function Secao({ id, titulo, subtitulo, children }: { id: string; titulo: string; subtitulo?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-linha py-8 md:py-10">
      <h2 id={`${id}-h`} className="ed-h2 max-w-3xl font-serif text-carvao">
        {titulo}
      </h2>
      {subtitulo && <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{subtitulo}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * Bloco recolhível (<details> nativo): o título e uma linha de dica ficam à vista, e o texto inteiro fica no HTML do servidor, aberto por
 * clique, toque ou teclado. Sem JavaScript funciona do mesmo jeito.
 */
function Recolhivel({ id, titulo, tituloEn, dica, children }: { id?: string; titulo: string; tituloEn?: string; dica?: string; children: ReactNode }) {
  // o título em português fica no atributo, onde as regras do texto o procuram; a página inglesa usa tituloEn
  if (tituloEn) titulo = tx(titulo, tituloEn);
  return (
    <details id={id} className="group scroll-mt-24 border-b border-linha">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-serif text-lg leading-snug text-carvao">{titulo}</span>
          {dica && <span className="block text-xs leading-snug text-carvao-muted">{dica}</span>}
        </span>
        <span aria-hidden="true" className="shrink-0 text-xs text-carvao-muted motion-safe:transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="space-y-3 pb-4 pt-1 text-sm leading-relaxed text-carvao-muted">{children}</div>
    </details>
  );
}

const porId = new Map(NOS_MAPA.map((n) => [n.id, n]));

/** Nome do verbete quando o chip mostra só a sigla ou uma forma curta; null quando o chip já é o nome. */
function nomeDoConceito(slug: string, rotulo: string): string | null {
  const c = conceito(slug);
  if (!c || c.nome.toLowerCase() === rotulo.toLowerCase()) return null;
  return c.nome;
}


/** Nome do conjunto da fonte sem sigla solta: "SAMP Balanço" vira "balanço do Sistema de Acompanhamento de Informações de Mercado para Regulação Econômica (SAMP)". */
function conjuntoPorExtenso(conjunto: string): string {
  const texto = conjuntoLegivel(conjunto).texto;
  const m = /^SAMP\s+(.+)$/.exec(texto);
  if (!m) return texto;
  return `${m[1].charAt(0).toLowerCase()}${m[1].slice(1)} do ${SIGLAS.SAMP.split(",")[0]} (SAMP)`;
}

/** "Concessionárias de distribuição (Brasil)" dentro de uma frase, sem parênteses dentro de parênteses: "concessionárias de distribuição do Brasil". */
function entidadeEmFrase(e: string): string {
  const m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(e.trim());
  const base = (m ? m[1] : e).trim();
  const minuscula = /^[A-ZÀ-Þ][a-zß-ÿ]/.test(base) ? base.charAt(0).toLowerCase() + base.slice(1) : base;
  if (!m) return minuscula;
  return m[2].toLowerCase() === "brasil" ? `${minuscula} do Brasil` : `${minuscula} (${m[2]})`;
}

/** Os cinco tipos de ligação do mapa, em uma frase: o nome de cada um e o que ele quer dizer. */
function TiposDeLigacao() {
  const ids = Object.keys(TIPOS_LIGACAO) as (keyof typeof TIPOS_LIGACAO)[];
  return (
    <>
      {ids.map((t, i) => (
        <span key={t}>
          <strong className="font-medium text-carvao">{TIPOS_LIGACAO[t].rotulo.toLowerCase()}</strong> ({TIPOS_LIGACAO[t].definicao.replace(/\.$/, "")}){i < ids.length - 1 ? "; " : "."}
        </span>
      ))}
    </>
  );
}

/**
 * Conteúdo de um elo do mapa: explicação, onde explorar, conceitos e ligações com o tipo de cada uma. O painel do desenho (desktop) mostra tudo
 * do elo escolhido, com as ligações que saem e as que chegam. No celular (`celular`), o elo é um bloco do mapa vertical e este conteúdo abre
 * ao toque; cada ligação aparece uma vez, no elo de onde ela parte (o tipo e o destino de todas ficam à vista no próprio mapa vertical).
 */
function DetalheNo({ no, celular = false }: { no: NoMapa; celular?: boolean }) {
  const saem = LIGACOES.filter((l) => l.de === no.id);
  const chegam = celular ? [] : LIGACOES.filter((l) => l.para === no.id);
  const destinos = no.destinos.map((s) => destino(s));
  const conceitos = no.conceitos.map((c) => (
    <span key={c.slug} className="text-carvao">
      <Termo slug={c.slug} alvo={!celular}>
        {c.rotulo}
      </Termo>
      {nomeDoConceito(c.slug, c.rotulo) && <span className="ml-1 text-carvao-muted">({nomeDoConceito(c.slug, c.rotulo)})</span>}
    </span>
  ));
  const ligacoes = (saem.length > 0 || chegam.length > 0) && (
    <div>
      <p className="rotulo text-mineral">{tx("Ligações", "Connections")}</p>
      <ul className={celular ? "mt-1 space-y-1.5" : "space-y-2"}>
        {saem.map((l) => (
          <li key={`s-${l.para}`}>
            <span className="text-carvao">
              {tx("Para", "To")} {porId.get(l.para)!.titulo.toLowerCase()} · {TIPOS_LIGACAO[l.tipo].rotulo.toLowerCase()}:
            </span>{" "}
            {l.texto}
          </li>
        ))}
        {chegam.map((l) => (
          <li key={`c-${l.de}`}>
            <span className="text-carvao">
              {tx("De", "From")} {porId.get(l.de)!.titulo.toLowerCase()} · {TIPOS_LIGACAO[l.tipo].rotulo.toLowerCase()}:
            </span>{" "}
            {l.texto}
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <>
      <p>{no.explicacao}</p>
      <div>
        <p className="rotulo text-mineral">{tx("Onde explorar", "Where to explore")}</p>
        <ul className="flex flex-wrap gap-x-4">
          {destinos.map((d) => (
            <li key={d.slug}>
              <Link href={d.href} className={celular ? `${linkTexto} inline-flex min-h-[44px] items-center` : link}>
                {d.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="rotulo text-mineral">{tx("Conceitos", "Concepts")}</p>
        <ul className="flex flex-wrap gap-x-3">
          {conceitos.map((c, i) => (
            <li key={no.conceitos[i].slug}>{c}</li>
          ))}
        </ul>
      </div>
      {ligacoes}
    </>
  );
}

/**
 * O mapa no celular, na vertical: as quatro faixas na ordem do desenho, os sete elos numerados (o título e a frase de cada um à vista), a seta
 * com o tipo da ligação entre os elos seguidos da mesma faixa e, sob cada elo, as ligações que saem dele para outros lugares, com o tipo. Ao
 * toque, o elo abre a explicação, onde explorar, os conceitos e a frase de cada ligação. Tudo vem de NOS_MAPA e LIGACOES: é o mesmo grafo do
 * desenho do desktop, lido de cima para baixo.
 */
function MapaVertical() {
  const numero = new Map(NOS_MAPA.map((n, i) => [n.id, i + 1]));
  return (
    <ol className="space-y-5" data-mapa-vertical="">
      {ORDEM_FAIXAS.map((f) => {
        const nos = NOS_MAPA.filter((n) => n.faixa === f);
        return (
          <li key={f} aria-labelledby={`mapa-faixa-${f}`}>
            <h3 id={`mapa-faixa-${f}`} className="rotulo text-mineral">
              {FAIXAS_MAPA[f].rotulo}
            </h3>
            <p className="mt-1 text-xs leading-snug text-carvao-muted">{FAIXAS_MAPA[f].resumo}</p>
            <ol className="mt-2">
              {nos.map((n, i) => {
                const proximo = nos[i + 1];
                const seguinte = proximo ? LIGACOES.find((l) => l.de === n.id && l.para === proximo.id) : undefined;
                // as ligações que saem do elo e não são a seta para o elo de baixo
                const outras = LIGACOES.filter((l) => l.de === n.id && l !== seguinte);
                return (
                  <li key={n.id}>
                    <details id={`mapa-elo-${n.id}`} className="group scroll-mt-24 border border-linha bg-superficie">
                      <summary className="flex min-h-[44px] cursor-pointer list-none items-start gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
                        <span className="tabular-nums leading-snug text-mineral">{numero.get(n.id)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-serif text-base leading-snug text-carvao">{n.titulo}</span>
                          <span className="block text-xs leading-snug text-carvao-muted">{n.curto}</span>
                        </span>
                        <span aria-hidden="true" className="shrink-0 pt-1 text-xs text-carvao-muted motion-safe:transition-transform group-open:rotate-180">
                          ▾
                        </span>
                      </summary>
                      <div className="space-y-3 border-t border-linha px-3 pb-3 pt-2 text-sm leading-relaxed text-carvao-muted">
                        <DetalheNo no={n} celular />
                      </div>
                    </details>
                    {outras.length > 0 && (
                      <p className="mt-1 pl-3 text-xs leading-snug text-carvao-muted">
                        {tx("Liga-se a", "Connects to")}{" "}
                        {outras.map((l, k) => (
                          <span key={l.para}>
                            {k > 0 && "; "}
                            {numero.get(l.para)}, {porId.get(l.para)!.titulo.toLowerCase()} ({TIPOS_LIGACAO[l.tipo].rotulo.toLowerCase()})
                          </span>
                        ))}
                        .
                      </p>
                    )}
                    {proximo && seguinte && (
                      <p className="py-1 pl-3 text-xs text-carvao-muted">
                        <span aria-hidden="true">↓</span> {TIPOS_LIGACAO[seguinte.tipo].rotulo.toLowerCase()}
                        <span className="sr-only">{tx(" para ", " to ")}{proximo.titulo.toLowerCase()}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}

type CartaoDaPagina = NonNullable<(typeof CARTOES)[string]>;

/**
 * O detalhe de uma página dentro do próprio item do índice, num botão de 44 px à direita do item: para que serve, o que se encontra (com o
 * link de cada painel), o recorte e o conceito principal. É o que antes ficava numa segunda lista de todas as páginas, "Detalhe de cada
 * página": o índice é um só, e o detalhe abre no lugar. O texto fica no HTML do servidor, aberto por clique, toque ou teclado.
 */
function DetalhesDoDestino({ d, c }: { d: DestinoNavegacao; c: CartaoDaPagina }) {
  return (
    <details className="group/d" data-detalhe-do-destino={d.slug}>
      <summary
        aria-label={tx(`Para que serve e o que se encontra em ${d.rotulo}`, `What ${d.rotulo} is for and what you will find there`)}
        className="absolute right-0 top-1 flex h-11 w-11 cursor-pointer list-none items-center justify-center text-xs text-carvao-muted hover:text-carvao [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true" className="motion-safe:transition-transform group-open/d:rotate-180">
          ▾
        </span>
      </summary>
      <div className="space-y-2 pb-3 pr-2 text-sm leading-relaxed text-carvao-muted">
        <p>
          <span className="text-carvao">{tx("Para que serve:", "What it is for:")}</span> {c.utilidade}
        </p>
        {d.integrado ? (
          <div>
            <p className="rotulo text-mineral">{tx("O que você encontra", "What you will find")}</p>
            <ul>
              {c.encontra.map((e) => (
                <li key={e.texto}>
                  <Link href={e.href} className={link}>
                    {e.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>
            <span className="rotulo mr-1 text-mineral">{tx("Em integração", "Being integrated")}</span>{" "}
            {tx("A página mostra o escopo, as perguntas e as fontes catalogadas, ainda sem números publicados.", "The page shows the scope, the questions and the cataloged sources, with no published numbers yet.")}
          </p>
        )}
        <p className="text-xs text-mineral">
          {tx("Recorte:", "Scope:")} {c.recorte}
        </p>
        {c.conceito && (
          <p className="text-carvao [&_a]:min-h-[44px]">
            <Termo slug={c.conceito.slug} alvo>
              {c.conceito.rotulo}
            </Termo>
          </p>
        )}
      </div>
    </details>
  );
}

/** Item do índice: o nome da página, a pergunta que ela responde, o estado (quando não publica números) e o botão com o detalhe dela. */
function ItemDoIndice({ d }: { d: DestinoNavegacao }) {
  const estado = estadoDoDestino(d);
  const c = CARTOES[d.slug];
  const corpo = (
    <>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className={estado === "preparacao" ? "text-base text-carvao" : "text-base text-energia-dark underline underline-offset-4 group-hover:text-carvao"}>{d.rotulo}</span>
        {estado === "integracao" && (
          <span className="rotulo text-mineral">
            {tx("Em integração", "Being integrated")}
            <span className="sr-only">{tx(": a página mostra o escopo e as fontes catalogadas, sem números publicados", ": the page shows the scope and the cataloged sources, with no published numbers")}</span>
          </span>
        )}
        {estado === "preparacao" && (
          <span className="rotulo text-mineral">
            {tx("Em preparação", "In preparation")}
            <span className="sr-only">{tx(": ainda sem página", ": no page yet")}</span>
          </span>
        )}
      </span>
      <span className="mt-0.5 block text-sm leading-snug text-carvao-muted">{d.pergunta}</span>
      {c && d.integrado && <span className="mt-2 block text-xs leading-relaxed text-mineral">{c.recorte}</span>}
    </>
  );
  if (estado === "preparacao") return <div className="py-2">{corpo}</div>;
  return (
    <div className="relative">
      <Link href={d.href} className={`group block min-h-[44px] py-2 ${c && d.publicado ? "pr-12" : ""}`}>
        {corpo}
      </Link>
      {c && d.publicado && <DetalhesDoDestino d={d} c={c} />}
    </div>
  );
}

/** Leitura de uma variação com glifo e palavra (a cor nunca é o único sinal), no estilo da faixa de métricas. */
function Variacao({ v }: { v: NonNullable<SinalDisponivel["variacao"]> }) {
  const d = descreverVariacao(v);
  return (
    <p className="col-span-2 mt-1 text-xs tabular-nums text-carvao-muted sm:col-auto sm:row-start-4 sm:mt-1.5">
      <span aria-hidden="true">
        {d.glifo && <span className="mr-1">{d.glifo}</span>}
        {d.texto} {v.referencia}
      </span>
      <span className="sr-only">{d.leitura}</span>
    </p>
  );
}

/**
 * A situação de uma fonte com forma própria: a cor nunca é o único sinal, e nenhuma forma aprova ou reprova. Círculo cheio para "em dia",
 * losango com moldura para "atrasada" (a única que pede atenção do leitor) e círculo vazio para a fonte sem calendário declarado ou sem avaliação.
 */
function Situacao({ l }: { l: LinhaAtualidade }) {
  const texto = l.situacao ?? tx("sem avaliação", "not assessed");
  if (l.atrasado) {
    return (
      <span className="inline-flex items-center gap-1.5 border border-carvao px-1.5 py-0.5 font-medium text-carvao">
        <span aria-hidden="true">◆</span>
        {texto}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true">{l.codigoSituacao === "EM DIA" ? "●" : "○"}</span>
      {texto}
    </span>
  );
}

/** O que a situação comparou com o calendário da fonte, em palavras; null quando a publicação não diz. */
function baseDaSituacao(l: LinhaAtualidade): string | null {
  if (l.base === "publicacao") return tx(`pela publicação do arquivo${l.publicadoEm ? `, em ${l.publicadoEm}` : ""}`, `by the publication of the file${l.publicadoEm ? `, on ${l.publicadoEm}` : ""}`);
  if (l.base === "periodo") return tx("pelo último período", "by the latest period");
  return null;
}

/** Ficha "Comprove este número" no tamanho da faixa de métricas: texto de 12 px sem caixa alta, 32 px de altura (44 px no toque). */
const COMPROVE_COMPACTO =
  "[&_[data-comprove]]:min-h-[2rem] [&_[data-comprove]]:text-xs [&_[data-comprove]]:normal-case [&_[data-comprove]]:tracking-normal [@media(pointer:coarse)]:[&_[data-comprove]]:min-h-[2.75rem]";

/**
 * A figura de referência de um número: a faixa observada (linha fina entre dois traços), a metade central (caixa), a mediana (traço) e o valor do
 * cartão (losango), com a legenda dos números embaixo. É uma ilustração de posição, sem juízo de valor: a escala vai do menor ao maior dos pontos
 * desenhados, com uma folga nas pontas. O desenho é invisível para o leitor de tela (aria-hidden); a legenda diz tudo com palavras.
 */
function FaixaDeReferencia({ f }: { f: FiguraReferencia }) {
  const pontos = [f.extremos[0], f.extremos[1], f.valor, ...(f.marca ? [f.marca.valor] : [])];
  const menor = Math.min(...pontos);
  const maior = Math.max(...pontos);
  const folga = (maior - menor) * 0.05 || 1;
  const a = menor - folga;
  const b = maior + folga;
  const x = (v: number) => `${((100 * (v - a)) / (b - a)).toFixed(2)}%`;
  const largura = (de: number, ate: number) => `${((100 * (ate - de)) / (b - a)).toFixed(2)}%`;
  return (
    <figure data-faixa="" className="m-0">
      <div aria-hidden="true" className="relative h-6">
        <span className="absolute top-1/2 border-t-2 border-mineral" style={{ left: x(f.extremos[0]), width: largura(f.extremos[0], f.extremos[1]) }} />
        <span className="absolute top-1/2 h-3 -translate-y-1/2 border-l-2 border-mineral" style={{ left: x(f.extremos[0]) }} />
        <span className="absolute top-1/2 h-3 -translate-y-1/2 border-l-2 border-mineral" style={{ left: x(f.extremos[1]) }} />
        {f.caixa && <span className="absolute top-1/2 h-3.5 -translate-y-1/2 border-2 border-mineral bg-energia-fundo" style={{ left: x(f.caixa[0]), width: largura(f.caixa[0], f.caixa[1]) }} />}
        {f.mediana !== undefined && <span className="absolute top-1/2 h-5 -translate-y-1/2 border-l-2 border-carvao" style={{ left: x(f.mediana) }} />}
        {f.marca && <span className="absolute top-0 h-6 border-l-2 border-dashed border-carvao" style={{ left: x(f.marca.valor) }} />}
        <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-energia-dark bg-energia-dark" style={{ left: x(f.valor) }} />
      </div>
      <figcaption className="mt-1 text-xs leading-snug text-carvao-muted">{f.legenda}</figcaption>
    </figure>
  );
}

/**
 * A medida de abertura de uma pergunta: o que se mede, o valor, o período, o selo de natureza, a ficha de prova, a variação, a figura de
 * referência, as referências, o universo e a ressalva. No celular a medida é uma linha de lista (rótulo e contexto à esquerda, valor e unidade à
 * direita), como na faixa de métricas das aberturas; a partir de 640 px o valor vem abaixo do rótulo. O cartão que a contém é um subgrid da
 * grade das perguntas: cada linha (título, para que serve, rótulo, valor, período, variação, figura, texto, ação) tem a mesma altura nos cartões
 * lado a lado, e o número fica alinhado entre as colunas mesmo quando o título ocupa uma ou duas linhas.
 */
function MedidaDisponivel({ s }: { s: SinalDisponivel }) {
  return (
    <>
      <div
        role="group"
        aria-label={s.medida}
        data-medida={s.id}
        className={`mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 sm:row-span-4 sm:row-start-3 sm:grid-cols-1 sm:grid-rows-subgrid sm:items-start sm:gap-y-0 ${COMPROVE_COMPACTO}`}
      >
        <p className="text-[0.8125rem] leading-snug text-carvao-muted sm:row-start-1 sm:mb-1.5">{s.medida}</p>
        <p className="col-start-2 row-span-2 row-start-1 text-right font-serif text-[1.75rem] leading-none tabular-nums text-carvao sm:col-start-1 sm:row-span-1 sm:row-start-2 sm:text-left sm:text-[2.25rem]">
          {s.valorTexto}
          <span className="block pt-1 font-sans text-xs leading-tight text-carvao-muted sm:!text-sm">{s.unidade}</span>
        </p>
        <div className="col-start-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-snug text-carvao-muted sm:row-start-3 sm:mt-1.5">
          <span>{s.periodo}</span>
          <SeloNatureza natureza={s.natureza} texto />
          {s.evidencia ? <ComproveNumero evidencia={s.evidencia} endereco={s.endereco} /> : s.prova && <ComproveNumero sobDemanda={s.prova} endereco={s.endereco} />}
        </div>
        {s.variacao && <Variacao v={s.variacao} />}
      </div>
      {s.figura && (
        <div className="mt-3 sm:row-start-7">
          <FaixaDeReferencia f={s.figura} />
        </div>
      )}
      <div className="mt-3 space-y-2 sm:row-start-8">
        {s.referencias.length > 0 && (
          <ul className="space-y-1 text-sm leading-snug text-carvao">
            {s.referencias.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        <p className="text-xs leading-relaxed text-carvao-muted">
          {comNomesProprios(s.universo, idiomaEnergia())} {s.ressalva}
        </p>
        {s.semFicha && (
          <p className="text-xs leading-relaxed text-carvao-muted" data-sem-ficha="">
            {s.semFicha}
          </p>
        )}
      </div>
    </>
  );
}

/** Ausência é um estado, com o motivo: hachura e "sem dado" (ou "indisponível nesta publicação"), nunca um zero. */
function MedidaAusente({ s }: { s: SinalAusente }) {
  return (
    <div role="group" aria-label={s.medida} data-medida={s.id} className="mt-3 sm:row-span-4 sm:row-start-3">
      <p className="text-[0.8125rem] leading-snug text-carvao-muted">{s.medida}</p>
      <p className="mt-1.5 inline-flex items-center gap-2 font-serif text-xl leading-none text-carvao-muted">
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 border border-mineral"
          style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, transparent 1px 4px)" }}
        />
        {s.estado === "indisponivel" ? tx("indisponível nesta publicação", "unavailable in this publication") : tx("sem dado", "no data")}
      </p>
      {s.periodo && <p className="mt-1.5 text-xs text-carvao-muted">{s.periodo}</p>}
      <p className="mt-2 text-xs leading-relaxed text-carvao-muted">{s.motivo}</p>
    </div>
  );
}

type EscolhasDistribuidora = ReturnType<typeof escolhasDeDistribuidora>;

/** A pergunta de um cartão: as seis prioritárias e as duas de acesso e desigualdade (que não têm resposta por distribuidora). */
type PerguntaDoCartao = Omit<PerguntaPrioritaria, "id"> & { id: string };

/** Uma das perguntas: o título, para que serve, a medida de abertura e o caminho para a página que aprofunda (com a "sua distribuidora" em conta, qualidade e perdas). */
function BlocoPergunta({ p, sinal, escolhas }: { p: PerguntaDoCartao; sinal: SinalHome; escolhas: EscolhasDistribuidora }) {
  const c = CARTOES[p.slug]?.conceito;
  // o link do verbete tem 44 px de altura de toque (o componente compartilhado entrega 24 px dentro de uma área de 44), e a dica do termo continua
  const termo = c && (
    <span className="text-sm text-carvao [&_a]:min-h-[44px]">
      <Termo slug={c.slug} alvo>
        {c.rotulo}
      </Termo>
    </span>
  );
  const por = p.porDistribuidora;
  const [destinoPagina, ancora] = p.link.href.split("#");
  // quem tem o dado de cada pergunta, e o que dizer da escolhida que não o tem
  const dados = por
    ? {
        conta: {
          comDado: escolhas.comDado.conta,
          emParte: [] as string[],
          semDado: tx("{sigla} não tem tarifa em vigor na data.", "{sigla} has no tariff in force on the date."),
          emParteTexto: undefined as string | undefined,
        },
        qualidade: {
          comDado: escolhas.comDado.qualidade,
          emParte: escolhas.comDado.qualidadeParcial,
          semDado: tx(`{sigla} não enviou DEC de ${escolhas.anoQualidade}.`, `{sigla} did not submit a DEC for ${escolhas.anoQualidade}.`),
          emParteTexto: tx(`{sigla} enviou só parte de ${escolhas.anoQualidade} e não tem DEC anual.`, `{sigla} submitted only part of ${escolhas.anoQualidade} and has no annual DEC.`) as string | undefined,
        },
        perdas: {
          comDado: escolhas.comDado.perdas,
          emParte: [] as string[],
          semDado: tx(`{sigla} não tem dado de perdas em ${escolhas.anoPerdas}.`, `{sigla} has no loss data for ${escolhas.anoPerdas}.`),
          emParteTexto: undefined as string | undefined,
        },

      }[por.tema]
    : null;
  return (
    <article
      aria-labelledby={`pergunta-${p.id}`}
      className="grid min-w-0 content-start border-t border-linha pb-6 pt-4 sm:row-span-9 sm:grid-rows-subgrid"
      data-sinal={p.id}
      data-estado={sinal.estado}
    >
      <h3 id={`pergunta-${p.id}`} className="ed-h3 font-serif text-carvao sm:row-start-1">
        {p.pergunta}
      </h3>
      <p className="mt-1 text-sm leading-snug text-carvao-muted sm:row-start-2" data-importa="">
        {p.importa}
      </p>
      {sinal.estado === "disponivel" ? <MedidaDisponivel s={sinal} /> : <MedidaAusente s={sinal} />}
      <div className="mt-3 sm:row-start-9">
        {por && dados ? (
          <div className="flex flex-col items-start">
            <LinkPorDistribuidora
              destino={destinoPagina}
              parametro={por.parametro}
              ancora={ancora}
              rotuloPadrao={p.link.rotulo}
              rotuloEscolhida={por.rotuloEscolhida}
              comDado={dados.comDado}
              emParte={dados.emParte}
              semDado={dados.semDado}
              emParteTexto={dados.emParteTexto}
              destinoEscolhida={por.hrefEscolhida}
              className={`rotulo ${link}`}
            />
            {termo}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6">
            <Link href={p.link.href} className={`rotulo ${link}`}>
              {p.link.rotulo}
              <span aria-hidden="true" className="ml-1.5">
                →
              </span>
            </Link>
            {termo}
          </div>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ a página */

export default function MapaDoObservatorio() {
  const perdas = lerGold<PerdasGold>("perdas.json");
  const qualidade = lerGold<QualidadeGold>("qualidade.json");
  const empresas = lerGold<EmpresasGold>("empresas.json");
  const pub = lerGold<PublicacaoAtualidade & { disponivel?: boolean; resumo?: { com_revisao?: number; observacoes_revisadas?: number; referencias_revisadas?: number } }>("publicacao.json");

  const distribuidoras = empresas && integra(empresas) ? empresas.distribuidoras.indice : [];
  const escolhas = escolhasDeDistribuidora(distribuidoras, integra(perdas) ? perdas.referencia.ano : null);
  const busca = indiceBusca(
    DESTINOS_NAVEGACAO,
    conceitos(),
    distribuidoras.map((d) => ({ slug: d.slug, sigla: d.sigla, nome: d.nome, cnpj: d.cnpj, ufs: d.ufs, grupo: d.controle?.topo_nome ?? null })),
  );
  const fichas = new Set(DATASETS_INTEGRADOS.map((d) => d.slug));
  // a publicação só conhece o ano do DEC e do FEC; o último mês com dado vem do módulo de Qualidade
  const atualidade = linhasAtualidade(pub && pub.disponivel !== false ? pub : null, fichas, refinosDePeriodo(qualidade));
  const resumoAtual = resumoAtualidade(atualidade);
  const regraAtual = regraDeAtualidade(atualidade);
  // os órgãos que a tabela cita, com o nome por extenso: o rótulo de cada fonte traz só a sigla
  const orgaosDaTabela = Array.from(new Set(atualidade.map((l) => l.orgao).filter((o): o is string => !!o)));
  const dataPublicacao = pub?.referencia?.hoje ?? null;
  const pubFontes = publicacaoDados();
  const orgaos = pubFontes ? orgaosDasFontes(pubFontes).map((o) => o.orgao) : [];
  const sinais = sinaisDaInicial();
  const sinaisInclusao = sinaisDeInclusao();
  // a frase do "sua distribuidora": quantas há em cada página, com a contagem do DEC que fecha com a da Visão geral e as de parte do ano à parte
  const nParciais = escolhas.comDado.qualidadeParcial.length;
  const descricaoDaEscolha = tx(
    `Vale para as três perguntas com resposta por distribuidora e fica guardada só neste navegador. Conta de luz: ${escolhas.comDado.conta.length} com tarifa em vigor. Qualidade: ${escolhas.comDado.qualidade.length} com DEC anual de ${escolhas.anoQualidade}${
      nParciais > 0 ? `, mais ${nParciais} com dado de parte do ano e sem DEC anual` : ""
    }. Perdas: ${escolhas.comDado.perdas.length} com dado de ${escolhas.anoPerdas}.`,
    `It applies to the three questions answered by distribution utility and is stored only in this browser. Electricity bill: ${escolhas.comDado.conta.length} with a tariff in force. Quality of supply: ${escolhas.comDado.qualidade.length} with an annual DEC for ${escolhas.anoQualidade}${
      nParciais > 0 ? `, plus ${nParciais} with data for part of the year and no annual DEC` : ""
    }. Losses: ${escolhas.comDado.perdas.length} with data for ${escolhas.anoPerdas}.`,
  );
  // os arquivos CSV de cada número, os mesmos que a ficha Comprove lista
  const tituloDe = new Map<string, string>([...PERGUNTAS_PRIORITARIAS, ...PERGUNTAS_DE_INCLUSAO].map((q) => [q.id, q.pergunta]));
  const baixaveis = [...sinais, ...sinaisInclusao].flatMap((x) => (x.estado === "disponivel" && x.downloads.length > 0 ? [{ id: x.id, pergunta: tituloDe.get(x.id) ?? x.medida, arquivos: x.downloads }] : []));

  // exemplo real da faixa "Como ler e conferir": um número publicado, com as suas datas e a ficha de prova
  const ev = integra(perdas) ? perdas.evidencias.taxa_nacional : null;
  // o denominador da taxa, refeito pelo seletor: a ficha o descreve com a origem dele, e o parágrafo do exemplo diz a diferença
  const denominador = denominadorDePerdas(perdas);
  const evFicha = ev ? evidenciaComDenominadorNomeado(ev, denominador) : null;
  const natEv = (metrica("perdas_taxa_total_injetada")?.natureza_transformacao ?? null) as Natureza | null;
  const revisoes = pub?.resumo ?? null;
  // quantas distribuidoras há por trás de cada contagem da página: o total nacional usa só as concessionárias
  const universo = universoPerdas(perdas);

  // o índice: todos os destinos publicados e em integração, menos a própria inicial; o estado de cada um vem de navegacao.ts
  const destinosDoIndice = (ds: DestinoNavegacao[]) => ds.filter((d) => d.slug !== "mapa");
  const todos = destinosDoIndice(DESTINOS_NAVEGACAO);
  const emIntegracao = todos.filter((d) => estadoDoDestino(d) === "integracao").map((d) => d.rotulo);
  const emPreparacao = todos.filter((d) => estadoDoDestino(d) === "preparacao").map((d) => d.rotulo);
  const estadoDoIndice =
    emIntegracao.length === 0 && emPreparacao.length === 0
      ? tx(`As ${todos.length} páginas publicam números.`, `All ${todos.length} pages publish numbers.`)
      : tx(
          [
            emIntegracao.length ? `${listaPorExtenso(emIntegracao)} ${emIntegracao.length === 1 ? "está" : "estão"} em integração: ${emIntegracao.length === 1 ? "mostra" : "mostram"} o escopo e as fontes catalogadas, sem números.` : "",
            emPreparacao.length ? `${listaPorExtenso(emPreparacao)} ${emPreparacao.length === 1 ? "está" : "estão"} em preparação, sem página.` : "",
          ],
          [
            emIntegracao.length ? `${listaEn(emIntegracao)} ${emIntegracao.length === 1 ? "is" : "are"} being integrated: ${emIntegracao.length === 1 ? "it shows" : "they show"} the scope and the cataloged sources, with no numbers.` : "",
            emPreparacao.length ? `${listaEn(emPreparacao)} ${emPreparacao.length === 1 ? "is" : "are"} in preparation, with no page.` : "",
          ],
        )
          .filter(Boolean)
          .join(" ");
  // o nome de um órgão por extenso, com a sigla: "Operador Nacional do Sistema Elétrico (ONS)" ("National Electric System Operator (ONS)")
  const orgaoPorExtenso = (o: string) => tx(SIGLAS[o] ? `${SIGLAS[o]} (${o})` : o, ORGAOS_EN[o] ? (/^[A-Z]{2,}$/.test(o) ? `${ORGAOS_EN[o]} (${o})` : `${o} (${ORGAOS_EN[o]})`) : o);

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:mapa" />
      <RedirecionaAncoraAntiga ancoras={ANCORAS_VISAO_GERAL} destino="/setor-eletrico/visao-geral" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina energia-atlas-inicial pb-12">
        {/* frescor dos dados diários na primeira tela: em 19/10/2026 a entrada mostrava o PLD de 30/09 sem dizer que a publicação estava parada */}
        <FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/setor-eletrico"]} idioma={idiomaEnergia()} />
        {/* abertura (20/10/2026): a pergunta do observatório e, ao lado, os três números de entrada com fonte e período, tudo na
            primeira tela; a gravura do sistema saiu daqui e abre o percurso da usina à tomada, depois do "Para você" */}
        <header id="proposito" className="scroll-mt-24 pb-6 pt-6 md:pb-8 md:pt-10">
          <div className="energia-abertura">
            <div className="energia-abertura-texto">
              <RotuloContexto rota="/setor-eletrico" />
              <h1>{tx("De onde vem a energia e quanto ela custa?", "Where does power come from, at what cost?")}</h1>
              <p>
                {tx(
                  "Preço, reservatórios, geração, consumo e rede do sistema elétrico, e o que chega à sua conta de luz. Cada número traz fonte, período e referência.",
                  "Price, reservoirs, generation, consumption and the grid of the power system, and what reaches your electricity bill. Every number carries its source, period and reference.",
                )}
              </p>
              <a className="energia-explorar" href="#percurso-energia">{tx("Explorar o sistema", "Explore the system")} <span aria-hidden="true">↓</span></a>
            </div>
            <div className="energia-abertura-medidas" aria-label={tx("Três medidas de entrada, com períodos próprios", "Three opening measures, each with its own period")}>
              {["agua", "pld", "qualidade"].map(id => { const s = sinais.find(x => x.id === id)!; return <a href={`#pergunta-${id}`} key={id}>
                <span>{s.medida}</span><strong>{s.estado === "disponivel" ? s.valorTexto : tx("Sem dado", "No data")}</strong>
                <span>{s.estado === "disponivel" ? s.unidade : s.motivo}</span><small>{s.periodo ?? tx("Período indisponível", "Period unavailable")} · {orgaoPorExtenso(id === "agua" ? "ONS" : id === "pld" ? "CCEE" : "ANEEL")}</small>
                <span className="energia-abertura-link">{tx("Ver universo, referência e fonte ↓", "See universe, reference and source ↓")}</span>
              </a>; })}
            </div>
          </div>
          <p className="energia-medidas-nota">
            {tx(
              "Cada indicador tem seu período. PLD não é tarifa; armazenamento não mede sozinho o risco de falta de energia.",
              "Each indicator has its own period. The spot price (PLD) is not a tariff; storage alone does not measure the risk of an energy shortage.",
            )}
          </p>
          <details className="energia-contexto"><summary>{tx("Sobre o observatório, caminhos e fontes", "About the observatory, paths and sources")} <span aria-hidden="true">+</span></summary>
          <div className="obs-hero grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <RotuloContexto rota="/setor-eletrico" className="text-mineral" />
              <p className="font-serif text-2xl">{tx("Energia, do sistema à sua conta", "Energy, from the system to your bill")}</p>
              <p className="ed-lead mt-3 max-w-3xl text-carvao-muted">
                {tx(
                  "Acompanhe preços, geração e reservatórios. Compare tarifas, interrupções e perdas por região. Cada painel explica o indicador e mostra sua fonte, período e referência.",
                  "Follow prices, generation and reservoirs. Compare tariffs, interruptions and losses by region. Each panel explains the indicator and shows its source, period and reference.",
                )}
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-snug text-carvao" data-limite="">
                <span className="rotulo mr-2 text-mineral">{tx("Não permite concluir", "Does not allow concluding")}</span>
                {tx(
                  "As medidas nacionais não estimam a fatura de uma casa nem o risco de falta de luz. Para conhecer o serviço local, selecione a sua distribuidora.",
                  "National measures do not estimate a household's bill or the risk of a power outage. To see the local service, select your distribution utility.",
                )}
              </p>
              <div className="ed-meta mt-1 items-center text-xs text-carvao-muted" data-recorte="">
                <span>{tx("Cada número informa o próprio período e universo", "Each number states its own period and universe")}</span>
                {orgaos.length > 0 && (
                  <span>
                    {tx(
                      `Fonte: ${orgaos.length} órgãos, entre eles ${listaEmPortugues(orgaos.slice(0, 3).map((o) => (SIGLAS[o] ? `${SIGLAS[o]} (${o})` : o)))}`,
                      `Source: ${orgaos.length} public bodies, including ${listaEn(orgaos.slice(0, 3).map(orgaoPorExtenso))}`,
                    )}
                  </span>
                )}
                <DetalheDoNivel resumo={tx("Fontes, datas e siglas", "Sources, dates and acronyms")} abreEm="nunca" className="[&[open]]:basis-full">
                  <div className="max-w-prose2 space-y-3 pb-2 pt-1 text-sm leading-relaxed text-carvao-muted">
                    {pubFontes && (
                      <p className="text-xs text-mineral">
                        <span className="font-medium text-carvao-muted">{tx("Fontes e datas de referência: ", "Sources and reference dates: ")}</span>
                        {tx(
                          `${listaEmPortugues(orgaos)}; catálogo publicado em ${carimbo(pubFontes.gerado_em)}. Cada painel mostra a data de referência dos próprios dados.`,
                          `${listaEn(orgaos)}; catalog published on ${carimbo(pubFontes.gerado_em)}. Each panel shows the reference date of its own data.`,
                        )}
                      </p>
                    )}
                    <p>
                      {tx(
                        <>
                          O observatório liga a operação do sistema elétrico, os preços, as empresas e o que chega à vida das pessoas, com dados públicos que você pode conferir número a número: de que
                          fonte vem, a que período se refere e como foi calculado. A atualidade de cada fonte está em{" "}
                          <a href="#aprofundar" className={linkTexto}>
                            Fontes e atualidade
                          </a>
                          .
                        </>,
                        <>
                          The observatory connects the operation of the power system, prices, companies and what reaches people&apos;s lives, with public data that you can check number by number: which
                          source it comes from, which period it refers to and how it was calculated. How current each source is appears in{" "}
                          <a href="#aprofundar" className={linkTexto}>
                            Sources and timeliness
                          </a>
                          .
                        </>,
                      )}
                    </p>
                    <LegendaDeSiglas siglas={["SIN", "PLD", "DEC", "EAR"]} />
                  </div>
                </DetalheDoNivel>
              </div>

            </div>
            <nav aria-label={tx("Por onde começar", "Where to start")} className="min-w-0 lg:border-l lg:border-linha lg:pl-8">
              <p className="rotulo text-mineral">{tx("Por onde começar", "Where to start")}</p>
              <ol className="mt-1 divide-y divide-linha">
                {CAMINHOS_INTENCAO.slice(0, 3).map((c) => {
                  const [principal, ...apoio] = c.slugs.map(destino);
                  const aoTitulo = "inline-flex min-h-[44px] items-center gap-2 font-serif text-lg leading-snug text-energia-dark underline underline-offset-4 hover:text-carvao";
                  return (
                    <li key={c.id} className="py-3" data-caminho={c.id}>
                      {c.ancora || !principal ? (
                        <a href={c.ancora ?? "#proposito"} className={aoTitulo}>
                          {c.titulo}
                          <span aria-hidden="true">↓</span>
                        </a>
                      ) : (
                        <Link href={principal.href} className={aoTitulo}>
                          {c.titulo}
                          <span aria-hidden="true">→</span>
                        </Link>
                      )}
                      <p className="text-sm leading-snug text-carvao-muted">{c.descricao}</p>
                      {apoio.length > 0 && (
                        <p className="flex flex-wrap items-center gap-x-3 text-sm text-carvao-muted">
                          <span>{tx("Como se calcula:", "How it is calculated:")}</span>
                          {apoio.map((d) => (
                            <Link key={d.slug} href={d.href} className={link}>
                              {d.rotulo}
                            </Link>
                          ))}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p className="border-t border-linha pt-1">
                <a href="#destinos" className={link}>
                  {tx("Ver todas as páginas, por tema", "See all pages, by topic")}
                  <span aria-hidden="true" className="ml-1.5">
                    ↓
                  </span>
                </a>
              </p>
            </nav>
          </div>
          <dl className="obs-metrics">
            {[
              [String(DESTINOS_NAVEGACAO.filter(d => d.publicado && d.slug !== "mapa").length), tx("páginas disponíveis", "pages available"), tx("Painéis, conhecimento e evidência", "Panels, knowledge and evidence")],
              [String(GRUPOS_NAVEGACAO.length), tx("grupos de temas", "topic groups"), tx("Do sistema à vida das pessoas", "From the system to people's lives")],
              [String(orgaos.length), tx("órgãos nas fontes", "public bodies in the sources"), tx("Dados públicos com procedência", "Public data with provenance")],
              ["3", tx("níveis de leitura", "reading levels"), tx("Entender, analisar e auditar", "Understand, analyze and audit")],
            ].map(([valor, rotulo, detalhe]) => <div key={rotulo}><dd>{valor}</dd><dt>{rotulo}</dt><dd>{detalhe}</dd></div>)}
          </dl>
          </details>
        </header>
        {/* "Para você" (Onda 2): as perguntas do leitor sobre o próprio caso, a um clique, logo depois das medidas de abertura; substitui os dois cartões "Qual pergunta você quer responder?" */}
        <ParaVoce
          entrada="/setor-eletrico"
          idioma={idiomaEnergia()}
          conteiner=""
          artes={{ luz: <ArteFoto src="/energia/arte/conta-gravura-v1.webp" />, "falta-luz": <ArtePrancha etapa="distribuicao" />, "tarifa-social-luz": <ArtePrancha etapa="consumo" /> }}
        />
        {/* a gravura do sistema abre o percurso: as quatro etapas levam a cada trecho dele */}
        <figure className="energia-cenario" aria-label={tx("Da geração ao consumo, em quatro etapas", "From generation to consumption, in four stages")}>
          <Image
            className="energia-cenario-imagem"
            src="/energia/arte/sistema-gravura-v1.webp"
            alt={tx(
              "Gravura conceitual de uma paisagem imaginária com reservatório, hidrelétrica, eólicas, painéis solares, linhas de transmissão, subestação e cidade.",
              "Conceptual engraving of an imaginary landscape with a reservoir, a hydropower plant, wind turbines, solar panels, transmission lines, a substation and a city.",
            )}
            width={1440}
            height={720}
            sizes="(max-width: 1240px) 100vw, 1240px"
          />
          <nav className="energia-cenario-pontos" aria-label={tx("Explore as etapas do sistema elétrico", "Explore the stages of the power system")}>
            {ETAPAS_ENERGIA_IDIOMAS[idiomaEnergia()].map((e) => (
              <a key={e.id} href={`#etapa-${e.id}`} data-etapa={e.id}>
                <span>{e.numero}</span>
                {e.nome}
              </a>
            ))}
          </nav>
          <figcaption className="energia-cenario-legenda">{tx("Ilustração conceitual gerada por IA · sem escala geográfica", "AI-generated conceptual illustration · not to geographic scale")}</figcaption>
        </figure>
        <PercursoVisualEnergia />
        <DuasCamadasEnergia compacto />
        <LeiturasIntegradas />
        <div className="obs-home-search">              <div>
                <BuscaObservatorio
                  itens={busca}
                  exemplos={tx(["preço da luz", "falta de energia", "reservatórios", "Tarifa Social"], ["electricity bill", "power outage", "reservoirs", "Tarifa Social"])}
                  regiao={{ href: destino("territorio").href, rotulo: destino("territorio").rotulo }}
                />
              </div></div>

        {/* mapa conceitual: o desenho a partir de md, a versão em texto no celular (e para o leitor de tela no desktop) */}
        <Secao
          id="mapa-conceitual"
          titulo={tx("Como as partes do setor elétrico se ligam", "How the parts of the power sector connect")}
          subtitulo={
            <>
              {tx(
                "Sete elos, da água à vida das pessoas, em quatro faixas: o caminho físico, a coordenação da operação, as relações econômicas e a experiência das pessoas.",
                "Seven nodes, from water to people's lives, in four bands: the physical path, the coordination of operation, the economic relationships and people's experience.",
              )}{" "}
              {/* o desenho e os botões só existem a partir de md: no celular a instrução é outra */}
              <span className="hidden md:inline">
                {tx(
                  "Escolha um elo para ver o que ele é, onde explorá-lo e com que tipo de ligação ele se conecta aos outros. A forma do traço e da ponta diz o tipo da ligação.",
                  "Choose a node to see what it is, where to explore it and with what type of connection it links to the others. The shape of the line and of its end shows the type of connection.",
                )}
              </span>
              <span className="md:hidden">
                {tx(
                  "Leia os sete elos abaixo, de cima para baixo; toque em um elo para ver o que ele é, onde explorá-lo e como se liga aos outros.",
                  "Read the seven nodes below, from top to bottom; tap a node to see what it is, where to explore it and how it connects to the others.",
                )}
              </span>
            </>
          }
        >
          <details className="energia-mapa-completo"><summary>{tx("Abrir o mapa completo de relações", "Open the full map of relationships")} <span aria-hidden="true">+</span></summary>
          <div className="hidden md:block">
            <MapaConceitual
              rotulo={tx("Mapa conceitual do setor elétrico: escolha um elo para ver a explicação e as ligações", "Conceptual map of the power sector: choose a node to see the explanation and the connections")}
              inicial="recursos"
              nos={NOS_MAPA.map((n) => ({ id: n.id, titulo: n.titulo, curto: n.curto, faixa: FAIXAS_MAPA[n.faixa].rotulo, pos: n.pos, detalhe: <DetalheNo no={n} /> }))}
              ligacoes={LIGACOES.map((l) => ({ de: l.de, para: l.para, tipo: l.tipo }))}
              tipos={(Object.keys(TIPOS_LIGACAO) as (keyof typeof TIPOS_LIGACAO)[]).map((id) => ({ id, ...TIPOS_LIGACAO[id] }))}
              faixas={ORDEM_FAIXAS.map((f) => ({ texto: FAIXAS_MAPA[f].rotulo, ...ROTULOS_FAIXA[f] }))}
            />
          </div>
          {/* mapa vertical: é o mapa no celular. No desktop ele some (display: none), porque cópia só para o leitor de tela deixava dezenas de paradas de Tab
              em links e resumos invisíveis; lá o leitor de tela e o teclado usam os sete botões e o painel do elo, que trazem o mesmo conteúdo */}
          <div className="md:hidden">
            <p className="mb-3 text-sm leading-relaxed text-carvao-muted">
              {tx("Tipos de ligação:", "Connection types:")} <TiposDeLigacao />
            </p>
            <MapaVertical />
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="border-l-2 border-energia pl-4 text-sm leading-relaxed text-carvao-muted">
              <p className="rotulo text-mineral">{tx("O que o mapa não diz", "What the map does not say")}</p>
              <ul className="mt-2 space-y-1.5">
                {O_QUE_O_MAPA_NAO_DIZ.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="rotulo text-mineral">{tx("Atravessam todos os elos", "Across all nodes")}</p>

              <ul className="mt-2 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {TRANSVERSAIS.map((t) => (
                  <li key={t.titulo} className="border-t border-linha pt-2 text-sm">
                    <p className="font-serif text-base text-carvao">{t.titulo}</p>
                    <p className="mt-0.5 leading-snug text-carvao-muted">{t.texto}</p>
                    <p className="flex flex-wrap gap-x-4">
                      {t.destinos.map((s) => (
                        <Link key={s} href={destino(s).href} className={link}>
                          {destino(s).rotulo}
                        </Link>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          </details>
        </Secao>

        {/* as seis perguntas, cada uma com a medida real, o período, a figura de referência e o link; a escolha da distribuidora é uma só */}
        <Secao
          id="perguntas"
          titulo={tx("Seis perguntas para começar", "Six questions to start with")}
          subtitulo={tx(
            "Cada resposta abre com uma medida, o período e a referência; a página de destino traz o resto. Escolha a sua distribuidora uma vez: as perguntas sobre a conta, a falta de energia e as perdas abrem a página dela já com a distribuidora selecionada.",
            "Each answer opens with a measure, its period and its reference; the destination page has the rest. Choose your distribution utility once: the questions about the bill, power outages and losses open its page with the utility already selected.",
          )}
        >
          <SuaDistribuidora opcoes={escolhas.opcoes} descricao={descricaoDaEscolha} />
          <p className="mb-6 max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-como-ler="">
            <span className="font-medium text-carvao">{tx("Como ler. ", "How to read. ")}</span>
            {tx(
              "O losango marca o valor destacado. A linha mostra a faixa observada; a caixa reúne a metade central dos casos; o traço dentro dela é a mediana (o ponto que divide os casos em duas metades). Compare apenas medidas com a mesma unidade e período. MW mede potência; MWh mede energia; MWmed é a energia em MWh dividida pelas horas do período.",
              "The diamond marks the highlighted value. The line shows the observed range; the box holds the middle half of the cases; the mark inside it is the median (the point that splits the cases into two halves). Compare only measures with the same unit and period. MW measures power; MWh measures energy; MWavg (average megawatts) is the energy in MWh divided by the hours in the period.",
            )}
          </p>
          <section aria-label={tx("Seis perguntas, cada uma com a medida de abertura, o período e a referência", "Six questions, each with its opening measure, period and reference")} data-seis-perguntas="">
            <PerguntasExploraveis resumos={PERGUNTAS_PRIORITARIAS.map(p => { const s = sinais.find(x => x.id === p.id)!; return { id: p.id, titulo: s.medida, valor: s.estado === "disponivel" ? s.valorTexto : tx("Sem dado", "No data"), unidade: s.estado === "disponivel" ? s.unidade : s.motivo, periodo: s.periodo ?? tx("Período indisponível", "Period unavailable") }; })}>
            {PERGUNTAS_PRIORITARIAS.map((p) => (
              <BlocoPergunta key={p.id} p={p} sinal={sinais.find((s) => s.id === p.id)!} escolhas={escolhas} />
            ))}
            </PerguntasExploraveis>
          </section>
          <section aria-label={tx("Acesso e desigualdade, duas perguntas, cada uma com a medida de abertura", "Access and inequality, two questions, each with its opening measure")} className="mt-6" data-inclusao="">
            <p className="rotulo text-mineral">{tx("Acesso e desigualdade", "Access and inequality")}</p>
            <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              {PERGUNTAS_DE_INCLUSAO.map((p) => (
                <BlocoPergunta key={p.id} p={{ ...p, slug: "inclusao-energetica" }} sinal={sinaisInclusao.find((s) => s.id === p.id)!} escolhas={escolhas} />
              ))}
              <div className="border-t border-linha pt-4 text-sm leading-relaxed text-carvao-muted sm:col-span-2 lg:col-span-1" data-nota-inclusao="">
                <p>
                  {tx(
                    "Estes dois números vêm da página Inclusão energética, que mostra também o peso da conta no orçamento das famílias, a cobertura por município e os sistemas isolados.",
                    "These two numbers come from the Energy inclusion page, which also shows the weight of the bill in household budgets, coverage by municipality and the isolated systems.",
                  )}
                </p>
                <Link href="/setor-eletrico/inclusao-energetica" className={link}>
                  {tx("Ver Inclusão energética", "See Energy inclusion")}
                </Link>
              </div>
            </div>
          </section>
          <div className="mt-6">
            <Recolhivel id="mais-perguntas" titulo={tx("Outras perguntas do dia a dia", "Other everyday questions")} dica={tx("Nove perguntas comuns e a página que responde a cada uma", "Nine common questions and the page that answers each one")}>
              <ul className="grid gap-x-10 gap-y-5 md:grid-cols-2">
                {PERGUNTAS_COTIDIANAS.map((p) => (
                  <li key={p.pergunta}>
                    <p className="font-serif text-base leading-snug text-carvao">{p.pergunta}</p>
                    <p className="mt-1">{p.resposta}</p>
                    <p className="mt-1 flex flex-wrap gap-x-5">
                      {p.destinos.map((d) => (
                        <Link key={d.href} href={d.href} className={link}>
                          {d.rotulo}
                        </Link>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </Recolhivel>
          </div>
        </Secao>

        <LaboratorioEnergia />

        {/* índice completo, agrupado nos seis grupos de navegação: um só, com o detalhe de cada página aberto no próprio item */}
        <Secao
          id="destinos"
          titulo={tx("Todas as páginas, por tema", "All pages, by topic")}
          subtitulo={tx(
            `Seis grupos e a pergunta que cada página responde. Cada página mostra sua pergunta e recorte. O ▾ abre os conteúdos e conceitos disponíveis. ${estadoDoIndice}`,
            `Six groups and the question each page answers. Each page shows its question and scope. The ▾ opens the available contents and concepts. ${estadoDoIndice}`,
          )}
        >
          <div className="obs-catalogo grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {GRUPOS_NAVEGACAO.map((g) => {
              const ds = destinosDoIndice(g.destinos);
              if (!ds.length) return null;
              return (
                <div key={g.id}>
                  <h3 className="ed-h3 font-serif text-carvao">{g.rotulo}</h3>
                  <p className="mt-1 border-b border-linha pb-2 text-sm leading-snug text-carvao-muted">{g.resumo}</p>
                  <ul className="divide-y divide-linha">
                    {ds.map((d) => (
                      <li key={d.slug}>
                        <ItemDoIndice d={d} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Secao>

        {/* trilhas de leitura: a sequência de paradas à vista, o que se aprende em cada uma recolhido */}
        <Secao
          id="trilhas"
          titulo={tx("Trilhas de leitura", "Learning paths")}
          subtitulo={tx(
            "Percursos curtos, em ordem, que ligam os temas. O tempo de leitura é uma estimativa editorial, não uma medida de uso.",
            "Short routes, in order, that connect the topics. The reading time is an editorial estimate, not a measure of use.",
          )}
        >
          <div className="grid gap-x-8 gap-y-8 md:grid-cols-2 xl:grid-cols-4">
            {TRILHAS.map((t) => (
              <section key={t.id} aria-labelledby={`trilha-${t.id}`} className="flex min-w-0 flex-col border-t border-linha pt-4">
                <h3 id={`trilha-${t.id}`} className="ed-h3 font-serif text-carvao">
                  {t.perfil}
                </h3>
                <p className="mt-1 text-sm leading-snug text-carvao-muted">{t.para}</p>
                <p className="mt-1 text-xs text-mineral">{tx(<>Leitura estimada: cerca de {t.minutos} min (estimativa editorial).</>, <>Estimated reading: about {t.minutos} min (editorial estimate).</>)}</p>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm marker:text-mineral">
                  {t.paradas.map((s) => (
                    <li key={`${t.id}-${s.href}-${s.rotulo}`}>
                      <Link href={s.href} className={`${linkTexto} inline-flex min-h-[44px] items-center`}>
                        {s.rotulo}
                      </Link>
                    </li>
                  ))}
                </ol>
                <details className="group mt-2 text-sm">
                  <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                    {tx("O que se aprende em cada parada", "What you learn at each stop")}
                  </summary>
                  <ol className="list-decimal space-y-2 pb-1 pl-5 text-carvao-muted marker:text-mineral">
                    {t.paradas.map((s) => (
                      <li key={`${t.id}-${s.href}-${s.rotulo}-aprende`}>
                        <span className="text-carvao">{s.rotulo}:</span> {tx("você aprende", "you learn")} {s.aprende}
                      </li>
                    ))}
                  </ol>
                </details>
              </section>
            ))}
          </div>
        </Secao>

        <nav aria-label={tx("Conhecimento e fontes", "Knowledge and sources")} className="mb-8 grid gap-4 sm:grid-cols-2">
          {CAMINHOS_INTENCAO.slice(3).map(c => <div key={c.id} data-caminho={c.id} className="border-l-4 border-obee bg-superficie p-5">
            <Link href={destino(c.slugs[0]).href} className="inline-flex min-h-[44px] items-center font-serif text-xl text-obee-tinta underline underline-offset-4">{c.titulo} →</Link>
            <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{c.descricao}</p>
            {c.slugs.slice(1).map(slug => <Link key={slug} href={destino(slug).href} className={link}>{destino(slug).rotulo}</Link>)}
          </div>)}
        </nav>
        {/* como ler e conferir: blocos recolhíveis de uma linha, com o conteúdo inteiro no HTML */}
        <Secao
          id="como-confiar"
          titulo={tx("Como ler e conferir", "How to read and check")}
          subtitulo={tx(
            "O que cada selo significa, por que cada número tem várias datas, o que é uma revisão da fonte e como provar um número. O método completo está na Metodologia.",
            "What each label means, why each number has several dates, what a source revision is and how to prove a number. The full method is in the Methodology.",
          )}
        >
          <p className="mb-3">
            <Link href="/setor-eletrico/metodologia" className={link}>
              {tx("Ler a Metodologia completa", "Read the full Methodology")}
              <span aria-hidden="true" className="ml-1.5">
                →
              </span>
            </Link>
          </p>
          <div className="grid gap-x-10 lg:grid-cols-2">
            <div className="border-t border-linha">
              <Recolhivel titulo={tx("Cinco naturezas de número", "Five kinds of number")} dica={tx("Observado, calculado, estimado, previsto e cenário, cada um com a sua forma", "Observed, calculated, estimated, forecast and scenario, each with its own shape")}>
                <ul className="space-y-2">
                  {ORDEM_NATUREZAS.map((n) => (
                    <li key={n} className="grid gap-1 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
                      <span className="self-start">
                        <SeloNatureza natureza={n} />
                      </span>
                      <span>{NATUREZAS[n].definicao}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  {tx(
                    "As naturezas nunca se confundem: um cálculo não aparece como medição, e um cenário não é previsão. O selo muda de forma, não só de cor.",
                    "The kinds are never mixed up: a calculation does not appear as a measurement, and a scenario is not a forecast. The label changes shape, not only color.",
                  )}
                </p>
              </Recolhivel>

              <Recolhivel titulo={tx("Um número real, do arquivo à página", "A real number, from the file to the page")} dica={tx("Um número publicado, com as suas datas e a ficha de prova", "A published number, with its dates and its proof record")}>
                {ev ? (
                  <>
                    {tx(
                      <p>
                        <span className="font-serif text-2xl text-carvao">{valorDestaque(ev.valor_calculo, "pct", 1)}</span> é a taxa de perdas totais das {entidadeEmFrase(ev.entidade)}, de{" "}
                        {periodoLegivel(ev.periodo.inicio)} a {periodoLegivel(ev.periodo.fim)}: {ev.universo}.
                        {universo && ` Ao todo, ${universo.total} distribuidoras têm dado de ${universo.ano}; este total soma só as ${universo.concessionarias} concessionárias, e as ${universo.permissionarias} permissionárias ficam fora dele.`}
                      </p>,
                      <p>
                        <span className="font-serif text-2xl text-carvao">{valorDestaque(ev.valor_calculo, "pct", 1)}</span> is the total loss rate of the{" "}
                        {traduzDaGold(ev.entidade) ?? <TrechoPortugues regiao="inicial-exemplo-entidade">{entidadeEmFrase(ev.entidade)}</TrechoPortugues>}, from {periodoLegivel(ev.periodo.inicio)} to{" "}
                        {periodoLegivel(ev.periodo.fim)}: {traduzModeloDaGold(ev.universo) ?? <TrechoPortugues regiao="inicial-exemplo-universo">{ev.universo}</TrechoPortugues>}.
                        {universo &&
                          ` In all, ${universo.total} distribution utilities have data for ${universo.ano}; this total adds only the ${universo.concessionarias} concession holders, and the ${universo.permissionarias} permit holders are left out of it.`}
                      </p>,
                    )}
                    {denominador && <p data-denominador="">{descreverDenominador(denominador).completa}</p>}
                    {natEv && (
                      <p className="flex flex-wrap items-center gap-2">
                        <SeloNatureza natureza={natEv} />{" "}
                        {tx(
                          <span>calculada pela plataforma a partir de {conjuntoPorExtenso(ev.fonte.conjunto)}, da {ev.fonte.orgao}.</span>,
                          <span>
                            calculated by the platform from{" "}
                            {/^SAMP\s+Balanço$/.test(conjuntoLegivel(ev.fonte.conjunto).texto) ? (
                              <>
                                the energy balance of the <Nome>SAMP</Nome> (ANEEL&apos;s market information monitoring system for economic regulation)
                              </>
                            ) : (
                              <Nome>{conjuntoLegivel(ev.fonte.conjunto).texto}</Nome>
                            )}
                            , published by {ev.fonte.orgao}.
                          </span>,
                        )}
                      </p>
                    )}
                    <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <dt>{tx("Período a que o dado se refere", "Period the data refers to")}</dt>
                      <dd className="text-carvao">
                        {tx(
                          <>
                            {periodoLegivel(ev.periodo.inicio)} a {periodoLegivel(ev.periodo.fim)}
                          </>,
                          <>
                            {periodoLegivel(ev.periodo.inicio)} to {periodoLegivel(ev.periodo.fim)}
                          </>,
                        )}
                      </dd>
                      {ev.fonte.publicado_em && (
                        <>
                          <dt>{tx("Arquivo publicado pela fonte em", "File published by the source on")}</dt>
                          <dd className="text-carvao">{dataBR(ev.fonte.publicado_em.slice(0, 10))}</dd>
                        </>
                      )}
                      {ev.fonte.capturado_em && (
                        <>
                          <dt>{tx("Capturado pela plataforma em", "Captured by the platform on")}</dt>
                          <dd className="text-carvao">{dataBR(ev.fonte.capturado_em.slice(0, 10))}</dd>
                        </>
                      )}
                      <dt>{tx("Processado em", "Processed on")}</dt>
                      <dd className="text-carvao">{dataBR(perdas!.gerado_em.slice(0, 10))}</dd>
                    </dl>
                    <div>
                      <p>
                        {tx(
                          "A ficha mostra a fórmula, o numerador, o denominador com a origem dele, o arquivo original com o seu código de verificação (sha256, que prova que é o mesmo arquivo), os testes e a citação pronta.",
                          "The record shows the formula, the numerator, the denominator with its origin, the original file with its verification code (sha256, which proves it is the same file), the tests and a ready-made citation.",
                        )}
                      </p>
                      <ComproveNumero evidencia={evFicha ?? ev} rotulo={tx("Comprove este número", "Check this number")} />
                    </div>
                  </>
                ) : (
                  <p className="text-mineral">
                    {tx("Exemplo indisponível nesta publicação: a base publicada de Perdas não foi processada.", "Example unavailable in this publication: the published Losses base was not processed.")}
                  </p>
                )}
              </Recolhivel>

              <Recolhivel
                // i18n: dado
                titulo="Cada data diz uma coisa"
                tituloEn="Each date says something different"
                dica={tx("Período de referência, publicação, captura e processamento", "Reference period, publication, capture and processing")}>
                {tx(
                  <>
                    <p>
                      <strong className="font-medium text-carvao">Período de referência</strong> é o tempo a que o dado se refere. <strong className="font-medium text-carvao">Publicação</strong> é quando a fonte
                      divulgou o arquivo, se ela informa. <strong className="font-medium text-carvao">Captura</strong> é quando a plataforma o baixou.{" "}
                      <strong className="font-medium text-carvao">Processamento</strong> é quando a página foi gerada.
                    </p>
                    <p>
                      Cada fonte tem o seu calendário: preço e água são diários, perdas e tarifas são mensais ou por vigência, pesquisas são anuais. As páginas mostram a data de cada fonte, e a data de
                      captura nunca substitui a data do dado.
                    </p>
                  </>,
                  <>
                    <p>
                      The <strong className="font-medium text-carvao">reference period</strong> is the time the data refers to. <strong className="font-medium text-carvao">Publication</strong> is when the source
                      released the file, if it says so. <strong className="font-medium text-carvao">Capture</strong> is when the platform downloaded it.{" "}
                      <strong className="font-medium text-carvao">Processing</strong> is when the page was generated.
                    </p>
                    <p>
                      Each source has its own calendar: price and water are daily, losses and tariffs are monthly or by validity period, surveys are annual. The pages show the date of each source, and the
                      capture date never replaces the date of the data.
                    </p>
                  </>,
                )}
              </Recolhivel>

              <Recolhivel
                // i18n: dado
                titulo="Dados revisados"
                tituloEn="Revised data"
                dica={tx("O que a plataforma faz quando a fonte corrige um número", "What the platform does when the source corrects a number")}>
                <p>
                  {tx(
                    "A fonte pode corrigir um número já publicado. A plataforma guarda cada versão capturada, compara as capturas do mesmo arquivo e registra a revisão em vez de sobrescrevê-la em silêncio.",
                    "The source may correct a number it has already published. The platform keeps each captured version, compares the captures of the same file and records the revision instead of silently overwriting it.",
                  )}
                </p>
                {revisoes && typeof revisoes.com_revisao === "number" && dataPublicacao && (
                  <p className="text-carvao">
                    {tx(
                      `Na publicação de ${dataBR(dataPublicacao)}, ${revisoes.com_revisao} ${revisoes.com_revisao === 1 ? "conjunto tinha" : "conjuntos tinham"} valores revisados pela fonte entre capturas.`,
                      `In the publication of ${dataBR(dataPublicacao)}, ${revisoes.com_revisao} ${revisoes.com_revisao === 1 ? "dataset had" : "datasets had"} values revised by the source between captures.`,
                    )}
                  </p>
                )}
                <p>
                  {tx("O estado de cada conjunto, com as revisões, está em", "The status of each dataset, with its revisions, is in")}{" "}
                  <Link href="/setor-eletrico/dados" className={linkTexto}>
                    {tx("Dados", "Data")}
                  </Link>
                  .
                </p>
              </Recolhivel>
            </div>

            <div className="lg:border-t lg:border-linha">
              <Recolhivel
                // i18n: dado
                titulo="Nomes e réguas que se confundem"
                tituloEn="Names and yardsticks that are easily confused"
                dica={tx("PLD e tarifa, CMO e PLD, subsistema e submercado, EAR e ENA, MWmed, MWh e MW", "PLD and tariff, CMO and PLD, subsystem and submarket, EAR and ENA, MWavg, MWh and MW")}>

                <dl className="space-y-2">
                  {nomesEReguas().map(([t, d]) => (
                    <div key={t}>
                      <dt className="font-medium text-carvao">{t}</dt>
                      <dd>{d}</dd>
                    </div>
                  ))}
                </dl>
              </Recolhivel>

              <Recolhivel
                // i18n: dado
                titulo="Ausência nunca vira zero"
                tituloEn="Absence never becomes zero"
                dica={tx("O que a página mostra quando falta dado, e os três níveis de leitura", "What the page shows when data is missing, and the three reading levels")}>
                {tx(
                  <>
                    <p>
                      Quando a fonte não publicou, o acesso foi bloqueado ou o processamento falhou, a página diz o que falta e por quê, em vez de mostrar zero ou uma estimativa. Nas tabelas a ausência
                      aparece como &quot;sem dado&quot;; nos arquivos CSV, como campo vazio.
                    </p>
                    <p>
                      As páginas de módulo trazem três profundidades sobre a mesma informação: <strong className="font-medium text-carvao">Entender</strong>, o essencial;{" "}
                      <strong className="font-medium text-carvao">Analisar</strong>, séries e comparações; <strong className="font-medium text-carvao">Auditar</strong>, regras, versões e arquivos.
                    </p>
                  </>,
                  <>
                    <p>
                      When the source did not publish, access was blocked or processing failed, the page says what is missing and why, instead of showing zero or an estimate. In tables, absence
                      appears as &quot;no data&quot;; in CSV files, as an empty field.
                    </p>
                    <p>
                      The module pages offer three depths on the same information: <strong className="font-medium text-carvao">Understand</strong>, the essentials;{" "}
                      <strong className="font-medium text-carvao">Analyze</strong>, series and comparisons; <strong className="font-medium text-carvao">Audit</strong>, rules, versions and files.
                    </p>
                  </>,
                )}
              </Recolhivel>

              <Recolhivel
                // i18n: dado
                titulo="Correções e sugestões"
                tituloEn="Corrections and suggestions"
                dica={tx("Como avisar de um número, uma data ou um texto que não confere com a fonte", "How to report a number, a date or a text that does not match the source")}>
                {tx(
                  <>
                    <p>
                      Encontrou um número, uma data ou um texto que não confere com a fonte? Diga a página e o trecho pela{" "}
                      <Link href="/observatorio/suggestions" className={linkTexto}>
                        página de sugestões
                      </Link>{" "}
                      da plataforma ou ao{" "}
                      <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className={linkTexto}>
                        responsável pela plataforma no LinkedIn
                      </a>
                      .
                    </p>
                    <p>
                      O método completo está na{" "}
                      <Link href="/setor-eletrico/metodologia" className={linkTexto}>
                        Metodologia
                      </Link>
                      .
                    </p>
                  </>,
                  <>
                    <p>
                      Found a number, a date or a text that does not match the source? Tell us the page and the passage through the platform&apos;s{" "}
                      <Link href="/observatorio/suggestions" className={linkTexto}>
                        suggestions page
                      </Link>{" "}
                      or the{" "}
                      <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className={linkTexto}>
                        person responsible for the platform on LinkedIn
                      </a>
                      .
                    </p>
                    <p>
                      The full method is in the{" "}
                      <Link href="/setor-eletrico/metodologia" className={linkTexto}>
                        Methodology
                      </Link>
                      .
                    </p>
                  </>,
                )}
              </Recolhivel>
            </div>
          </div>
        </Secao>

        {/* fontes e atualidade em resumo, com acesso à lista completa */}
        <Secao
          id="aprofundar"
          titulo={tx("Fontes e atualidade", "Sources and timeliness")}
          subtitulo={tx(
            "O último período de cada fonte principal, no calendário da própria fonte. Nada aqui é tempo real: cada fonte publica no seu ritmo.",
            "The latest period of each main source, on the source's own calendar. Nothing here is real time: each source publishes at its own pace.",
          )}
        >
          <FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/setor-eletrico"]} variante="metodo" idioma={idiomaEnergia()} className="mb-8" />
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4" data-resumo-atualidade="">
            {pubFontes && (
              <div>
                <dt className="rotulo text-mineral">{tx("Órgãos e integrações", "Public bodies and integrations")}</dt>
                <dd className="mt-1 text-sm leading-snug text-carvao">
                  {tx(
                    <>
                      {orgaos.length} órgãos, {pubFontes.conjuntos.length} integrações de conjuntos de dados abertos.
                    </>,
                    <>
                      {orgaos.length} public bodies, {pubFontes.conjuntos.length} open dataset integrations.
                    </>,
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt className="rotulo text-mineral">{tx("Fontes principais", "Main sources")}</dt>
              <dd className="mt-1 text-sm leading-snug text-carvao">
                {tx(
                  <>
                    {resumoAtual.total} fontes em {new Set(atualidade.map((l) => l.tema)).size} temas.
                  </>,
                  <>
                    {resumoAtual.total} sources in {new Set(atualidade.map((l) => l.tema)).size} topics.
                  </>,
                )}
              </dd>
            </div>
            <div>
              <dt className="rotulo text-mineral">{tx("Situação pelo calendário da fonte", "Status by the source's calendar")}</dt>
              <dd className="mt-1 text-sm leading-snug text-carvao">
                {resumoAtual.semAvaliacao === resumoAtual.total
                  ? tx("Sem avaliação nesta publicação: o quadro de atualidade das fontes não foi processado.", "Not assessed in this publication: the source timeliness table was not processed.")
                  : tx(
                      `${resumoAtual.emDia} em dia, ${resumoAtual.atrasadas.length} ${resumoAtual.atrasadas.length === 1 ? "atrasada" : "atrasadas"}, ${resumoAtual.semCalendario} sem calendário declarado${resumoAtual.semAvaliacao ? ` e ${resumoAtual.semAvaliacao} sem avaliação` : ""}.`,
                      `${resumoAtual.emDia} up to date, ${resumoAtual.atrasadas.length} late, ${resumoAtual.semCalendario} with no declared schedule${resumoAtual.semAvaliacao ? ` and ${resumoAtual.semAvaliacao} not assessed` : ""}.`,
                    )}
              </dd>
            </div>
            <div>
              <dt className="rotulo text-mineral">{tx("Atrasadas", "Late")}</dt>
              <dd className="mt-1 text-sm leading-snug text-carvao">
                {resumoAtual.atrasadas.length === 0 ? (
                  tx("Nenhuma fonte principal atrasada pelo calendário que declara.", "No main source is late by the calendar it declares.")
                ) : (
                  <ul className="space-y-1">
                    {resumoAtual.atrasadas.map((l) => (
                      <li key={`${l.tema}-${l.rotulo}`}>
                        <Link href={l.href} className={link}>
                          {l.rotulo}
                        </Link>
                        {l.ultimo ? tx(`: último período ${l.ultimo}`, `: latest period ${l.ultimo}`) : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-4 flex flex-wrap gap-x-6 text-sm">
            <Link href="/setor-eletrico/dados" className={link}>
              {tx("Catálogo completo de dados", "Full data catalog")}
            </Link>
            <Link href="/setor-eletrico/dados/saude" className={link}>
              {tx("Saúde das fontes", "Source health")}
            </Link>
            <Link href="/setor-eletrico/dados/reproducao" className={link}>
              {tx("Download e reprodução", "Download and reproduction")}
            </Link>
          </p>
          <div className="mt-2">
            <Recolhivel
              id="dados-dos-numeros"
              titulo={tx("Baixar os dados dos números das perguntas", "Download the data behind the question numbers")}
              dica={tx("Os arquivos CSV de cada número da abertura, os mesmos que a ficha Comprove lista", "The CSV files for each opening number, the same ones the Check this number record lists")}
            >
              {baixaveis.length > 0 ? (
                <ul className="grid gap-x-10 gap-y-4 md:grid-cols-2">
                  {baixaveis.map((b) => (
                    <li key={b.id}>
                      <p className="font-serif text-base leading-snug text-carvao">{b.pergunta}</p>
                      <ul>
                        {b.arquivos.map((a) => (
                          <li key={a.url}>
                            <a href={a.url} download className={link}>
                              {tx<ReactNode>(a.rotulo, comNomesProprios(traduzDaGold(a.rotulo) ?? "", "en") || <TrechoPortugues regiao="inicial-download">{a.rotulo}</TrechoPortugues>)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{tx("Nenhum arquivo listado nesta publicação.", "No files listed in this publication.")}</p>
              )}
              <p>
                {tx("O dicionário das colunas e a reprodução passo a passo estão em", "The column dictionary and the step-by-step reproduction are in")}{" "}
                <Link href="/setor-eletrico/dados/reproducao" className={linkTexto}>
                  {tx("Download e reprodução", "Download and reproduction")}
                </Link>
                .
              </p>
            </Recolhivel>
          </div>
          <div className="mt-2">
            <Recolhivel
              id="atualidade-por-fonte"
              titulo={tx("Atualidade por fonte", "Timeliness by source")}
              dica={tx(`Último período, atualização e situação de cada uma das ${resumoAtual.total} fontes principais`, `Latest period, update frequency and status of each of the ${resumoAtual.total} main sources`)}
            >
              {/* no celular, uma ficha por fonte; a partir de md, a tabela */}
              <ul className="space-y-3 md:hidden">
                {atualidade.map((l) => (
                  <li key={`${l.tema}-${l.rotulo}`} className="border border-linha bg-superficie p-4 text-sm">
                    <p className="rotulo text-mineral">
                      <Link href={l.href} className={linkTexto}>
                        {l.tema}
                      </Link>
                    </p>
                    <p className="mt-1 text-carvao">
                      {l.ficha ? (
                        <Link href={l.ficha} className={linkTexto}>
                          {l.rotulo}
                        </Link>
                      ) : (
                        l.rotulo
                      )}
                    </p>
                    <p className="mt-1 text-carvao-muted">
                      {tx("Último período:", "Latest period:")} <span className="text-carvao">{l.ultimoMes ?? l.ultimo ?? tx("sem período nesta publicação", "no period in this publication")}</span>
                      {l.ultimoMes
                        ? tx(` (${l.ultimoMesRotulo}; o arquivo é anual, e ${l.ultimo} está em curso)`, ` (${l.ultimoMesRotulo}; the file is annual, and ${l.ultimo} is in progress)`)
                        : l.emCurso
                          ? ` (${nomeDoPeriodoEmCurso(l.ultimo)})`
                          : ""}
                      {l.cadencia ? tx(` · atualização ${l.cadencia}`, ` · updated ${l.cadencia === "annual" ? "annually" : l.cadencia}`) : ""}
                    </p>
                    <p className="mt-1 text-carvao-muted">
                      <Situacao l={l} />
                      {baseDaSituacao(l) ? ` ${baseDaSituacao(l)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
              <div
                className="tabela-scroll hidden border border-linha bg-superficie md:block"
                tabIndex={0}
                role="region"
                aria-label={tx("Atualidade das fontes principais (tabela rolável)", "Timeliness of the main sources (scrollable table)")}
              >
                <table className="w-full min-w-[44rem] border-collapse text-sm">
                  <caption className="sr-only">{tx("Fontes principais de cada tema e o último período de referência publicado", "Main sources of each topic and the latest published reference period")}</caption>
                  <thead>
                    <tr className="text-left text-mineral">
                      {tx(["Tema", "Fonte", "Último período de referência", "Atualização da fonte", "Situação"], ["Topic", "Source", "Latest reference period", "Source update frequency", "Status"]).map((c) => (
                        <th key={c} scope="col" className="rotulo border-b border-linha px-3 py-2 font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {atualidade.map((l) => (
                      <tr key={`${l.tema}-${l.rotulo}`} className="border-b border-linha align-top last:border-b-0">
                        <td className="px-3 py-2">
                          <Link href={l.href} className={linkTexto}>
                            {l.tema}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-carvao">
                          {l.ficha ? (
                            <Link href={l.ficha} className={linkTexto}>
                              {l.rotulo}
                            </Link>
                          ) : (
                            l.rotulo
                          )}
                        </td>
                        <td className="px-3 py-2 text-carvao">
                          {l.ultimoMes ?? l.ultimo ?? <span className="text-mineral">{tx("sem período nesta publicação", "no period in this publication")}</span>}
                          {l.ultimoMes ? (
                            <span className="block text-xs text-mineral">
                              {tx(
                                <>
                                  {l.ultimoMesRotulo}; o arquivo é anual, e {l.ultimo} está em curso
                                </>,
                                <>
                                  {l.ultimoMesRotulo}; the file is annual, and {l.ultimo} is in progress
                                </>,
                              )}
                            </span>
                          ) : (
                            l.emCurso && <span className="block text-xs text-mineral">{nomeDoPeriodoEmCurso(l.ultimo)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-carvao-muted">{l.cadencia ?? tx("não declarada", "not declared")}</td>
                        <td className={`px-3 py-2 ${l.atrasado ? "text-carvao" : "text-carvao-muted"}`}>
                          <Situacao l={l} />
                          {baseDaSituacao(l) && <span className="block text-xs text-mineral">{baseDaSituacao(l)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="max-w-prose2" data-nota-atualidade="regra">
                {tx(
                  <>
                    <strong className="font-medium text-carvao">Como a situação é medida.</strong> Quando a fonte publica uma série por período (dia, semana, mês), compara-se o fim do último período com o calendário que
                    ela declara, mais uma tolerância. Quando publica um arquivo anual, um cadastro ou uma vigência e o reescreve no ritmo declarado, compara-se a data em que ela publicou o arquivo. Por isso uma fonte
                    pode estar em dia mesmo quando o último mês com dado ficou para trás
                    {regraAtual.comMesAtras.length > 0 && // i18n: dado
                      `: ${regraAtual.comMesAtras.map((l) => `em ${l.tema}, o arquivo foi publicado em ${l.publicadoEm} e o ${l.ultimoMesRotulo} é ${l.ultimoMes}`).join("; ")}`}
                    .{regraAtual.tolerancias.length > 0 && // i18n: dado
                      ` Tolerância depois do prazo, por atualização: ${regraAtual.tolerancias.map((x) => `${x.cadencia}, ${x.dias} dias`).join("; ")}.`}
                  </>,
                  <>
                    <strong className="font-medium text-carvao">How the status is measured.</strong> When the source publishes a series by period (day, week, month), the end of the latest period is compared with the
                    calendar it declares, plus a tolerance. When it publishes an annual file, a registry or a validity period and rewrites it at the declared pace, the date on which it published the file is compared.
                    That is why a source can be up to date even when the latest month with data is behind
                    {regraAtual.comMesAtras.length > 0 &&
                      `: ${regraAtual.comMesAtras.map((l) => `in ${l.tema}, the file was published on ${l.publicadoEm} and the ${l.ultimoMesRotulo} is ${l.ultimoMes}`).join("; ")}`}
                    .{regraAtual.tolerancias.length > 0 && ` Tolerance after the deadline, by update frequency: ${regraAtual.tolerancias.map((x) => `${x.cadencia}, ${x.dias} ${x.dias === 1 ? "day" : "days"}`).join("; ")}.`}
                  </>,
                )}
              </p>
              {orgaosDaTabela.length > 0 && (
                <p className="max-w-prose2 text-xs" data-orgaos="">
                  <span className="font-medium text-carvao-muted">{tx("Órgãos: ", "Public bodies: ")}</span>
                  {tx(legendaDeSiglas(orgaosDaTabela), legendaDeOrgaosEn(orgaosDaTabela))}.
                </p>
              )}
              {atualidade.some((l) => l.codigoSituacao === "SEM SLA") && (
                <p className="max-w-prose2" data-nota-atualidade="sem-calendario">
                  {tx(
                    "Sem calendário declarado: a fonte não informa de quanto em quanto tempo atualiza, e por isso o observatório não diz se está em dia ou atrasada; mostra só o último período que ela publicou.",
                    "No declared schedule: the source does not say how often it updates, so the observatory does not say whether it is up to date or late; it shows only the latest period it published.",
                  )}
                </p>
              )}
              {atualidade.some((l) => l.vigencia) && (
                <p className="max-w-prose2" data-nota-atualidade="vigencia">
                  {tx(
                    "Nas tarifas, a fonte publica vigências (a data em que cada tarifa passa a valer), e não um período de referência: o que aparece é o início da vigência mais recente. A situação vem da frequência de atualização que a fonte declara.",
                    "For tariffs, the source publishes validity periods (the date on which each tariff takes effect), not a reference period: what appears is the start of the most recent validity period. The status comes from the update frequency the source declares.",
                  )}
                </p>
              )}
              <p className="max-w-prose2">
                {tx(
                  <>
                    {dataPublicacao ? `Situação avaliada na publicação de ${dataBR(dataPublicacao)}, pela frequência que a própria fonte declara. ` : ""}A data de captura de cada arquivo fica na ficha do conjunto, em{" "}
                    <Link href="/setor-eletrico/dados" className={linkTexto}>
                      Dados
                    </Link>
                    : ela registra quando a plataforma baixou o arquivo e nunca é apresentada como data do dado.
                  </>,
                  <>
                    {dataPublicacao ? `Status assessed in the publication of ${dataBR(dataPublicacao)}, by the frequency the source itself declares. ` : ""}The capture date of each file is in the dataset record, in{" "}
                    <Link href="/setor-eletrico/dados" className={linkTexto}>
                      Data
                    </Link>
                    : it records when the platform downloaded the file and is never presented as the date of the data.
                  </>,
                )}
              </p>

            </Recolhivel>
          </div>
        </Secao>
      </main>
    </>
  );
}

