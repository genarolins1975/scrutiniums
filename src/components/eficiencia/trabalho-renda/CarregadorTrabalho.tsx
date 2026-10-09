'use client';
import {useEffect,useState} from 'react';
import {carregarTrabalhoRenda} from '@/lib/eficiencia/trabalho-renda/dados';
import type {Snapshot} from './modelo';
import {ExploradorTrabalho} from './ExploradorTrabalho';
import {PanoramaTrabalho} from './PanoramaTrabalho';
import {MetodosTrabalho} from './MetodosTrabalho';
let promessa:Promise<Snapshot>|null=null;
export function CarregadorTrabalho({visao='explorador',...props}:{visao?:'explorador'|'panorama'|'metodos';titulo?:string;pergunta?:string;ids?:string[];censo?:boolean}){const[dados,setDados]=useState<Snapshot|null>(null);const[erro,setErro]=useState(false);const[tentativa,setTentativa]=useState(0);useEffect(()=>{let ativo=true;promessa??=carregarTrabalhoRenda();promessa.then(d=>{if(ativo)setDados(d)}).catch(()=>{promessa=null;if(ativo)setErro(true)});return()=>{ativo=false}},[tentativa]);if(erro)return <section className="tr-empty" role="alert"><h1>Dados temporariamente indisponíveis</h1><p>A base não pôde ser carregada. Nenhum valor é substituído por zero ou por uma estimativa.</p><button onClick={()=>{setErro(false);setTentativa(v=>v+1)}}>Tentar novamente</button></section>;if(!dados)return <section className="tr-empty" role="status"><h1>{props.titulo??'Trabalho e renda'}</h1><p>Carregando a base oficial e seus períodos de referência…</p><noscript>Ative JavaScript para explorar os dados. <a href="/eficiencia/trabalho-renda/snapshot.json">A base completa permanece disponível em JSON.</a></noscript></section>;return visao==='panorama'?<PanoramaTrabalho dados={dados}/>:visao==='metodos'?<MetodosTrabalho dados={dados}/>:<ExploradorTrabalho dados={dados} titulo={props.titulo??''} pergunta={props.pergunta??''} ids={props.ids??dados.indicadores.map(i=>i.id)} censo={props.censo}/>}
