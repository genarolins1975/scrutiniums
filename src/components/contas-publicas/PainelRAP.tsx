'use client';
import {CicloRAP} from './artefatos/CicloRAP';
import {useState} from 'react';
import fonte from '@/lib/contas-publicas/snapshots/rap.json';
import {somarRAP,porOrigemRAP} from '@/lib/contas-publicas/rap-modelo';
import {moeda as formatarMoeda,participacao} from '@/lib/contas-publicas/formato';
const moeda=(v:number)=>formatarMoeda(v,'reais');
const periodos={'000/2026':'Abertura de 2026','DEZ/2025':'Encerramento de 2025','DEZ/2024':'Encerramento de 2024'};
export function PainelRAP(){
 const [periodo,setPeriodo]=useState('000/2026'),[orgao,setOrgao]=useState(''),[tipo,setTipo]=useState('');
 const rs=fonte.registros.filter(r=>r.periodo===periodo&&(!orgao||r.orgao===orgao)&&(!tipo||r.tipo===tipo));
 const total=somarRAP(rs),origens=porOrigemRAP(rs),abertura=periodo==='000/2026';
 const base=total.inscritos+total.reinscritos;
 return <section className="cp-section cp-data-section" id="rap-observado" aria-labelledby="rap-titulo"><p className="cp-eyebrow">Estoque e movimento · Tesouro Nacional</p><h2 id="rap-titulo">O orçamento que atravessa o exercício.</h2><p className="cp-reading">Cada posição reúne compromissos de exercícios anteriores. A idade do empenho ajuda a investigar sua permanência, mas não comprova atraso nem desperdício.</p>
 <div className="cp-controls"><label>Posição contábil<select value={periodo} onChange={e=>setPeriodo(e.target.value)}>{Object.entries(periodos).map(([id,nome])=><option key={id} value={id}>{nome}</option>)}</select></label><label>Órgão<select value={orgao} onChange={e=>setOrgao(e.target.value)}><option value="">Todos os órgãos</option>{Object.entries(fonte.orgaos).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')).map(([id,nome])=><option key={id} value={id}>{id} · {nome}</option>)}</select></label><label>Tipo na inscrição<select value={tipo} onChange={e=>setTipo(e.target.value)}><option value="">Todos os tipos</option><option value="processados">Processados</option><option value="nao-processados">Não processados</option></select></label></div>
 <div className="cp-kpis" aria-live="polite"><div><span>Saldo a pagar</span><strong>{moeda(total.saldo)}</strong><small>{periodos[periodo as keyof typeof periodos]}</small></div><div><span>{abertura?'Origem mais recente: '+(origens[0]?.ano??'não identificada'):'Base de inscrições ajustada'}</span><strong>{abertura?participacao(origens[0]?.saldo??0,total.saldo):moeda(base)}</strong><small>Perímetro selecionado · valores correntes</small></div><div><span>Exercícios de origem com saldo</span><strong>{origens.filter(r=>r.saldo>0).length}</strong><small>Não somamos estoques de posições distintas</small></div></div>
 {rs.length===0?<p role="status">Não há registros neste recorte.</p>:<CicloRAP registros={rs} periodo={periodo} referencia={periodos[periodo as keyof typeof periodos]}/>}
 <p className="cp-note">Processados foram liquidados antes da inscrição. Não processados não haviam sido liquidados naquele momento; podem ter sido liquidados posteriormente. O total inclui despesas primárias e financeiras.</p><p className="cp-note">{fonte.nota2025}</p>
 <details className="cp-data-details"><summary>Valores exatos do recorte em reais</summary><div className="cp-table-scroll"><table className="cp-table"><caption>Saldo a pagar por origem, sem arredondamento para bilhões</caption><thead><tr><th scope="col">Origem</th><th scope="col">R$ correntes</th></tr></thead><tbody>{origens.map(r=><tr key={r.ano}><th scope="row">{r.ano}</th><td>{r.saldo.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>)}</tbody></table></div></details>
</section>
}
