"use client";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { bateriaDidatica, cargaDataCenter } from "@/lib/energia/leitura-integrada";
import { useEstadoUrl } from "./useEstadoUrl";
import s from "./LeiturasIntegradas.module.css";

const esquema = {
  laboratorio: campo(tiposUrl.opcao(["bateria", "demanda"] as const), "bateria"),
  mw: campo(tiposUrl.numero({ min: 1, max: 200 }), 50, { historico: "replace" }),
  mwh: campo(tiposUrl.numero({ min: 10, max: 800 }), 200, { historico: "replace" }),
  eficiencia: campo(tiposUrl.numero({ min: 50, max: 100 }), 85, { historico: "replace" }),
  compra: campo(tiposUrl.numero({ min: 0, max: 1000 }), 100, { historico: "replace" }),
  venda: campo(tiposUrl.numero({ min: 0, max: 1000 }), 300, { historico: "replace" }),
  ti: campo(tiposUrl.numero({ min: 1, max: 500 }), 100, { historico: "replace" }),
  uso: campo(tiposUrl.numero({ min: 10, max: 100 }), 80, { historico: "replace" }),
  pue: campo(tiposUrl.numero({ min: 1, max: 2.5 }), 1.3, { historico: "replace" }),
};
const n = (v: number, casas = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
export function LaboratorioFlexibilidade() {
  const [v, definir] = useEstadoUrl(esquema);
  const b = bateriaDidatica(v.mw, v.mwh, v.eficiencia / 100, v.compra, v.venda)!;
  const d = cargaDataCenter(v.ti, v.uso / 100, v.pue)!;
  return <section id="laboratorio-flexibilidade" className={s.section} aria-labelledby="flexibilidade-titulo"><p className={s.eyebrow}>Laboratório · cenários hipotéticos</p><h2 id="flexibilidade-titulo" className={s.title}>Quanto cabe numa bateria? Quanto consome um data center?</h2><p className={s.intro}>Altere as hipóteses para entender as ordens de grandeza. Os resultados são contas físicas e financeiras simplificadas, não previsões de projetos.</p>
    <div className={s.tabs} role="group" aria-label="Escolha o laboratório"><button className={s.button} aria-pressed={v.laboratorio === "bateria"} onClick={() => definir({laboratorio:"bateria"})}>Bateria e deslocamento de energia</button><button className={s.button} aria-pressed={v.laboratorio === "demanda"} onClick={() => definir({laboratorio:"demanda"})}>Data center e demanda</button></div>
    {v.laboratorio === "bateria" ? <>
      <div className={s.controls}>
        <label>Potência de descarga: {n(v.mw)} MW<input aria-label="Potência de descarga da bateria" type="range" min={1} max={200} step={1} value={v.mw} onChange={e => definir({mw:Number(e.target.value)})} /></label>
        <label>Energia útil de saída: {n(v.mwh)} MWh<input aria-label="Energia útil de saída da bateria" type="range" min={10} max={800} step={10} value={v.mwh} onChange={e => definir({mwh:Number(e.target.value)})} /></label>
        <label>Rendimento de ida e volta: {n(v.eficiencia)}%<input aria-label="Rendimento de ida e volta" type="range" min={50} max={100} value={v.eficiencia} onChange={e => definir({eficiencia:Number(e.target.value)})} /></label>
      </div>
      <dl className={s.metrics}><div><dt>Duração à potência selecionada</dt><dd>{n(b.duracao)} horas</dd><small>{n(v.mwh)} MWh ÷ {n(v.mw)} MW.</small></div><div><dt>Energia comprada para carregar</dt><dd>{n(b.entrada)} MWh</dd><small>{n(v.mwh)} MWh úteis ÷ {n(v.eficiencia)}%.</small></div><div><dt>Energia perdida no ciclo</dt><dd>{n(b.perdas)} MWh</dd><small>Entrada − saída útil. Armazenar também consome energia.</small></div></dl>
      <div className={s.meter} role="img" aria-label={`De toda a energia de entrada, ${n(v.eficiencia)}% volta como energia útil e ${n(100-v.eficiencia)}% se perde no ciclo.`}><span style={{width:`${v.eficiencia}%`}} /></div><p className={s.note}>Barra inteira: energia de entrada (100%). Parte escura: saída útil. Parte clara: perdas do ciclo.</p>
      <div className={s.controls}><label>Compra hipotética: R$ {n(v.compra)}/MWh<input aria-label="Preço de compra da energia da bateria" type="range" min={0} max={1000} step={10} value={v.compra} onChange={e=>definir({compra:Number(e.target.value)})} /></label><label>Venda hipotética: R$ {n(v.venda)}/MWh<input aria-label="Preço de venda da energia da bateria" type="range" min={0} max={1000} step={10} value={v.venda} onChange={e=>definir({venda:Number(e.target.value)})} /></label></div>
      <div className={s.bridge}><strong>Margem bruta de energia por ciclo: R$ {n(b.margemBruta)}.</strong> Receita = {n(v.mwh)} × {n(v.venda)}; compra = {n(b.entrada)} × {n(v.compra)} (cálculo sem arredondar). O preço de venda que cobre somente a energia de entrada é R$ {n(b.precoEquilibrio)}/MWh.</div>
      <p className={s.note}>Energia útil especificada na saída em corrente alternada, ciclo completo e rendimento constante. Não considera CAPEX, degradação, reserva de carga, limites de conexão, tributos, tarifas, encargos ou remuneração por outros serviços. Margem bruta positiva não demonstra viabilidade. O exercício não estima quanto curtailment uma bateria evitaria: isso exige localização e simulação horária da rede.</p>
    </> : <>
      <div className={s.controls}><label>Potência nominal de TI: {n(v.ti)} MW<input aria-label="Potência de TI do data center" type="range" min={1} max={500} value={v.ti} onChange={e=>definir({ti:Number(e.target.value)})} /></label><label>Utilização média: {n(v.uso)}%<input aria-label="Utilização média do data center" type="range" min={10} max={100} value={v.uso} onChange={e=>definir({uso:Number(e.target.value)})} /></label><label>PUE médio: {n(v.pue, 2)}<input aria-label="PUE médio do data center" type="range" min={1} max={2.5} step={0.05} value={v.pue} onChange={e=>definir({pue:Number(e.target.value)})} /></label></div>
      <dl className={s.metrics}><div><dt>Demanda média da instalação</dt><dd>{n(d.mwMedios)} MW</dd><small>TI × utilização × PUE.</small></div><div><dt>Energia anual total</dt><dd>{n(d.gwhAno)} GWh</dd><small>Demanda média × 8.760 h ÷ 1.000.</small></div><div><dt>Energia anual de TI</dt><dd>{n(d.gwhTI)} GWh</dd><small>A diferença para o total representa os demais sistemas na hipótese adotada.</small></div></dl>
      <div className={s.bridge}><strong>PUE = energia total da instalação ÷ energia dos equipamentos de TI.</strong> Com PUE {n(v.pue, 2)}, cada 1 MWh de TI corresponde a {n(v.pue, 2)} MWh no total. PUE não mede o trabalho computacional por MWh.</div><p className={s.note}>Ano de 8.760 horas; potência de TI, utilização e PUE constantes nas médias. Um anúncio de potência ou pedido de conexão não comprova consumo efetivo, data de entrada ou firmeza da demanda. O cálculo anual não revela rampas, localização, reforços de rede ou disponibilidade hídrica para resfriamento.</p>
    </>}
    <button className={s.button} onClick={() => definir({mw:50,mwh:200,eficiencia:85,compra:100,venda:300,ti:100,uso:80,pue:1.3})}>Restaurar hipóteses</button>
  </section>;
}
