"use client";
import Link from "./LinkSemPrefetch";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { FONTES_RISCO, temasRisco, type FonteRiscoId } from "@/lib/energia/riscos-referencias";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { useEstadoUrl } from "./useEstadoUrl";
import s from "./LeiturasIntegradas.module.css";
import r from "./Riscos.module.css";
const esquema={perfil:campo(tiposUrl.opcao(["todos","geracao","redes","comercial","consumo"] as const),"todos")}; // i18n: dado
export function CitacoesRisco({ids}:{ids:FonteRiscoId[]}) {const tx=useTx();return <p className={r.citation}>{tx("Aprofunde:","Further reading:")} {ids.map(id=>{const f=FONTES_RISCO.find(x=>x.id===id)!;return <a key={id} href={`#fonte-${id}`}>{f.org}{(id.startsWith("mck")||id.startsWith("iea"))?` · ${f.ano}`:""}</a>;})}</p>;}
export function RiscosMatriz(){
  const [v,definir]=useEstadoUrl(esquema);
  const idioma=useIdioma();const tx=useTx();
  const todos=temasRisco(idioma);
  const temas=todos.filter(t=>v.perfil==="todos"||t.perfis.includes(v.perfil));
  return <section id="mapa-riscos" className={s.section} aria-labelledby="mapa-riscos-titulo">
    <div className={r.sectionTitle}><span className={r.number}>01</span><h2 id="mapa-riscos-titulo">{tx("Que risco chega a cada parte do setor?","Which risks reach each part of the sector?")}</h2></div>
    <p className={s.intro}>{tx("Abra cada tema para seguir o mecanismo, escolher a medida e entender o que permanece exposto após a mitigação. O filtro indica relações relevantes; não atribui uma nota de risco a empresas.","Open each theme to follow the mechanism, choose the measure and understand what remains exposed after mitigation. The filter shows relevant relationships; it does not assign a risk score to companies.")}</p>
    <div className={s.controls}><label>{tx("Perspectiva da análise","Analysis perspective")}<select value={v.perfil} onChange={e=>definir({perfil:e.target.value as typeof v.perfil})}><option value="todos">{tx("Toda a cadeia","Whole value chain")}</option><option value="geracao">{tx("Geração e armazenamento","Generation and storage")}</option><option value="redes">{tx("Transmissão e distribuição","Transmission and distribution")}</option><option value="comercial">{tx("Comercialização","Energy trading")}</option><option value="consumo">{tx("Grandes consumidores","Large consumers")}</option></select></label></div>
    <p className={s.note}>{tx(`${temas.length} de ${todos.length} temas nesta perspectiva. A ordem é temática, sem ranking de gravidade.`,`${temas.length} of ${todos.length} themes in this perspective. The order is thematic, not a severity ranking.`)}</p>
    <div className={r.riskList}>{temas.map(t=><details className={r.riskItem} key={t.id}><summary><span>{String(todos.indexOf(t)+1).padStart(2,"0")}</span><strong>{t.titulo}</strong><span>{t.horizonte}</span></summary><div className={r.riskContent}><p>{t.mecanismo}</p><dl className={r.riskDetail}><div><dt>{tx("Sinal a acompanhar","Signal to watch")}</dt><dd>{t.sinal}</dd></div><div><dt>{tx("Como medir","How to measure")}</dt><dd>{t.medida}</dd></div><div><dt>{tx("Resposta possível","Possible response")}</dt><dd>{t.resposta}</dd></div><div><dt>{tx("Risco que permanece","Residual risk")}</dt><dd>{t.residual}</dd></div></dl><Link className={s.link} href={t.href}>{t.destino} →</Link><CitacoesRisco ids={t.fontes}/></div></details>)}</div>
  </section>;
}
