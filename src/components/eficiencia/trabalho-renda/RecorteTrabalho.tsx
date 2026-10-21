'use client';
import {useEffect,useState} from 'react';
export function RecorteTrabalho({children,resumo}:{children:React.ReactNode;resumo:string}){const[aberto,setAberto]=useState(false);useEffect(()=>{if(window.matchMedia('(min-width: 769px)').matches)setAberto(true)},[]);return <details className="tr-recorte" open={aberto} onToggle={e=>setAberto(e.currentTarget.open)}><summary><strong>Recorte da análise</strong><span className="tr-recorte-resumo">{resumo}</span></summary>{children}</details>}
