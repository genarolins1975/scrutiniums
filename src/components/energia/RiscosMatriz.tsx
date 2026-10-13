"use client";
import Link from "./LinkSemPrefetch";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { FONTES_RISCO, TEMAS_RISCO, type FonteRiscoId } from "@/lib/energia/riscos-referencias";
import { useEstadoUrl } from "./useEstadoUrl";
import s from "./LeiturasIntegradas.module.css";
import r from "./Riscos.module.css";
const esquema={perfil:campo(tiposUrl.opcao(["todos","geracao","redes","comercial","consumo"] as const),"todos")};
export function CitacoesRisco({ids}:{ids:FonteRiscoId[]}) {return <p className={r.citation}>Aprofunde: {ids.map(id=>{const f=FONTES_RISCO.find(x=>x.id===id)!;return <a key={id} href={`#fonte-${id}`}>{f.org}{id.startsWith("mck")?` · ${f.ano}`:""}</a>;})}</p>;}
export function RiscosMatriz(){
  const [v,definir]=useEstadoUrl(esquema);
  const temas=TEMAS_RISCO.filter(t=>v.perfil==="todos"||t.perfis.includes(v.perfil));
  return <section id="mapa-riscos" className={s.section} aria-labelledby="mapa-riscos-titulo">
    <div className={r.sectionTitle}><span className={r.number}>01</span><h2 id="mapa-riscos-titulo">Que risco chega a cada parte do setor?</h2></div>
    <p className={s.intro}>Abra cada tema para seguir o mecanismo, escolher a medida e entender o que permanece exposto após a mitigação. O filtro indica relações relevantes; não atribui uma nota de risco a empresas.</p>
    <div className={s.controls}><label>Perspectiva da análise<select value={v.perfil} onChange={e=>definir({perfil:e.target.value as typeof v.perfil})}><option value="todos">Toda a cadeia</option><option value="geracao">Geração e armazenamento</option><option value="redes">Transmissão e distribuição</option><option value="comercial">Comercialização</option><option value="consumo">Grandes consumidores</option></select></label></div>
    <p className={s.note}>{temas.length} de {TEMAS_RISCO.length} temas nesta perspectiva. A ordem é temática, sem ranking de gravidade.</p>
    <div className={r.riskList}>{temas.map(t=><details className={r.riskItem} key={t.id}><summary><span>{String(TEMAS_RISCO.indexOf(t)+1).padStart(2,"0")}</span><strong>{t.titulo}</strong><span>{t.horizonte}</span></summary><div className={r.riskContent}><p>{t.mecanismo}</p><dl className={r.riskDetail}><div><dt>Sinal a acompanhar</dt><dd>{t.sinal}</dd></div><div><dt>Como medir</dt><dd>{t.medida}</dd></div><div><dt>Resposta possível</dt><dd>{t.resposta}</dd></div><div><dt>Risco que permanece</dt><dd>{t.residual}</dd></div></dl><Link className={s.link} href={t.href}>{t.destino} →</Link><CitacoesRisco ids={t.fontes}/></div></details>)}</div>
  </section>;
}
