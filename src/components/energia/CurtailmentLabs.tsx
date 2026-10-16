"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TransicaoOpcoes } from "@/components/energia/TransicaoOpcoes";
import {
  CENARIOS_DIA,
  PARAMETROS_INICIAIS,
  RENDIMENTO_BATERIA,
  meiaHora,
  receitaDoCorte,
  simularDia,
  type Formas,
  type ParametrosDia,
  type ParametrosReceita,
} from "@/lib/energia/curtailment";

/**
 * Laboratórios da seção Curtailment. Todos são modelos didáticos: as grandezas são escolhidas pela pessoa, e cada laboratório diz o que
 * deixa de fora. Os números oficiais ficam nas figuras da página, fora daqui.
 *
 * Controles: rádios e deslizantes nativos, com rótulo visível, valor escrito ao lado e alvo de 44 px; nenhuma informação depende só de
 * cor. O resultado de cada mudança é anunciado ao leitor de tela por uma região viva.
 */

const n = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace(/^-/, "−");
const reais = (v: number) => `R$ ${n(v / 1e6, 1)} milhões`;

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
  const casas = passo < 1 ? 1 : 0;
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
    <Moldura id="lab-meia-hora" titulo="Como o corte é medido: uma usina, uma meia hora" rotuloModelo="Modelo didático">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        O ONS estima, para cada usina e cada meia hora, quanto ela geraria sem limitação (a referência). Quando ele limita a usina, a diferença
        entre a referência e o que foi gerado é a energia não gerada. Mexa nos valores e veja o que entra na conta e o que fica de fora.
      </p>
      <TransicaoOpcoes
        rotulo="Nesta meia hora"
        nome="lab-meia-hora-limitada"
        opcoes={[
          ["sim", "O ONS limitou a usina"],
          ["nao", "A usina gerou abaixo por falta de vento ou sol"],
        ]}
        valor={limitada ? "sim" : "nao"}
        onMudar={(v) => setLimitada(v === "sim")}
      />
      <div className="grid gap-5 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Controle rotulo="Referência estimada pelo ONS" valor={referencia} min={0} max={200} unidade="MW" onMudar={setReferencia} />
          {limitada ? (
            <Controle rotulo="Limite imposto pelo ONS" valor={limite} min={0} max={200} unidade="MW" onMudar={setLimite} />
          ) : (
            <Controle rotulo="O que o vento ou o sol permitiram" valor={recurso} min={0} max={200} unidade="MW" onMudar={setRecurso} />
          )}
        </div>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <p className="flex justify-between text-carvao">
              <span>Referência</span>
              <span className="tabular-nums">{n(referencia)} MW</span>
            </p>
            {barra(referencia, "var(--serie-referencia)")}
          </div>
          <div className="space-y-1">
            <p className="flex justify-between text-carvao">
              <span>Gerada (verificada)</span>
              <span className="tabular-nums">{n(r.verificadaMw)} MW</span>
            </p>
            {barra(r.verificadaMw, "var(--cor-energia)")}
          </div>
          <div className="space-y-1">
            <p className="flex justify-between text-carvao">
              <span>Não gerada que entra na estatística</span>
              <span className="tabular-nums">{n(r.naoGeradaMw)} MW</span>
            </p>
            {barra(r.naoGeradaMw, "var(--serie-termica)", true)}
          </div>
          <p className="border-t border-linha pt-2 leading-relaxed text-carvao" aria-live="polite">
            {r.contada ? (
              <>
                Nesta meia hora entram <strong className="tabular-nums">{n(r.naoGeradaMwh, 1)} MWh</strong> de energia não gerada ({n(r.naoGeradaMw)} MW durante meia
                hora, ou seja, MW × 0,5).
                {limite >= referencia && " Com o limite acima da referência, a limitação não tirou nada: a usina gerou tudo o que podia."}
              </>
            ) : (
              <>
                Nada entra na estatística: a usina gerou {n(Math.max(0, referencia - r.verificadaMw))} MW abaixo da referência, mas sem limitação do ONS isso não é
                corte. Falta de vento ou de sol, defeito ou manutenção da usina ficam fora.
              </>
            )}
          </p>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-carvao-muted">
        Fica de fora deste laboratório: como o ONS estima a referência. A taxa publicada no painel soma muitas meias horas e divide a energia não
        gerada pela soma de gerada e não gerada, nas mesmas usinas; o denominador não é a capacidade instalada.
      </p>
    </Moldura>
  );
}

/* ------------------------------------------------------------------ 2. um dia no sistema */

const SERIES_DIA = [
  { id: "sincrona", rotulo: "Hidráulicas e térmicas (síncronas)", cor: "var(--serie-hidraulica)" },
  { id: "renovavelUsada", rotulo: "Eólica e solar aproveitadas", cor: "var(--serie-eolica)" },
  { id: "bateriaDescarga", rotulo: "Bateria devolvendo", cor: "var(--serie-comp-4)" },
  { id: "bateriaCarga", rotulo: "Guardada na bateria", cor: "var(--serie-solar)" },
  { id: "ENE", rotulo: "Corte energético", cor: "var(--cor-energia)" },
  { id: "CNF", rotulo: "Corte por confiabilidade", cor: "var(--serie-sm-se)" },
  { id: "REL", rotulo: "Corte elétrico", cor: "var(--serie-termica)" },
];

const rotuloVariacao = (de: number, para: number) => {
  const d = para - de;
  if (Math.abs(d) < 0.05) return "igual ao ponto de partida";
  return `${d > 0 ? "+" : "−"}${n(Math.abs(d), 1)} GWh contra o ponto de partida`;
};

export function SimuladorDia({ formas, diaReferencia }: { formas: Formas; diaReferencia: string }) {
  const [p, setP] = useState<ParametrosDia>(PARAMETROS_INICIAIS);
  const [cenario, setCenario] = useState("partida");
  const def = (k: keyof ParametrosDia) => (v: number) => {
    setP((x) => ({ ...x, [k]: v }));
    setCenario("");
  };
  const r = useMemo(() => simularDia(p, formas), [p, formas]);
  const base = useMemo(() => simularDia(PARAMETROS_INICIAIS, formas), [formas]);
  const escolhido = CENARIOS_DIA.find((c) => c.id === cenario);

  const comCorte = r.horas.filter((h) => h.ENE + h.CNF + h.REL > 0.005);
  const series = SERIES_DIA.filter((s) => (s.id !== "bateriaCarga" && s.id !== "bateriaDescarga") || p.bateriaGw > 0);
  const espaco = r.horas.map((h) => ({
    hora: h.hora,
    disponivel: h.disponivel,
    espaco: Math.max(0, h.demanda - Math.max(Math.min(p.minimoSincronoGw, h.demanda), (Math.min(100, p.exigenciaSincronaPct) / 100) * h.demanda)),
    demanda: h.demanda,
  }));

  return (
    <Moldura id="lab-dia" titulo="Por que o ONS corta: um dia no sistema, hora a hora" rotuloModelo="Modelo didático">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        O formato das curvas vem de um dia real ({diaReferencia}): a demanda segue a soma da geração verificada do SIN, e a eólica e a solar seguem as
        próprias curvas. As grandezas são suas. Três regras decidem o corte, nesta ordem: o Nordeste não escoa mais que a linha permite (elétrica); o país
        não consome mais que a demanda (energética); e a segurança pede um mínimo de máquinas que giram em sincronismo (confiabilidade).
      </p>

      <div role="group" aria-label="Cenários prontos" className="flex flex-wrap gap-2">
        {CENARIOS_DIA.map((c) => (
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
          <legend className="rotulo mb-1 text-mineral">Alavancas</legend>
          <Controle rotulo="Pico da demanda do país" valor={p.demandaPicoGw} min={50} max={130} unidade="GW" onMudar={def("demandaPicoGw")} />
          <Controle rotulo="Eólica disponível no pico" valor={p.eolicaPicoGw} min={0} max={60} unidade="GW" onMudar={def("eolicaPicoGw")} />
          <Controle rotulo="Solar disponível no pico" valor={p.solarPicoGw} min={0} max={100} unidade="GW" onMudar={def("solarPicoGw")} />
          <Controle
            rotulo="Mínimo técnico das máquinas síncronas"
            valor={p.minimoSincronoGw}
            min={0}
            max={60}
            unidade="GW"
            onMudar={def("minimoSincronoGw")}
            ajuda="Hidráulicas e térmicas que não podem baixar mais (vazão mínima, contrato, ciclo térmico)."
          />
          <Controle
            rotulo="Máquinas síncronas exigidas pela segurança"
            valor={p.exigenciaSincronaPct}
            min={0}
            max={80}
            unidade="% da demanda"
            onMudar={def("exigenciaSincronaPct")}
            ajuda="Inércia e controle de frequência: parte da demanda precisa vir de máquinas girando em sincronismo."
          />
          <Controle rotulo="Escoamento do Nordeste para o país" valor={p.escoamentoGw} min={0} max={60} unidade="GW" onMudar={def("escoamentoGw")} />
          <Controle rotulo="Bateria: potência" valor={p.bateriaGw} min={0} max={30} unidade="GW" onMudar={def("bateriaGw")} />
          <Controle
            rotulo="Bateria: energia"
            valor={p.bateriaGwh}
            min={0}
            max={150}
            passo={5}
            unidade="GWh"
            onMudar={def("bateriaGwh")}
            ajuda={`Rendimento de ida e volta de ${n(RENDIMENTO_BATERIA * 100)}%: parte do que entra se perde no ciclo.`}
          />
          <details className="text-sm">
            <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4">Onde está cada fonte</summary>
            <div className="mt-2 space-y-3">
              <Controle rotulo="Demanda no Nordeste" valor={p.nordesteDemandaPct} min={0} max={50} unidade="%" onMudar={def("nordesteDemandaPct")} />
              <Controle rotulo="Eólica no Nordeste" valor={p.nordesteEolicaPct} min={0} max={100} unidade="%" onMudar={def("nordesteEolicaPct")} />
              <Controle rotulo="Solar no Nordeste" valor={p.nordesteSolarPct} min={0} max={100} unidade="%" onMudar={def("nordesteSolarPct")} />
            </div>
          </details>
        </fieldset>

        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-live="polite">
            <Cartao destaque rotulo="Eólica e solar cortadas no dia" valor={`${n(r.cortadaGwh, 1)} GWh`} nota={rotuloVariacao(base.cortadaGwh, r.cortadaGwh)} />
            <Cartao rotulo="Parcela cortada do recurso" valor={`${n(r.taxaPct, 1)}%`} nota={`de ${n(r.disponivelGwh, 0)} GWh disponíveis`} />
            <Cartao
              rotulo="Por razão"
              valor={
                <span className="text-sm">
                  ENE {n(r.porRazaoGwh.ENE, 1)} · CNF {n(r.porRazaoGwh.CNF, 1)} · REL {n(r.porRazaoGwh.REL, 1)}
                </span>
              }
              nota="GWh: energético, confiabilidade e elétrico"
            />
            <Cartao rotulo="Maior corte numa hora" valor={`${n(r.picoCorteGw, 1)} GW`} nota={r.horaPicoCorte ? `às ${r.horaPicoCorte}` : "sem corte"} />
          </div>
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
            {comCorte.length
              ? `Há corte em ${comCorte.length} das 24 horas, de ${comCorte[0].hora} a ${comCorte[comCorte.length - 1].hora}.`
              : "Sem corte: todo o recurso eólico e solar encontra demanda ao lado das máquinas síncronas exigidas."}
            {p.bateriaGw > 0 && p.bateriaGwh > 0 && ` A bateria guardou ${n(r.bateriaCarregadaGwh, 1)} GWh e devolveu ${n(r.bateriaDevolvidaGwh, 1)} GWh depois.`}
          </p>
          <GraficoBarras
            titulo="Para onde vai a energia possível em cada hora"
            dados={r.horas}
            chaveCategoria="hora"
            series={series}
            unidade="GW"
            casas={1}
            empilhado
            altura={320}
          />
          <GraficoLinhas
            titulo="Recurso eólico e solar contra o espaço que sobra para ele"
            dados={espaco}
            chaveX="hora"
            formatoX="texto"
            series={[
              { id: "disponivel", rotulo: "Eólica e solar disponíveis", cor: "var(--serie-eolica)" },
              { id: "espaco", rotulo: "Espaço: demanda menos máquinas síncronas exigidas", cor: "var(--serie-hidraulica)", tracejada: true },
              { id: "demanda", rotulo: "Demanda", cor: "var(--serie-referencia)" },
            ]}
            unidade="GW"
            casas={1}
            zeroNoEixo
            altura={240}
          />
          <p className="text-xs leading-relaxed text-carvao-muted">
            Onde a linha do recurso passa acima da linha tracejada, sobra eólica e solar: é a forma do corte energético e por confiabilidade. O corte elétrico
            aparece mesmo abaixo dela, quando a sobra está presa no Nordeste.
          </p>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-carvao-muted">
        Fica de fora deste laboratório: intercâmbio com outros países, reservatórios e a decisão de quanto guardar de água, rampas das térmicas, exportação, a
        geração distribuída como redução da demanda, o despacho do ONS por usina e a regra oficial de classificação das razões. O ponto de partida foi
        escolhido para mostrar as três razões; ele não reproduz a taxa de nenhum mês real.
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
  const inicial = padroes[0];
  const valoresDe = (pd: PadraoReceita | undefined): ParametrosReceita => ({
    potenciaMw: 100,
    fatorCapacidadePct: pd?.fonte === "solar" ? 25 : 45,
    taxaCortePct: Math.round(pd?.taxaPct ?? 10),
    parcelaEletricaPct: Math.round(pd?.parcelaEletricaPct ?? 0),
    precoContrato: 200,
    pldNasHorasDeCorte: Math.round(pld ?? 60),
  });
  const [fonte, setFonte] = useState<string>(inicial?.fonte ?? "eolica");
  const [p, setP] = useState<ParametrosReceita>(valoresDe(inicial));
  const def = (k: keyof ParametrosReceita) => (v: number) => setP((x) => ({ ...x, [k]: v }));
  const r = receitaDoCorte(p);
  const pd = padroes.find((x) => x.fonte === fonte);

  return (
    <Moldura id="lab-receita" titulo="Do lado de quem gera: quanto vale a energia cortada" rotuloModelo="Modelo didático">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Uma usina hipotética. A taxa de corte e a parcela da razão elétrica começam nos valores publicados para os últimos 12 meses ({pd?.periodo ?? "período não publicado"}
        ); potência, fator de capacidade e preço de contrato são valores de exemplo para você trocar pelos do seu caso.
      </p>
      {padroes.length > 1 && (
        <TransicaoOpcoes
          rotulo="Fonte"
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
          <legend className="rotulo mb-1 text-mineral">Premissas</legend>
          <Controle rotulo="Potência da usina" valor={p.potenciaMw} min={10} max={1000} passo={10} unidade="MW" onMudar={def("potenciaMw")} />
          <Controle rotulo="Fator de capacidade (exemplo)" valor={p.fatorCapacidadePct} min={5} max={70} unidade="%" onMudar={def("fatorCapacidadePct")} />
          <Controle
            rotulo="Taxa de corte"
            valor={p.taxaCortePct}
            min={0}
            max={60}
            unidade="%"
            onMudar={def("taxaCortePct")}
            ajuda={pd?.taxaPct != null ? `Publicado para as ${pd.rotulo.toLowerCase()} em ${pd.periodo}: ${n(pd.taxaPct, 1)}%.` : undefined}
          />
          <Controle
            rotulo="Parcela com razão elétrica"
            valor={p.parcelaEletricaPct}
            min={0}
            max={100}
            unidade="%"
            onMudar={def("parcelaEletricaPct")}
            ajuda={pd?.parcelaEletricaPct != null ? `Publicado: ${n(pd.parcelaEletricaPct, 1)}% da energia não gerada.` : undefined}
          />
          <Controle rotulo="Preço do contrato (exemplo)" valor={p.precoContrato} min={0} max={600} passo={10} unidade="R$/MWh" onMudar={def("precoContrato")} />
          <Controle rotulo="PLD nas horas de corte" valor={p.pldNasHorasDeCorte} min={0} max={800} unidade="R$/MWh" onMudar={def("pldNasHorasDeCorte")} ajuda={pldNota} />
        </fieldset>
        <div className="min-w-0 space-y-3" aria-live="polite">
          <div className="grid grid-cols-2 gap-2">
            <Cartao rotulo="Energia possível no ano" valor={`${n(r.possivelMwh / 1e3, 1)} GWh`} nota="potência × fator de capacidade × 8.760 h" />
            <Cartao destaque rotulo="Energia cortada no ano" valor={`${n(r.cortadaMwh / 1e3, 1)} GWh`} nota={`${n(p.taxaCortePct)}% da possível`} />
            <Cartao rotulo="Valor a preço de contrato" valor={reais(r.valorContrato)} nota="o que a energia cortada valeria na venda" />
            <Cartao rotulo="Valor ao PLD informado" valor={reais(r.valorPld)} nota="custo de repor no curto prazo, ou o que deixa de receber quem vende nele" />
            <Cartao rotulo="Cortada com razão elétrica" valor={`${n(r.eletricaMwh / 1e3, 1)} GWh`} nota="a razão que a norma lida associa a ressarcimento" />
            <Cartao rotulo="Diferença entre os dois valores" valor={reais(Math.abs(r.valorContrato - r.valorPld))} nota="quanto o preço da hora do corte muda a conta" />
          </div>
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
            A mesma energia cortada vale {reais(r.valorContrato)} a preço de contrato e {reais(r.valorPld)} ao PLD informado. Quando o corte acontece nas horas em
            que o PLD está baixo, repor a energia no curto prazo custa pouco por MWh; o que pesa é o volume e quem, pelas regras do contrato, arca com ele.
          </p>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-carvao-muted">
        Fica de fora deste laboratório: ressarcimento por encargo de serviços do sistema (pela norma lida, a REN ANEEL nº 1.030/2022 em cópia de 08/01/2025, só
        a razão de indisponibilidade externa dá direito a ele; franquias, cálculo e alterações posteriores indicadas em fontes secundárias não foram
        verificadas), garantia física, contratos por disponibilidade, tributos e encargos. Não é avaliação de nenhuma usina real.
      </p>
    </Moldura>
  );
}

/* ------------------------------------------------------------------ 4. o que o país deixou de usar */

export function LabValorPerdido({ cortadaTwh, periodo, pldMenor, pldNota }: { cortadaTwh: number; periodo: string; pldMenor: number | null; pldNota: string }) {
  const [preco, setPreco] = useState(200);
  const valorBi = (cortadaTwh * 1e6 * preco) / 1e9;
  const atalhos: { rotulo: string; v: number }[] = [
    ...(pldMenor !== null ? [{ rotulo: `Menor PLD horário do ano (R$ ${n(pldMenor, 2)})`, v: Math.round(pldMenor * 100) / 100 }] : []),
    { rotulo: "R$ 200/MWh (exemplo)", v: 200 },
    { rotulo: "R$ 400/MWh (exemplo)", v: 400 },
  ];
  return (
    <Moldura id="lab-valor" titulo="Quanto vale a energia que o país deixou de usar" rotuloModelo="Conta com dado publicado e preço escolhido">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        A quantidade é a publicada: {n(cortadaTwh, 1)} TWh de eólicas e fotovoltaicas não gerados por limitação do ONS em {periodo}. O preço é a escolha: não
        existe um preço único da energia cortada, e o valor muda muito conforme a régua. Por isso a conta mostra a faixa, não um número.
      </p>
      <div role="group" aria-label="Preços de referência" className="flex flex-wrap gap-2">
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
        <Controle rotulo="Preço atribuído à energia" valor={preco} min={0} max={800} passo={1} unidade="R$/MWh" onMudar={setPreco} ajuda={pldNota} />
        <div className="grid grid-cols-2 gap-2" aria-live="polite">
          <Cartao destaque rotulo="Valor da energia não gerada" valor={`R$ ${n(valorBi, 1)} bilhões`} nota={`${n(cortadaTwh, 1)} TWh × R$ ${n(preco, 2)}/MWh`} />
          <Cartao rotulo="Por MWh de diferença no preço" valor={`R$ ${n((cortadaTwh * 1e6) / 1e6, 1)} milhões`} nota="cada R$ 1/MWh a mais na régua soma isto ao valor" />
        </div>
      </div>
      <p className="text-xs leading-relaxed text-carvao-muted">
        O valor não é custo do consumidor nem prejuízo de um agente: ele diz a ordem de grandeza do recurso que já tinha usina construída e não chegou a quem
        consome. Quem arca com quanto depende das regras de contrato e de ressarcimento, que este laboratório não modela.
      </p>
    </Moldura>
  );
}
