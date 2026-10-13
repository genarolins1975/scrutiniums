'use client';
import {useEffect,useState} from 'react';

/** A URL só muda numa ação do leitor; o HTML inicial permanece estável. */
export function useRecorte<T extends string>(chave:string,inicial:T,validar:(valor:string)=>boolean){
 const[valor,setValor]=useState<T>(inicial);
 useEffect(()=>{const q=new URLSearchParams(window.location.search).get(chave);if(q!==null&&validar(q))setValor(q as T)},[chave,inicial,validar]);
 function alterar(novo:T){setValor(novo);const url=new URL(window.location.href);if(novo===inicial)url.searchParams.delete(chave);else url.searchParams.set(chave,novo);window.history.replaceState(window.history.state,'',url)}
 return [valor,alterar] as const;
}
export function RecorteCompartilhavel(){
 const[link,setLink]=useState(''),[mensagem,setMensagem]=useState('');
 async function compartilhar(){const url=window.location.href;setLink(url);try{await navigator.clipboard.writeText(url);setMensagem('Link copiado com os filtros aplicados.')}catch{setMensagem('Selecione e copie o link abaixo.')}}
 return <div className="cp-share"><button type="button" className="cp-button" onClick={()=>void compartilhar()}>Compartilhar recorte ↗</button>{link&&<div><p role="status" className="cp-note">{mensagem}</p><label className="cp-sr-only" htmlFor="cp-share-link">Link do recorte</label><input id="cp-share-link" type="url" value={link} readOnly onFocus={e=>e.currentTarget.select()}/></div>}</div>;
}
