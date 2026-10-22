"use client";
import { useState } from 'react';
const n = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export default function LaboratorioOrcamentario() {
  const [gasto, setGasto] = useState(80);
  const [entrega, setEntrega] = useState(60);
  return <section className="ce-lab" aria-labelledby="ce-lab-title">
    <div className="ce-lab-header"><div><p className="rotulo ce-kicker">Laboratório / cenário hipotético</p><h2 id="ce-lab-title">Gastar e entregar<br/>são medidas diferentes.</h2><p>Um programa tem orçamento de R$ 100 milhões e meta de 100 unidades de serviço. Mova os controles e compare as duas medidas.</p></div><span className="ce-lab-tag">Exemplo didático<br/>Sem dados de governos</span></div>
    <div className="ce-lab-grid"><div className="ce-lab-controls"><label htmlFor="ce-lab-spend">Despesa liquidada <output htmlFor="ce-lab-spend">R$ {gasto} milhões</output></label><input id="ce-lab-spend" type="range" min="0" max="100" step="5" value={gasto} onChange={e => setGasto(Number(e.target.value))}/><label htmlFor="ce-lab-output">Unidades entregues <output htmlFor="ce-lab-output">{entrega} de 100</output></label><input id="ce-lab-output" type="range" min="0" max="100" step="5" value={entrega} onChange={e => setEntrega(Number(e.target.value))}/><div className="ce-lab-presets"><button type="button" onClick={() => { setGasto(100); setEntrega(60); }}>Todo o orçamento, 60 entregas</button><button type="button" onClick={() => { setGasto(80); setEntrega(60); }}>Restaurar exemplo</button></div></div>
      <figure className="ce-lab-figure"><figcaption>Dois denominadores. Duas perguntas.</figcaption>{[['Execução financeira', gasto, 'Despesa liquidada ÷ orçamento atualizado'], ['Cumprimento da meta física', entrega, 'Unidades entregues ÷ unidades previstas']].map(([nome, valor, formula], i) => <div className="ce-lab-measure" key={nome}><div><span>{nome}</span><strong>{valor}%</strong></div><div className="ce-lab-track" aria-hidden="true"><span className={i === 0 ? 'ce-lab-financial' : 'ce-lab-physical'} style={{ width: `${valor}%` }}/></div><p>{formula}</p></div>)}<p className="ce-lab-axis">Escala comum: 0% a 100%. Cores identificam medidas, não desempenho.</p></figure>
    </div><div className="ce-lab-conclusion"><div><span>Despesa por unidade entregue</span><strong>{entrega === 0 ? 'Não calculável' : `R$ ${n(gasto / entrega)} milhão${gasto / entrega === 1 ? '' : 's'}`}</strong></div><p>{entrega === 0 ? 'Sem entrega, a razão não é calculada. Ausência de denominador não vira custo zero.' : 'Esta razão não é um escore de eficiência. Qualidade, escopo, maturação do gasto e contexto precisam ser comparáveis.'}</p></div>
    <p className="ce-note">Hipóteses: um programa, um período e uma unidade homogênea de serviço, sem defasagem entre despesa e entrega. A meta é didática; não representa um programa ou estado real. O exercício não mede efetividade.</p>
  </section>;
}
