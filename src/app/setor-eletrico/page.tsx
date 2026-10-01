import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BuscaObservatorio } from "@/components/energia/BuscaObservatorio";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { EscolhaDistribuidora } from "@/components/energia/EscolhaDistribuidora";
import { MapaConceitual } from "@/components/energia/MapaConceitual";
import { RedirecionaAncoraAntiga } from "@/components/energia/RedirecionaAncoraAntiga";
import { NATUREZAS, SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { LINKEDIN_URL } from "@/lib/contato";
import { CONCEITOS } from "@/lib/energia/conteudo/conceitos";
import { DATASETS_INTEGRADOS } from "@/lib/energia/datasets";
import { dataBR } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { indiceBusca, linhasAtualidade, opcoesDistribuidora, periodoLegivel, type PublicacaoAtualidade } from "@/lib/energia/home";
import {
  ANCORAS_VISAO_GERAL,
  CARTOES,
  LIGACOES,
  NOS_MAPA,
  O_QUE_O_MAPA_NAO_DIZ,
  PERGUNTAS_COTIDIANAS,
  SECOES_HOME,
  TIPOS_LIGACAO,
  TRANSVERSAIS,
  TRILHAS,
  type NoMapa,
} from "@/lib/energia/mapa";
import { metrica } from "@/lib/energia/metricas";
import { DESTINOS_NAVEGACAO, GRUPOS_NAVEGACAO, destino, type DestinoNavegacao } from "@/lib/energia/navegacao";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import type { Natureza } from "@/lib/energia/tipos";

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

function Secao({ id, letra, rotulo, titulo, subtitulo, children }: { id: string; letra: string; rotulo: string; titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-linha py-12 md:py-16">
      <p className="rotulo flex items-center gap-3 text-mineral">
        <span aria-hidden="true" className="font-serif text-lg normal-case tracking-normal text-energia">
          {letra}
        </span>
        {rotulo}
      </p>
      <h2 id={`${id}-h`} className="mt-2 max-w-3xl font-serif text-2xl leading-snug text-carvao md:text-3xl">
        {titulo}
      </h2>
      <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{subtitulo}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <article className="border border-linha bg-superficie p-6">
      <h3 className="font-serif text-lg leading-snug text-carvao">{titulo}</h3>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-carvao-muted">{children}</div>
    </article>
  );
}

const porId = new Map(NOS_MAPA.map((n) => [n.id, n]));

/** Conteúdo de um elo do mapa: explicação, onde explorar, conceitos e ligações com o tipo de cada uma. */
function DetalheNo({ no }: { no: NoMapa }) {
  const saem = LIGACOES.filter((l) => l.de === no.id);
  const chegam = LIGACOES.filter((l) => l.para === no.id);
  return (
    <>
      <p>{no.explicacao}</p>
      <div>
        <p className="rotulo text-mineral">Onde explorar</p>
        <ul className="flex flex-wrap gap-x-4">
          {no.destinos.map((s) => {
            const d = destino(s);
            return (
              <li key={s}>
                <Link href={d.href} className={link}>
                  {d.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <p className="rotulo text-mineral">Conceitos</p>
        <ul className="flex flex-wrap gap-x-3 text-carvao">
          {no.conceitos.map((c) => (
            <li key={c.slug}>
              <Termo slug={c.slug} alvo>
                {c.rotulo}
              </Termo>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="rotulo text-mineral">Ligações</p>
        <ul className="space-y-2">
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
    </>
  );
}

function MapaEmTexto() {
  return (
    <ol className="space-y-4">
      {NOS_MAPA.map((n, i) => (
        <li key={n.id} className="border border-linha bg-superficie p-5">
          <h3 className="font-serif text-lg leading-snug text-carvao">
            <span className="mr-2 text-mineral">{i + 1}.</span>
            {n.titulo}
          </h3>
          <div className="mt-2 space-y-3 text-sm leading-relaxed text-carvao-muted">
            <DetalheNo no={n} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function CartaoDestino({ d }: { d: DestinoNavegacao }) {
  const c = CARTOES[d.slug];
  if (!c) return null;
  return (
    <article className="flex flex-col border border-linha bg-superficie p-5">
      <h4 className="font-serif text-lg leading-snug text-carvao">{d.rotulo}</h4>
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

export default function MapaDoObservatorio() {
  const perdas = lerGold<PerdasGold>("perdas.json");
  const empresas = lerGold<EmpresasGold>("empresas.json");
  const pub = lerGold<PublicacaoAtualidade & { disponivel?: boolean; resumo?: { com_revisao?: number; observacoes_revisadas?: number; referencias_revisadas?: number } }>("publicacao.json");

  const distribuidoras = integra(empresas) ? empresas.distribuidoras.indice : [];
  const opcoesPerdas = opcoesDistribuidora(distribuidoras, (d) => d.perdas !== null);
  const opcoesQualidade = opcoesDistribuidora(distribuidoras, (d) => d.qualidade !== null);
  const busca = indiceBusca(
    DESTINOS_NAVEGACAO,
    CONCEITOS,
    distribuidoras.map((d) => ({ slug: d.slug, sigla: d.sigla, nome: d.nome, cnpj: d.cnpj, ufs: d.ufs })),
  );
  const fichas = new Set(DATASETS_INTEGRADOS.map((d) => d.slug));
  const atualidade = linhasAtualidade(pub && pub.disponivel !== false ? pub : null, fichas);
  const hojePub = pub?.referencia?.hoje ?? null;

  // exemplo real da seção F: um número publicado, com as suas datas e a ficha de prova
  const ev = integra(perdas) ? perdas.evidencias.taxa_nacional : null;
  const natEv = (metrica("perdas_taxa_total_injetada")?.natureza_transformacao ?? null) as Natureza | null;
  const revisoes = pub?.resumo ?? null;

  const destinosComCartao = (ds: DestinoNavegacao[]) => ds.filter((d) => d.publicado && d.slug !== "mapa" && CARTOES[d.slug]);

  return (
    <>
      <CabecalhoEnergia atual="mapa" />
      <MarcaVisita secao="energia:mapa" />
      <RedirecionaAncoraAntiga ancoras={ANCORAS_VISAO_GERAL} destino="/setor-eletrico/visao-geral" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-4 pb-16 sm:px-6">
        {/* A. propósito em uma tela */}
        <header id="proposito" className="scroll-mt-24 pb-10 pt-10 md:pt-14">
          <p className="rotulo text-mineral">Observatório Brasileiro do Setor Elétrico</p>
          <h1 className="mt-3 max-w-4xl font-serif text-[clamp(2.1rem,5vw,3.4rem)] leading-[1.08] text-carvao">Entenda a energia que move o Brasil</h1>
          <p className="mt-5 max-w-prose2 leading-relaxed text-carvao-muted md:text-lg">
            O observatório liga a operação do sistema elétrico, os preços, as empresas e o que chega à vida das pessoas, com dados públicos que você pode conferir número a
            número: de que fonte vem, a que período se refere e como foi calculado.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a href="#perguntas" className="rotulo inline-flex min-h-[44px] items-center bg-carvao px-6 text-marfim hover:bg-carvao-soft">
              Explorar por pergunta <span aria-hidden="true" className="ml-2">↓</span>
            </a>
            <Link href="/setor-eletrico/visao-geral" className={`rotulo ${link}`}>
              Ver a situação do sistema
            </Link>
          </div>
          <div className="mt-10">
            <BuscaObservatorio itens={busca} exemplos={["perdas", "bandeira", "reservatórios", "Tarifa Social"]} />
          </div>
          <nav aria-label="Nesta página" className="mt-10 border-t border-linha pt-4">
            <p className="rotulo text-mineral">Nesta página</p>
            <ul className="mt-1 flex flex-wrap gap-x-6 text-sm">
              {SECOES_HOME.filter((s) => s.id !== "proposito").map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className={link}>
                    {s.rotulo}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        {/* B. mapa conceitual navegável */}
        <Secao
          id="mapa-conceitual"
          letra="B"
          rotulo="Mapa conceitual"
          titulo="Como as partes do setor elétrico se ligam"
          subtitulo="Sete elos, da água à vida das pessoas. Escolha um elo para ver o que ele é, onde explorá-lo e com que tipo de ligação ele se conecta aos outros. A forma do traço diz o tipo da ligação."
        >
          <div className="hidden md:block">
            <MapaConceitual
              rotulo="Mapa conceitual do setor elétrico: escolha um elo para ver a explicação e as ligações"
              inicial="recursos"
              nos={NOS_MAPA.map((n) => ({ id: n.id, titulo: n.titulo, curto: n.curto, pos: n.pos, detalhe: <DetalheNo no={n} /> }))}
              ligacoes={LIGACOES.map((l) => ({ de: l.de, para: l.para, tipo: l.tipo }))}
              tipos={(Object.keys(TIPOS_LIGACAO) as (keyof typeof TIPOS_LIGACAO)[]).map((id) => ({ id, ...TIPOS_LIGACAO[id] }))}
            />
            <details className="mt-6 border-t border-linha pt-4">
              <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-energia-dark">O mesmo mapa em texto</summary>
              <div className="mt-4">
                <MapaEmTexto />
              </div>
            </details>
          </div>
          <div className="md:hidden">
            <p className="mb-4 text-sm leading-relaxed text-carvao-muted">
              Tipos de ligação:{" "}
              {(Object.keys(TIPOS_LIGACAO) as (keyof typeof TIPOS_LIGACAO)[]).map((t, i, a) => (
                <span key={t}>
                  <strong className="font-medium text-carvao">{TIPOS_LIGACAO[t].rotulo.toLowerCase()}</strong> ({TIPOS_LIGACAO[t].definicao.replace(/\.$/, "")}){i < a.length - 1 ? "; " : "."}
                </span>
              ))}
            </p>
            <MapaEmTexto />
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
              <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                {TRANSVERSAIS.map((t) => (
                  <li key={t.titulo} className="border border-linha bg-superficie p-4 text-sm">
                    <p className="font-serif text-base text-carvao">{t.titulo}</p>
                    <p className="mt-1 leading-relaxed text-carvao-muted">{t.texto}</p>
                    <p className="mt-1 flex flex-wrap gap-x-4">
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

        {/* C. para que serve cada página */}
        <Secao
          id="destinos"
          letra="C"
          rotulo="Destinos"
          titulo="Para que serve cada página"
          subtitulo="Cada página responde a uma pergunta. O cartão diz para que serve a resposta, o que você encontra lá e o recorte disponível."
        >
          <div className="space-y-10">
            {GRUPOS_NAVEGACAO.map((g) => {
              const ds = destinosComCartao(g.destinos);
              if (!ds.length) return null;
              return (
                <div key={g.id}>
                  <h3 className="font-serif text-xl text-carvao">{g.rotulo}</h3>
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
        </Secao>

        {/* D. explore pela sua pergunta */}
        <Secao
          id="perguntas"
          letra="D"
          rotulo="Perguntas"
          titulo="Explore pela sua pergunta"
          subtitulo="Perguntas do dia a dia e a página que responde a cada uma. Nas perguntas sobre a sua distribuidora, escolha-a e a página abre com ela selecionada."
        >
          <ul className="grid gap-4 md:grid-cols-2">
            {PERGUNTAS_COTIDIANAS.map((p) => (
              <li key={p.pergunta} className="border border-linha bg-superficie p-5">
                <p className="font-serif text-lg leading-snug text-carvao">{p.pergunta}</p>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{p.resposta}</p>
                {p.porDistribuidora === "perdas" && opcoesPerdas.length > 0 ? (
                  <EscolhaDistribuidora opcoes={opcoesPerdas} destino="/setor-eletrico/perdas" parametro="d" ancora="painel-mapa" rotulo="Ver em Perdas" />
                ) : p.porDistribuidora === "qualidade" && opcoesQualidade.length > 0 ? (
                  <EscolhaDistribuidora opcoes={opcoesQualidade} destino="/setor-eletrico/qualidade" parametro="dist" ancora="p051" rotulo="Ver em Qualidade" />
                ) : (
                  <p className="mt-2 flex flex-wrap gap-x-5 text-sm">
                    {p.destinos.map((d) => (
                      <Link key={d.href} href={d.href} className={link}>
                        {d.rotulo}
                      </Link>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Secao>

        {/* E. trilhas por interesse */}
        <Secao
          id="trilhas"
          letra="E"
          rotulo="Trilhas"
          titulo="Trilhas por interesse"
          subtitulo="Percursos curtos, em ordem, com o que se aprende em cada parada. O tempo de leitura é uma estimativa editorial, não uma medida de uso."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {TRILHAS.map((t) => (
              <section key={t.id} aria-labelledby={`trilha-${t.id}`} className="border border-linha bg-superficie p-5">
                <h3 id={`trilha-${t.id}`} className="font-serif text-xl text-carvao">
                  {t.perfil}
                </h3>
                <p className="mt-1 text-sm text-carvao-muted">{t.para}</p>
                <p className="mt-1 text-xs text-mineral">Leitura estimada: cerca de {t.minutos} minutos (estimativa editorial).</p>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm marker:text-mineral">
                  {t.paradas.map((s) => (
                    <li key={`${t.id}-${s.href}-${s.rotulo}`}>
                      <Link href={s.href} className={linkTexto}>
                        {s.rotulo}
                      </Link>
                      <span className="block text-carvao-muted">Você aprende {s.aprende}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </Secao>

        {/* F. como confiar e como ler */}
        <Secao
          id="como-confiar"
          letra="F"
          rotulo="Confiança"
          titulo="Como confiar e como ler"
          subtitulo="O que cada selo significa, por que cada número tem várias datas, o que é uma revisão da fonte e como provar um número. Os detalhes técnicos estão na Metodologia."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Cartao titulo="Cinco naturezas de número">
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
            </Cartao>

            <Cartao titulo="Um número real, do arquivo à página">
              {ev ? (
                <>
                  <p>
                    <span className="font-serif text-2xl text-carvao">{ev.valor_exibido}</span> é a taxa de perdas totais das distribuidoras ({ev.entidade.toLowerCase()}) de{" "}
                    {periodoLegivel(ev.periodo.inicio)} a {periodoLegivel(ev.periodo.fim)}, com {ev.universo}.
                  </p>
                  {natEv && (
                    <p className="flex flex-wrap items-center gap-2">
                      <SeloNatureza natureza={natEv} /> <span>calculada pela plataforma a partir de {ev.fonte.conjunto}, da {ev.fonte.orgao}.</span>
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
                  <p>
                    A ficha mostra a fórmula, o numerador, o denominador, o arquivo original com o sha256, os testes e a citação pronta.{" "}
                    <ComproveNumero evidencia={ev} rotulo="Comprove este número" />
                  </p>
                </>
              ) : (
                <p className="text-mineral">Exemplo indisponível nesta publicação: a gold de Perdas não foi processada.</p>
              )}
            </Cartao>

            <Cartao titulo="Cada data diz uma coisa">
              <p>
                <strong className="font-medium text-carvao">Período de referência</strong> é o tempo a que o dado se refere. <strong className="font-medium text-carvao">Publicação</strong> é quando a
                fonte divulgou o arquivo, se ela informa. <strong className="font-medium text-carvao">Captura</strong> é quando a plataforma o baixou.{" "}
                <strong className="font-medium text-carvao">Processamento</strong> é quando a página foi gerada.
              </p>
              <p>
                Cada fonte tem o seu calendário: preço e água são diários, perdas e tarifas são mensais ou por vigência, pesquisas são anuais. As páginas mostram a data de cada fonte, e a data de
                captura nunca substitui a data do dado.
              </p>
            </Cartao>

            <Cartao titulo="Dados revisados">
              <p>
                A fonte pode corrigir um número já publicado. A plataforma guarda cada versão capturada, compara as capturas do mesmo arquivo e registra a revisão em vez de sobrescrevê-la em silêncio.
              </p>
              {revisoes && typeof revisoes.com_revisao === "number" && hojePub && (
                <p className="text-carvao">
                  Na publicação de {dataBR(hojePub)}, {revisoes.com_revisao} {revisoes.com_revisao === 1 ? "conjunto tinha" : "conjuntos tinham"} valores revisados pela fonte entre capturas.
                </p>
              )}
              <p>
                O estado de cada conjunto, com as revisões, está em{" "}
                <Link href="/setor-eletrico/dados" className={linkTexto}>
                  Dados
                </Link>
                .
              </p>
            </Cartao>

            <Cartao titulo="Nomes e réguas que se confundem">
              <dl className="space-y-2">
                {NOMES_E_REGUAS.map(([t, d]) => (
                  <div key={t}>
                    <dt className="font-medium text-carvao">{t}</dt>
                    <dd>{d}</dd>
                  </div>
                ))}
              </dl>
            </Cartao>

            <Cartao titulo="Ausência nunca vira zero">
              <p>
                Quando a fonte não publicou, o acesso foi bloqueado ou o processamento falhou, a página diz o que falta e por quê, em vez de mostrar zero ou uma estimativa. Nas tabelas a ausência
                aparece como &quot;sem dado&quot;; nos arquivos CSV, como campo vazio.
              </p>
              <p>
                As páginas de módulo trazem três profundidades sobre a mesma informação: <strong className="font-medium text-carvao">Entender</strong>, o essencial;{" "}
                <strong className="font-medium text-carvao">Analisar</strong>, séries e comparações; <strong className="font-medium text-carvao">Auditar</strong>, regras, versões e arquivos.
              </p>
            </Cartao>

            <Cartao titulo="Correções e sugestões">
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
            </Cartao>
          </div>
        </Secao>

        {/* G. onde aprofundar e atualidade */}
        <Secao
          id="aprofundar"
          letra="G"
          rotulo="Atualidade"
          titulo="Onde aprofundar e até quando vão os dados"
          subtitulo="O último período disponível de cada fonte principal, no calendário da própria fonte. Nada aqui é tempo real: cada fonte publica no seu ritmo."
        >
          <ul className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: "/setor-eletrico/visao-geral", rotulo: "Visão geral", texto: "O que está acontecendo agora, com a evidência de cada frase." },
              { href: "/setor-eletrico/dados", rotulo: "Catálogo de dados", texto: "Todos os conjuntos, o estado de cada um e os arquivos para baixar." },
              { href: "/setor-eletrico/metodologia", rotulo: "Metodologia", texto: "Naturezas, unidades, linhagem e limitações." },
              { href: "/setor-eletrico/aprenda", rotulo: "Aprenda", texto: "Os conceitos, com a definição da fonte oficial." },
            ].map((x) => (
              <li key={x.href} className="border border-linha bg-superficie p-4 text-sm">
                <Link href={x.href} className={`font-serif text-base ${linkTexto}`}>
                  {x.rotulo}
                </Link>
                <p className="mt-1 leading-relaxed text-carvao-muted">{x.texto}</p>
              </li>
            ))}
          </ul>

          {/* no celular, uma ficha por fonte; a partir de md, a tabela */}
          <ul className="space-y-3 md:hidden">
            {atualidade.map((l) => (
              <li key={`${l.tema}-${l.rotulo}`} className="border border-linha bg-superficie p-4 text-sm">
                <p className="rotulo text-mineral">
                  <Link href={l.href} className={linkTexto}>
                    {l.tema}
                  </Link>
                </p>
                <p className="mt-1 text-carvao">{l.ficha ? <Link href={l.ficha} className={linkTexto}>{l.rotulo}</Link> : l.rotulo}</p>
                <p className="mt-1 text-carvao-muted">
                  Último período: <span className="text-carvao">{l.ultimo ?? "sem período nesta publicação"}</span>
                  {l.emCurso ? " (período em curso)" : ""}
                  {l.cadencia ? ` · atualização ${l.cadencia}` : ""}
                  {l.situacao ? ` · ${l.situacao}` : ""}
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
                    <td className="px-3 py-2 text-carvao">{l.ficha ? <Link href={l.ficha} className={linkTexto}>{l.rotulo}</Link> : l.rotulo}</td>
                    <td className="px-3 py-2 text-carvao">
                      {l.ultimo ?? <span className="text-mineral">sem período nesta publicação</span>}
                      {l.emCurso && <span className="block text-xs text-mineral">período em curso</span>}
                    </td>
                    <td className="px-3 py-2 text-carvao-muted">{l.cadencia ?? "não declarada"}</td>
                    <td className={`px-3 py-2 ${l.atrasado ? "text-carvao" : "text-carvao-muted"}`}>{l.situacao ?? "sem avaliação"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            {hojePub ? `Situação avaliada na publicação de ${dataBR(hojePub)}, pela frequência que a própria fonte declara. ` : ""}A data de captura de cada arquivo fica na ficha do conjunto, em{" "}
            <Link href="/setor-eletrico/dados" className={linkTexto}>
              Dados
            </Link>
            : ela registra quando a plataforma baixou o arquivo e nunca é apresentada como data do dado.
          </p>
        </Secao>
      </main>
    </>
  );
}
