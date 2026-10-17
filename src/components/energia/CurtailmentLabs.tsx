"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TransicaoOpcoes } from "@/components/energia/TransicaoOpcoes";
import {
  PARAMETROS_INICIAIS,
  RENDIMENTO_BATERIA,
  cenariosDia,
  meiaHora,
  receitaDoCorte,
  simularDia,
  type Formas,
  type ParametrosDia,
  type ParametrosReceita,
} from "@/lib/energia/curtailment";
import { formatos } from "@/lib/energia/formato";
import { txEm } from "@/lib/energia/i18n/geracao";
import type { Idioma } from "@/lib/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * Laboratórios da seção Curtailment. Todos são modelos didáticos: as grandezas são escolhidas pela pessoa, e cada laboratório diz o que
 * deixa de fora. Os números oficiais ficam nas figuras da página, fora daqui.
 *
 * Controles: rádios e deslizantes nativos, com rótulo visível, valor escrito ao lado e alvo de 44 px; nenhuma informação depende só de
 * cor. O resultado de cada mudança é anunciado ao leitor de tela por uma região viva.
 */

/** Número no idioma da página (pt-BR ou en-US), com o sinal de menos tipográfico. */
function numero(idioma: Idioma) {
  const loc = idioma === "en" ? "en-US" : "pt-BR";
  return (v: number, casas = 0) => v.toLocaleString(loc, { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace(/^-/, "−");
}

/** Reais em milhões: "R$ 1,2 milhões"; em inglês, "R$ 1.2 million". */
function emMilhoes(idioma: Idioma) {
  const n = numero(idioma);
  const tx = txEm(idioma);
  return (v: number) => tx(`R$ ${n(v / 1e6, 1)} milhões`, `R$ ${n(v / 1e6, 1)} million`);
}

function Controle({
  rotulo,
  valor,
  min,
  max,
  passo = 1,
  unidade,
  onMudar,
  ajuda,
}: {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo?: number;
  unidade: string;
  onMudar: (v: number) => void;
  ajuda?: string;
}) {
  const id = useId();
  const n = numero(useIdioma());
  const casas = passo < 0.1 ? 2 : passo < 1 ? 1 : 0;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-sm text-carvao">
        <span>{rotulo}</span>
        <span className="tabular-nums font-medium">
          {n(valor, casas)} {unidade}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        aria-valuetext={`${n(valor, casas)} ${unidade}`}
        onChange={(e) => onMudar(Number(e.target.value))}
        className="block min-h-[44px] w-full accent-energia"
      />
      {ajuda && <p className="text-xs leading-relaxed text-carvao-muted">{ajuda}</p>}
    </div>
  );
}

function Cartao({ rotulo, valor, nota, destaque = false }: { rotulo: string; valor: ReactNode; nota?: ReactNode; destaque?: boolean }) {
  return (
    <div className={`border px-3 py-2 ${destaque ? "border-energia bg-energia-fundo" : "border-linha bg-superficie"}`}>
      <p className="text-xs text-carvao-muted">{rotulo}</p>
      <p className="mt-0.5 text-lg font-medium tabular-nums text-carvao">{valor}</p>
      {nota && <p className="mt-0.5 text-xs leading-relaxed text-carvao-muted">{nota}</p>}
    </div>
  );
}

function Moldura({ id, titulo, rotuloModelo, children }: { id: string; titulo: string; rotuloModelo: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="space-y-4 border border-linha bg-papel p-4 sm:p-5" data-laboratorio={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 id={`${id}-t`} className="font-serif text-lg text-carvao">
          {titulo}
        </h4>
        <span className="rotulo border border-dashed border-mineral px-2 py-0.5 text-xs text-carvao-muted">{rotuloModelo}</span>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ 1. uma meia hora */

export function LabMeiaHora() {
  const idioma = useIdioma();
  const tx = useTx();
  const n = numero(idioma);
  const [referencia, setReferencia] = useState(120);
  const [limite, setLimite] = useState(70);
  const [limitada, setLimitada] = useState(true);
  const [recurso, setRecurso] = useState(80);
  const r = meiaHora(referencia, limite, limitada, recurso);
  const escala = 200;
  const barra = (v: number, cor: string, padrao = false) => (
    <div className="h-5 w-full bg-superficie" aria-hidden="true">
      <div
        className="h-5"
        style={{
          width: `${Math.min(100, (100 * v) / escala)}%`,
          background: padrao ? `repeating-linear-gradient(45deg, ${cor} 0 4px, transparent 4px 8px)` : cor,
          border: padrao ? `1px dashed ${cor}` : undefined,
        }}
      />
    </div>
  );
  return (
    <Moldura
      id="lab-meia-hora"
      titulo={tx("Como o corte é medido: uma usina, uma meia hora", "How the cut is measured: one plant, one half hour")}
      rotuloModelo={tx("Modelo didático", "Teaching model")}
    >
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {tx(
          <>
            O ONS estima, para cada usina e cada meia hora, quanto ela geraria sem limitação (a referência). Quando ele limita a usina, a diferença
            entre a referência e o que foi gerado é a energia não gerada. Mexa nos valores e veja o que entra na conta e o que fica de fora.
          </>,
          <>
            For each plant and each half hour, the ONS estimates how much it would generate without limitation (the reference). When the ONS limits the plant, the difference
            between the reference and what was generated is the energy not generated. Move the values and see what enters the calculation and what is left out.
          </>,
        )}
      </p>
      <TransicaoOpcoes
        rotulo={tx("Nesta meia hora", "In this half hour")}
        nome="lab-meia-hora-limitada"
        opcoes={[
          ["sim", tx("O ONS limitou a usina", "The ONS limited the plant")],
          ["nao", tx("A usina gerou abaixo por falta de vento ou sol", "The plant generated less due to a lack of wind or sun")],
        ]}
        valor={limitada ? "sim" : "nao"} // i18n: dado
        onMudar={(v) => setLimitada(v === "sim")}
      />
      <div className="grid gap-5 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Controle rotulo={tx("Referência estimada pelo ONS", "Reference estimated by the ONS")} valor={referencia} min={0} max={200} unidade="MW" onMudar={setReferencia} />
          {limitada ? (
            <Controle rotulo={tx("Limite imposto pelo ONS", "Limit imposed by the ONS")} valor={limite} min={0} max={200} unidade="MW" onMudar={setLimite} />
          ) : (
            <Controle rotulo={tx("O que o vento ou o sol permitiram", "What the wind or sun allowed")} valor={recurso} min={0} max={200} unidade="MW" onMudar={setRecurso} />
          )}
        </div>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <p className="flex justify-between text-carvao">
              <span>{tx("Referência", "Reference")}</span>
              <span className="tabular-nums">{n(referencia)} MW</span>
            </p>
            {barra(referencia, "var(--serie-referencia)")}
          </div>
          <div className="space-y-1">
            <p className="flex justify-between text-carvao">
              <span>{tx("Gerada (verificada)", "Generated (verified)")}</span>
              <span className="tabular-nums">{n(r.verificadaMw)} MW</span>
            </p>
            {/* // i18n: dado (cor da barra) */}
            {barra(r.verificadaMw, "var(--cor-energia)")}
          </div>
          <div className="space-y-1">
            <p className="flex justify-between text-carvao">
              <span>{tx("Não gerada que entra na estatística", "Not generated, counted in the statistics")}</span>
              <span className="tabular-nums">{n(r.naoGeradaMw)} MW</span>
            </p>
            {barra(r.naoGeradaMw, "var(--serie-termica)", true)}
          </div>
          <p className="border-t border-linha pt-2 leading-relaxed text-carvao" aria-live="polite">
            {r.contada
              ? tx(
                  <>
                    Nesta meia hora entram <strong className="tabular-nums">{n(r.naoGeradaMwh, 1)} MWh</strong> de energia não gerada ({n(r.naoGeradaMw)} MW durante meia
                    hora, ou seja, MW × 0,5).
                    {limite >= referencia && " Com o limite acima da referência, a limitação não tirou nada: a usina gerou tudo o que podia."}
                  </>,
                  <>
                    In this half hour, <strong className="tabular-nums">{n(r.naoGeradaMwh, 1)} MWh</strong> of energy not generated are counted ({n(r.naoGeradaMw)} MW for half
                    an hour, that is, MW × {n(0.5, 1)}).
                    {limite >= referencia && " With the limit above the reference, the limitation took nothing away: the plant generated everything it could."}
                  </>,
                )
              : tx(
                  <>
                    Nada entra na estatística: a usina gerou {n(Math.max(0, referencia - r.verificadaMw))} MW abaixo da referência, mas sem limitação do ONS isso não é
                    corte. Falta de vento ou de sol, defeito ou manutenção da usina ficam fora.
                  </>,
                  <>
                    Nothing is counted in the statistics: the plant generated {n(Math.max(0, referencia - r.verificadaMw))} MW below the reference, but without an ONS limitation this is not
                    a cut. Lack of wind or sun, a plant fault or maintenance are left out.
                  </>,
                )}
          </p>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-carvao-muted">
        {tx(
          <>
            Fica de fora deste laboratório: como o ONS estima a referência. A taxa publicada no painel soma muitas meias horas e divide a energia não
            gerada pela soma de gerada e não gerada, nas mesmas usinas; o denominador não é a capacidade instalada.
          </>,
          <>
            Left out of this lab: how the ONS estimates the reference. The rate published in the panel adds up many half hours and divides the energy not
            generated by the sum of generated and not generated, in the same plants; the denominator is not the installed capacity.
          </>,
        )}
      </p>
    </Moldura>
  );
}

/* ------------------------------------------------------------------ 2. um dia no sistema */

function seriesDia(idioma: Idioma) {
  const tx = <T,>(pt: T, en: T) => (idioma === "en" ? en : pt);
  return [
    { id: "sincrona", rotulo: tx("Hidráulicas e térmicas (síncronas)", "Hydropower and thermal (synchronous)"), cor: "var(--serie-hidraulica)" },
    { id: "renovavelUsada", rotulo: tx("Eólica e solar aproveitadas", "Wind and solar used"), cor: "var(--serie-eolica)" },
    { id: "bateriaDescarga", rotulo: tx("Bateria devolvendo", "Battery discharging"), cor: "var(--serie-comp-4)" },
    { id: "bateriaCarga", rotulo: tx("Guardada na bateria", "Stored in the battery"), cor: "var(--serie-solar)" },
    { id: "ENE", rotulo: tx("Corte energético", "Energy cut"), cor: "var(--cor-energia)" }, // i18n: dado
    { id: "CNF", rotulo: tx("Corte por confiabilidade", "Reliability cut"), cor: "var(--serie-sm-se)" },
    { id: "REL", rotulo: tx("Corte elétrico", "Electrical cut"), cor: "var(--serie-termica)" },
  ];
}

export function SimuladorDia({ formas, diaReferencia }: { formas: Formas; diaReferencia: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const n = numero(idioma);
  const [p, setP] = useState<ParametrosDia>(PARAMETROS_INICIAIS);
  const [cenario, setCenario] = useState("partida");
  const def = (k: keyof ParametrosDia) => (v: number) => {
    setP((x) => ({ ...x, [k]: v }));
    setCenario("");
  };
  const r = useMemo(() => simularDia(p, formas), [p, formas]);
  const base = useMemo(() => simularDia(PARAMETROS_INICIAIS, formas), [formas]);
  const cenarios = cenariosDia(idioma);
  const escolhido = cenarios.find((c) => c.id === cenario);
  const rotuloVariacao = (de: number, para: number) => {
    const d = para - de;
    if (Math.abs(d) < 0.05) return tx("igual ao ponto de partida", "same as the starting point");
    const valor = `${d > 0 ? "+" : "−"}${n(Math.abs(d), 1)}`;
    return tx(`${valor} GWh contra o ponto de partida`, `${valor} GWh against the starting point`);
  };

  const comCorte = r.horas.filter((h) => h.ENE + h.CNF + h.REL > 0.005);
  const series = seriesDia(idioma).filter((s) => (s.id !== "bateriaCarga" && s.id !== "bateriaDescarga") || p.bateriaGw > 0);
  const espaco = r.horas.map((h) => ({
    hora: h.hora,
    disponivel: h.disponivel,
    espaco: Math.max(0, h.demanda - Math.max(Math.min(p.minimoSincronoGw, h.demanda), (Math.min(100, p.exigenciaSincronaPct) / 100) * h.demanda)),
    demanda: h.demanda,
  }));

  return (
    <Moldura id="lab-dia" titulo={tx("Por que o ONS corta: um dia no sistema, hora a hora", "Why the ONS cuts: one day in the system, hour by hour")} rotuloModelo={tx("Modelo didático", "Teaching model")}>
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {tx(
          <>
            O formato das curvas vem de um dia real ({diaReferencia}): a demanda segue a soma da geração verificada do SIN, e a eólica e a solar seguem as
            próprias curvas. As grandezas são suas. Três regras decidem o corte, nesta ordem: o Nordeste não escoa mais que a linha permite (elétrica); o país
            não consome mais que a demanda (energética); e a segurança pede um mínimo de máquinas que giram em sincronismo (confiabilidade).
          </>,
          <>
            The shape of the curves comes from a real day ({diaReferencia}): demand follows the sum of verified SIN generation, and wind and solar follow their
            own curves. The magnitudes are yours. Three rules decide the cut, in this order: the Northeast cannot send out more than the line allows (electrical); the country
            does not consume more than demand (energy); and security requires a minimum of machines spinning in synchronism (reliability).
          </>,
        )}
      </p>

      <div role="group" aria-label={tx("Cenários prontos", "Ready-made scenarios")} className="flex flex-wrap gap-2">
        {cenarios.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={cenario === c.id}
            onClick={() => {
              setP({ ...PARAMETROS_INICIAIS, ...c.mudanca });
              setCenario(c.id);
            }}
            className={`inline-flex min-h-[44px] items-center border px-3 text-sm ${
              cenario === c.id ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia"
            }`}
          >
            {c.rotulo}
          </button>
        ))}
      </div>
      {escolhido && <p className="max-w-prose2 text-sm leading-relaxed text-carvao">{escolhido.explicacao}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <fieldset className="space-y-3">
          <legend className="rotulo mb-1 text-mineral">{tx("Alavancas", "Levers")}</legend>
          <Controle rotulo={tx("Pico da demanda do país", "Country's peak demand")} valor={p.demandaPicoGw} min={50} max={130} unidade="GW" onMudar={def("demandaPicoGw")} />
          <Controle rotulo={tx("Eólica disponível no pico", "Wind available at the peak")} valor={p.eolicaPicoGw} min={0} max={60} unidade="GW" onMudar={def("eolicaPicoGw")} />
          <Controle rotulo={tx("Solar disponível no pico", "Solar available at the peak")} valor={p.solarPicoGw} min={0} max={100} unidade="GW" onMudar={def("solarPicoGw")} />
          <Controle
            rotulo={tx("Mínimo técnico das máquinas síncronas", "Technical minimum of the synchronous machines")}
            valor={p.minimoSincronoGw}
            min={0}
            max={60}
            unidade="GW"
            onMudar={def("minimoSincronoGw")}
            ajuda={tx("Hidráulicas e térmicas que não podem baixar mais (vazão mínima, contrato, ciclo térmico).", "Hydropower and thermal plants that cannot go any lower (minimum flow, contract, thermal cycle).")}
          />
          <Controle
            rotulo={tx("Máquinas síncronas exigidas pela segurança", "Synchronous machines required for security")}
            valor={p.exigenciaSincronaPct}
            min={0}
            max={80}
            unidade={tx("% da demanda", "% of demand")}
            onMudar={def("exigenciaSincronaPct")}
            ajuda={tx("Inércia e controle de frequência: parte da demanda precisa vir de máquinas girando em sincronismo.", "Inertia and frequency control: part of the demand has to come from machines spinning in synchronism.")}
          />
          <Controle rotulo={tx("Escoamento do Nordeste para o país", "Transmission from the Northeast to the country")} valor={p.escoamentoGw} min={0} max={60} unidade="GW" onMudar={def("escoamentoGw")} />
          <Controle rotulo={tx("Bateria: potência", "Battery: capacity")} valor={p.bateriaGw} min={0} max={30} unidade="GW" onMudar={def("bateriaGw")} />
          <Controle
            rotulo={tx("Bateria: energia", "Battery: energy")}
            valor={p.bateriaGwh}
            min={0}
            max={150}
            passo={5}
            unidade="GWh"
            onMudar={def("bateriaGwh")}
            ajuda={tx(
              `Rendimento de ida e volta de ${n(RENDIMENTO_BATERIA * 100)}%: parte do que entra se perde no ciclo.`,
              `Round-trip efficiency of ${n(RENDIMENTO_BATERIA * 100)}%: part of what goes in is lost in the cycle.`,
            )}
          />
          <details className="text-sm">
            <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4">{tx("Onde está cada fonte", "Where each source is")}</summary>
            <div className="mt-2 space-y-3">
              <Controle rotulo={tx("Demanda no Nordeste", "Demand in the Northeast")} valor={p.nordesteDemandaPct} min={0} max={50} unidade="%" onMudar={def("nordesteDemandaPct")} />
              <Controle rotulo={tx("Eólica no Nordeste", "Wind in the Northeast")} valor={p.nordesteEolicaPct} min={0} max={100} unidade="%" onMudar={def("nordesteEolicaPct")} />
              <Controle rotulo={tx("Solar no Nordeste", "Solar in the Northeast")} valor={p.nordesteSolarPct} min={0} max={100} unidade="%" onMudar={def("nordesteSolarPct")} />
            </div>
          </details>
        </fieldset>

        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-live="polite">
            <Cartao destaque rotulo={tx("Eólica e solar cortadas no dia", "Wind and solar cut in the day")} valor={`${n(r.cortadaGwh, 1)} GWh`} nota={rotuloVariacao(base.cortadaGwh, r.cortadaGwh)} />
            <Cartao
              rotulo={tx("Parcela cortada do recurso", "Share of the resource cut")}
              valor={`${n(r.taxaPct, 1)}%`}
              nota={tx(`de ${n(r.disponivelGwh, 0)} GWh disponíveis`, `of ${n(r.disponivelGwh, 0)} GWh available`)}
            />
            <Cartao
              rotulo={tx("Por razão", "By reason")}
              valor={
                <span className="text-sm">
                  ENE {n(r.porRazaoGwh.ENE, 1)} · CNF {n(r.porRazaoGwh.CNF, 1)} · REL {n(r.porRazaoGwh.REL, 1)}
                </span>
              }
              nota={tx("GWh: energético, confiabilidade e elétrico", "GWh: energy, reliability and electrical")}
            />
            <Cartao
              rotulo={tx("Maior corte numa hora", "Largest cut in an hour")}
              valor={`${n(r.picoCorteGw, 1)} GW`}
              nota={r.horaPicoCorte ? tx(`às ${r.horaPicoCorte}`, `at ${r.horaPicoCorte}`) : tx("sem corte", "no cut")}
            />
          </div>
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
            {comCorte.length
              ? tx(
                  `Há corte em ${comCorte.length} das 24 horas, de ${comCorte[0].hora} a ${comCorte[comCorte.length - 1].hora}.`,
                  `There are cuts in ${comCorte.length} of the 24 hours, from ${comCorte[0].hora} to ${comCorte[comCorte.length - 1].hora}.`,
                )
              : tx("Sem corte: todo o recurso eólico e solar encontra demanda ao lado das máquinas síncronas exigidas.", "No cut: all the wind and solar resource finds demand alongside the required synchronous machines.")}
            {p.bateriaGw > 0 &&
              p.bateriaGwh > 0 &&
              tx(
                ` A bateria guardou ${n(r.bateriaCarregadaGwh, 1)} GWh e devolveu ${n(r.bateriaDevolvidaGwh, 1)} GWh depois.`,
                ` The battery stored ${n(r.bateriaCarregadaGwh, 1)} GWh and returned ${n(r.bateriaDevolvidaGwh, 1)} GWh later.`,
              )}
          </p>
          <GraficoBarras
            titulo={tx("Para onde vai a energia possível em cada hora", "Where the possible energy goes in each hour")}
            dados={r.horas}
            chaveCategoria="hora"
            series={series}
            unidade="GW"
            casas={1}
            empilhado
            altura={320}
          />
          <GraficoLinhas
            titulo={tx("Recurso eólico e solar contra o espaço que sobra para ele", "Wind and solar resource against the room left for it")}
            dados={espaco}
            chaveX="hora"
            formatoX="texto"
            series={[
              { id: "disponivel", rotulo: tx("Eólica e solar disponíveis", "Wind and solar available"), cor: "var(--serie-eolica)" },
              { id: "espaco", rotulo: tx("Espaço: demanda menos máquinas síncronas exigidas", "Room: demand minus required synchronous machines"), cor: "var(--serie-hidraulica)", tracejada: true },
              { id: "demanda", rotulo: tx("Demanda", "Demand"), cor: "var(--serie-referencia)" },
            ]}
            unidade="GW"
            casas={1}
            zeroNoEixo
            altura={240}
          />
          <p className="text-xs leading-relaxed text-carvao-muted">
            {tx(
              <>
                Onde a linha do recurso passa acima da linha tracejada, sobra eólica e solar: é a forma do corte energético e por confiabilidade. O corte elétrico
                aparece mesmo abaixo dela, quando a sobra está presa no Nordeste.
              </>,
              <>
                Where the resource line rises above the dashed line, there is surplus wind and solar: that is the shape of the energy and reliability cut. The electrical cut
                appears even below it, when the surplus is trapped in the Northeast.
              </>,
            )}
          </p>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-carvao-muted">
        {tx(
          <>
            Fica de fora deste laboratório: intercâmbio com outros países, reservatórios e a decisão de quanto guardar de água, rampas das térmicas, exportação, a
            geração distribuída como redução da demanda, o despacho do ONS por usina e a regra oficial de classificação das razões. O ponto de partida foi
            escolhido para mostrar as três razões; ele não reproduz a taxa de nenhum mês real.
          </>,
          <>
            Left out of this lab: interchange with other countries, reservoirs and the decision on how much water to store, thermal ramps, exports,
            distributed generation as a reduction in demand, ONS dispatch by plant and the official rule for classifying the reasons. The starting point was
            chosen to show all three reasons; it does not reproduce the rate of any real month.
          </>,
        )}
      </p>
    </Moldura>
  );
}

/* ------------------------------------------------------------------ 3. quem gera */

export type PadraoReceita = {
  fonte: "eolica" | "solar";
  rotulo: string;
  /** Taxa de restrição publicada para os 12 meses e a parcela da razão elétrica, com o período por extenso. */
  taxaPct: number | null;
  parcelaEletricaPct: number | null;
  periodo: string;
};

export function LabReceita({ padroes, pld, pldNota }: { padroes: PadraoReceita[]; pld: number | null; pldNota: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const n = numero(idioma);
  const reais = emMilhoes(idioma);
  const { dataBR } = formatos(idioma);
  const inicial = padroes[0];
  const valoresDe = (pd: PadraoReceita | undefined): ParametrosReceita => ({
    potenciaMw: 100,
    fatorCapacidadePct: pd?.fonte === "solar" ? 25 : 45,
    // os valores publicados entram como publicados: arredondar mudaria a premissa que o texto diz ser a da fonte
    taxaCortePct: pd?.taxaPct ?? 10,
    parcelaEletricaPct: pd?.parcelaEletricaPct ?? 0,
    precoContrato: 200,
    pldNasHorasDeCorte: pld ?? 60,
  });
  const [fonte, setFonte] = useState<string>(inicial?.fonte ?? "eolica");
  const [p, setP] = useState<ParametrosReceita>(valoresDe(inicial));
  const def = (k: keyof ParametrosReceita) => (v: number) => setP((x) => ({ ...x, [k]: v }));
  const r = receitaDoCorte(p);
  const pd = padroes.find((x) => x.fonte === fonte);

  return (
    <Moldura id="lab-receita" titulo={tx("Do lado de quem gera: quanto vale a energia cortada", "On the generator's side: how much the curtailed energy is worth")} rotuloModelo={tx("Modelo didático", "Teaching model")}>
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {tx(
          <>
            Uma usina hipotética. A taxa de corte e a parcela da razão elétrica começam nos valores publicados para os últimos 12 meses ({pd?.periodo ?? "período não publicado"}
            ); potência, fator de capacidade e preço de contrato são valores de exemplo para você trocar pelos do seu caso.
          </>,
          <>
            A hypothetical plant. The cut rate and the electrical-reason share start at the values published for the last 12 months ({pd?.periodo ?? "period not published"}
            ); capacity, capacity factor and contract price are example values for you to replace with those of your case.
          </>,
        )}
      </p>
      {padroes.length > 1 && (
        <TransicaoOpcoes
          rotulo={tx("Fonte", "Source")}
          nome="lab-receita-fonte"
          opcoes={padroes.map((x) => [x.fonte, x.rotulo] as const)}
          valor={fonte}
          onMudar={(v) => {
            setFonte(v);
            setP(valoresDe(padroes.find((x) => x.fonte === v)));
          }}
        />
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <fieldset className="space-y-3">
          <legend className="rotulo mb-1 text-mineral">{tx("Premissas", "Assumptions")}</legend>
          <Controle rotulo={tx("Potência da usina", "Plant capacity")} valor={p.potenciaMw} min={10} max={1000} passo={10} unidade="MW" onMudar={def("potenciaMw")} />
          <Controle rotulo={tx("Fator de capacidade (exemplo)", "Capacity factor (example)")} valor={p.fatorCapacidadePct} min={5} max={70} unidade="%" onMudar={def("fatorCapacidadePct")} />
          <Controle
            rotulo={tx("Taxa de corte", "Cut rate")}
            valor={p.taxaCortePct}
            min={0}
            max={60}
            passo={0.1}
            unidade="%"
            onMudar={def("taxaCortePct")}
            ajuda={
              pd?.taxaPct != null
                ? tx(`Publicado para as ${pd.rotulo.toLowerCase()} em ${pd.periodo}: ${n(pd.taxaPct, 1)}%.`, `Published for ${pd.rotulo.toLowerCase()} plants in ${pd.periodo}: ${n(pd.taxaPct, 1)}%.`)
                : undefined
            }
          />
          <Controle
            rotulo={tx("Parcela com razão elétrica", "Share with an electrical reason")}
            valor={p.parcelaEletricaPct}
            min={0}
            max={100}
            passo={0.1}
            unidade="%"
            onMudar={def("parcelaEletricaPct")}
            ajuda={pd?.parcelaEletricaPct != null ? tx(`Publicado: ${n(pd.parcelaEletricaPct, 1)}% da energia não gerada.`, `Published: ${n(pd.parcelaEletricaPct, 1)}% of the energy not generated.`) : undefined}
          />
          <Controle rotulo={tx("Preço do contrato (exemplo)", "Contract price (example)")} valor={p.precoContrato} min={0} max={600} passo={10} unidade="R$/MWh" onMudar={def("precoContrato")} />
          <Controle rotulo={tx("PLD nas horas de corte", "PLD in the hours with cuts")} valor={p.pldNasHorasDeCorte} min={0} max={800} passo={0.01} unidade="R$/MWh" onMudar={def("pldNasHorasDeCorte")} ajuda={pldNota} />
        </fieldset>
        <div className="min-w-0 space-y-3" aria-live="polite">
          <div className="grid grid-cols-2 gap-2">
            <Cartao
              rotulo={tx("Energia possível no ano", "Possible energy in the year")}
              valor={`${n(r.possivelMwh / 1e3, 1)} GWh`}
              nota={tx(`potência × fator de capacidade × 8.760 h`, `capacity × capacity factor × ${n(8760)} h`)}
            />
            <Cartao destaque rotulo={tx("Energia cortada no ano", "Energy cut in the year")} valor={`${n(r.cortadaMwh / 1e3, 1)} GWh`} nota={tx(`${n(p.taxaCortePct, 1)}% da possível`, `${n(p.taxaCortePct, 1)}% of the possible`)} />
            <Cartao rotulo={tx("Valor a preço de contrato", "Value at the contract price")} valor={reais(r.valorContrato)} nota={tx("o que a energia cortada valeria na venda", "what the curtailed energy would be worth when sold")} />
            <Cartao
              rotulo={tx("Valor ao PLD informado", "Value at the PLD entered")}
              valor={reais(r.valorPld)}
              nota={tx("custo de repor no curto prazo, ou o que deixa de receber quem vende nele", "cost of replacing it in the short-term market, or what a seller in that market fails to receive")}
            />
            <Cartao
              rotulo={tx("Cortada com razão elétrica", "Cut with an electrical reason")}
              valor={`${n(r.eletricaMwh / 1e3, 1)} GWh`}
              nota={tx("a razão que a norma lida associa a ressarcimento", "the reason that the regulation read associates with compensation")}
            />
            <Cartao
              rotulo={tx("Diferença entre os dois valores", "Difference between the two values")}
              valor={reais(Math.abs(r.valorContrato - r.valorPld))}
              nota={tx("quanto o preço da hora do corte muda a conta", "how much the price in the hour of the cut changes the calculation")}
            />
          </div>
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
            {tx(
              <>
                A mesma energia cortada vale {reais(r.valorContrato)} a preço de contrato e {reais(r.valorPld)} ao PLD informado. Quando o corte acontece nas horas em
                que o PLD está baixo, repor a energia no curto prazo custa pouco por MWh; o que pesa é o volume e quem, pelas regras do contrato, arca com ele.
              </>,
              <>
                The same curtailed energy is worth {reais(r.valorContrato)} at the contract price and {reais(r.valorPld)} at the PLD entered. When the cut happens in hours when
                the PLD is low, replacing the energy in the short-term market costs little per MWh; what weighs is the volume and who, under the contract rules, bears it.
              </>,
            )}
          </p>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-carvao-muted">
        {tx(
          <>
            Fica de fora deste laboratório: ressarcimento por encargo de serviços do sistema (pela norma lida, a REN ANEEL nº 1.030/2022 em cópia de 08/01/2025, só
            a razão de indisponibilidade externa dá direito a ele; franquias, cálculo e alterações posteriores indicadas em fontes secundárias não foram
            verificadas), garantia física, contratos por disponibilidade, tributos e encargos. Não é avaliação de nenhuma usina real.
          </>,
          <>
            Left out of this lab: compensation through the system services charge (under the regulation read, ANEEL normative resolution (REN) No. 1.030/2022 in a copy dated {dataBR("2025-01-08")}, only
            the external unavailability reason gives the right to it; allowances, calculation and later changes indicated in secondary sources were not
            verified), physical guarantee, availability contracts, taxes and charges. It is not an assessment of any real plant.
          </>,
        )}
      </p>
    </Moldura>
  );
}

/* ------------------------------------------------------------------ 4. o que o país deixou de usar */

export function LabValorPerdido({ cortadaTwh, periodo, pldMenor, pldNota }: { cortadaTwh: number; periodo: string; pldMenor: number | null; pldNota: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const n = numero(idioma);
  const [preco, setPreco] = useState(200);
  const valorBi = (cortadaTwh * 1e6 * preco) / 1e9;
  const atalhos: { rotulo: string; v: number }[] = [
    ...(pldMenor !== null ? [{ rotulo: tx(`Menor PLD horário do ano (R$ ${n(pldMenor, 2)})`, `Lowest hourly PLD of the year (R$ ${n(pldMenor, 2)})`), v: Math.round(pldMenor * 100) / 100 }] : []),
    { rotulo: tx("R$ 200/MWh (exemplo)", "R$ 200/MWh (example)"), v: 200 },
    { rotulo: tx("R$ 400/MWh (exemplo)", "R$ 400/MWh (example)"), v: 400 },
  ];
  return (
    <Moldura
      id="lab-valor"
      titulo={tx("Quanto vale a energia que o país deixou de usar", "How much the energy the country did not use is worth")}
      rotuloModelo={tx("Conta com dado publicado e preço escolhido", "Calculation with published data and a chosen price")}
    >
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {tx(
          <>
            A quantidade é a publicada: {n(cortadaTwh, 1)} TWh de eólicas e fotovoltaicas não gerados por limitação do ONS em {periodo}. O preço é a escolha: não
            existe um preço único da energia cortada, e o valor muda muito conforme a régua. Por isso a conta mostra a faixa, não um número.
          </>,
          <>
            The quantity is the published one: {n(cortadaTwh, 1)} TWh from wind and photovoltaic plants not generated due to ONS limitation in {periodo}. The price is the choice: there is
            no single price for curtailed energy, and the value changes a lot depending on the yardstick. That is why the calculation shows the range, not a single number.
          </>,
        )}
      </p>
      <div role="group" aria-label={tx("Preços de referência", "Reference prices")} className="flex flex-wrap gap-2">
        {atalhos.map((a) => (
          <button
            key={a.rotulo}
            type="button"
            aria-pressed={Math.abs(preco - a.v) < 0.005}
            onClick={() => setPreco(a.v)}
            className={`inline-flex min-h-[44px] items-center border px-3 text-sm ${
              Math.abs(preco - a.v) < 0.005 ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <Controle rotulo={tx("Preço atribuído à energia", "Price assigned to the energy")} valor={preco} min={0} max={800} passo={1} unidade="R$/MWh" onMudar={setPreco} ajuda={pldNota} />
        <div className="grid grid-cols-2 gap-2" aria-live="polite">
          <Cartao
            destaque
            rotulo={tx("Valor da energia não gerada", "Value of the energy not generated")}
            valor={tx(`R$ ${n(valorBi, 1)} bilhões`, `R$ ${n(valorBi, 1)} billion`)}
            nota={`${n(cortadaTwh, 1)} TWh × R$ ${n(preco, 2)}/MWh`}
          />
          <Cartao
            rotulo={tx("Por MWh de diferença no preço", "Per MWh of difference in the price")}
            valor={tx(`R$ ${n((cortadaTwh * 1e6) / 1e6, 1)} milhões`, `R$ ${n((cortadaTwh * 1e6) / 1e6, 1)} million`)}
            nota={tx("cada R$ 1/MWh a mais na régua soma isto ao valor", "each extra R$ 1/MWh on the yardstick adds this to the value")}
          />
        </div>
      </div>
      <p className="text-xs leading-relaxed text-carvao-muted">
        {tx(
          <>
            O valor não é custo do consumidor nem prejuízo de um agente: ele diz a ordem de grandeza do recurso que já tinha usina construída e não chegou a quem
            consome. Quem arca com quanto depende das regras de contrato e de ressarcimento, que este laboratório não modela.
          </>,
          <>
            The value is neither a consumer cost nor an agent&apos;s loss: it gives the order of magnitude of the resource that already had a plant built and did not reach those who
            consume. Who bears how much depends on the contract and compensation rules, which this lab does not model.
          </>,
        )}
      </p>
    </Moldura>
  );
}
