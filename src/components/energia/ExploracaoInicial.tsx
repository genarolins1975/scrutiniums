"use client";

import { energiaConsumida } from "@/lib/energia/energia-consumida";
import Link from "@/components/i18n/LinkIdioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

import { Children, useEffect, useState, type ReactNode } from "react";
import { observarAncoras, guardarAncora } from "./navegacao-ancoras";
import styles from "./ExploracaoInicial.module.css";

export type ResumoInicial = { id: string; titulo: string; valor: string; unidade: string; periodo: string };

/** Os painéis continuam sendo renderizados no servidor, com provas, ressalvas e links originais. */
export function PerguntasExploraveis({ resumos, children }: { resumos: ResumoInicial[]; children: ReactNode }) {
  const [atual, setAtual] = useState(0);
  const [todos, setTodos] = useState(false);
  const tx = useTx();
  useEffect(() => observarAncoras(hash => {
    if (hash === "#perguntas") { setTodos(true); return; }
    const i = resumos.findIndex(r => hash === `#pergunta-${r.id}`);
    if (i < 0) return;
    setAtual(i); setTodos(false);
    requestAnimationFrame(() => document.getElementById(`energia-resposta-${resumos[i].id}`)?.scrollIntoView({ block: "start" }));
  }), [resumos]);
  return <div className={styles.explorador}>
    <div className={styles.opcoes} role="group" aria-label={tx("Escolha o indicador para explorar", "Choose the indicator to explore")}>
      {resumos.map((r, i) => <button type="button" key={r.id} aria-pressed={!todos && atual === i} aria-controls={`energia-resposta-${r.id}`} onClick={() => { setAtual(i); setTodos(false); guardarAncora(`#pergunta-${r.id}`); }}>
        <span className={styles.indice}>{String(i + 1).padStart(2, "0")} <span aria-hidden="true">↗</span></span>
        <span className={`t-meta ${styles.titulo}`}>{r.titulo}</span><strong>{r.valor}</strong><span>{r.unidade}</span><small>{r.periodo}</small>
      </button>)}
    </div>
    <div className={styles.barra}><p>{tx("Selecione uma medida para abrir sua referência, universo e fonte. Cada uma tem seu próprio período.", "Select a measure to open its reference, universe and source. Each one has its own period.")}</p>
      <button type="button" aria-pressed={todos} onClick={() => { setTodos(!todos); guardarAncora(todos ? `#pergunta-${resumos[atual].id}` : "#perguntas"); }}>{todos ? tx("Voltar à exploração", "Back to exploring") : tx("Mostrar todas as análises", "Show all analyses")}</button></div>
    <div className={`${styles.respostas} ${todos ? styles.todas : ""}`}>
      {Children.map(children, (child, i) => <div id={`energia-resposta-${resumos[i].id}`} className={styles.resposta} hidden={!todos && atual !== i}>{child}</div>)}
    </div>
  </div>;
}

/**
 * Laboratório "Potência não é energia". `embutido`: dentro do ModeloDidatico da entrada (Iniciativa 4), que já traz o rótulo, o
 * título e a descrição; aqui ficam os controles, o gráfico, o resultado, a nota de hipóteses e o link para o simulador da conta.
 */
export function LaboratorioEnergia({ embutido = false }: { embutido?: boolean } = {}) {
  const idioma = useIdioma();
  const tx = useTx();
  const num = (v: number) => v.toLocaleString(idioma === "en" ? "en-US" : "pt-BR", { maximumFractionDigits: 2 });
  const [potencia, setPotencia] = useState(1500);
  const [horas, setHoras] = useState(3);
  const [dias, setDias] = useState(30);
  const kwh = energiaConsumida(potencia, horas, dias)!;
  const diario = energiaConsumida(potencia, horas, 1)!;
  const referencia = energiaConsumida(1500, 3, 30)!;
  const simulador = <Link href="/setor-eletrico/conta-de-luz#simulador">{tx("Explorar o simulador da conta ↗", "Explore the bill simulator ↗")}</Link>;
  const corpo = <>
    <div className={styles.labGrade}>
      <div className={styles.controles}>
        <label htmlFor="energia-lab-w">{tx("Potência constante", "Constant power")} <output htmlFor="energia-lab-w">{num(potencia)} W</output></label>
        <input id="energia-lab-w" type="range" min="100" max="6000" step="100" value={potencia} onChange={e => setPotencia(Number(e.target.value))} />
        <label htmlFor="energia-lab-h">{tx("Uso por dia", "Use per day")} <output htmlFor="energia-lab-h">{num(horas)} h</output></label>
        <input id="energia-lab-h" type="range" min="0.5" max="24" step="0.5" value={horas} onChange={e => setHoras(Number(e.target.value))} />
        <label htmlFor="energia-lab-d">{tx("Dias de uso", "Days of use")} <output htmlFor="energia-lab-d">{tx(`${dias} dias`, dias === 1 ? "1 day" : `${dias} days`)}</output></label>
        <input id="energia-lab-d" type="range" min="1" max="31" step="1" value={dias} onChange={e => setDias(Number(e.target.value))} />
        <div className={styles.presets}>
          <button type="button" onClick={() => { setPotencia(1500); setHoras(3); setDias(30); }}>{tx("Restaurar referência", "Restore reference")}</button>
          <button type="button" onClick={() => setHoras(1.5)}>{tx("Testar 1,5 h/dia", "Try 1.5 h/day")}</button>
        </div>
      </div>
      <div>
        <div className={styles.legendaGrafico}><span>{tx("Potência · kW", "Power · kW")}</span><span>{tx(`Área = ${num(diario)} kWh/dia`, `Area = ${num(diario)} kWh/day`)}</span></div>
        <svg className={styles.grafico} viewBox="0 0 500 270" role="img" aria-label={tx(`Potência de ${num(potencia / 1000)} kW por ${num(horas)} horas: ${num(diario)} kWh por dia. Escalas fixas: zero a seis kW e zero a vinte e quatro horas.`, `Power of ${num(potencia / 1000)} kW for ${num(horas)} hours: ${num(diario)} kWh per day. Fixed scales: zero to six kW and zero to twenty-four hours.`)}>
          {[0, 2, 4, 6].map(v => <g key={v}><line x1="48" x2="475" y1={226 - v * 32} y2={226 - v * 32} stroke="currentColor" opacity=".25" /><text x="34" y={231 - v * 32} textAnchor="end">{v}</text></g>)}
          <rect x="48" y={226 - potencia / 1000 * 32} width={horas / 24 * 427} height={potencia / 1000 * 32} fill="var(--atlas-acento)" opacity=".75" />
          <path d="M48 26V226H475" fill="none" stroke="currentColor" />
          {[0, 6, 12, 18, 24].map(v => <text key={v} x={48 + v / 24 * 427} y="247" textAnchor="middle">{v} h</text>)}

        </svg>
        <div className={styles.resultado} aria-live="polite" aria-atomic="true"><span>{tx(`Energia em ${dias} dias`, dias === 1 ? "Energy in 1 day" : `Energy in ${dias} days`)}</span><strong>{num(kwh)} <small>kWh</small></strong><p>{tx(`${num(potencia / 1000)} kW × ${num(horas)} h/dia × ${dias} dias`, `${num(potencia / 1000)} kW × ${num(horas)} h/day × ${dias} ${dias === 1 ? "day" : "days"}`)}</p><p>{tx(`${num(kwh - referencia)} kWh em relação à referência de ${num(referencia)} kWh.`, `${num(kwh - referencia)} kWh relative to the reference of ${num(referencia)} kWh.`)}</p></div>
      </div>
    </div>
    <p className={styles.nota}>{tx("Hipóteses de uso, sem dados de uma residência. Referência: 1.500 W, 3 h/dia e 30 dias. Potência constante durante o uso; não considera ciclos de funcionamento. O exercício calcula energia, não fatura, despacho ou PLD. O gráfico mantém as mesmas escalas em todos os cenários.", "Usage assumptions, with no data from an actual household. Reference: 1,500 W, 3 h/day and 30 days. Constant power during use; operating cycles are not considered. The exercise calculates energy, not the bill, dispatch or PLD. The chart keeps the same scales in every scenario.")}</p>
  </>;
  if (embutido) return <div className={`${styles.laboratorio} ${styles.embutido}`}>{corpo}<p className={styles.simulador}>{simulador}</p></div>;
  return <section className={styles.laboratorio} aria-labelledby="energia-lab-titulo" id="laboratorio-energia">
    <div className={styles.labCabecalho}><div><p className={`rotulo ${styles.sobretitulo}`}>{tx("Laboratório de leitura · cenário ilustrativo", "Reading lab · illustrative scenario")}</p><h2 id="energia-lab-titulo">{tx("Potência não é energia.", "Capacity is not energy.")}</h2><p>{tx("Experimente: a altura representa a potência; a largura, o tempo de uso. A área revela a energia consumida em um dia.", "Try it: the height represents power; the width, the time of use. The area shows the energy consumed in one day.")}</p></div>{simulador}</div>
    {corpo}
  </section>;
}

