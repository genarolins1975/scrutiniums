import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { RedirecionaAncoraAntiga } from "@/components/energia/RedirecionaAncoraAntiga";
import { Conferido } from "@/components/evidencia/Conferido";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { NATUREZAS, SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { SobreEsteDado } from "@/components/evidencia/SobreEsteDado";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { LINKEDIN_URL } from "@/lib/contato";
import { CONCEITOS } from "@/lib/energia/conteudo/conceitos";
import { DATASETS_INTEGRADOS } from "@/lib/energia/datasets";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { gold, integra } from "@/lib/energia/gold";
import { ANCORAS_VISAO_GERAL, GRUPOS_PERGUNTAS, PAGINAS_MAPA, PASSOS, TRILHAS } from "@/lib/energia/mapa";
import { MODULOS_ENERGIA } from "@/lib/energia/navegacao";
import { datasDeReferencia, linhaDeDatas, type ChaveReferencia } from "@/lib/energia/referencias";
import type { Natureza } from "@/lib/energia/tipos";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: { absolute: "Observatório Brasileiro do Setor Elétrico · Scrutiniums" },
  description:
    "Mapa do Observatório Brasileiro do Setor Elétrico: o sistema da água ao preço em seis passos, a pergunta que cada página responde, trilhas por perfil, como ler selos, fichas de proveniência e modos de profundidade, e a data de cada fonte.",
  alternates: { canonical: "/setor-eletrico" },
};

/** Conjunto integrado → chave de data de referência. */
const CHAVE_DO_CONJUNTO: Record<string, ChaveReferencia> = {
  ccee_pld_horario: "pld",
  ear_subsistema_di: "ear",
  ena_subsistema_di: "ena",
  carga_energia_di: "carga",
  balanco_energia_subsistema_ho: "geracao",
  intercambio_nacional_ho: "intercambio",
  cmo_se: "cmo",
};

/** Nome legível quando o catálogo da fonte traz só o identificador técnico. */
const NOME_LEGIVEL: Record<string, string> = { "ccee-pld-horario": "PLD horário por submercado" };

const ORDEM_NATUREZAS: Natureza[] = ["OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO"];

const PAGINAS_COM_PROFUNDIDADE = ["PLD", "Água e clima", "Geração", "Carga", "Rede"];

const MODOS = [
  { id: "entender", rotulo: "Entender", dica: "O essencial em poucos minutos: a resposta, por que importa e o limite da leitura.", href: "/setor-eletrico/pld" },
  { id: "analisar", rotulo: "Analisar", dica: "Mais séries, períodos e comparações entre regiões e anos.", href: "/setor-eletrico/pld?modo=analisar#hoje" },
  { id: "auditar", rotulo: "Auditar", dica: "Dados, regras, modelos, versões e arquivos, para conferir cada número.", href: "/setor-eletrico/pld?modo=auditar#previsao" },
];

const SEIS_PERGUNTAS: [string, string][] = [
  ["O que estou vendo", "o título diz a pergunta ou a resposta curta a ela; o subtítulo diz o dado, a unidade e o período."],
  ["Por que importa", "o que o número ajuda a entender sobre o sistema."],
  ["O que mudou", "a variação recente, calculada pela regra da página."],
  ["Como interpretar", "como ler o gráfico ou a tabela sem erro."],
  ["O que não é possível concluir", "o limite da leitura, dito na própria página."],
  ["Fonte", "órgão, conjunto e data de referência, com a ficha Sobre este dado."],
];

/** Nomes e réguas que parecem iguais e não são; cada item usa só o que está conferido nos verbetes e nas unidades. */
const NOMES_E_REGUAS: [string, ReactNode][] = [
  [
    "Subsistema e submercado",
    <>
      O ONS publica por <strong className="font-medium text-carvao">subsistema</strong>; a CCEE calcula o PLD por{" "}
      <Termo slug="submercado">submercado</Termo>. Os conjuntos usados aqui identificam as regiões pelos mesmos códigos (N, NE, S e SE), e a
      plataforma chama a última de Sudeste/Centro-Oeste.
    </>,
  ],
  [
    "CMO e PLD",
    <>
      O <Termo slug="cmo">CMO</Termo> é o custo marginal publicado pelo ONS, semanal (modelo DECOMP) e semi-horário (modelo DESSEM). O{" "}
      <Termo slug="pld">PLD</Termo> é o preço que a CCEE calcula para cada hora com base no CMO, dentro dos limites mínimo e máximos vigentes.
      Não são o mesmo número.
    </>,
  ],
  [
    "PLD e tarifa",
    <>O PLD não é a tarifa do consumidor atendido pela distribuidora: essa conta segue a TE e a TUSD, resultantes dos processos tarifários da ANEEL.</>,
  ],
  [
    "MWmed e MWmês",
    <>
      <Unidade u="MWmed" /> é a energia de um período dividida pelas horas do período: carga, geração e intercâmbio vêm nessa unidade.{" "}
      <Unidade u="MWmês" /> é a unidade da energia armazenada (EAR).
    </>,
  ],
  [
    "% da EAR máxima e % da MLT",
    <>
      A <Termo slug="ear">EAR</Termo> aparece em percentual da capacidade máxima de armazenamento; a <Termo slug="ena">ENA</Termo>, em
      percentual da <Termo slug="mlt">média de longo termo</Termo>. As referências são diferentes: os dois percentuais não se comparam entre si.
    </>,
  ],
  [
    "Valor do SIN",
    <>
      Os conjuntos do ONS usados aqui vêm por subsistema. O valor do <Termo slug="sin">SIN</Termo> é calculado pela plataforma a partir dos
      quatro, com a regra declarada no indicador, e por isso leva o selo Calculado.
    </>,
  ],
  [
    "Hora, dia e mês",
    <>O PLD é horário; o PLD médio do dia e o do mês são médias calculadas, com a fórmula na ficha do número. Médias de períodos diferentes não são o mesmo número e não se somam.</>,
  ],
];

const link = "inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";
const linkTexto = "text-energia-dark underline underline-offset-4 hover:text-carvao";

function Secao({ id, numero, rotulo, titulo, subtitulo, children }: { id: string; numero: string; rotulo: string; titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-linha py-12 md:py-16">
      <p className="rotulo flex items-center gap-3 text-mineral">
        <span className="font-serif text-lg normal-case tracking-normal text-energia">{numero}</span>
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

export default function MapaDoObservatorio() {
  const datas = datasDeReferencia();
  const pld = gold.pld();
  const hid = gold.hidrologia();
  const rede = gold.rede();
  const modelos = gold.modelos();
  const cat = gold.catalogo();
  const meta = gold.meta();

  const comDados = MODULOS_ENERGIA.filter((m) => m.integrado && !["mapa", "aprenda", "dados"].includes(m.slug)).length;
  const emIntegracao = MODULOS_ENERGIA.filter((m) => !m.integrado).length;
  const conferidos = CONCEITOS.filter((c) => c.estado === "CONFERIDO");
  const pendentes = CONCEITOS.filter((c) => c.estado === "PENDENTE");
  const nModelos = integra(modelos) ? modelos.modelos.length : null;
  const nProducao = integra(modelos) ? modelos.em_producao.length : null;
  const manuais = cat ? cat.entradas.filter((e) => !e.metadados_verificados).length : 0;

  const linhasFontes = DATASETS_INTEGRADOS.map((d) => {
    const e = cat?.entradas.find((x) => x.id === d.catalogoId);
    const f = meta?.fontes[d.interno];
    const chave = CHAVE_DO_CONJUNTO[d.interno];
    const titulo = NOME_LEGIVEL[d.slug] ? `${NOME_LEGIVEL[d.slug]} (${e?.titulo ?? d.slug})` : (e?.titulo ?? d.slug);
    return {
      d,
      titulo,
      orgao: `${e?.orgao ?? "órgão não informado"}${e?.licenca ? ` · ${e.licenca}` : ""}`,
      referencia: (chave && datas[chave]) ?? "sem dado nesta publicação",
      captura: f?.ultima_captura ? carimbo(f.ultima_captura) : "sem captura",
    };
  });

  return (
    <>
      <CabecalhoEnergia atual="mapa" />
      <MarcaVisita secao="energia:mapa" />
      <RedirecionaAncoraAntiga ancoras={ANCORAS_VISAO_GERAL} destino="/setor-eletrico/visao-geral" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <header className="pb-10 pt-10 md:pt-14">
          <p className="rotulo text-mineral">Observatório Brasileiro do Setor Elétrico · comece por aqui</p>
          <h1 className="mt-3 max-w-4xl font-serif text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.08] text-carvao">Mapa do Observatório</h1>
          <p className="mt-5 max-w-prose2 leading-relaxed text-carvao-muted md:text-lg">
            O sistema elétrico brasileiro, da água nos reservatórios ao preço da energia, em seis passos: o que cada página responde, com que
            fonte e até quando. Comece por aqui e siga pelo passo, pela pergunta ou pela trilha do seu perfil. Os números estão nas páginas;
            este mapa mostra onde está cada um e como lê-lo.
          </p>
          <p className="mt-5 text-sm text-carvao">
            {DATASETS_INTEGRADOS.length} conjuntos de dados integrados, do ONS e da CCEE · {comDados} módulos com dados e {emIntegracao} em
            integração · {conferidos.length} verbetes conferidos na fonte primária · quatro submercados
          </p>
          <p className="mt-2 text-xs text-mineral">
            Cada fonte tem a sua data. Dados: {linhaDeDatas()}
            {meta ? ` · processados em ${carimbo(meta.gerado_em)}` : ""}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/setor-eletrico/visao-geral"
              className="rotulo inline-flex min-h-[44px] items-center bg-carvao px-6 text-marfim hover:bg-carvao-soft"
            >
              O que está acontecendo agora <span aria-hidden="true" className="ml-2">→</span>
            </Link>
            <Link href="/setor-eletrico/pld#o-que-e" className={`rotulo ${link}`}>
              Entender o PLD
            </Link>
            <Link href="/setor-eletrico/aprenda" className={`rotulo ${link}`}>
              Aprender os conceitos
            </Link>
          </div>
          <nav aria-label="Nesta página" className="mt-10 border-t border-linha pt-4">
            <p className="rotulo text-mineral">Nesta página</p>
            <ul className="mt-1 flex flex-wrap gap-x-6 text-sm">
              {[
                ["#passos", "O sistema em seis passos"],
                ["#perguntas", "Por pergunta"],
                ["#trilhas", "Trilhas de leitura"],
                ["#como-ler", "Como ler o Observatório"],
                ["#fontes", "Fontes e atualidade"],
              ].map(([href, rotulo]) => (
                <li key={href}>
                  <a href={href} className={link}>
                    {rotulo}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        {/* 1. o sistema em seis passos */}
        <Secao
          id="passos"
          numero="1"
          rotulo="Mapa"
          titulo="O sistema elétrico em seis passos"
          subtitulo="Cada passo responde a uma pergunta, explica os conceitos que a página usa e leva às páginas que a respondem, com a fonte e a data de referência dos dados."
        >
          <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PASSOS.map((p) => (
              <li key={p.id} id={p.id} className="flex scroll-mt-28 flex-col border border-linha bg-superficie p-5">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-energia font-serif text-lg text-energia-dark">
                    {p.n}
                  </span>
                  <h3 className="font-serif text-lg leading-snug text-carvao">
                    <span className="sr-only">Passo {p.n}: </span>
                    {p.titulo}
                  </h3>
                </div>
                <p className="mt-4 font-medium text-carvao">{p.pergunta}</p>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{p.texto}</p>
                {p.id === "passo-preco" && nModelos !== null && meta && (
                  <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                    {nProducao === 0
                      ? `Em ${dataBR(meta.gerado_em.slice(0, 10))}, nenhum dos ${nModelos} modelos de previsão registrados estava em produção; por isso não há previsão oficial publicada.`
                      : `Em ${dataBR(meta.gerado_em.slice(0, 10))}, ${nProducao} dos ${nModelos} modelos de previsão registrados estavam em produção.`}
                  </p>
                )}
                <p className="mt-4 text-xs text-mineral">Conceitos:</p>
                <ul className="flex flex-wrap gap-x-3 text-sm text-carvao">
                  {p.conceitos.map((c) => (
                    <li key={c.slug}>
                      <Termo slug={c.slug} alvo>
                        {c.rotulo}
                      </Termo>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-mineral">{p.paginas.length > 1 ? "Páginas:" : "Página:"}</p>
                <ul className="flex flex-wrap gap-x-4 text-sm">
                  {p.paginas.map((id) => {
                    const pg = PAGINAS_MAPA[id];
                    return (
                      <li key={id}>
                        <Link href={pg.href} className={link}>
                          {pg.rotulo}
                        </Link>
                        {pg.estado === "integracao" && <span className="text-xs text-mineral"> · em integração</span>}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-auto border-t border-linha pt-3 text-xs text-mineral">
                  {p.fontes.length ? (
                    p.fontes.map((f) => (
                      <p key={f.chave}>
                        {f.rotulo}: {datas[f.chave] ?? "sem dado nesta publicação"}
                      </p>
                    ))
                  ) : (
                    <p>Sem dados integrados; as fontes deste passo estão no catálogo de dados.</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <p className="text-sm leading-relaxed text-carvao-muted">
              Os seis passos são um roteiro de leitura. Os quatro primeiros descrevem a operação do sistema publicada pelo ONS: a água guardada
              e a que chega (1), a geração por fonte (2), a carga (3) e o intercâmbio entre as regiões (4). O quinto trata do custo e do preço de
              curto prazo, publicados pelo ONS e pela CCEE. O sexto reúne o que ainda está em integração.
            </p>
            <div className="border-l-2 border-energia pl-4 text-sm leading-relaxed text-carvao-muted">
              <p className="rotulo text-mineral">O que o mapa não permite concluir</p>
              <p className="mt-1">
                A ordem dos passos é didática: não descreve causa nem sequência física entre as grandezas. Relações que dependem dos modelos
                oficiais aparecem marcadas como conferidas ou pendentes de conferência documental, como no diagrama de formação do preço do PLD,
                ou não são afirmadas.
              </p>
            </div>
          </div>
        </Secao>

        {/* 2. por pergunta */}
        <Secao
          id="perguntas"
          numero="2"
          rotulo="Índice"
          titulo="Por pergunta"
          subtitulo="A pergunta que cada página responde, agrupada por tema. Nas páginas de módulo, a pergunta é o próprio título da página."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {GRUPOS_PERGUNTAS.map((g) => (
              <div key={g.rotulo} className="border border-linha bg-superficie p-5">
                <h3 className="rotulo text-mineral">{g.rotulo}</h3>
                <dl className="mt-2 divide-y divide-linha">
                  {g.paginas.map((id) => {
                    const pg = PAGINAS_MAPA[id];
                    return (
                      <div key={id} className="py-2">
                        <dt className="text-sm text-carvao">{pg.pergunta}</dt>
                        <dd className="text-sm">
                          <Link href={pg.href} className={link}>
                            {pg.rotulo}
                          </Link>
                          {pg.estado === "integracao" && <span className="text-xs text-mineral"> · em integração, sem números</span>}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
          </div>
        </Secao>

        {/* 3. trilhas */}
        <Secao
          id="trilhas"
          numero="3"
          rotulo="Roteiros"
          titulo="Trilhas de leitura"
          subtitulo="Três perfis, cinco a sete paradas cada. Alguns links já abrem a página no modo de profundidade indicado."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {TRILHAS.map((t) => (
              <div key={t.perfil} className="border border-linha bg-superficie p-5">
                <h3 className="font-serif text-lg text-carvao">{t.perfil}</h3>
                <p className="mt-1 text-sm text-carvao-muted">{t.quem}</p>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm marker:text-mineral">
                  {t.passos.map((s, i) => {
                    const pg = PAGINAS_MAPA[s.pagina];
                    return (
                      <li key={`${s.pagina}-${i}`}>
                        <Link href={s.href ?? pg.href} className={link}>
                          {pg.rotulo}
                          {s.nota ? `, ${s.nota}` : ""}
                        </Link>
                        <span className="block text-xs text-mineral">{pg.pergunta}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </Secao>

        {/* 4. como ler */}
        <Secao
          id="como-ler"
          numero="4"
          rotulo="Leitura"
          titulo="Como ler o Observatório"
          subtitulo="Os elementos que se repetem nas páginas, o que cada um significa e um exemplo real de cada."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Cartao titulo="O selo diz a natureza de cada número">
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
                As naturezas nunca se confundem: um número calculado nunca aparece como observado, e cenário nunca é previsão. A forma do selo muda
                com a natureza, não só a cor.
              </p>
            </Cartao>

            <Cartao titulo="Cada painel responde às mesmas seis perguntas">
              <ol className="list-decimal space-y-1 pl-5 marker:text-mineral">
                {SEIS_PERGUNTAS.map(([t, d]) => (
                  <li key={t}>
                    <strong className="font-medium text-carvao">{t}:</strong> {d}
                  </li>
                ))}
              </ol>
              <p>A regra é obrigatória no componente de painel: um painel sem esses campos não é construído.</p>
            </Cartao>

            <Cartao titulo="Sobre este dado: a ficha de cada número">
              <p>
                O botão <span className="text-carvao">ⓘ Sobre este dado</span>, no rodapé de cada painel, abre a ficha do número: natureza, fonte
                primária, unidade, frequência, período de referência, data de publicação pela fonte (quando a fonte a informa de modo confiável),
                data de captura, última validação, cobertura histórica, transformações, fórmula, snapshot e sha256, versão do processamento, revisões
                detectadas, limitações, licença e a descrição da fonte.
              </p>
              <p>
                Um painel que cita números de fontes ou naturezas diferentes traz uma ficha para cada um. O sha256 é a impressão digital de um
                arquivo: qualquer mudança no conteúdo muda o código, o que permite conferir que o arquivo é o mesmo.
              </p>
              {integra(pld) ? (
                <SobreEsteDado p={pld.proveniencia.diario} rotulo="Abrir a ficha real do PLD médio diário" />
              ) : (
                <p className="text-mineral">Exemplo indisponível nesta publicação: os dados do PLD não foram processados.</p>
              )}
            </Cartao>

            <Cartao titulo="Três profundidades na mesma página">
              <ul className="space-y-2">
                {MODOS.map((m) => (
                  <li key={m.id}>
                    <Link href={m.href} className={`${link} font-medium`}>
                      {m.rotulo}
                    </Link>
                    <span className="block">{m.dica}</span>
                  </li>
                ))}
              </ul>
              <p>
                O seletor Profundidade fica no alto das páginas {PAGINAS_COM_PROFUNDIDADE.slice(0, -1).join(", ")} e{" "}
                {PAGINAS_COM_PROFUNDIDADE.at(-1)}. O modo escolhido fica no endereço da página, para compartilhar; sem JavaScript, todos os níveis
                aparecem em ordem. Os links acima abrem a página do PLD em cada modo.
              </p>
            </Cartao>

            <Cartao titulo="Termos e unidades se explicam">
              <p>
                Siglas e conceitos sublinhados em pontilhado abrem uma dica curta ao passar o ponteiro ou ao chegar pelo teclado (Esc fecha). O link
                de um conceito leva ao verbete, com a fonte oficial e o trecho citado; o de uma unidade, à seção de unidades da Metodologia. No
                celular, o toque abre o verbete ou a seção.
              </p>
              <p className="text-carvao">Experimente:</p>
              <ul className="flex flex-wrap gap-x-4 text-carvao">
                <li>
                  <Termo slug="pld" alvo>
                    PLD
                  </Termo>
                </li>
                <li>
                  <Termo slug="ear" alvo>
                    EAR
                  </Termo>
                </li>
                <li>
                  <Termo slug="submercado" alvo>
                    submercado
                  </Termo>
                </li>
                <li>
                  <Unidade u="MWmed" alvo />
                </li>
                <li>
                  <Unidade u="MWmês" alvo />
                </li>
                <li>
                  <Unidade u="p.p." alvo />
                </li>
              </ul>
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

            <Cartao titulo="Mediana, faixa usual e percentil">
              <p>
                Para dizer se um valor é comum para a época, várias páginas o comparam com o mesmo dia do calendário nos anos anteriores.
                {integra(hid) ? ` ${hid.regras.padrao_historico} ${hid.regras.faixa_usual}` : ""}
              </p>
              <p>
                A mediana é o valor do meio: metade dos anos ficou abaixo dela. O percentil é a posição do valor na distribuição: no percentil 80,
                cerca de 80% dos valores históricos da mesma data ficaram abaixo dele. Posição histórica não é risco nem previsão.
              </p>
              {integra(pld) && pld.regras.posicao_historica && (
                <p>
                  No PLD, a régua é outra: {pld.regras.posicao_historica.charAt(0).toLowerCase()}
                  {pld.regras.posicao_historica.slice(1)}
                </p>
              )}
            </Cartao>

            <Cartao titulo="Conferido, pendente ou leitura">
              <ul className="space-y-2">
                <li>
                  <Conferido ok />
                  <span className="block">a afirmação tem trecho citado de documento primário da fonte.</span>
                </li>
                <li>
                  <Conferido ok={false} />
                  <span className="block">a afirmação ainda não tem trecho conferido em documento primário e fica marcada até ser conferida.</span>
                </li>
                <li>
                  <span className="rotulo text-mineral">Leitura usual do setor, ainda não conferida</span>
                  <span className="block">interpretação comum no setor, apresentada como tal, nunca como fato da fonte.</span>
                </li>
                <li>
                  <span className="rotulo text-mineral">Leitura da Scrutiniums a partir do dado</span>
                  <span className="block">o que a plataforma identificou no próprio dado, sem documento da fonte que o confirme.</span>
                </li>
              </ul>
              <p>
                Definição de conceito só entra com fonte primária e trecho citado. Hoje, {conferidos.length} verbetes estão conferidos e{" "}
                {pendentes.length} estão em preparação, sem definição publicada: {pendentes.map((c) => c.sigla ?? c.nome.toLowerCase()).join(", ")}.
              </p>
            </Cartao>

            <Cartao titulo="Ausência nunca vira zero">
              <p>
                Quando a fonte não publicou, o conjunto ainda não foi integrado ou o processamento falhou, a página diz o que falta e por quê, em vez
                de mostrar zero ou uma estimativa. Nas tabelas, a ausência aparece como &quot;sem dado&quot;; nos arquivos CSV, como campo vazio.
              </p>
              {integra(rede) && rede.regras.limites && <Indisponivel titulo="Exemplo real: limites de intercâmbio" motivo={rede.regras.limites} />}
            </Cartao>

            <Cartao titulo="Previsão só com modelo em produção">
              <p>
                Um modelo de previsão passa pelos estados pesquisa, validação e produção, e pode ser aposentado. Só um modelo em produção gera
                previsão oficial; em pesquisa ou em validação, nunca.
              </p>
              {nModelos !== null && meta && (
                <p className="text-carvao">
                  Em {dataBR(meta.gerado_em.slice(0, 10))}: {nModelos} modelos registrados, {nProducao} em produção.
                </p>
              )}
              <p>
                Rodada interna de teste nunca aparece como previsão: o número fica retido. Cada registro do{" "}
                <Link href="/setor-eletrico/pld/previsoes" className={linkTexto}>
                  histórico de previsões
                </Link>{" "}
                é permanente; uma correção cria registro novo que aponta para o original.
              </p>
            </Cartao>

            <Cartao titulo="Cada número tem a sua data">
              <p>
                A plataforma distingue o período de referência (a data a que o dado se refere, no cabeçalho de cada página), a data de publicação pela
                fonte, quando a fonte a informa de modo confiável, a data de captura pela Scrutiniums e a data de processamento.
              </p>
              <p>
                Cada fonte tem o seu calendário: as páginas mostram a data de cada uma, em vez de uma data única que esconderia a diferença. Dia ou
                mês incompleto é marcado como parcial ou fica fora da conta, conforme a regra da página; a geração diária, por exemplo, só usa dias
                com as 24 horas.
              </p>
            </Cartao>

            <Cartao titulo="Tabela e arquivo em cada gráfico">
              <p>
                Os gráficos trazem a mesma informação em tabela (&quot;Dados do gráfico em tabela&quot; ou &quot;Resumo em tabela&quot;) e, quando há
                série, o link para baixar o CSV completo: separador ponto e vírgula, ponto decimal e campo vazio para ausência.
              </p>
              <p>No gráfico, as setas do teclado percorrem os pontos, e cada ponto mostra data, valor e unidade.</p>
            </Cartao>

            <Cartao titulo="Síntese e alertas: regras, não previsões">
              <p>
                A síntese do alto da{" "}
                <Link href="/setor-eletrico/visao-geral#sistema" className={linkTexto}>
                  Visão geral
                </Link>{" "}
                é montada por regras fixas, trecho a trecho, com link para a evidência de cada número; nenhum texto é redigido livremente.
              </p>
              <p>
                A lista{" "}
                <Link href="/setor-eletrico/visao-geral#observar" className={linkTexto}>
                  O que observar
                </Link>{" "}
                avalia regras explícitas sobre os dados mais recentes, como armazenamento fora da faixa usual para a data. Cada item mostra a regra e
                a evidência; nenhum é previsão.
              </p>
            </Cartao>

            <Cartao titulo="Módulo em integração">
              <p>
                No menu, o sinal <span aria-hidden="true">○</span>
                <span className="sr-only">círculo vazio</span> marca módulos em integração: a página mostra escopo, perguntas e fontes catalogadas, sem
                números.
              </p>
              <p>
                Um conjunto só alimenta números depois de integrado: coletado automaticamente, com a cópia original identificada por sha256,
                validação e proveniência. O estado de cada conjunto está em{" "}
                <Link href="/setor-eletrico/dados" className={linkTexto}>
                  Dados
                </Link>
                .
              </p>
            </Cartao>

            <Cartao titulo="Correções e sugestões">
              <p>
                Encontrou um número, uma data ou um texto que não confere com a fonte? Diga a página e o trecho. Quem tem conta gratuita envia pela{" "}
                <Link href="/observatorio/suggestions" className={linkTexto}>
                  página de sugestões
                </Link>{" "}
                da plataforma, que chega direto à administração; também é possível escrever ao{" "}
                <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className={linkTexto}>
                  responsável pela plataforma no LinkedIn
                </a>
                .
              </p>
            </Cartao>
          </div>
        </Secao>

        {/* 5. fontes e atualidade */}
        <Secao
          id="fontes"
          numero="5"
          rotulo="Fontes"
          titulo="Fontes e atualidade"
          subtitulo="Cada conjunto integrado, a data a que os dados se referem, a última captura pela Scrutiniums e as páginas onde aparece."
        >
          {/* no celular, uma ficha por conjunto; a partir de md, a tabela com as quatro colunas */}
          <ul className="space-y-3 md:hidden">
            {linhasFontes.map((l) => (
              <li key={l.d.slug} className="border border-linha bg-superficie p-4 text-sm">
                <Link href={`/setor-eletrico/dados/${l.d.slug}`} className={link}>
                  {l.titulo}
                </Link>
                <p className="text-xs text-mineral">{l.orgao}</p>
                <dl className="mt-2 space-y-1">
                  <div>
                    <dt className="rotulo inline text-mineral">Referência dos dados: </dt>
                    <dd className="inline text-carvao">{l.referencia}</dd>
                  </div>
                  <div>
                    <dt className="rotulo inline text-mineral">Última captura: </dt>
                    <dd className="inline text-carvao-muted">{l.captura}</dd>
                  </div>
                  <div>
                    <dt className="rotulo text-mineral">Onde aparece</dt>
                    <dd className="flex flex-wrap gap-x-3">
                      {l.d.paginas.map((p) => (
                        <Link key={p.href} href={p.href} className={link}>
                          {p.rotulo}
                        </Link>
                      ))}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="tabela-scroll hidden border border-linha bg-superficie md:block" tabIndex={0} role="region" aria-label="Fontes e atualidade (tabela rolável)">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <caption className="sr-only">Conjuntos integrados, data de referência, última captura e páginas onde aparecem</caption>
              <thead>
                <tr className="text-left text-mineral">
                  {["Conjunto", "Referência dos dados", "Última captura", "Onde aparece"].map((c) => (
                    <th key={c} scope="col" className="rotulo border-b border-linha px-3 py-2 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhasFontes.map((l) => (
                  <tr key={l.d.slug} className="border-b border-linha align-middle last:border-b-0">
                    <td className="px-3 py-2">
                      <Link href={`/setor-eletrico/dados/${l.d.slug}`} className={link}>
                        {l.titulo}
                      </Link>
                      <span className="block text-xs text-mineral">{l.orgao}</span>
                    </td>
                    <td className="px-3 py-2 text-carvao">{l.referencia}</td>
                    <td className="px-3 py-2 text-carvao-muted">{l.captura}</td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap gap-x-3">
                        {l.d.paginas.map((p) => (
                          <Link key={p.href} href={p.href} className={link}>
                            {p.rotulo}
                          </Link>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Todas as fontes integradas são abertas e oficiais, do ONS e da CCEE, com a licença informada na ficha de cada conjunto.
            {cat
              ? ` O catálogo registra ${cat.total} entradas: ${cat.total - manuais} colhidas das APIs dos portais de dados abertos e ${manuais} registradas à mão, com metadados ainda não verificados na fonte; ${DATASETS_INTEGRADOS.length} conjuntos já estão integrados.`
              : ""}{" "}
            A linhagem de cada arquivo, do download à página, está em{" "}
            <Link href="/setor-eletrico/metodologia#linhagem" className={linkTexto}>
              Metodologia
            </Link>{" "}
            e em{" "}
            <Link href="/setor-eletrico/dados" className={linkTexto}>
              Dados
            </Link>
            .
          </p>
        </Secao>
      </main>
    </>
  );
}
