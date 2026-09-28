import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SobreEsteDado } from "@/components/evidencia/SobreEsteDado";
import { Termo } from "@/components/evidencia/Termo";
import { CartoesPld } from "@/components/energia/CartoesPld";
import { DiagramaFormacao, type NoComEstado } from "@/components/energia/DiagramaFormacao";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MapaSubmercados } from "@/components/energia/MapaSubmercados";
import { PldPeriodos, type PeriodoPld } from "@/components/energia/PldPeriodos";
import { IlustracaoDistribuicao } from "@/components/energia/IlustracaoDistribuicao";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra } from "@/lib/energia/gold";
import { carimbo, dataBR, num, pct, reais, rotuloRegra } from "@/lib/energia/formato";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { NOS_FORMACAO, PLD_NAO_E, TIPOS_RELACAO } from "@/lib/energia/conteudo/pld";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { estadoCarga, estadoEar, estadoEna, estadoPld, estadoRenovaveis, estadoTermicas } from "@/lib/energia/leituras";
import type { PldGold } from "@/lib/energia/tipos";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "PLD: o preço horário da energia por submercado, explicado",
  description:
    "O que é o PLD, o que ele não é, de onde vem o preço, o que aconteceu no último dia publicado nos quatro submercados e o estado real da previsão, com fonte, regra e limitação em cada número.",
  alternates: { canonical: "/setor-eletrico/pld" },
};

function Conferido({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="rotulo !text-[0.62rem] text-sucesso">● conferido na fonte</span>
  ) : (
    <span className="rotulo !text-[0.62rem] text-aviso">○ conferência documental pendente</span>
  );
}

function Capitulo({ id, numero, titulo, subtitulo, children, nivel }: { id: string; numero: string; titulo: string; subtitulo?: string; children: React.ReactNode; nivel?: string }) {
  return (
    <section id={id} data-nivel={nivel} aria-labelledby={`${id}-h`} className="scroll-mt-28 border-t border-linha py-12 md:py-16">
      <p className="rotulo flex items-center gap-3 text-mineral">
        <span className="font-serif text-lg normal-case tracking-normal text-energia">{numero}</span>
        {subtitulo}
      </p>
      <h2 id={`${id}-h`} className="mt-2 max-w-3xl font-serif text-2xl leading-snug text-carvao md:text-[2rem]">
        {titulo}
      </h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function periodos(p: PldGold): PeriodoPld[] {
  const x = (arr: Record<string, unknown>[], chave: string) =>
    arr.map((r) => ({ x: String(r[chave]), SE: r.SE as number | null, S: r.S as number | null, NE: r.NE as number | null, N: r.N as number | null }));
  const h30 = x(p.horario_30d as unknown as Record<string, unknown>[], "t");
  const curva = p.curva_horaria.horas.map((r) => ({ x: `${p.curva_horaria.dia}T${r.h}`, SE: r.SE, S: r.S, NE: r.NE, N: r.N }));
  const diario = x(p.diario as unknown as Record<string, unknown>[], "d");
  const mensal = x(p.mensal as unknown as Record<string, unknown>[], "m");
  const base = (id: keyof PldGold["periodos"], rotulo: string, serie: Record<string, string | number | null>[], formatoX: PeriodoPld["formatoX"], descricaoSerie: string): PeriodoPld => ({
    id,
    rotulo,
    inicio: p.periodos[id].inicio,
    fim: p.periodos[id].fim,
    nHoras: p.periodos[id].n_horas,
    stats: p.periodos[id].por_submercado,
    diferenca: p.periodos[id].diferenca,
    serie,
    formatoX,
    descricaoSerie,
  });
  return [
    base("hoje", `Dia ${dataBR(p.dia_referencia).slice(0, 5)}`, curva, "hora", `curva horária de ${dataBR(p.dia_referencia)} (valores observados)`),
    base("7d", "7 dias", h30.slice(-168), "hora", "valores horários (observados)"),
    base("30d", "30 dias", h30, "hora", "valores horários (observados)"),
    base("12m", "12 meses", diario.slice(-365), "data", "médias diárias (calculadas)"),
    base("historico", "Histórico", mensal, "mes", "médias mensais desde jan/2021 (calculadas; mês corrente parcial)"),
  ];
}

export default function PldPage() {
  const pld = gold.pld();
  const hid = gold.hidrologia();
  const ger = gold.geracao();
  const carga = gold.carga();
  const rede = gold.rede();
  const cmo = gold.cmo();
  const prev = gold.previsoes();
  const mods = gold.modelos();
  const cPld = conceito("pld");

  const estados: Record<string, NoComEstado["estado"]> = {
    afluencias: estadoEna(hid) ? { texto: estadoEna(hid)!, natureza: "CALCULADO", historico: { rotulo: "Histórico da ENA", href: "/setor-eletrico/agua-e-clima#ena" } } : null,
    reservatorios: estadoEar(hid) ? { texto: estadoEar(hid)!, natureza: "CALCULADO", historico: { rotulo: "Histórico da EAR", href: "/setor-eletrico/agua-e-clima#ear" } } : null,
    carga: estadoCarga(carga) ? { texto: estadoCarga(carga)!, natureza: "CALCULADO", historico: { rotulo: "Histórico da carga", href: "/setor-eletrico/carga" } } : null,
    renovaveis: estadoRenovaveis(ger) ? { texto: estadoRenovaveis(ger)!, natureza: "CALCULADO", historico: { rotulo: "Matriz por janela", href: "/setor-eletrico/geracao" } } : null,
    termicas: estadoTermicas(ger) ? { texto: estadoTermicas(ger)!, natureza: "CALCULADO", historico: { rotulo: "Térmicas em contexto", href: "/setor-eletrico/geracao#termica" } } : null,
    rede: integra(rede)
      ? {
          texto: `Em ${dataBR(rede.dia_referencia)}: ${rede.fronteiras
            .map((f) => {
              if (f.fluxo_dia === null) return `${f.de}–${f.para} sem dado`;
              const [o, d] = f.fluxo_dia >= 0 ? [f.de, f.para] : [f.para, f.de];
              return `${o}→${d} ${num(Math.abs(f.fluxo_dia), 0)} MWmed`;
            })
            .join("; ")}. Limites de intercâmbio não integrados.`,
          natureza: "CALCULADO",
          historico: { rotulo: "Intercâmbios", href: "/setor-eletrico/rede" },
        }
      : null,
    otimizacao: null,
    cmo: integra(cmo)
      ? {
          texto: `CMO semanal publicado pelo ONS para a semana operativa de ${dataBR(cmo.semana_referencia)}: ${cmo.ultima_semana.map((s) => `${s.sm === "SE" ? "SE/CO" : s.sm} ${reais(s.semanal)}`).join("; ")} por MWh.`,
          natureza: "OBSERVADO",
          historico: { rotulo: "Série do CMO", href: "#cmo" },
        }
      : null,
    limites: integra(pld)
      ? {
          texto: `Menor valor horário observado em ${pld.dia_referencia.slice(0, 4)} até ${dataBR(pld.dia_referencia)}: ${reais(pld.menor_valor_ano.at(-1)?.SE ?? null)}/MWh. Não é o piso regulatório: os limites oficiais vigentes não foram auditados nesta fase.`,
          natureza: "CALCULADO",
        }
      : null,
    pld: estadoPld(pld) ? { texto: estadoPld(pld)!, natureza: "CALCULADO", historico: { rotulo: "O que está acontecendo", href: "#hoje" } } : null,
  };
  const nos: NoComEstado[] = NOS_FORMACAO.map((n) => ({ ...n, estado: estados[n.id] ?? null }));

  const cmoSerie = integra(cmo) ? cmo.serie.slice(-104).map((s) => ({ x: s.s, SE: s.SE, S: s.S, NE: s.NE, N: s.N })) : [];
  const amplitude = integra(rede) ? rede.serie_amplitude_pld.map((a) => ({ x: a.d, amp: a.amplitude })) : [];
  const ult = prev?.atual?.ultima_execucao;

  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld" />
      <main className="mx-auto max-w-page px-6">
        <header className="pb-6 pt-10 md:pt-14">
          <p className="rotulo text-mineral">Preço de Liquidação das Diferenças</p>
          <h1 className="mt-3 font-serif text-[clamp(2.6rem,6vw,4rem)] leading-none text-carvao">PLD</h1>
          <p className="mt-4 max-w-2xl font-serif text-xl leading-snug text-carvao-muted md:text-2xl">
            O preço horário da energia no Brasil, explicado.
          </p>
          <nav aria-label="Nesta página" className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {[
              ["#o-que-e", "O que é"],
              ["#formacao", "De onde vem o preço"],
              ["#hoje", "Último dia publicado"],
              ["#submercados", "Por que as regiões diferem"],
              ["#previsao", "Para onde pode ir"],
            ].map(([h, r]) => (
              <a key={h} href={h} className="inline-flex min-h-[44px] items-center text-energia-dark underline decoration-energia/40 underline-offset-4 hover:text-carvao">
                {r}
              </a>
            ))}
          </nav>
        </header>

        <ModoProfundidade>
          {/* 1. Entenda em 90 segundos */}
          <Capitulo
            id="o-que-e"
            numero="1"
            subtitulo="Entenda em 90 segundos"
            titulo="A que preço se acerta a energia no curto prazo, hora a hora e em cada região?"
          >
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div>
                <p className="font-serif text-xl leading-relaxed text-carvao md:text-2xl">
                  No Mercado de Curto Prazo, a CCEE apura, para cada perfil de agente, submercado e hora, um balanço de energia em MWh, positivo
                  ou negativo, e um resultado financeiro em R$, separado em venda e compra. O PLD é o preço desse mercado.
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-mineral">
                  Base: descrições oficiais dos conjuntos PLD_HORARIO_SUBMERCADO, SUMARIO_BE_HORARIO_SUBMERCADO e
                  SUMARIO_MENSAL_COMPRA_VENDA_SUBMERCADO no portal de dados abertos da CCEE, capturadas em 28/09/2026. <Conferido ok />
                </p>
                <p className="mt-6 text-lg leading-relaxed text-carvao">
                  É um valor em R$/MWh que a CCEE calcula todos os dias para cada hora do dia seguinte e para cada um dos quatro{" "}
                  <Termo slug="submercado">submercados</Termo>. O cálculo é feito por modelos computacionais (NEWAVE, DECOMP e
                  DESSEM), tem como base o <Termo slug="cmo">custo marginal de operação</Termo> e respeita os limites mínimo e
                  máximos vigentes.
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-mineral">
                  Base: descrição oficial da CCEE no portal de dados abertos (conjunto PLD_HORARIO), capturada em 27/09/2026. <Conferido ok />
                </p>
                <p className="mt-6 leading-relaxed text-carvao-muted">
                  Como o balanço de cada perfil de agente é formado (contratos, geração e consumo medidos) e como o resultado é liquidado entre
                  quem vende e quem compra estão nas Regras de Comercialização da CCEE.
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral">
                  Regras de Comercialização: <Conferido ok={false} /> (documento não conferido nesta fase)
                </p>
                <div className="mt-8 border-l-2 border-energia pl-5">
                  <p className="rotulo text-mineral">A ideia central</p>
                  {integra(ger) && ger.regioes.find((r) => r.rg === "SIN")?.["12m"] && (
                    <p className="mt-2 flex flex-wrap items-center gap-2 leading-relaxed text-carvao">
                      <span>
                        Nos 12 meses até {dataBR(ger.dia_referencia)}, a geração hidráulica respondeu por{" "}
                        {pct(ger.regioes.find((r) => r.rg === "SIN")!["12m"]!.participacao.hidraulica)} da geração verificada do SIN
                        (ONS, Balanço de Energia nos Subsistemas).
                      </span>
                      <SeloNatureza natureza="CALCULADO" />
                    </p>
                  )}
                  <p className="mt-3 border border-dashed border-mineral p-3 text-sm leading-relaxed text-carvao-muted">
                    <span className="rotulo mb-1 block text-mineral">Leitura usual do setor, ainda não conferida em documento primário</span>
                    O sistema brasileiro é descrito como <strong className="font-medium">hidrotérmico e intertemporal</strong>: parte da
                    geração hidráulica vem de usinas com reservatório, e a água usada hoje não estará disponível amanhã. Nessa leitura,
                    a água guardada tem valor para o futuro, esse valor pesa na decisão de gerar com água agora ou acionar outras
                    fontes, e o preço sai dessa decisão, não de uma única variável.
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral">
                    Mecanismo do valor da água: <Conferido ok={false} /> (documentação dos modelos não acessada nesta fase)
                  </p>
                </div>
              </div>
              <div>
                <p className="rotulo text-mineral">O que o PLD não é</p>
                <ul className="mt-3 space-y-3">
                  {PLD_NAO_E.map((x) => (
                    <li key={x.titulo} className="border border-linha bg-superficie p-4">
                      <p className="font-medium text-carvao">{x.titulo}</p>
                      <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{x.porque}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral">
                        {x.base} <Conferido ok={x.conferencia === "CONFERIDO"} />
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {cPld?.fontes[0]?.trecho && (
              <blockquote data-nivel="auditar" className="mt-8 border border-linha bg-superficie p-5 text-sm leading-relaxed text-carvao-muted">
                <p className="rotulo mb-2 text-mineral">Íntegra da fonte (CCEE)</p>“{cPld.fontes[0].trecho}”
                <footer className="mt-2 text-xs text-mineral">
                  <a href={cPld.fontes[0].url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    {cPld.fontes[0].documento}
                  </a>
                </footer>
              </blockquote>
            )}
          </Capitulo>

          {/* 2. De onde vem o preço */}
          <Capitulo id="formacao" numero="2" subtitulo="De onde vem o preço?" titulo="O PLD emerge de um sistema, não de uma variável">
            <p className="mb-6 max-w-prose2 leading-relaxed text-carvao-muted">
              Toque em cada etapa para ver o que ela é, como está agora e como se liga à seguinte. As definições vêm das fontes
              oficiais citadas; cada ligação declara seu tipo e se já foi conferida na documentação primária.
            </p>
            <DiagramaFormacao nos={nos} />
            <details data-nivel="analisar" className="mt-6 border border-linha bg-superficie p-5">
              <summary className="rotulo min-h-[44px] cursor-pointer text-carvao">Tipos de relação usados na plataforma</summary>
              <dl className="mt-3 grid gap-3 md:grid-cols-2">
                {Object.values(TIPOS_RELACAO).map((t) => (
                  <div key={t.rotulo}>
                    <dt className="font-medium text-carvao">{t.rotulo}</dt>
                    <dd className="text-sm text-carvao-muted">{t.definicao}</dd>
                  </div>
                ))}
              </dl>
            </details>
            {integra(cmo) && (
              <div className="mt-8" data-nivel="analisar">
                <PainelEvidencia
                  nivelTitulo={3}
                  id="cmo"
                  pergunta="Qual custo marginal o ONS está publicando para cada subsistema?"
                  subtitulo="CMO semanal (modelo DECOMP) · R$/MWh · últimas 104 semanas operativas"
                  porQueImporta={<>O <Termo slug="cmo">CMO</Termo> é a base do PLD, segundo a CCEE. O ONS publica o CMO semanal estimado pelo DECOMP para cada semana operativa, por subsistema e patamar de carga.</>}
                  oQueMudou={<>Semana de {dataBR(cmo.semana_referencia)}: Sudeste/Centro-Oeste {reais(cmo.ultima_semana[0].semanal)} contra {reais(cmo.ultima_semana[0].semana_anterior)} na semana anterior.</>}
                  comoInterpretar={<>Compare os subsistemas na mesma semana: valores iguais ou diferentes são saída do modelo DECOMP; a razão de uma diferença não é identificada aqui.</>}
                  naoConcluir={<>CMO semanal não é PLD: o PLD é horário, calculado pela CCEE, e aplica limites mínimo e máximos; os dois podem diferir muito na mesma semana (compare com os cartões do PLD no capítulo 3). O CMO é saída de modelo, não medição.</>}
                  proveniencia={cmo.proveniencia.cmo}
                >
                  <GraficoLinhas
                    titulo="CMO semanal por subsistema"
                    dados={cmoSerie}
                    chaveX="x"
                    series={[
                      { id: "SE", rotulo: "Sudeste/Centro-Oeste", cor: "var(--serie-sm-se)" },
                      { id: "S", rotulo: "Sul", cor: "var(--serie-sm-s)" },
                      { id: "NE", rotulo: "Nordeste", cor: "var(--serie-sm-ne)" },
                      { id: "N", rotulo: "Norte", cor: "var(--serie-sm-n)" },
                    ]}
                    unidade="R$/MWh"
                    casas={2}
                  />
                </PainelEvidencia>
              </div>
            )}
          </Capitulo>

          {/* 3. O que está acontecendo */}
          <Capitulo id="hoje" numero="3" subtitulo="O que está acontecendo" titulo={integra(pld) ? `O PLD em ${dataBR(pld.dia_referencia)} e no período recente` : "O PLD no período recente"}>
            {integra(pld) ? (
              <>
                <CartoesPld pld={pld} />
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-mineral">
                  <span>Fonte: CCEE, PLD_HORARIO; médias e posição calculadas pela Scrutiniums.</span>
                  <SobreEsteDado p={pld.proveniencia.horario} rotulo="Sobre o PLD horário" />
                  <SobreEsteDado p={pld.proveniencia.diario} rotulo="Sobre a média diária" />
                  <SobreEsteDado p={pld.proveniencia.posicao} rotulo="Sobre a posição histórica" />
                </div>
                <div className="mt-8">
                  <PainelEvidencia
                    nivelTitulo={3}
                    id="periodos"
                    pergunta="Em que horas o preço sobe, e as regiões se separam?"
                    subtitulo="PLD por submercado · R$/MWh nominais · hora local de Brasília"
                    porQueImporta={<>O PLD é horário. A curva mostra em que horas do dia o preço de cada submercado sobe ou cai e se os quatro seguem juntos.</>}
                    oQueMudou={<>Nos últimos 30 dias, {pld.periodos["30d"].diferenca.horas_acima_limiar} horas tiveram diferença acima de R$ {num(pld.limiar_diferenca, 0)}/MWh entre submercados.</>}
                    comoInterpretar={<>Alterne os períodos. O dia de referência, 7 e 30 dias mostram horas; 12 meses mostra médias diárias; o histórico, médias mensais desde 2021.</>}
                    naoConcluir={<>Uma posição alta ou baixa no histórico não diz para onde o preço vai. Anos diferentes têm limites regulatórios diferentes, não auditados nesta fase.</>}
                    proveniencia={pld.proveniencia.horario}
                    extraFonte={<>Captura primária de {carimbo(pld.proveniencia.horario.capturado_em)}.</>}
                    complementares={[
                      ...(pld.proveniencia.estatisticas ? [{ rotulo: "Sobre as estatísticas do período", p: pld.proveniencia.estatisticas }] : []),
                      { rotulo: "Sobre as médias diárias e mensais", p: pld.proveniencia.diario },
                    ]}
                  >
                    <PldPeriodos periodos={periodos(pld)} limiar={pld.limiar_diferenca} />
                  </PainelEvidencia>
                </div>
                <div id="regras" data-nivel="analisar" className="mt-8 scroll-mt-28 border border-linha bg-superficie p-6">
                  <h3 className="font-serif text-xl text-carvao">Como classificamos</h3>
                  <p className="mt-1 text-sm text-carvao-muted">Nenhuma classificação sem regra. Estas são as regras que produzem cada resposta desta seção.</p>
                  <dl className="mt-4 grid gap-4 md:grid-cols-2">
                    {Object.entries(pld.regras).map(([k, v]) => (
                      <div key={k}>
                        <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
                        <dd className="mt-1 text-sm leading-relaxed text-carvao">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-4">
                    <SobreEsteDado p={pld.proveniencia.posicao} rotulo="Sobre a posição histórica" />
                    <SobreEsteDado p={pld.proveniencia.diario} rotulo="Sobre a média diária" />
                  </div>
                </div>
                <div data-nivel="auditar" className="mt-8 border border-linha bg-superficie p-6">
                  <h3 className="font-serif text-xl text-carvao">Menor valor horário observado por ano</h3>
                  <p className="mt-1 text-sm text-carvao-muted">
                    Referência descritiva. Não é o piso regulatório do PLD: os limites homologados de cada ano não foram auditados nesta fase.
                  </p>
                  <TabelaDados
                    titulo="Menor valor horário observado por ano e submercado"
                    colunas={["Ano", "Até", "SE/CO", "Sul", "Nordeste", "Norte"]}
                    linhas={pld.menor_valor_ano.map((m) => [m.ano, dataBR(m.ate), m.SE, m.S, m.NE, m.N])}
                  />
                  <p className="rotulo mt-6 text-mineral">Downloads</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {pld.downloads.map((d) => (
                      <li key={d.url}>
                        <a href={d.url} download className="text-energia-dark underline underline-offset-4">{d.rotulo}</a>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-mineral [overflow-wrap:anywhere]">
                    Snapshot {pld.snapshot.id} · sha256 {pld.snapshot.sha256} · série de {pld.primeira_hora.replace("T", " ")} a {pld.ultima_hora.replace("T", " ")}
                  </p>
                </div>
              </>
            ) : (
              <Indisponivel titulo="PLD indisponível" motivo={pld?.motivo ?? "A gold do PLD não foi gerada."} />
            )}
          </Capitulo>

          {/* 4. Submercados */}
          <Capitulo id="submercados" numero="4" subtitulo="Por que os preços dos submercados podem diferir?" titulo="Quatro preços, quatro regiões e as linhas de transmissão entre elas">
            {integra(rede) && integra(pld) ? (
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <MapaSubmercados
                    fluxos={rede.fronteiras.map((f) => ({ de: f.de, para: f.para, fluxo: f.fluxo_dia }))}
                    precos={Object.fromEntries(pld.cartoes.map((c) => [c.sm, c.media_dia]))}
                    diaFluxo={dataBR(rede.dia_referencia)}
                    diaPreco={dataBR(pld.dia_referencia)}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-mineral">
                    <span>Fonte: CCEE (PLD) e ONS (intercâmbio).</span>
                    <SobreEsteDado p={pld.proveniencia.diario} rotulo="Sobre o PLD médio" />
                    <SobreEsteDado p={rede.proveniencia.fluxo} rotulo="Sobre os fluxos" />
                  </div>
                </div>
                <div className="space-y-4 leading-relaxed text-carvao">
                  <p>
                    A CCEE calcula um PLD para cada submercado. As regiões estão ligadas por linhas de transmissão de fronteira, e o
                    ONS mede o <Termo slug="intercambio">intercâmbio</Termo> entre elas hora a hora.
                  </p>
                  <p className="border border-dashed border-mineral p-3 text-sm text-carvao-muted">
                    <span className="rotulo mb-1 block text-mineral">Leitura usual do setor, ainda não conferida em documento primário</span>
                    Se a energia pudesse circular sem limite, o custo de atender uma carga a mais seria o mesmo em todo lugar. Como a
                    capacidade de transferência entre regiões é finita, uma região com sobra pode não conseguir enviar tudo o que
                    teria para outra, e os preços se separam.
                  </p>
                  <ul className="space-y-1 text-xs text-mineral">
                    <li className="flex flex-wrap items-center gap-2">Definições de PLD por submercado (CCEE) e de intercâmbio (ONS): <Conferido ok /></li>
                    <li className="flex flex-wrap items-center gap-2">Mecanismo de separação por limite de transferência: <Conferido ok={false} /></li>
                  </ul>
                  <p className="flex flex-wrap items-center gap-2 border-l-2 border-energia pl-4 text-sm text-carvao-muted">
                    <span>
                      {rede.serie_amplitude_pld.find((a) => a.d === pld.dia_referencia)
                        ? <>Em {dataBR(pld.dia_referencia)}, a diferença entre o maior e o menor PLD médio foi de {reais(rede.serie_amplitude_pld.find((a) => a.d === pld.dia_referencia)!.amplitude)}/MWh. </>
                        : null}
                      Nos últimos 30 dias, {pld.periodos["30d"].diferenca.horas_acima_limiar} horas tiveram diferença acima de {reais(pld.limiar_diferenca)}/MWh.
                    </span>
                    <SeloNatureza natureza="CALCULADO" />
                  </p>
                </div>
                <div className="lg:col-span-2" data-nivel="analisar">
                  <PainelEvidencia
                    nivelTitulo={3}
                    id="amplitude"
                    pergunta="Quando os submercados se separaram no último ano?"
                    subtitulo="Diferença entre o maior e o menor PLD médio diário · R$/MWh"
                    porQueImporta={<>Picos desta série marcam dias em que os PLDs médios das regiões ficaram mais distantes entre si.</>}
                    oQueMudou={<>Último dia com PLD: {dataBR(rede.ultimo_dia_pld)}.</>}
                    comoInterpretar={<>Zero significa os quatro submercados com a mesma média diária. A série usa médias diárias; diferenças de poucas horas podem sumir na média.</>}
                    naoConcluir={<>A série não identifica qual fronteira ou linha causou a separação, nem se o limite de transferência foi atingido: os limites não estão integrados. A causa de uma separação não é atribuída.</>}
                    proveniencia={rede.proveniencia.diferenca}
                  >
                    <GraficoLinhas
                      titulo="Diferença entre o maior e o menor PLD médio diário"
                      dados={amplitude}
                      chaveX="x"
                      series={[{ id: "amp", rotulo: "Diferença máx.−mín.", cor: "var(--cor-energia)" }]}
                      unidade="R$/MWh"
                      casas={2}
                      zeroNoEixo
                    />
                  </PainelEvidencia>
                </div>
              </div>
            ) : (
              <Indisponivel titulo="Dados de rede indisponíveis" motivo="As golds de rede ou de PLD não foram geradas nesta publicação." />
            )}
          </Capitulo>

          {/* 5. Previsão */}
          <Capitulo id="previsao" numero="5" subtitulo="Previsão" titulo="Para onde o PLD pode ir?">
            <p className="max-w-prose2 font-serif text-xl leading-snug text-carvao">Previsão é distribuição de possibilidades, não um único número.</p>
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              <IlustracaoDistribuicao />
              <div>
                {prev && !prev.atual.disponivel ? (
                  <Indisponivel
                    titulo="Previsão indisponível"
                    motivo={<>{prev.atual.motivo} A Scrutiniums não publica previsão de modelo em pesquisa ou em validação.</>}
                    ultimaExecucao={
                      ult ? (
                        <>
                          Rodada interna de {dataBR(ult.origem)} (modelo {ult.versao_modelo}, estado {ult.estado_modelo.toLowerCase()}): {ult.celulas} combinações de horizonte e submercado, {ult.com_numero} com número. Motivo:{" "}
                          {ult.motivos.includes("SEM_PLD_CAPTURADO_ATE_O_CORTE") ? "nenhum PLD do período exigido capturado até o corte" : ult.motivos.join(", ")}.
                        </>
                      ) : (
                        "Nenhuma rodada registrada."
                      )
                    }
                    faltante={prev.atual.informacao_faltante}
                    estado={prev.atual.estado_pipeline}
                  >
                    <p className="mt-5 flex flex-wrap gap-4 text-sm">
                      <Link href="/setor-eletrico/pld/modelos" className="text-energia-dark underline underline-offset-4">Registro de modelos</Link>
                      <Link href="/setor-eletrico/pld/previsoes" className="text-energia-dark underline underline-offset-4">Histórico de previsões ({prev.arquivo.length} registros, {prev.publicacoes} publicações)</Link>
                    </p>
                  </Indisponivel>
                ) : prev && prev.atual.disponivel ? (
                  <div className="border border-linha bg-superficie p-5">
                    <p className="rotulo text-mineral">Previsão publicada</p>
                    <p className="mt-2 text-sm leading-relaxed text-carvao">
                      Há publicação do modelo em produção no arquivo imutável. Cada registro traz modelo, versão, corte, quantis e sha256.
                    </p>
                    <Link href="/setor-eletrico/pld/previsoes" className="mt-3 inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4">
                      Ver no histórico de previsões
                    </Link>
                  </div>
                ) : (
                  <Indisponivel titulo="Previsão indisponível" motivo="O arquivo de previsões não foi gerado nesta publicação." />
                )}
              </div>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <div className="border border-linha bg-superficie p-5">
                <h3 className="font-serif text-lg text-carvao">Como ler, quando houver previsão</h3>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                  A mediana é o valor central da distribuição. As faixas mostram onde o realizado caiu no passado em casos comparáveis. A
                  frase &quot;em cerca de 80% dos casos&quot; só aparece quando a cobertura medida sustentar; caso contrário, a página diz
                  quanto a faixa realmente cobriu.
                </p>
              </div>
              <div className="border border-linha bg-superficie p-5">
                <h3 className="font-serif text-lg text-carvao">O que mudou desde a previsão anterior</h3>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                  Sem previsões publicadas para comparar. Quando houver, esta seção separa o que <strong className="font-medium">mudou na informação</strong> (EAR, ENA, carga, renováveis, térmicas, intercâmbio) do que foi <strong className="font-medium">contribuição do modelo</strong>, que nunca é chamada de causa.
                </p>
              </div>
              <div className="border border-linha bg-superficie p-5">
                <h3 className="font-serif text-lg text-carvao">Por que confiar? O modelo tem acertado?</h3>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                  Ainda não há previsão publicada com realizado para comparar. Os resultados retrospectivos da pesquisa estão{" "}
                  {mods?.publicacao_resultados.liberada ? "no registro de modelos" : "retidos até a conclusão da revisão da pesquisa e a liberação pelo responsável pela plataforma"}.
                  Toda avaliação futura começa por previsão, realizado e erro, depois erro típico, depois cobertura da faixa, e só então métricas técnicas contra referências simples.
                </p>
              </div>
            </div>
            <div data-nivel="auditar" className="mt-8 border border-linha bg-superficie p-6">
              <h3 className="font-serif text-xl text-carvao">Regras de governança aplicadas</h3>
              <dl className="mt-4 grid gap-4 md:grid-cols-2">
                {prev &&
                  Object.entries(prev.regras).map(([k, v]) => (
                    <div key={k}>
                      <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-carvao">{v}</dd>
                    </div>
                  ))}
              </dl>
              <p className="mt-4 text-sm text-carvao-muted">
                Validações automatizadas em <code className="font-mono text-xs">pipeline/energia/governanca.py</code> bloqueiam: publicação de modelo não promovido, uso de dado posterior ao corte, alteração silenciosa de registro publicado, previsão sem versão ou snapshot, faixa não calibrada rotulada como 80%, cenário como previsão e ausência como número.
              </p>
            </div>
          </Capitulo>
        </ModoProfundidade>
      </main>
    </>
  );
}
