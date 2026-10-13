'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {GLOSSARIO,type TermoId} from '@/lib/contas-publicas/glossario';
import {dataFonte} from '@/lib/contas-publicas/dados';
export function Termo({id,children}:{id:TermoId;children?:React.ReactNode}){
 const t=GLOSSARIO[id],uid=useId(),[aberto,setAberto]=useState(false),botao=useRef<HTMLButtonElement>(null),caixa=useRef<HTMLSpanElement>(null),fechar=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!aberto)return;fechar.current?.focus();function tecla(e:KeyboardEvent){if(e.key==='Escape'){setAberto(false);botao.current?.focus()}}function fora(e:PointerEvent){if(!caixa.current?.contains(e.target as Node))setAberto(false)}document.addEventListener('keydown',tecla);document.addEventListener('pointerdown',fora);return()=>{document.removeEventListener('keydown',tecla);document.removeEventListener('pointerdown',fora)}},[aberto]);
 return <span className="cp-term" ref={caixa}><button ref={botao} type="button" className="cp-term-button" aria-expanded={aberto} aria-controls={uid} onClick={()=>setAberto(!aberto)}>{children||t.termo}</button>{aberto&&<span className="cp-term-popover" id={uid} role="dialog" aria-label={`Definição: ${t.termo}`}><strong>{t.termo}</strong><span>{t.definicao}</span><a href={t.url}>{t.fonte} ↗</a><span>Consulta: {dataFonte(t.consulta)}.</span><a href={`/contas-publicas/glossario#${id}`}>Ver no glossário</a><button ref={fechar} type="button" className="cp-button" onClick={()=>{setAberto(false);botao.current?.focus()}}>Fechar definição</button></span>}</span>;
}
