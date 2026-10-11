"use client";

import { Children, useEffect, useState, type ReactNode } from "react";
import styles from "./ExploracaoInicial.module.css";

export type ResumoInicial = { id: string; titulo: string; valor: string; unidade: string; periodo: string };

/** Os painéis continuam sendo renderizados no servidor, com provas, ressalvas e links originais. */
export function PerguntasExploraveis({ resumos, children }: { resumos: ResumoInicial[]; children: ReactNode }) {
  const [atual, setAtual] = useState(0);
  const [todos, setTodos] = useState(false);
  useEffect(() => {
    const abrirAncora = () => {
      const i = resumos.findIndex(r => window.location.hash === `#pergunta-${r.id}`);
      if (i < 0) return;
      setAtual(i); setTodos(false);
      requestAnimationFrame(() => document.getElementById(`energia-resposta-${resumos[i].id}`)?.scrollIntoView({ block: "start" }));
    };
    abrirAncora();
    window.addEventListener("hashchange", abrirAncora);
    return () => window.removeEventListener("hashchange", abrirAncora);
  }, [resumos]);
  return <div className={styles.explorador}>
    <div className={styles.opcoes} role="group" aria-label="Escolha o indicador para explorar">
      {resumos.map((r, i) => <button type="button" key={r.id} aria-pressed={!todos && atual === i} aria-controls={`energia-resposta-${r.id}`} onClick={() => { setAtual(i); setTodos(false); }}>
        <span className={styles.indice}>{String(i + 1).padStart(2, "0")} <span aria-hidden="true">↗</span></span>
        <span className={styles.rotulo}>{r.titulo}</span><strong>{r.valor}</strong><span>{r.unidade}</span><small>{r.periodo}</small>
      </button>)}
    </div>
    <div className={styles.barra}><p>Selecione uma medida para abrir sua referência, universo e fonte. Cada uma tem seu próprio período.</p>
      <button type="button" aria-pressed={todos} onClick={() => setTodos(!todos)}>{todos ? "Voltar à exploração" : "Mostrar todas as análises"}</button></div>
    <div className={`${styles.respostas} ${todos ? styles.todas : ""}`}>
      {Children.map(children, (child, i) => <div id={`energia-resposta-${resumos[i].id}`} className={styles.resposta} hidden={!todos && atual !== i}>{child}</div>)}
    </div>
  </div>;
}

/** Conversão dimensional, sem modelo do SIN ou hipótese de preço. */
export function energiaConsumida(watts: number, horas: number, dias: number): number | null {
  if (![watts, horas, dias].every(Number.isFinite) || watts < 0 || horas < 0 || horas > 24 || dias < 0) return null;
  return watts / 1000 * horas * dias;
}
const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function LaboratorioEnergia() {
  const [potencia, setPotencia] = useState(1500);
  const [horas, setHoras] = useState(3);
  const [dias, setDias] = useState(30);
  const kwh = energiaConsumida(potencia, horas, dias)!;
  const diario = energiaConsumida(potencia, horas, 1)!;
  const referencia = energiaConsumida(1500, 3, 30)!;
  return <section className={styles.laboratorio} aria-labelledby="energia-lab-titulo" id="laboratorio-energia">
    <div className={styles.labCabecalho}><div><p className={styles.sobretitulo}>Laboratório de leitura · cenário ilustrativo</p><h2 id="energia-lab-titulo">Potência não é energia.</h2><p>Experimente: a altura representa a potência; a largura, o tempo de uso. A área revela a energia consumida em um dia.</p></div><a href="/setor-eletrico/conta-de-luz#simulador">Explorar o simulador da conta ↗</a></div>
    <div className={styles.labGrade}>
      <div className={styles.controles}>
        <label htmlFor="energia-lab-w">Potência constante <output htmlFor="energia-lab-w">{num(potencia)} W</output></label>
        <input id="energia-lab-w" type="range" min="100" max="6000" step="100" value={potencia} onChange={e => setPotencia(Number(e.target.value))} />
        <label htmlFor="energia-lab-h">Uso por dia <output htmlFor="energia-lab-h">{num(horas)} h</output></label>
        <input id="energia-lab-h" type="range" min="0.5" max="24" step="0.5" value={horas} onChange={e => setHoras(Number(e.target.value))} />
        <label htmlFor="energia-lab-d">Dias de uso <output htmlFor="energia-lab-d">{dias} dias</output></label>
        <input id="energia-lab-d" type="range" min="1" max="31" step="1" value={dias} onChange={e => setDias(Number(e.target.value))} />
        <div className={styles.presets}>
          <button type="button" onClick={() => { setPotencia(1500); setHoras(3); setDias(30); }}>Restaurar referência</button>
          <button type="button" onClick={() => setHoras(1.5)}>Testar 1,5 h/dia</button>
        </div>
      </div>
      <div>
        <div className={styles.legendaGrafico}><span>Potência · kW</span><span>Área = {num(diario)} kWh/dia</span></div>
        <svg className={styles.grafico} viewBox="0 0 500 270" role="img" aria-label={`Potência de ${num(potencia / 1000)} kW por ${num(horas)} horas: ${num(diario)} kWh por dia. Escalas fixas: zero a seis kW e zero a vinte e quatro horas.`}>
          {[0, 2, 4, 6].map(v => <g key={v}><line x1="48" x2="475" y1={226 - v * 32} y2={226 - v * 32} stroke="currentColor" opacity=".25" /><text x="34" y={231 - v * 32} textAnchor="end">{v}</text></g>)}
          <rect x="48" y={226 - potencia / 1000 * 32} width={horas / 24 * 427} height={potencia / 1000 * 32} fill="#97cbc4" opacity=".75" />
          <path d="M48 26V226H475" fill="none" stroke="currentColor" />
          {[0, 6, 12, 18, 24].map(v => <text key={v} x={48 + v / 24 * 427} y="247" textAnchor="middle">{v} h</text>)}

        </svg>
        <div className={styles.resultado} aria-live="polite" aria-atomic="true"><span>Energia em {dias} dias</span><strong>{num(kwh)} <small>kWh</small></strong><p>{num(potencia / 1000)} kW × {num(horas)} h/dia × {dias} dias</p><p>{num(kwh - referencia)} kWh em relação à referência de {num(referencia)} kWh.</p></div>
      </div>
    </div>
    <p className={styles.nota}>Hipóteses de uso, sem dados de uma residência. Referência: 1.500 W, 3 h/dia e 30 dias. Potência constante durante o uso; não considera ciclos de funcionamento. O exercício calcula energia, não fatura, despacho ou PLD. O gráfico mantém as mesmas escalas em todos os cenários.</p>
  </section>;
}
