import type { Metadata } from "next";
import Link from "@/components/energia/LinkSemPrefetch";
import type { ReactNode } from "react";
import { BuscaObservatorio } from "@/components/energia/BuscaObservatorio";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { DetalheDoNivel } from "@/components/energia/DetalheDoNivel";
import { EscolhaDistribuidora } from "@/components/energia/EscolhaDistribuidora";
import { LegendaDeSiglas } from "@/components/energia/LegendaSiglas";
import { MapaConceitual } from "@/components/energia/MapaConceitual";
import { RedirecionaAncoraAntiga } from "@/components/energia/RedirecionaAncoraAntiga";
import { NATUREZAS, SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { conjuntoLegivel, descreverVariacao, valorDestaque } from "@/lib/energia/evidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { LINKEDIN_URL } from "@/lib/contato";
import { CONCEITOS, conceito } from "@/lib/energia/conteudo/conceitos";
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
  universoPerdas,
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

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: { absolute: "Observatório Brasileiro do Setor Elétrico · Scrutiniums" },
  description:
    "Entenda a energia que move o Brasil: como água, geração, rede, consumo, preço, contratos e tarifa se ligam, a pergunta que cada página responde, trilhas por interesse, como conferir cada número e a data de cada fonte.",
  alternates: { canonical: "/setor-eletrico" },
};

const ORDEM_NATUREZAS: Natureza[] = ["OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO"];

const link = "inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";
const linkTexto = "text-energia-dark underline underline-offset-4 hover:text-carvao";

/** Nomes e réguas que parecem iguais e não são; cada item usa só o que está conferido nos verbetes e nas unidades. */
const NOMES_E_REGUAS: [string, ReactNode][] = [
  [
    "PLD e tarifa",
    <>
      O <Termo slug="pld">PLD</Termo> é o preço das diferenças liquidadas no mercado de curto prazo. A conta de quem é atendido pela distribuidora segue a{" "}
      <Termo slug="tarifa-te-tusd">TE e a TUSD</Termo>, homologadas pela ANEEL.
    </>,
  ],
  [
    "CMO e PLD",
    <>
      O <Termo slug="cmo">CMO</Termo> é o custo marginal publicado pelo ONS; o PLD é calculado pela CCEE com base no CMO, dentro de limites. Não são o mesmo número.
    </>,
  ],
  [
    "Subsistema e submercado",
    <>
      O ONS publica por subsistema; a CCEE calcula o PLD por <Termo slug="submercado">submercado</Termo>. Os conjuntos usados aqui identificam as regiões pelos mesmos códigos (N, NE, S e SE).
    </>,
  ],
  [
    "% da EAR máxima e % da MLT",
    <>
      A <Termo slug="ear">EAR</Termo> aparece em percentual da capacidade de armazenamento; a <Termo slug="ena">ENA</Termo>, em percentual da média de longo termo. As réguas são diferentes e os
      percentuais não se comparam entre si.
    </>,
  ],
  [
    "MWmed, MWh e MW",
    <>
      <Unidade u="MWmed" /> é energia de um período dividida pelas horas do período; MWh é energia; MW é potência, a capacidade num instante. Capacidade instalada não é energia gerada.
    </>,
  ],
];

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
function Recolhivel({ id, titulo, dica, children }: { id?: string; titulo: string; dica?: string; children: ReactNode }) {
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
      <p className="rotulo text-mineral">Ligações</p>
      <ul className={celular ? "mt-1 space-y-1.5" : "space-y-2"}>
        {saem.map((l) => (
          <li key={`s-${l.para}`}>
            <span className="text-carvao">
              Para {porId.get(l.para)!.titulo.toLowerCase()} · {TIPOS_LIGACAO[l.tipo].rotulo.toLowerCase()}:
            </span>{" "}
            {l.texto}
          </li>
        ))}
        {chegam.map((l) => (
          <li key={`c-${l.de}`}>
            <span className="text-carvao">
              De {porId.get(l.de)!.titulo.toLowerCase()} · {TIPOS_LIGACAO[l.tipo].rotulo.toLowerCase()}:
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
        <p className="rotulo text-mineral">Onde explorar</p>
        <ul className="flex flex-wrap gap-x-4">
          {destinos.map((d) => (
            <li key={d.slug}>
              <Link href={d.href} className={celular ? `${linkTexto} inline-flex min-h-[32px] items-center` : link}>
                {d.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="rotulo text-mineral">Conceitos</p>
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
            <h4 id={`mapa-faixa-${f}`} className="rotulo text-mineral">
              {FAIXAS_MAPA[f].rotulo}
            </h4>
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
                        Liga-se a{" "}
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
                        <span className="sr-only"> para {proximo.titulo.toLowerCase()}</span>
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

/** Cartão de um destino, no bloco recolhível depois do índice: para que serve, o que se encontra e o recorte. */
function CartaoDestino({ d }: { d: DestinoNavegacao }) {
  const c = CARTOES[d.slug];
  if (!c) return null;
  return (
    <article className="flex flex-col border border-linha bg-superficie p-5">
      <h5 className="font-serif text-lg leading-snug text-carvao">{d.rotulo}</h5>
      <p className="mt-2 font-medium leading-snug text-carvao">{d.pergunta}</p>
      <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
        <span className="text-carvao">Para que serve:</span> {c.utilidade}
      </p>
      {d.integrado ? (
        <div className="mt-3">
          <p className="rotulo text-mineral">O que você encontra</p>
          <ul className="mt-1 space-y-1 text-sm">
            {c.encontra.map((e) => (
              <li key={e.texto}>
                <Link href={e.href} className={linkTexto}>
                  {e.texto}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-carvao-muted">
          <span className="rotulo mr-1 text-mineral">Em integração</span> A página mostra o escopo, as perguntas e as fontes catalogadas, ainda sem números publicados.
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-mineral">Recorte: {c.recorte}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-5 pt-3">
        <Link href={d.href} className={`rotulo ${link}`}>
          Explorar <span className="sr-only">{d.rotulo}</span>
          <span aria-hidden="true" className="ml-1.5">
            →
          </span>
        </Link>
        {c.conceito && (
          <span className="text-sm text-carvao">
            <Termo slug={c.conceito.slug} alvo>
              {c.conceito.rotulo}
            </Termo>
          </span>
        )}
      </div>
    </article>
  );
}

/** Item do índice: o nome da página, a pergunta que ela responde e, quando não publica números, o estado dela (lido de navegacao.ts). */
function ItemDoIndice({ d }: { d: DestinoNavegacao }) {
  const estado = estadoDoDestino(d);
  const corpo = (
    <>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className={estado === "preparacao" ? "text-base text-carvao" : "text-base text-energia-dark underline underline-offset-4 group-hover:text-carvao"}>{d.rotulo}</span>
        {estado === "integracao" && (
          <span className="rotulo text-mineral">
            Em integração<span className="sr-only">: a página mostra o escopo e as fontes catalogadas, sem números publicados</span>
          </span>
        )}
        {estado === "preparacao" && (
          <span className="rotulo text-mineral">
            Em preparação<span className="sr-only">: ainda sem página</span>
          </span>
        )}
      </span>
      <span className="mt-0.5 block text-sm leading-snug text-carvao-muted">{d.pergunta}</span>
    </>
  );
  if (estado === "preparacao") return <div className="py-2">{corpo}</div>;
  return (
    <Link href={d.href} className="group block py-2">
      {corpo}
    </Link>
  );
}

/** Leitura de uma variação com glifo e palavra (a cor nunca é o único sinal), no estilo da faixa de métricas. */
function Variacao({ v }: { v: NonNullable<SinalDisponivel["variacao"]> }) {
  const d = descreverVariacao(v);
  return (
    <p className="col-span-2 mt-1 text-xs tabular-nums text-carvao-muted sm:col-auto sm:mt-1.5">
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
  const texto = l.situacao ?? "sem avaliação";
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
      <span aria-hidden="true">{l.situacao === "em dia" ? "●" : "○"}</span>
      {texto}
    </span>
  );
}

/** O que a situação comparou com o calendário da fonte, em palavras; null quando a publicação não diz. */
function baseDaSituacao(l: LinhaAtualidade): string | null {
  if (l.base === "publicacao") return `pela publicação do arquivo${l.publicadoEm ? `, em ${l.publicadoEm}` : ""}`;
  if (l.base === "periodo") return "pelo último período";
  return null;
}

/** Ficha "Comprove este número" no tamanho da faixa de métricas: texto de 12 px sem caixa alta, 32 px de altura (44 px no toque). */
const COMPROVE_COMPACTO =
  "[&_[data-comprove]]:min-h-[2rem] [&_[data-comprove]]:text-xs [&_[data-comprove]]:normal-case [&_[data-comprove]]:tracking-normal [@media(pointer:coarse)]:[&_[data-comprove]]:min-h-[2.75rem]";

/**
 * A medida de abertura de uma pergunta: o que se mede, o valor, o período, o selo de natureza, a ficha de prova, a variação, a referência, o
 * universo e a ressalva. No celular a medida é uma linha de lista (rótulo e contexto à esquerda, valor e unidade à direita), como na faixa de
 * métricas das aberturas; a partir de 640 px o valor vem abaixo do rótulo.
 */
function MedidaDisponivel({ s }: { s: SinalDisponivel }) {
  return (
    <>
      <div
        role="group"
        aria-label={s.medida}
        data-medida={s.id}
        className={`mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 sm:block ${COMPROVE_COMPACTO}`}
      >
        <p className="text-[0.8125rem] leading-snug text-carvao-muted sm:mb-1.5 lg:min-h-[2.25rem]">{s.medida}</p>
        <p className="col-start-2 row-span-2 row-start-1 text-right font-serif text-[1.75rem] leading-none tabular-nums text-carvao sm:text-left sm:text-[2.25rem]">
          {s.valorTexto}
          <span className="block pt-1 font-sans text-xs leading-tight text-carvao-muted sm:ml-1.5 sm:inline sm:pt-0 sm:!text-sm">{s.unidade}</span>
        </p>
        <div className="col-start-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-snug text-carvao-muted sm:mt-1.5">
          <span>{s.periodo}</span>
          <SeloNatureza natureza={s.natureza} texto />
          {s.evidencia ? <ComproveNumero evidencia={s.evidencia} endereco={s.endereco} /> : s.prova && <ComproveNumero sobDemanda={s.prova} endereco={s.endereco} />}
        </div>
        {s.variacao && <Variacao v={s.variacao} />}
      </div>
      {s.referencias.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm leading-snug text-carvao">
          {s.referencias.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs leading-relaxed text-carvao-muted">{s.universo}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-carvao-muted">{s.ressalva}</p>
    </>
  );
}

/** Ausência é um estado, com o motivo: hachura e "sem dado" (ou "indisponível nesta publicação"), nunca um zero. */
function MedidaAusente({ s }: { s: SinalAusente }) {
  return (
    <div role="group" aria-label={s.medida} data-medida={s.id} className="mt-3">
      <p className="text-[0.8125rem] leading-snug text-carvao-muted lg:min-h-[2.25rem]">{s.medida}</p>
      <p className="mt-1.5 inline-flex items-center gap-2 font-serif text-xl leading-none text-carvao-muted">
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 border border-mineral"
          style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, transparent 1px 4px)" }}
        />
        {s.estado === "indisponivel" ? "indisponível nesta publicação" : "sem dado"}
      </p>
      {s.periodo && <p className="mt-1.5 text-xs text-carvao-muted">{s.periodo}</p>}
      <p className="mt-2 text-xs leading-relaxed text-carvao-muted">{s.motivo}</p>
    </div>
  );
}

type EscolhasDistribuidora = ReturnType<typeof escolhasDeDistribuidora>;

/** Uma das seis perguntas: a pergunta, a medida de abertura e o caminho para a página que aprofunda (com "sua distribuidora" em perdas e qualidade). */
function BlocoPergunta({ p, sinal, escolhas }: { p: PerguntaPrioritaria; sinal: SinalHome; escolhas: EscolhasDistribuidora }) {
  const c = CARTOES[p.slug]?.conceito;
  const comEscolha =
    p.porDistribuidora === "perdas" ? escolhas.opcoesPerdas.length > 0 : p.porDistribuidora === "qualidade" ? escolhas.opcoesQualidade.length > 0 : false;
  const termo = c && (
    <span className="text-sm text-carvao">
      <Termo slug={c.slug} alvo>
        {c.rotulo}
      </Termo>
    </span>
  );
  return (
    <article aria-labelledby={`pergunta-${p.id}`} className="min-w-0 border-t border-linha pb-2 pt-4" data-sinal={p.id} data-estado={sinal.estado}>
      <h3 id={`pergunta-${p.id}`} className="ed-h3 font-serif text-carvao lg:min-h-[2.5rem]">
        {p.pergunta}
      </h3>
      {sinal.estado === "disponivel" ? <MedidaDisponivel s={sinal} /> : <MedidaAusente s={sinal} />}
      {comEscolha ? (
        <>
          {p.porDistribuidora === "perdas" ? (
            <EscolhaDistribuidora opcoes={escolhas.opcoesPerdas} destino="/setor-eletrico/perdas" parametro="d" ancora="painel-mapa" rotulo="Ver em Perdas" ano={escolhas.anoPerdas} assunto="Perdas" />
          ) : (
            <EscolhaDistribuidora opcoes={escolhas.opcoesQualidade} destino="/setor-eletrico/qualidade" parametro="dist" ancora="p051" rotulo="Ver em Qualidade" ano={escolhas.anoQualidade} assunto="Qualidade" />
          )}
          <p>{termo}</p>
        </>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-x-6">
          <Link href={p.link.href} className={`rotulo ${link}`}>
            {p.link.rotulo}
            <span aria-hidden="true" className="ml-1.5">
              →
            </span>
          </Link>
          {termo}
        </div>
      )}
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
    CONCEITOS,
    distribuidoras.map((d) => ({ slug: d.slug, sigla: d.sigla, nome: d.nome, cnpj: d.cnpj, ufs: d.ufs })),
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
      ? `As ${todos.length} páginas publicam números.`
      : [
          emIntegracao.length ? `${listaPorExtenso(emIntegracao)} ${emIntegracao.length === 1 ? "está" : "estão"} em integração: ${emIntegracao.length === 1 ? "mostra" : "mostram"} o escopo e as fontes catalogadas, sem números.` : "",
          emPreparacao.length ? `${listaPorExtenso(emPreparacao)} ${emPreparacao.length === 1 ? "está" : "estão"} em preparação, sem página.` : "",
        ]
          .filter(Boolean)
          .join(" ");
  const destinosComCartao = (ds: DestinoNavegacao[]) => ds.filter((d) => d.publicado && d.slug !== "mapa" && CARTOES[d.slug]);

  return (
    <>
      <CabecalhoEnergia atual="mapa" />
      <MarcaVisita secao="energia:mapa" />
      <RedirecionaAncoraAntiga ancoras={ANCORAS_VISAO_GERAL} destino="/setor-eletrico/visao-geral" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina pb-12">
        {/* hero: a proposta, a busca e os quatro caminhos, tudo na primeira tela */}
        <header id="proposito" className="scroll-mt-24 pb-8 pt-6 md:pb-10 md:pt-10">
          <div className="grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className="rotulo text-mineral">Observatório Brasileiro do Setor Elétrico</p>
              <h1 className="ed-h1 mt-2 max-w-4xl font-serif text-carvao">Energia, do sistema à sua conta</h1>
              <p className="ed-lead mt-3 max-w-3xl text-carvao-muted">Entenda o setor elétrico, compare regiões e confira cada número em dados públicos, com a fonte, o período e o método à vista.</p>
              <div className="ed-meta mt-1 items-center text-xs text-carvao-muted" data-recorte="">
                <span>Cada número informa o próprio período e universo</span>
                {orgaos.length > 0 && (
                  <span>
                    Fonte: {orgaos.length} órgãos, entre eles {listaEmPortugues(orgaos.slice(0, 3).map((o) => (SIGLAS[o] ? `${SIGLAS[o]} (${o})` : o)))}
                  </span>
                )}
                <DetalheDoNivel resumo="Fontes, datas e siglas" abreEm="nunca" className="[&[open]]:basis-full">
                  <div className="max-w-prose2 space-y-3 pb-2 pt-1 text-sm leading-relaxed text-carvao-muted">
                    {pubFontes && (
                      <p className="text-xs text-mineral">
                        <span className="font-medium text-carvao-muted">Fontes e datas de referência: </span>
                        {listaEmPortugues(orgaos)}; catálogo publicado em {carimbo(pubFontes.gerado_em)}. Cada painel mostra a data de referência dos próprios dados.
                      </p>
                    )}
                    <p>
                      O observatório liga a operação do sistema elétrico, os preços, as empresas e o que chega à vida das pessoas, com dados públicos que você pode conferir número a número: de que
                      fonte vem, a que período se refere e como foi calculado. A atualidade de cada fonte está em{" "}
                      <a href="#aprofundar" className={linkTexto}>
                        Fontes e atualidade
                      </a>
                      .
                    </p>
                    <LegendaDeSiglas siglas={["SIN", "PLD", "DEC", "EAR"]} />
                  </div>
                </DetalheDoNivel>
              </div>
              <div className="mt-6">
                <BuscaObservatorio
                  itens={busca}
                  exemplos={["preço da luz", "falta de energia", "reservatórios", "Tarifa Social"]}
                  regiao={{ href: destino("territorio").href, rotulo: destino("territorio").rotulo }}
                />
              </div>
            </div>
            <nav aria-label="Por onde começar" className="min-w-0 lg:border-l lg:border-linha lg:pl-8">
              <p className="rotulo text-mineral">Por onde começar</p>
              <ol className="mt-1 divide-y divide-linha">
                {CAMINHOS_INTENCAO.map((c) => {
                  const [principal, ...apoio] = c.slugs.map(destino);
                  return (
                    <li key={c.id} className="py-3" data-caminho={c.id}>
                      <Link href={principal.href} className="inline-flex min-h-[44px] items-center gap-2 font-serif text-lg leading-snug text-energia-dark underline underline-offset-4 hover:text-carvao">
                        {c.titulo}
                        <span aria-hidden="true">→</span>
                      </Link>
                      <p className="text-sm leading-snug text-carvao-muted">{c.descricao}</p>
                      {apoio.length > 0 && (
                        <p className="mt-1 text-sm text-carvao-muted">
                          Como se calcula:{" "}
                          {apoio.map((d, i) => (
                            <span key={d.slug}>
                              {i > 0 && ", "}
                              <Link href={d.href} className={linkTexto}>
                                {d.rotulo}
                              </Link>
                            </span>
                          ))}
                          .
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p className="border-t border-linha pt-1">
                <a href="#destinos" className={link}>
                  Ver todas as páginas, por tema
                  <span aria-hidden="true" className="ml-1.5">
                    ↓
                  </span>
                </a>
              </p>
            </nav>
          </div>
        </header>

        {/* as seis perguntas, cada uma com a medida real, o período, a referência e o link */}
        <Secao
          id="perguntas"
          titulo="Seis perguntas para começar"
          subtitulo="Cada resposta abre com uma medida, o período e a referência; a página de destino traz o resto. Nas perguntas sobre a sua distribuidora, escolha-a e a página abre com ela selecionada."
        >
          <section aria-label="Seis perguntas, cada uma com a medida de abertura, o período e a referência" className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3" data-seis-perguntas="">
            {PERGUNTAS_PRIORITARIAS.map((p) => (
              <BlocoPergunta key={p.id} p={p} sinal={sinais.find((s) => s.id === p.id)!} escolhas={escolhas} />
            ))}
          </section>
          <div className="mt-6">
            <Recolhivel id="mais-perguntas" titulo="Outras perguntas do dia a dia" dica="Nove perguntas comuns e a página que responde a cada uma">
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

        {/* índice completo, agrupado nos seis grupos de navegação */}
        <Secao id="destinos" titulo="Todas as páginas, por tema" subtitulo={`Seis grupos e a pergunta que cada página responde. ${estadoDoIndice}`}>
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
            {GRUPOS_NAVEGACAO.map((g) => {
              const ds = destinosDoIndice(g.destinos);
              if (!ds.length) return null;
              return (
                <div key={g.id}>
                  <h3 className="ed-h3 border-b border-linha pb-2 font-serif text-carvao">{g.rotulo}</h3>
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
          <div className="mt-6">
            <Recolhivel id="detalhe-das-paginas" titulo="Detalhe de cada página" dica="Para que serve, o que se encontra nela, o recorte e o conceito principal">
              <div className="space-y-8 pt-2">
                {GRUPOS_NAVEGACAO.map((g) => {
                  const ds = destinosComCartao(g.destinos);
                  if (!ds.length) return null;
                  return (
                    <div key={g.id}>
                      <h4 className="font-serif text-xl text-carvao">{g.rotulo}</h4>
                      <p className="mt-1 text-sm text-carvao-muted">{g.resumo}</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {ds.map((d) => (
                          <CartaoDestino key={d.slug} d={d} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Recolhivel>
          </div>
        </Secao>

        {/* mapa conceitual: o desenho a partir de md, a versão em texto no celular (e para o leitor de tela no desktop) */}
        <Secao
          id="mapa-conceitual"
          titulo="Como as partes do setor elétrico se ligam"
          subtitulo={
            <>
              Sete elos, da água à vida das pessoas, em quatro faixas: o caminho físico, a coordenação da operação, as relações econômicas e a experiência das pessoas.{" "}
              {/* o desenho e os botões só existem a partir de md: no celular a instrução é outra */}
              <span className="hidden md:inline">
                Escolha um elo para ver o que ele é, onde explorá-lo e com que tipo de ligação ele se conecta aos outros. A forma do traço diz o tipo da ligação.
              </span>
              <span className="md:hidden">Leia os sete elos abaixo, de cima para baixo; toque em um elo para ver o que ele é, onde explorá-lo e como se liga aos outros.</span>
            </>
          }
        >
          <div className="hidden md:block">
            <MapaConceitual
              rotulo="Mapa conceitual do setor elétrico: escolha um elo para ver a explicação e as ligações"
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
              Tipos de ligação: <TiposDeLigacao />
            </p>
            <MapaVertical />
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="border-l-2 border-energia pl-4 text-sm leading-relaxed text-carvao-muted">
              <p className="rotulo text-mineral">O que o mapa não diz</p>
              <ul className="mt-2 space-y-1.5">
                {O_QUE_O_MAPA_NAO_DIZ.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="rotulo text-mineral">Atravessam todos os elos</p>
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
        </Secao>

        {/* trilhas de leitura: a sequência de paradas à vista, o que se aprende em cada uma recolhido */}
        <Secao id="trilhas" titulo="Trilhas de leitura" subtitulo="Percursos curtos, em ordem, que ligam os temas. O tempo de leitura é uma estimativa editorial, não uma medida de uso.">
          <div className="grid gap-x-8 gap-y-8 md:grid-cols-2 xl:grid-cols-4">
            {TRILHAS.map((t) => (
              <section key={t.id} aria-labelledby={`trilha-${t.id}`} className="flex min-w-0 flex-col border-t border-linha pt-4">
                <h3 id={`trilha-${t.id}`} className="ed-h3 font-serif text-carvao">
                  {t.perfil}
                </h3>
                <p className="mt-1 text-sm leading-snug text-carvao-muted">{t.para}</p>
                <p className="mt-1 text-xs text-mineral">Leitura estimada: cerca de {t.minutos} min (estimativa editorial).</p>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm marker:text-mineral">
                  {t.paradas.map((s) => (
                    <li key={`${t.id}-${s.href}-${s.rotulo}`}>
                      <Link href={s.href} className={`${linkTexto} inline-flex min-h-[28px] items-center`}>
                        {s.rotulo}
                      </Link>
                    </li>
                  ))}
                </ol>
                <details className="group mt-2 text-sm">
                  <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-energia-dark underline underline-offset-4 hover:text-carvao">O que se aprende em cada parada</summary>
                  <ol className="list-decimal space-y-2 pb-1 pl-5 text-carvao-muted marker:text-mineral">
                    {t.paradas.map((s) => (
                      <li key={`${t.id}-${s.href}-${s.rotulo}-aprende`}>
                        <span className="text-carvao">{s.rotulo}:</span> você aprende {s.aprende}
                      </li>
                    ))}
                  </ol>
                </details>
              </section>
            ))}
          </div>
        </Secao>

        {/* como ler e conferir: blocos recolhíveis de uma linha, com o conteúdo inteiro no HTML */}
        <Secao
          id="como-confiar"
          titulo="Como ler e conferir"
          subtitulo={
            <>
              O que cada selo significa, por que cada número tem várias datas, o que é uma revisão da fonte e como provar um número. O método completo está na{" "}
              <Link href="/setor-eletrico/metodologia" className={linkTexto}>
                Metodologia
              </Link>
              .
            </>
          }
        >
          <div className="grid gap-x-10 lg:grid-cols-2">
            <div className="border-t border-linha">
              <Recolhivel titulo="Cinco naturezas de número" dica="Observado, calculado, estimado, previsto e cenário, cada um com a sua forma">
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
                <p>As naturezas nunca se confundem: um cálculo não aparece como medição, e um cenário não é previsão. O selo muda de forma, não só de cor.</p>
              </Recolhivel>

              <Recolhivel titulo="Um número real, do arquivo à página" dica="Um número publicado, com as suas datas e a ficha de prova">
                {ev ? (
                  <>
                    <p>
                      <span className="font-serif text-2xl text-carvao">{valorDestaque(ev.valor_calculo, "pct", 2)}</span> é a taxa de perdas totais das {entidadeEmFrase(ev.entidade)}, de{" "}
                      {periodoLegivel(ev.periodo.inicio)} a {periodoLegivel(ev.periodo.fim)}: {ev.universo}.
                      {universo && ` Ao todo, ${universo.total} distribuidoras têm dado de ${universo.ano}; este total soma só as ${universo.concessionarias} concessionárias, e as ${universo.permissionarias} permissionárias ficam fora dele.`}
                    </p>
                    {denominador && <p data-denominador="">{descreverDenominador(denominador).completa}</p>}
                    {natEv && (
                      <p className="flex flex-wrap items-center gap-2">
                        <SeloNatureza natureza={natEv} /> <span>calculada pela plataforma a partir de {conjuntoPorExtenso(ev.fonte.conjunto)}, da {ev.fonte.orgao}.</span>
                      </p>
                    )}
                    <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <dt>Período a que o dado se refere</dt>
                      <dd className="text-carvao">
                        {periodoLegivel(ev.periodo.inicio)} a {periodoLegivel(ev.periodo.fim)}
                      </dd>
                      {ev.fonte.publicado_em && (
                        <>
                          <dt>Arquivo publicado pela fonte em</dt>
                          <dd className="text-carvao">{dataBR(ev.fonte.publicado_em.slice(0, 10))}</dd>
                        </>
                      )}
                      {ev.fonte.capturado_em && (
                        <>
                          <dt>Capturado pela plataforma em</dt>
                          <dd className="text-carvao">{dataBR(ev.fonte.capturado_em.slice(0, 10))}</dd>
                        </>
                      )}
                      <dt>Processado em</dt>
                      <dd className="text-carvao">{dataBR(perdas!.gerado_em.slice(0, 10))}</dd>
                    </dl>
                    <div>
                      <p>
                        A ficha mostra a fórmula, o numerador, o denominador com a origem dele, o arquivo original com o seu código de verificação (sha256, que prova que é o mesmo arquivo), os testes e a citação
                        pronta.
                      </p>
                      <ComproveNumero evidencia={evFicha ?? ev} rotulo="Comprove este número" />
                    </div>
                  </>
                ) : (
                  <p className="text-mineral">Exemplo indisponível nesta publicação: a base publicada de Perdas não foi processada.</p>
                )}
              </Recolhivel>

              <Recolhivel titulo="Cada data diz uma coisa" dica="Período de referência, publicação, captura e processamento">
                <p>
                  <strong className="font-medium text-carvao">Período de referência</strong> é o tempo a que o dado se refere. <strong className="font-medium text-carvao">Publicação</strong> é quando a fonte
                  divulgou o arquivo, se ela informa. <strong className="font-medium text-carvao">Captura</strong> é quando a plataforma o baixou.{" "}
                  <strong className="font-medium text-carvao">Processamento</strong> é quando a página foi gerada.
                </p>
                <p>
                  Cada fonte tem o seu calendário: preço e água são diários, perdas e tarifas são mensais ou por vigência, pesquisas são anuais. As páginas mostram a data de cada fonte, e a data de
                  captura nunca substitui a data do dado.
                </p>
              </Recolhivel>

              <Recolhivel titulo="Dados revisados" dica="O que a plataforma faz quando a fonte corrige um número">
                <p>A fonte pode corrigir um número já publicado. A plataforma guarda cada versão capturada, compara as capturas do mesmo arquivo e registra a revisão em vez de sobrescrevê-la em silêncio.</p>
                {revisoes && typeof revisoes.com_revisao === "number" && dataPublicacao && (
                  <p className="text-carvao">
                    Na publicação de {dataBR(dataPublicacao)}, {revisoes.com_revisao} {revisoes.com_revisao === 1 ? "conjunto tinha" : "conjuntos tinham"} valores revisados pela fonte entre capturas.
                  </p>
                )}
                <p>
                  O estado de cada conjunto, com as revisões, está em{" "}
                  <Link href="/setor-eletrico/dados" className={linkTexto}>
                    Dados
                  </Link>
                  .
                </p>
              </Recolhivel>
            </div>

            <div className="lg:border-t lg:border-linha">
              <Recolhivel titulo="Nomes e réguas que se confundem" dica="PLD e tarifa, CMO e PLD, subsistema e submercado, EAR e ENA, MWmed, MWh e MW">
                <dl className="space-y-2">
                  {NOMES_E_REGUAS.map(([t, d]) => (
                    <div key={t}>
                      <dt className="font-medium text-carvao">{t}</dt>
                      <dd>{d}</dd>
                    </div>
                  ))}
                </dl>
              </Recolhivel>

              <Recolhivel titulo="Ausência nunca vira zero" dica="O que a página mostra quando falta dado, e os três níveis de leitura">
                <p>
                  Quando a fonte não publicou, o acesso foi bloqueado ou o processamento falhou, a página diz o que falta e por quê, em vez de mostrar zero ou uma estimativa. Nas tabelas a ausência
                  aparece como &quot;sem dado&quot;; nos arquivos CSV, como campo vazio.
                </p>
                <p>
                  As páginas de módulo trazem três profundidades sobre a mesma informação: <strong className="font-medium text-carvao">Entender</strong>, o essencial;{" "}
                  <strong className="font-medium text-carvao">Analisar</strong>, séries e comparações; <strong className="font-medium text-carvao">Auditar</strong>, regras, versões e arquivos.
                </p>
              </Recolhivel>

              <Recolhivel titulo="Correções e sugestões" dica="Como avisar de um número, uma data ou um texto que não confere com a fonte">
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
              </Recolhivel>
            </div>
          </div>
        </Secao>

        {/* fontes e atualidade em resumo, com acesso à lista completa */}
        <Secao
          id="aprofundar"
          titulo="Fontes e atualidade"
          subtitulo="O último período de cada fonte principal, no calendário da própria fonte. Nada aqui é tempo real: cada fonte publica no seu ritmo."
        >
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4" data-resumo-atualidade="">
            {pubFontes && (
              <div>
                <dt className="rotulo text-mineral">Órgãos e integrações</dt>
                <dd className="mt-1 text-sm leading-snug text-carvao">
                  {orgaos.length} órgãos, {pubFontes.conjuntos.length} integrações de conjuntos de dados abertos.
                </dd>
              </div>
            )}
            <div>
              <dt className="rotulo text-mineral">Fontes principais</dt>
              <dd className="mt-1 text-sm leading-snug text-carvao">{resumoAtual.total} fontes em {new Set(atualidade.map((l) => l.tema)).size} temas.</dd>
            </div>
            <div>
              <dt className="rotulo text-mineral">Situação pelo calendário da fonte</dt>
              <dd className="mt-1 text-sm leading-snug text-carvao">
                {resumoAtual.semAvaliacao === resumoAtual.total
                  ? "Sem avaliação nesta publicação: o quadro de atualidade das fontes não foi processado."
                  : `${resumoAtual.emDia} em dia, ${resumoAtual.atrasadas.length} ${resumoAtual.atrasadas.length === 1 ? "atrasada" : "atrasadas"}, ${resumoAtual.semCalendario} sem calendário declarado${resumoAtual.semAvaliacao ? ` e ${resumoAtual.semAvaliacao} sem avaliação` : ""}.`}
              </dd>
            </div>
            <div>
              <dt className="rotulo text-mineral">Atrasadas</dt>
              <dd className="mt-1 text-sm leading-snug text-carvao">
                {resumoAtual.atrasadas.length === 0 ? (
                  "Nenhuma fonte principal atrasada pelo calendário que declara."
                ) : (
                  <ul className="space-y-1">
                    {resumoAtual.atrasadas.map((l) => (
                      <li key={`${l.tema}-${l.rotulo}`}>
                        <Link href={l.href} className={linkTexto}>
                          {l.rotulo}
                        </Link>
                        {l.ultimo ? `: último período ${l.ultimo}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-4 flex flex-wrap gap-x-6 text-sm">
            <Link href="/setor-eletrico/dados" className={link}>
              Catálogo completo de dados
            </Link>
            <Link href="/setor-eletrico/dados/saude" className={link}>
              Saúde das fontes
            </Link>
            <Link href="/setor-eletrico/dados/reproducao" className={link}>
              Download e reprodução
            </Link>
          </p>
          <div className="mt-2">
            <Recolhivel id="atualidade-por-fonte" titulo="Atualidade por fonte" dica={`Último período, atualização e situação de cada uma das ${resumoAtual.total} fontes principais`}>
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
                      Último período: <span className="text-carvao">{l.ultimoMes ?? l.ultimo ?? "sem período nesta publicação"}</span>
                      {l.ultimoMes ? ` (${l.ultimoMesRotulo}; o arquivo é anual, e ${l.ultimo} está em curso)` : l.emCurso ? ` (${nomeDoPeriodoEmCurso(l.ultimo)})` : ""}
                      {l.cadencia ? ` · atualização ${l.cadencia}` : ""}
                    </p>
                    <p className="mt-1 text-carvao-muted">
                      <Situacao l={l} />
                      {baseDaSituacao(l) ? ` ${baseDaSituacao(l)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="tabela-scroll hidden border border-linha bg-superficie md:block" tabIndex={0} role="region" aria-label="Atualidade das fontes principais (tabela rolável)">
                <table className="w-full min-w-[44rem] border-collapse text-sm">
                  <caption className="sr-only">Fontes principais de cada tema e o último período de referência publicado</caption>
                  <thead>
                    <tr className="text-left text-mineral">
                      {["Tema", "Fonte", "Último período de referência", "Atualização da fonte", "Situação"].map((c) => (
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
                          {l.ultimoMes ?? l.ultimo ?? <span className="text-mineral">sem período nesta publicação</span>}
                          {l.ultimoMes ? (
                            <span className="block text-xs text-mineral">
                              {l.ultimoMesRotulo}; o arquivo é anual, e {l.ultimo} está em curso
                            </span>
                          ) : (
                            l.emCurso && <span className="block text-xs text-mineral">{nomeDoPeriodoEmCurso(l.ultimo)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-carvao-muted">{l.cadencia ?? "não declarada"}</td>
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
                <strong className="font-medium text-carvao">Como a situação é medida.</strong> Quando a fonte publica uma série por período (dia, semana, mês), compara-se o fim do último período com o calendário que
                ela declara, mais uma tolerância. Quando publica um arquivo anual, um cadastro ou uma vigência e o reescreve no ritmo declarado, compara-se a data em que ela publicou o arquivo. Por isso uma fonte
                pode estar em dia mesmo quando o último mês com dado ficou para trás
                {regraAtual.comMesAtras.length > 0 &&
                  `: ${regraAtual.comMesAtras.map((l) => `em ${l.tema}, o arquivo foi publicado em ${l.publicadoEm} e o ${l.ultimoMesRotulo} é ${l.ultimoMes}`).join("; ")}`}
                .{regraAtual.tolerancias.length > 0 && ` Tolerância depois do prazo, por atualização: ${regraAtual.tolerancias.map((x) => `${x.cadencia}, ${x.dias} dias`).join("; ")}.`}
              </p>
              {orgaosDaTabela.length > 0 && (
                <p className="max-w-prose2 text-xs" data-orgaos="">
                  <span className="font-medium text-carvao-muted">Órgãos: </span>
                  {legendaDeSiglas(orgaosDaTabela)}.
                </p>
              )}
              {atualidade.some((l) => l.situacao === "sem calendário declarado") && (
                <p className="max-w-prose2" data-nota-atualidade="sem-calendario">
                  Sem calendário declarado: a fonte não informa de quanto em quanto tempo atualiza, e por isso o observatório não diz se está em dia ou atrasada; mostra só o último período que ela publicou.
                </p>
              )}
              {atualidade.some((l) => l.ultimo?.startsWith("vigência")) && (
                <p className="max-w-prose2" data-nota-atualidade="vigencia">
                  Nas tarifas, a fonte publica vigências (a data em que cada tarifa passa a valer), e não um período de referência: o que aparece é o início da vigência mais recente. A situação vem da frequência de atualização que a fonte declara.
                </p>
              )}
              <p className="max-w-prose2">
                {dataPublicacao ? `Situação avaliada na publicação de ${dataBR(dataPublicacao)}, pela frequência que a própria fonte declara. ` : ""}A data de captura de cada arquivo fica na ficha do conjunto, em{" "}
                <Link href="/setor-eletrico/dados" className={linkTexto}>
                  Dados
                </Link>
                : ela registra quando a plataforma baixou o arquivo e nunca é apresentada como data do dado.
              </p>
            </Recolhivel>
          </div>
        </Secao>
      </main>
    </>
  );
}
