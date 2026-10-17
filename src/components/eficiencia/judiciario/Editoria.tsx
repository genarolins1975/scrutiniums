import Link from 'next/link';
import {judiciario as d} from '@/lib/eficiencia/judiciario/dados';
import {BASE_JUDICIARIO} from '@/lib/eficiencia/judiciario/modelo';
import s from './Judiciario.module.css';
export {s as estiloJudiciario};
export function SetaJudiciario(){return <svg className={s.inlineArrow} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 13 13 3M3 3h10v10"/></svg>;}
export function AberturaJudiciario({titulo,texto,rotulo='Judiciário brasileiro'}:{titulo:string;texto:string;rotulo?:string}){
 return <header className={s.header}><p className={s.eyebrow}>OBEE / {rotulo}</p><h1>{titulo}</h1><p>{texto}</p><p className={s.meta}>CNJ · Justiça em Números {d.edicao} · ano-base {d.ano} · original conferido em 17/10/2026</p></header>;
}
export function FonteJudiciario({pagina,children}:{pagina:string;children?:React.ReactNode}){
 return <p className={s.source}>Fonte: <a href={`${d.fonte.url}#page=${pagina.split(/[– e]/)[0]}`}>CNJ, Justiça em Números {d.edicao}, p. {pagina}</a> · ano-base {d.ano}. {children} <Link href={BASE_JUDICIARIO+'/metodos'}>Cobertura e método.</Link></p>;
}
export function NotaJudiciario({children}:{children:React.ReactNode}){return <aside className={s.notice}>{children}</aside>;}
export function SecaoJudiciario({titulo,texto,children,id}:{titulo:string;texto?:string;children:React.ReactNode;id?:string}){return <section className={s.section} id={id}><h2>{titulo}</h2>{texto&&<p>{texto}</p>}{children}</section>;}
export function NumerosJudiciario({itens}:{itens:{titulo:string;valor:string;nota:string}[]}){return <dl className={s.numbers}>{itens.map(i=><div key={i.titulo}><dt>{i.titulo}</dt><dd>{i.valor}</dd><dd>{i.nota}</dd></div>)}</dl>;}
export function CoberturaJudiciario(){return <NotaJudiciario><strong>Cobertura deste recorte:</strong> Justiça Estadual, Federal e do Trabalho; tempos, congestionamento e IPC-Jus de 57 tribunais; despesas dos ramos e de 51 TJs/TRTs. Série financeira oficial de 2009–2025. Histórico por tribunal, despesa individual de TRFs e satisfação do direito não estão integrados. <Link className="underline" href={BASE_JUDICIARIO+'/metodos#cobertura'}>Ver fontes e limites.</Link></NotaJudiciario>;}
