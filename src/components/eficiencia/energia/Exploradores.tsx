'use client';
import {useState,type ReactNode} from 'react';
import {Controles,TabelaDados} from '@/components/painel';
import {dataBR} from '@/lib/painel/formato';
import type {Acesso,Distribuidora,Tarifa} from '@/lib/eficiencia/energia/dados';

/**
 * Os três exploradores das visões de Energia e conectividade no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): cada um é
 * a fatia de tabelas da sua visão, com os controles (Controles do kit, rótulo visível e alvo de 44 px) logo antes da tabela que afetam e a
 * tabela na TabelaDados do kit, à vista, no lugar da tabela à mão. Filtros, busca, ordem, consumo de referência e validação são os de antes;
 * os números saem com as mesmas casas, e ausência continua "Não disponível". O estado fica no navegador, como antes (não vai à URL).
 */
const rotulo='rotulo block text-mineral';
const campo='mt-1 block min-h-[44px] w-full min-w-0 border border-mineral bg-superficie px-3 text-sm text-carvao focus:outline focus:outline-2 focus:outline-obee';
const ROLAR='Em telas estreitas, role a tabela para comparar as colunas.';
const AUSENTE='Não disponível';

function Bloco({secao,titulo,lead,colunas,linhas,casas,ausencia,nota}:{secao:string;titulo:string;lead?:ReactNode;colunas:string[];linhas:(string|number|null)[][];casas:(number|null)[];ausencia:Record<string,string>;nota?:ReactNode}){
 return <TabelaDados recolhida={false} idioma="pt" titulo={titulo+' · '+linhas.length+' registros'} tituloVisivel={secao} lead={lead} colunas={colunas} linhas={linhas} casas={casas} limite={Math.max(linhas.length,1)} ausencia={ausencia}
  nota={<>{!linhas.length&&<span className="block text-carvao">Nenhum registro neste recorte. </span>}{ROLAR} {nota}</>}/>;
}

export function AcessoEnergia({registros,secao,lead,nota}:{registros:Acesso[];secao:string;lead?:ReactNode;nota?:ReactNode}){const anos=Array.from(new Set(registros.map(r=>r.ano))).sort().reverse();const [ano,setAno]=useState(anos[0]);const rows=registros.filter(r=>r.ano===ano&&r.situacao==='total');
 const colunas=['Território','Com energia (%)','CV da estimativa (%)','Rede geral (%)','Tempo integral entre ligados à rede (%)','Sem energia (mil domicílios)'];
 return <>
  <Controles rotulo="Ano das estimativas de acesso" resumo={'Acesso à energia · '+ano+' · '+rows.length+' registros'} idioma="pt">
   <label className="min-w-0 sm:w-56"><span className={rotulo}>Ano de referência</span><select className={campo} value={ano} onChange={e=>setAno(e.target.value)}>{anos.map(a=><option key={a}>{a}</option>)}</select></label>
  </Controles>
  <Bloco secao={secao} titulo={'Acesso à energia · '+ano} lead={lead} nota={nota} colunas={colunas} casas={[null,1,1,1,1,0]} ausencia={Object.fromEntries(colunas.slice(1).map(c=>[c,AUSENTE]))}
   linhas={rows.map(r=>[r.territorio,r.pct_com_energia,r.cv_pct_com_energia,r.pct_rede_geral,r.pct_integral_entre_rede,r.domicilios_sem_energia_estado==='menos_de_1_mil'?'Menos de 1 mil':r.domicilios_sem_energia_mil])}/>
 </>}

export function QualidadeEnergia({registros,secao,lead,nota}:{registros:Distribuidora[];secao:string;lead?:ReactNode;nota?:ReactNode}){const [busca,setBusca]=useState('');const [ordem,setOrdem]=useState('nome');const rows=registros.filter(r=>(r.nome_comercial+' '+r.sigla).toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))).sort((a,b)=>ordem==='dec'?((a.dec??Infinity)-(b.dec??Infinity)):a.nome_comercial.localeCompare(b.nome_comercial,'pt-BR'));
 const colunas=['Distribuidora','Ano / meses','DEC apurado (h/UC)','Limite DEC (h/UC)','Todas as parcelas (h/UC)','FEC (interrupções/UC)'];
 return <>
  <Controles rotulo="Busca e ordem das distribuidoras" resumo={rows.length+' de '+registros.length+' distribuidoras'} idioma="pt">
   <label className="min-w-0 sm:w-72"><span className={rotulo}>Buscar distribuidora</span><input className={campo} value={busca} onChange={e=>setBusca(e.target.value)} type="search"/></label>
   <label className="min-w-0 sm:w-64"><span className={rotulo}>Ordenar por</span><select className={campo} value={ordem} onChange={e=>setOrdem(e.target.value)}><option value="nome">Nome</option><option value="dec">DEC apurado crescente</option></select></label>
  </Controles>
  <Bloco secao={secao} titulo="Continuidade por distribuidora · ano declarado em cada registro" lead={lead} nota={nota} colunas={colunas} casas={[null,null,2,2,2,2]} ausencia={Object.fromEntries(colunas.slice(2).map(c=>[c,AUSENTE]))}
   linhas={rows.map(r=>[r.nome_comercial,r.ano+' / '+r.meses,r.dec,r.dec_limite,r.dec_todas_parcelas,r.fec])}/>
 </>}

export function TarifasEnergia({registros,referencia,secao,lead,nota}:{registros:Tarifa[];referencia:string;secao:string;lead?:ReactNode;nota?:ReactNode}){const [busca,setBusca]=useState('');const [consumo,setConsumo]=useState('200');const kwh=consumo.trim()===''?null:Number(consumo);const valido=kwh!==null&&Number.isFinite(kwh)&&kwh>=0&&kwh<=10000;const rows=registros.filter(r=>(r.nome+' '+r.sigla).toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')));
 const colunas=['Distribuidora','TE + TUSD (R$/kWh)','Parcela calculada (R$)','Vigência inicial','Vigência final','Ato'];
 return <>
  <Controles rotulo="Busca e consumo de referência" resumo={rows.length+' de '+registros.length+' distribuidoras · '+(valido?consumo+' kWh/mês':'consumo inválido')} idioma="pt">
   <label className="min-w-0 sm:w-72"><span className={rotulo}>Buscar distribuidora</span><input type="search" className={campo} value={busca} onChange={e=>setBusca(e.target.value)}/></label>
   <label className="min-w-0 sm:w-64"><span className={rotulo}>Consumo de referência (kWh/mês)</span><input type="number" min="0" max="10000" step="1" className={campo} value={consumo} aria-invalid={!valido} onChange={e=>setConsumo(e.target.value)}/></label>
  </Controles>
  {!valido&&<p role="alert" className="t-corpo mt-3 text-carvao">Informe consumo entre 0 e 10.000 kWh para calcular a parcela tarifária.</p>}
  <Bloco secao={secao} titulo={'Tarifas residenciais B1 convencionais · referência '+referencia} nota={nota} colunas={colunas} casas={[null,4,2,null,null,null]} ausencia={{'Parcela calculada (R$)':'Não calculado'}}
   lead={<>{lead}<p className="mt-2">Cálculo: consumo × (TE + TUSD) ÷ 1.000. Valores sem tributos, bandeiras, iluminação pública, desconto social ou custo de disponibilidade. Não representam a fatura final nem o gasto médio das famílias. A referência desta publicação é {referencia}; não é uma consulta de tarifa em tempo real.</p></>}
   linhas={rows.map(r=>[r.sigla+' · '+r.nome,r.total/1000,valido?r.total*(kwh as number)/1000:null,dataBR(r.inicio,'pt'),dataBR(r.fim,'pt'),r.ato])}/>
 </>}
