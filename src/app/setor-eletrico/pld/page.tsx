import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SobreEsteDado } from "@/components/evidencia/SobreEsteDado";
import { Termo } from "@/components/evidencia/Termo";
import { Conferido } from "@/components/evidencia/Conferido";
import { CartoesPld } from "@/components/energia/CartoesPld";
import { DiagramaFormacao, type NoComEstado } from "@/components/energia/DiagramaFormacao";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { intensidadeFaixa } from "@/lib/energia/geo";
import { MapaBrasil } from "@/components/energia/MapaBrasil";
import { MetricaHero } from "@/components/energia/MetricaHero";
import { LinhaDoDia, type DiaHorario } from "@/components/energia/LinhaDoDia";
import { PldPeriodos, type PeriodoPld } from "@/components/energia/PldPeriodos";
import { PrevisaoPld } from "@/components/energia/PrevisaoPld";
import { MaquinaDoTempo, type RealizadoEntrega } from "@/components/energia/MaquinaDoTempo";
import { ExplicadorIncerteza } from "@/components/energia/ExplicadorIncerteza";
import { IconeSetor } from "@/components/energia/IconeSetor";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra } from "@/lib/energia/gold";
import { carimbo, dataBR, horaLocal, num, pct, reais, rotuloRegra, sinal } from "@/lib/energia/formato";
import { textoAmplitude } from "@/lib/energia/resumos";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { NOS_FORMACAO, PLD_NAO_E, TIPOS_RELACAO } from "@/lib/energia/conteudo/pld";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { ROTULO_FAIXA_PLD, estadoCarga, estadoEar, estadoEna, estadoPld, estadoRenovaveis, estadoTermicas, sin } from "@/lib/energia/leituras";
import type { PldGold, Submercado } from "@/lib/energia/tipos";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "PLD: por que a energia tem este preço hoje",
  description:
    "O que é o PLD, de onde vem o preço (do clima ao CMO e às regras), o preço hora a hora nos quatro submercados, o mapa das diferenças entre regiões e o estado real da previsão, com fonte, regra e limitação em cada número.",
  alternates: { canonical: "/setor-eletrico/pld" },
};

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

/** Os 30 dias de PLD horário agrupados por dia, para a linha do tempo do dia. */
function diasHorarios(p: PldGold): DiaHorario[] {
  const por = new Map<string, DiaHorario["horas"]>();
  for (const r of p.horario_30d) {
    const d = r.t.slice(0, 10);
    por.set(d, [...(por.get(d) ?? []), { h: r.t.slice(11, 16), SE: r.SE, S: r.S, NE: r.NE, N: r.N }]);
  }
  if (!por.has(p.curva_horaria.dia)) por.set(p.curva_horaria.dia, p.curva_horaria.horas.map((h) => ({ h: h.h, SE: h.SE, S: h.S, NE: h.NE, N: h.N })));
  return Array.from(por.entries())
    .filter(([, horas]) => horas.length === 24)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([d, horas]) => ({ d, horas }));
}

/** Data local de Brasília de um instante UTC do arquivo de previsões. */
function diaBrasilia(iso: string): string {
  const d = new Date(iso);
  d.setUTCHours(d.getUTCHours() - 3);
  return d.toISOString().slice(0, 10);
}

const NOME_SM_CMO: Record<string, string> = { SE: "Sudeste/Centro-Oeste", S: "Sul", NE: "Nordeste", N: "Norte" };
const SMS: Submercado[] = ["N", "NE", "SE", "S"];

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

  const hidSin = integra(hid) ? sin(hid.subsistemas) : undefined;
  const gSin7 = integra(ger) ? ger.regioes.find((r) => r.rg === "SIN")?.["7d"] : undefined;
  const cargaSin = integra(carga) ? sin(carga.subsistemas) : undefined;
  const neSe = integra(rede) ? rede.fronteiras.find((f) => f.par === "NE_SE") : undefined;
  const se = integra(pld) ? pld.cartoes.find((c) => c.sm === "SE") : undefined;

  const estados: Record<string, NoComEstado["estado"]> = {
    afluencias: estadoEna(hid) ? { texto: estadoEna(hid)!, natureza: "CALCULADO", resumo: hidSin ? `${pct(hidSin.ena.pct_mlt_30d, 0)} da MLT em 30 dias` : undefined, historico: { rotulo: "Histórico da ENA", href: "/setor-eletrico/agua-e-clima#ena" } } : null,
    reservatorios: estadoEar(hid) ? { texto: estadoEar(hid)!, natureza: "CALCULADO", resumo: hidSin ? `${pct(hidSin.ear.valor)} da EAR máxima` : undefined, historico: { rotulo: "Histórico da EAR", href: "/setor-eletrico/agua-e-clima#ear" } } : null,
    carga: estadoCarga(carga) ? { texto: estadoCarga(carga)!, natureza: "CALCULADO", resumo: cargaSin ? `${num(cargaSin.dia / 1000, 1)} GWmed no dia` : undefined, historico: { rotulo: "Histórico da carga", href: "/setor-eletrico/carga" } } : null,
    renovaveis: estadoRenovaveis(ger) ? { texto: estadoRenovaveis(ger)!, natureza: "CALCULADO", resumo: gSin7 ? `eólica ${pct(gSin7.participacao.eolica, 0)} · solar ${pct(gSin7.participacao.solar, 0)}` : undefined, historico: { rotulo: "Matriz por janela", href: "/setor-eletrico/geracao" } } : null,
    termicas: estadoTermicas(ger) ? { texto: estadoTermicas(ger)!, natureza: "CALCULADO", resumo: integra(ger) ? `${pct(ger.termica_contexto.participacao_7d)} da geração em 7 dias` : undefined, historico: { rotulo: "Térmicas em contexto", href: "/setor-eletrico/geracao#termica" } } : null,
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
          resumo: neSe && neSe.fluxo_dia !== null ? `NE→SE/CO ${num(Math.abs(neSe.fluxo_dia), 0)} MWmed` : undefined,
          historico: { rotulo: "Intercâmbios", href: "/setor-eletrico/rede" },
        }
      : null,
    otimizacao: null,
    cmo: integra(cmo)
      ? {
          texto: `CMO semanal publicado pelo ONS para a semana operativa de ${dataBR(cmo.semana_referencia)}: ${cmo.ultima_semana.map((s) => `${s.sm === "SE" ? "SE/CO" : s.sm} ${reais(s.semanal)}`).join("; ")} por MWh.`,
          natureza: "OBSERVADO",
          resumo: `SE/CO ${reais(cmo.ultima_semana.find((s) => s.sm === "SE")?.semanal ?? null)}/MWh`,
          historico: { rotulo: "Série do CMO", href: "#cmo" },
        }
      : null,
    limites: integra(pld)
      ? {
          texto: `Menor valor horário observado em ${pld.dia_referencia.slice(0, 4)} até ${dataBR(pld.dia_referencia)}: ${reais(pld.menor_valor_ano.at(-1)?.SE ?? null)}/MWh. Não é o piso regulatório: os limites oficiais vigentes não foram auditados nesta fase.`,
          natureza: "CALCULADO",
          resumo: `menor valor do ano ${reais(pld.menor_valor_ano.at(-1)?.SE ?? null)}`,
        }
      : null,
    pld: estadoPld(pld) ? { texto: estadoPld(pld)!, natureza: "CALCULADO", resumo: se ? `${reais(se.media_dia)}/MWh no SE/CO` : undefined, historico: { rotulo: "O que está acontecendo", href: "#hoje" } } : null,
  };
  const nos: NoComEstado[] = NOS_FORMACAO.map((n) => ({ ...n, estado: estados[n.id] ?? null }));

  const cmoSerie = integra(cmo) ? cmo.serie.slice(-104).map((s) => ({ x: s.s, SE: s.SE, S: s.S, NE: s.NE, N: s.N })) : [];
  const amplitude = integra(rede) ? rede.serie_amplitude_pld.map((a) => ({ x: a.d, amp: a.amplitude })) : [];
  const ult = prev?.atual?.ultima_execucao;
  const picoCmo = integra(cmo)
    ? cmo.serie
        .slice(-12)
        .flatMap((s) => (["SE", "S", "NE", "N"] as const).map((sm) => ({ s: s.s, sm, v: s[sm] })))
        .filter((x): x is { s: string; sm: "SE" | "S" | "NE" | "N"; v: number } => typeof x.v === "number")
        .sort((a, b) => b.v - a.v)[0] ?? null
    : null;
  const exemploSe = integra(pld) ? pld.cartoes.find((c) => c.sm === "SE" && c.max_hora !== null) ?? null : null;

  // realizado por entrega do arquivo de previsões (média das médias diárias nos dias da entrega, horário de Brasília)
  const realizadoPorEntrega: Record<string, Partial<Record<Submercado, RealizadoEntrega>>> = {};
  if (prev && integra(pld)) {
    const porDia = new Map(pld.diario.map((d) => [d.d, d]));
    for (const r of prev.arquivo) {
      if (realizadoPorEntrega[r.entrega.id]) continue;
      const ini = diaBrasilia(r.entrega.inicio);
      const fim = diaBrasilia(r.entrega.fim);
      const dias: string[] = [];
      for (let d = new Date(`${ini}T00:00:00Z`); d.toISOString().slice(0, 10) < fim; d.setUTCDate(d.getUTCDate() + 1)) dias.push(d.toISOString().slice(0, 10));
      realizadoPorEntrega[r.entrega.id] = Object.fromEntries(
        (["SE", "S", "NE", "N"] as Submercado[]).map((sm) => {
          const vs = dias.map((d) => porDia.get(d)?.[sm]).filter((v): v is number => typeof v === "number");
          return [sm, { media: vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null, dias: vs.length, esperados: dias.length }];
        }),
      );
    }
  }

  const resumoRodada = ult
    ? `Última rodada interna, de ${dataBR(ult.origem)}, com o modelo ${ult.modelo} (${ult.estado_modelo === "PESQUISA" ? "em pesquisa" : ult.estado_modelo.toLowerCase()}): ${ult.celulas} previsões tentadas, ${ult.com_numero === 0 ? "nenhuma com número" : `${ult.com_numero} com número`}. Motivo: ${ult.motivos.includes("SEM_PLD_CAPTURADO_ATE_O_CORTE") ? "nenhum PLD do período exigido havia sido capturado até o horário de corte" : ult.motivos.join(", ")}.`
    : null;

  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <header className="pb-8 pt-10 md:pt-14">
          <p className="rotulo flex items-center gap-2 text-mineral">
            <IconeSetor tipo="preco" tamanho={15} /> Preço de Liquidação das Diferenças
          </p>
          <div className="mt-3 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
            <div>
              <h1 className="max-w-3xl font-serif text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.06] text-carvao">Por que a energia tem este preço hoje?</h1>
              {integra(pld) && se ? (
                <p className="mt-5 max-w-2xl font-serif text-lg leading-snug text-carvao-muted md:text-xl">
                  Em {dataBR(pld.dia_referencia)}, o PLD médio do Sudeste/Centro-Oeste foi {reais(se.media_dia)}/MWh
                  {se.posicao.faixa ? `, na ${ROTULO_FAIXA_PLD[se.posicao.faixa]} das médias diárias desde 2021` : ""}, com {reais(pld.amplitude_dia)}/MWh de diferença entre o maior e o menor submercado. O preço sai de um sistema inteiro, do clima às regras: esta página o percorre etapa a etapa.
                </p>
              ) : (
                <p className="mt-5 max-w-2xl font-serif text-lg leading-snug text-carvao-muted md:text-xl">O preço horário da energia no Brasil, explicado etapa a etapa, do clima às regras.</p>
              )}
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
            </div>
            {integra(pld) && se && (
              <div className="border border-linha bg-superficie p-5 md:p-6">
                <MetricaHero
                  icone="preco"
                  rotulo={`PLD médio · SE/CO · ${dataBR(pld.dia_referencia)}`}
                  valor={reais(se.media_dia)}
                  unidade="/MWh"
                  natureza="CALCULADO"
                  variacao={se.variacao_dia_anterior ? `${sinal(se.variacao_dia_anterior.abs, 2)} (${sinal(se.variacao_dia_anterior.pct)}%) sobre o dia anterior` : "sem comparação com o dia anterior"}
                  sparkline={pld.diario.slice(-90).map((p) => p.SE)}
                  cor="var(--serie-pld)"
                  contexto={
                    <>
                      Faixa horária de {reais(se.min_hora)} a {reais(se.max_hora)}. {se.posicao.percentil !== null ? `Percentil ${num(se.posicao.percentil, 1)} das médias diárias desde 2021, valores nominais.` : ""} A linha mostra os últimos 90 dias.
                    </>
                  }
                  tamanho="grande"
                />
              </div>
            )}
          </div>
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
                  No <Termo slug="mcp">Mercado de Curto Prazo</Termo>, a CCEE apura o balanço de energia de cada perfil de agente, positivo ou
                  negativo, por submercado e hora, e o resultado financeiro correspondente. O PLD é o preço desse mercado. A CCEE publica esses
                  valores somados por submercado e hora e, no consolidado do mês, separa o resultado de venda e o de compra.
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-mineral [overflow-wrap:anywhere]">
                  Base: descrições oficiais dos conjuntos PLD_HORARIO_SUBMERCADO, SUMARIO_BE_HORARIO_SUBMERCADO e
                  SUMARIO_MENSAL_COMPRA_VENDA_SUBMERCADO no portal de dados abertos da CCEE, capturadas em 28/09/2026. <Conferido ok />
                </p>
                {exemploSe && integra(pld) && (
                  <div className="mt-5 border border-dashed border-mineral bg-papel p-4 text-sm leading-relaxed text-carvao">
                    <p className="rotulo text-mineral">Leitura usual do setor sobre um preço real; regra ainda não conferida</p>
                    <p className="mt-2">
                      Na hora mais cara de {dataBR(pld.dia_referencia)} no Sudeste/Centro-Oeste ({exemploSe.quando_max.slice(11, 13)}h), o PLD foi{" "}
                      {reais(exemploSe.max_hora)}/MWh <SeloNatureza natureza="OBSERVADO" />.
                    </p>
                    <p className="mt-2 text-carvao-muted">
                      Na leitura usual do setor, cada MWh de balanço de um perfil de agente naquela hora e submercado seria acertado a esse
                      preço: quem fechasse a hora com balanço negativo compraria a diferença no Mercado de Curto Prazo, e quem fechasse com
                      balanço positivo a venderia. A regra exata está nas Regras de Comercialização da CCEE, ainda não conferidas nesta fase; por
                      isso a plataforma não mostra valores de liquidação.
                    </p>
                  </div>
                )}
                <p className="mt-6 text-lg leading-relaxed text-carvao">
                  É um valor em R$/MWh que a CCEE calcula todos os dias para cada hora do dia seguinte e para cada um dos quatro{" "}
                  <Termo slug="submercado">submercados</Termo>. O cálculo é feito por modelos computacionais (NEWAVE, DECOMP e
                  DESSEM), tem como base o <Termo slug="cmo">custo marginal de operação</Termo> e respeita os limites mínimo e
                  máximos vigentes.
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-mineral">
                  Base: descrição oficial da CCEE no portal de dados abertos (conjunto PLD_HORARIO), capturada em 27/09/2026. <Conferido ok />
                </p>
                <div className="mt-8 border-l-2 border-energia pl-5">
                  <p className="rotulo text-mineral">A ideia central</p>
                  {integra(ger) && ger.regioes.find((r) => r.rg === "SIN")?.["12m"] && (
                    <p className="mt-2 flex flex-wrap items-center gap-2 leading-relaxed text-carvao">
                      <span>
                        Nos 12 meses até {dataBR(ger.dia_referencia)}, a geração hidráulica respondeu por{" "}
                        {pct(ger.regioes.find((r) => r.rg === "SIN")!["12m"]!.participacao.hidraulica)} da geração verificada do <Termo slug="sin">SIN</Termo>{" "}
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

          {/* 2. De onde vem o preço: o visual principal */}
          <Capitulo id="formacao" numero="2" subtitulo="De onde vem o preço?" titulo="O PLD emerge de um sistema, não de uma variável">
            <p className="mb-6 max-w-prose2 leading-relaxed text-carvao-muted">
              Do clima ao preço, etapa a etapa. Toque em cada nó para ver o que ele é, como está agora e como se liga ao seguinte. As
              definições vêm das fontes oficiais citadas; cada ligação declara seu tipo e se já foi conferida na documentação primária.
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
                  oQueMudou={
                    <>
                      Semana de {dataBR(cmo.semana_referencia)}: {cmo.ultima_semana.map((x) => `${x.sm === "SE" ? "SE/CO" : x.sm} ${reais(x.semanal)} (semana anterior ${reais(x.semana_anterior)})`).join("; ")}.
                      {picoCmo ? ` Maior valor semanal nas últimas 12 semanas: ${reais(picoCmo.v)}/MWh no ${NOME_SM_CMO[picoCmo.sm]}, na semana de ${dataBR(picoCmo.s)}.` : ""}
                    </>
                  }
                  comoInterpretar={<>Compare os subsistemas na mesma semana: valores iguais ou diferentes são saída do modelo DECOMP; a razão de uma diferença não é identificada aqui. A CCEE informa que o PLD horário é calculado com NEWAVE, DECOMP e DESSEM; o CMO semi-horário do DESSEM, também publicado pelo ONS, ainda não está integrado a este painel.</>}
                  naoConcluir={<>CMO semanal não é PLD: o PLD é horário, calculado pela CCEE, e aplica limites mínimo e máximos; os dois podem diferir muito na mesma semana (compare com os cartões do PLD no capítulo 3). O CMO é saída de modelo, não medição.</>}
                  proveniencia={cmo.proveniencia.cmo}
                >
                  <GraficoLinhas
                    titulo="CMO semanal por subsistema"
                    dados={cmoSerie}
                    chaveX="x"
                    series={[
                      { id: "SE", rotulo: "Sudeste/Centro-Oeste", sigla: "SE/CO", cor: "var(--serie-sm-se)" },
                      { id: "S", rotulo: "Sul", sigla: "S", cor: "var(--serie-sm-s)" },
                      { id: "NE", rotulo: "Nordeste", sigla: "NE", cor: "var(--serie-sm-ne)" },
                      { id: "N", rotulo: "Norte", sigla: "N", cor: "var(--serie-sm-n)" },
                    ]}
                    unidade="R$/MWh"
                    casas={2}
                    ensina={{ texto: "CMO: custo, por unidade de energia, para atender ao incremento de uma unidade de carga no SIN; aqui, o valor semanal estimado pelo DECOMP.", fonte: "ONS", href: "/setor-eletrico/aprenda/cmo", hrefRotulo: "Entenda CMO" }}
                  />
                </PainelEvidencia>
              </div>
            )}
          </Capitulo>

          {/* 3. O que está acontecendo */}
          <Capitulo id="hoje" numero="3" subtitulo="O que está acontecendo" titulo={integra(pld) ? `O PLD em ${dataBR(pld.dia_referencia)} e no período recente` : "O PLD no período recente"}>
            {integra(pld) ? (
              <>
                <PainelEvidencia
                  nivelTitulo={3}
                  id="linha-do-dia"
                  pergunta="Como o preço muda ao longo das 24 horas?"
                  subtitulo="PLD horário por submercado · R$/MWh nominais · hora local de Brasília"
                  porQueImporta={<>O PLD é horário: a curva do dia mostra em que horas o preço sobe e cai e se os quatro submercados seguem juntos. Escolha o dia entre os últimos 30 e, quando o dia coincide com o perfil de geração publicado, veja a solar e a eólica ao lado.</>}
                  oQueMudou={<>Em {dataBR(pld.dia_referencia)}, no Sudeste/Centro-Oeste, os valores horários foram de {reais(pld.cartoes[0].min_hora)} ({pld.cartoes[0].quando_min.slice(11, 13)}h) a {reais(pld.cartoes[0].max_hora)} ({pld.cartoes[0].quando_max.slice(11, 13)}h) por MWh.</>}
                  comoInterpretar={<>As faixas de fundo marcam madrugada, manhã, tarde e noite. Passe pelas horas para ler o valor de cada submercado; a tabela abaixo do gráfico traz os mesmos números.</>}
                  naoConcluir={<>Um único dia não é padrão. Ver geração e preço no mesmo dia não estabelece relação de causa: o preço sai dos modelos oficiais com muitas entradas, descritas no capítulo 2.</>}
                  proveniencia={pld.proveniencia.horario}
                  extraFonte={<>Captura primária de {carimbo(pld.proveniencia.horario.capturado_em)}.</>}
                  complementares={integra(ger) ? [{ rotulo: "Sobre o perfil horário de geração", p: ger.proveniencia.geracao }] : []}
                >
                  <LinhaDoDia dias={diasHorarios(pld)} perfil={integra(ger) ? { dia: ger.dia_referencia, horas: ger.perfil_horario_sin } : null} limiar={pld.limiar_diferenca} />
                </PainelEvidencia>
                <div className="mt-8">
                  <CartoesPld pld={pld} />
                </div>
                <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                  <span className="rotulo mr-1 text-mineral">O que não é possível concluir:</span>
                  a posição no histórico não diz para onde o preço vai, e a faixa horária mostra os extremos de um único dia. Faixa horária:{" "}
                  valores observados; média, variação e percentil: calculados.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-mineral">
                  <span>Fonte: CCEE, PLD_HORARIO; médias e posição calculadas pela Scrutiniums.</span>
                  <SobreEsteDado p={pld.proveniencia.horario} rotulo="Sobre o PLD horário" />
                  <SobreEsteDado p={pld.proveniencia.diario} rotulo="Sobre a média diária" />
                  <SobreEsteDado p={pld.proveniencia.posicao} rotulo="Sobre a posição histórica" />
                </div>
                <div className="mt-8" data-nivel="analisar">
                  <PainelEvidencia
                    nivelTitulo={3}
                    id="periodos"
                    pergunta="Em que horas o preço sobe, e as regiões se separam?"
                    subtitulo="PLD por submercado · R$/MWh nominais · hora local de Brasília"
                    porQueImporta={<>Alternar os períodos mostra se o dia de referência é típico da semana, do mês e do ano, e desde quando os submercados andam juntos ou separados.</>}
                    oQueMudou={<>Nos últimos 30 dias, {pld.periodos["30d"].diferenca.horas_acima_limiar} horas tiveram diferença acima de {reais(pld.limiar_diferenca)}/MWh entre submercados.</>}
                    comoInterpretar={<>O dia de referência, 7 e 30 dias mostram horas; 12 meses mostra médias diárias; o histórico, médias mensais desde 2021.</>}
                    naoConcluir={<>Uma posição alta ou baixa no histórico não diz para onde o preço vai. Anos diferentes têm limites regulatórios diferentes, não auditados nesta fase.</>}
                    proveniencia={pld.proveniencia.horario}
                    complementares={[
                      ...(pld.proveniencia.estatisticas ? [{ rotulo: "Sobre as estatísticas do período", p: pld.proveniencia.estatisticas }] : []),
                      { rotulo: "Sobre as médias diárias", p: pld.proveniencia.diario },
                      ...(pld.proveniencia.mensal ? [{ rotulo: "Sobre as médias mensais", p: pld.proveniencia.mensal }] : []),
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
                    casas={[null, null, 2, 2, 2, 2]}
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
                    Snapshot {pld.snapshot.id} · sha256 {pld.snapshot.sha256} · série de {horaLocal(pld.primeira_hora)} a {horaLocal(pld.ultima_hora)} (horário de Brasília)
                  </p>
                </div>
              </>
            ) : (
              <Indisponivel titulo="PLD indisponível" motivo={pld?.motivo ?? "Os dados processados do PLD não foram gerados."} />
            )}
          </Capitulo>

          {/* 4. Submercados */}
          <Capitulo id="submercados" numero="4" subtitulo="Por que os preços dos submercados podem diferir?" titulo="Quatro preços, quatro regiões e as linhas de transmissão entre elas">
            {integra(rede) && integra(pld) ? (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <MapaBrasil
                    titulo={`PLD médio de ${dataBR(pld.dia_referencia)} e fluxos de ${dataBR(rede.dia_referencia)}`}
                    tom="preco"
                    valores={Object.fromEntries(
                      pld.cartoes.map((c) => [c.sm, { valor: reais(c.media_dia), sub: c.posicao.percentil !== null ? `faixa ${c.posicao.percentil < 25 ? "baixa" : c.posicao.percentil > 75 ? "alta" : "central"} desde 2021` : "PLD médio do dia", intensidade: intensidadeFaixa(c.posicao.percentil) }]),
                    )}
                    fluxos={rede.fronteiras.map((f) => ({ de: f.de, para: f.para, valor: f.fluxo_dia }))}
                    legenda={`Chips: PLD médio de ${dataBR(pld.dia_referencia)} (R$/MWh); cor da região: posição do dia na distribuição desde 2021. Setas: sentido e fluxo médio verificado entre subsistemas em ${dataBR(rede.dia_referencia)}. Quando os preços divergem, o mapa mostra a diferença; a razão não é atribuída.`}
                    lista="abaixo"
                    detalhes={Object.fromEntries(
                      SMS.map((sm) => {
                        const c = pld.cartoes.find((x) => x.sm === sm);
                        const fr = rede.fronteiras.filter((f) => f.de === sm || f.para === sm);
                        return [
                          sm,
                          <ul key={sm} className="space-y-1">
                            {c && <li>PLD médio {reais(c.media_dia)}/MWh; faixa horária {reais(c.min_hora)} a {reais(c.max_hora)}.</li>}
                            {fr.map((f) => (
                              <li key={f.par}>
                                {f.nome}: {f.fluxo_dia === null ? "sem dado" : `${num(Math.abs(f.fluxo_dia), 0)} MWmed${f.fluxo_dia < 0 ? " no sentido inverso" : ""}`}; PLD diferente entre as pontas em {f.dias_com_diferenca_30d} de {f.n_dias_pld_30d} dias.
                              </li>
                            ))}
                          </ul>,
                        ];
                      }),
                    )}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-mineral">
                    <span>Fonte: CCEE (PLD) e ONS (intercâmbio). O mapa não mostra limites de transferência nem explica diferenças de preço.</span>
                    <SobreEsteDado p={pld.proveniencia.diario} rotulo="Sobre o PLD médio" />
                    <SobreEsteDado p={rede.proveniencia.fluxo} rotulo="Sobre os fluxos" />
                  </div>
                  <TabelaDados
                    titulo="Dados do mapa: PLD médio por submercado e fluxo por fronteira"
                    colunas={["Item", "Valor", "Unidade", "Dia"]}
                    linhas={[
                      ...pld.cartoes.map((c) => [`PLD médio, ${c.nome}`, c.media_dia, "R$/MWh", dataBR(pld.dia_referencia)] as (string | number | null)[]),
                      ...rede.fronteiras.map((f) => [`Fluxo ${f.nome}`, f.fluxo_dia === null ? null : num(f.fluxo_dia, 0), "MWmed", dataBR(rede.dia_referencia)] as (string | number | null)[]),
                    ]}
                    casas={[null, 2, null, null]}
                  />
                </div>
                <div className="min-w-0 space-y-4 leading-relaxed text-carvao">
                  <p>
                    A CCEE calcula um PLD para cada submercado. As regiões estão ligadas por linhas de transmissão de fronteira, e o
                    ONS mede o <Termo slug="intercambio">intercâmbio</Termo> entre elas hora a hora.
                  </p>
                  <p className="flex flex-wrap items-center gap-2 border-l-2 border-energia pl-4 text-sm text-carvao-muted">
                    <span>
                      {rede.serie_amplitude_pld.find((a) => a.d === pld.dia_referencia)
                        ? <>Em {dataBR(pld.dia_referencia)}, a diferença entre o maior e o menor PLD médio foi de {reais(rede.serie_amplitude_pld.find((a) => a.d === pld.dia_referencia)!.amplitude)}/MWh. </>
                        : null}
                      Nos últimos 30 dias, {pld.periodos["30d"].diferenca.horas_acima_limiar} horas tiveram diferença acima de {reais(pld.limiar_diferenca)}/MWh.
                    </span>
                    <SeloNatureza natureza="CALCULADO" />
                  </p>
                  <details className="border border-linha bg-superficie p-4">
                    <summary className="min-h-[44px] cursor-pointer font-serif text-lg text-carvao">Por que os preços estão diferentes?</summary>
                    <div className="mt-3 space-y-4 text-sm">
                      <p className="border border-dashed border-mineral p-3 text-carvao-muted">
                        <span className="rotulo mb-1 block text-mineral">Leitura usual do setor, ainda não conferida em documento primário</span>
                        Se a energia pudesse circular sem limite, o custo de atender uma carga a mais seria o mesmo em todo lugar. Como a
                        capacidade de transferência entre regiões é finita, uma região com sobra pode não conseguir enviar tudo o que
                        teria para outra, e os preços se separam.
                      </p>
                      <dl className="space-y-3">
                        <div>
                          <dt className="rotulo text-mineral">Capacidade de intercâmbio e restrições</dt>
                          <dd className="mt-1 text-carvao-muted">Não integradas: {rede.regras.limites}</dd>
                        </div>
                        {integra(ger) && (
                          <div>
                            <dt className="rotulo text-mineral">Diferenças de geração (7 dias até {dataBR(ger.dia_referencia)})</dt>
                            <dd className="mt-1 text-carvao-muted">
                              {SMS.map((sm) => {
                                const m = ger.regioes.find((r) => r.rg === sm)?.["7d"];
                                return m ? `${ger.regioes.find((r) => r.rg === sm)?.nome}: hidráulica ${pct(m.participacao.hidraulica, 0)}, eólica ${pct(m.participacao.eolica, 0)}, solar ${pct(m.participacao.solar, 0)}, térmica ${pct(m.participacao.termica, 0)}` : null;
                              })
                                .filter(Boolean)
                                .join("; ")}
                              .
                            </dd>
                          </div>
                        )}
                        {integra(carga) && (
                          <div>
                            <dt className="rotulo text-mineral">Diferenças de carga ({dataBR(carga.dia_referencia)})</dt>
                            <dd className="mt-1 text-carvao-muted">{carga.subsistemas.filter((s) => s.sm !== "SIN").map((s) => `${s.nome} ${num(s.dia, 0)} MWmed`).join("; ")}.</dd>
                          </div>
                        )}
                        <div>
                          <dt className="rotulo text-mineral">Outros fatores documentados</dt>
                          <dd className="mt-1 text-carvao-muted">A regra de formação do PLD por submercado está nas Regras de Comercialização da CCEE e na documentação dos modelos, ainda não conferidas nesta fase. Nenhum dos fatores acima é apontado como a razão de uma diferença específica.</dd>
                        </div>
                      </dl>
                      <ul className="space-y-1 text-xs text-mineral">
                        <li className="flex flex-wrap items-center gap-2">Definições de PLD por submercado (CCEE) e de intercâmbio (ONS): <Conferido ok /></li>
                        <li className="flex flex-wrap items-center gap-2">Mecanismo de separação por limite de transferência: <Conferido ok={false} /></li>
                      </ul>
                    </div>
                  </details>
                </div>
                <div className="lg:col-span-2" data-nivel="analisar">
                  <PainelEvidencia
                    nivelTitulo={3}
                    id="amplitude"
                    pergunta="Quando os submercados se separaram no último ano?"
                    subtitulo="Diferença entre o maior e o menor PLD médio diário · R$/MWh"
                    porQueImporta={<>Picos desta série marcam dias em que os PLDs médios das regiões ficaram mais distantes entre si.</>}
                    oQueMudou={<>{textoAmplitude(rede.resumo_amplitude)}</>}
                    comoInterpretar={<>Zero significa os quatro submercados com a mesma média diária. A série usa médias diárias; diferenças de poucas horas podem sumir na média.</>}
                    naoConcluir={<>A série não identifica qual fronteira ou linha separou os preços, nem se o limite de transferência foi atingido: os limites não estão integrados.</>}
                    proveniencia={rede.proveniencia.amplitude}
                  >
                    <GraficoLinhas
                      titulo="Diferença entre o maior e o menor PLD médio diário"
                      dados={amplitude}
                      chaveX="x"
                      series={[{ id: "amp", rotulo: "Diferença máx.−mín.", cor: "var(--serie-pld)" }]}
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
            <div className="mt-6">
              {prev && integra(pld) ? (
                <PrevisaoPld
                  diario={pld.diario.slice(-140)}
                  motivoIndisponivel={prev.atual.disponivel ? "A publicação de previsões ainda não está ligada a este gráfico." : (prev.atual.motivo ?? "Nenhum modelo em produção.")}
                  resumoRodada={resumoRodada}
                  nRegistros={prev.arquivo.length}
                  nPublicacoes={prev.publicacoes}
                />
              ) : (
                <Indisponivel titulo="Previsão indisponível" motivo="O arquivo de previsões ou a série do PLD não foram gerados nesta publicação." />
              )}
            </div>

            <div className="mt-10 grid items-start gap-8 lg:grid-cols-2">
              <div>
                <h3 className="font-serif text-xl text-carvao">Existem muitos futuros possíveis</h3>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                  Uma previsão honesta não é uma linha: é uma faixa, e a largura da faixa é informação. A ilustração ao lado mostra como muitas trajetórias possíveis se resumem numa faixa com a mediana no centro.
                </p>
                <div className="mt-4">
                  <ExplicadorIncerteza />
                </div>
              </div>
              <div>
                <div className="border border-linha bg-superficie p-5">
                  <h3 className="font-serif text-lg text-carvao">O que aparecerá aqui quando houver modelo em produção</h3>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-carvao-muted">
                    <li>
                      <span className="font-medium text-carvao">Por que a previsão mudou.</span> Barras com quanto cada informação nova (EAR, ENA, carga, renováveis, térmicas, intercâmbio) contribuiu para a mudança entre a previsão anterior e a atual, rotuladas como{" "}
                      <strong className="font-medium">contribuição do modelo</strong>, e só se a decomposição for tecnicamente justificável para o modelo em produção.
                    </li>
                    <li>
                      <span className="font-medium text-carvao">Se o modelo tem acertado.</span> Previsão, realizado e erro por entrega, depois erro típico, cobertura da faixa e comparação com referências simples. Os resultados retrospectivos da pesquisa estão{" "}
                      {mods?.publicacao_resultados.liberada ? "no registro de modelos" : "retidos até a conclusão da revisão da pesquisa e a liberação pelo responsável pela plataforma"}.
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            {prev && (
              <div id="maquina-do-tempo" className="mt-10 scroll-mt-28 border border-linha bg-superficie p-6" data-nivel="analisar">
                <p className="rotulo text-mineral">Auditabilidade em ação</p>
                <h3 className="mt-1 font-serif text-2xl text-carvao">Máquina do tempo da previsão</h3>
                <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                  Escolha uma data e veja o que a plataforma registrava naquele dia: os dados disponíveis, cada célula do arquivo (horizonte por submercado), o realizado das entregas já completas e o erro, quando os dois existem. O arquivo é imutável: nada é reescrito.
                </p>
                <div className="mt-5">
                  <MaquinaDoTempo registros={prev.arquivo} realizado={realizadoPorEntrega} />
                </div>
              </div>
            )}
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
                Validações automáticas, executadas a cada atualização antes de publicar (validador de governança do código do portal), bloqueiam: publicação de modelo não promovido, uso de dado posterior ao corte, alteração silenciosa de registro publicado, previsão sem versão ou snapshot, faixa não calibrada rotulada como 80%, cenário como previsão e ausência como número.
              </p>
            </div>
          </Capitulo>
        </ModoProfundidade>
      </main>
    </>
  );
}
