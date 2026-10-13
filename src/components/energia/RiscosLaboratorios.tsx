"use client";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "./useEstadoUrl";
import { RiscoReceita } from "./RiscoReceita";
import { RiscoBateria } from "./RiscoBateria";
import { RiscoClima } from "./RiscoClima";
import { RiscoDemanda } from "./RiscoDemanda";
import r from "./Riscos.module.css";
import s from "./LeiturasIntegradas.module.css";
const esq={laboratorio:campo(tiposUrl.opcao(["receita","bateria","clima","demanda"] as const),"receita")};
const labs=[{id:"receita",titulo:"Receita e dívida",sub:"Produção × preço × contrato"},{id:"bateria",titulo:"Economia da bateria",sub:"Do ciclo físico ao VPL"},{id:"clima",titulo:"Interrupção e seguro",sub:"Perda bruta × perda retida"},{id:"demanda",titulo:"Data center e conexão",sub:"Energia × pico × recuperação"}] as const;
export function RiscosLaboratorios(){const [v,set]=useEstadoUrl(esq);return <section id="laboratorio-flexibilidade" className={s.section} aria-labelledby="laboratorios-risco-titulo"><div className={r.sectionTitle}><span className={r.number}>03</span><h2 id="laboratorios-risco-titulo">Teste o mecanismo, acompanhe a consequência.</h2></div><p className={s.eyebrow}>Cenários hipotéticos · modelos próprios · premissas editáveis</p><p className={s.intro}>Quatro laboratórios ligam engenharia e resultado econômico. Altere os controles, compare cenários e abra o método para reproduzir as contas. Não são previsões nem avaliações de ativos reais.</p><div className={r.labNav} role="group" aria-label="Escolha o laboratório de risco">{labs.map(l=><button key={l.id} aria-pressed={v.laboratorio===l.id} onClick={()=>set({laboratorio:l.id})}><span>{l.sub}</span>{l.titulo}</button>)}</div>{v.laboratorio==="receita"?<RiscoReceita/>:v.laboratorio==="bateria"?<RiscoBateria/>:v.laboratorio==="clima"?<RiscoClima/>:<RiscoDemanda/>}<p className={s.note}>A seleção e as premissas ficam no endereço da página. Para compartilhar, copie a URL após a edição. Cada laboratório exporta entradas e resultados completos em JSON. Os modelos são independentes: não some seus resultados como se fossem uma única carteira.</p></section>;}
