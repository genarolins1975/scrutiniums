'use client';
import {useState} from 'react';
import {compararDespesas,denominador,exportarComparacaoFiscal,UNIDADES_ESCALA,type EscalaFiscal} from '@/lib/contas-publicas/escala';
import {moeda,numero,variacaoPercentual} from '@/lib/contas-publicas/formato';
import {FonteEscala} from './artefatos/EscalaDoAgregado';
import {Termo} from './artefatos/Termo';

function exibir(v:number,escala:EscalaFiscal,delta=false) {
  if(escala==='pib') return delta?`${v>0?'+':''}${numero(v,2)} p.p.`:`${numero(v,2)}% do PIB`;
  return moeda(v,escala==='total'?'milhoes':'reais',{curta:escala==='total',variacao:delta});
}
export function ComparadorFiscal({ano,mes}:{ano:number;mes:number}) {
  const [escala,setEscala]=useState<EscalaFiscal>('total');
  const [ordem,setOrdem]=useState('valor');
  const denominadores=!!denominador(ano,mes)&&!!denominador(ano-1,mes);
  const efetiva=denominadores?escala:'total';
  const linhas=compararDespesas(ano,mes,efetiva);
  if(!linhas) return <p className="cp-status">Não há dois recortes compatíveis para esta comparação.</p>;
  const ordenadas=[...linhas].sort((a,b)=>ordem==='valor'?b.atual-a.atual:Math.abs(b.diferenca)-Math.abs(a.diferenca));
  const maiores=linhas.filter(l=>l.atual===Math.max(...linhas.map(x=>x.atual)));
  const variacoes=linhas.filter(l=>Math.abs(l.diferenca)===Math.max(...linhas.map(x=>Math.abs(x.diferenca))));
  const teto=Math.max(...linhas.flatMap(l=>[l.atual,l.anterior]),1);
  const janela=mes===12?'Janeiro a dezembro':`Janeiro a ${new Intl.DateTimeFormat('pt-BR',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(ano,mes-1,1)))}`;
  const unidade=efetiva==='total'?'R$ correntes':efetiva==='habitante'?'R$ correntes por habitante no ano':'% do PIB de cada ano';
  const csv=exportarComparacaoFiscal(ordenadas,ano,mes,efetiva);
  return <section className="cp-fiscal-compare" aria-labelledby="comparar-despesas">
    <div className="cp-section-head"><div><p className="cp-eyebrow">Composição e mudança</p><h3 id="comparar-despesas">Maiores despesas e o que mudou</h3><p className="cp-note">{janela} de {ano-1} e {ano} · Governo Central · {unidade}</p></div></div>
    <div className="cp-compare-controls">
      <label className="cp-select">Escala da comparação<select value={efetiva} onChange={e=>setEscala(e.target.value as EscalaFiscal)}><option value="total">Valor total</option><option value="habitante" disabled={!denominadores}>Por habitante</option><option value="pib" disabled={!denominadores}>Em % do PIB</option></select></label>
      <label className="cp-select">Ordenar despesas<select value={ordem} onChange={e=>setOrdem(e.target.value)}><option value="valor">Maior valor atual</option><option value="diferenca">Maior variação em magnitude</option></select></label>
    </div>
    {!denominadores&&<p className="cp-note">Por habitante e % do PIB exigem denominadores nos dois anos completos. Essas escalas estão disponíveis na comparação 2025 × 2024.</p>}
    <div className="cp-compare-reading" aria-live="polite"><p><span>Maior despesa no recorte</span><strong>{maiores.map(l=>l.nome).join(' / ')}</strong>{exibir(maiores[0].atual,efetiva)} · {numero(maiores[0].participacao)}% da despesa primária{maiores.length>1?' · empate':''}</p><p><span>Maior variação em magnitude</span><strong>{variacoes.map(l=>l.nome).join(' / ')}</strong>{exibir(variacoes[0].diferenca,efetiva,true)}{variacoes.length>1?' · empate':''}<small>{efetiva==='pib'?'Diferença em pontos percentuais do PIB.':'Diferença nominal; sem correção pela inflação.'}</small></p></div>
    <p className="cp-note">As barras partem de zero e usam a mesma escala. {ano-1}: barra contornada; {ano}: barra preenchida. As cores identificam os anos.</p>
    <ol className="cp-compare-list">{ordenadas.map(l=><li key={l.id}>
      <div className="cp-compare-title"><h4>{l.nome}</h4><span>{numero(l.participacao)}% da despesa em {ano}</span></div>
      {([{year:ano-1,value:l.anterior,before:true},{year:ano,value:l.atual,before:false}]).map(v=><div className="cp-paired-row" key={v.year}><span>{v.year}</span><div className="cp-paired-track" aria-hidden="true"><i className={v.before?'cp-paired-before':''} style={{width:`${100*v.value/teto}%`}}/></div><strong>{exibir(v.value,efetiva)}</strong></div>)}
      <p className="cp-compare-delta">Variação: <strong>{exibir(l.diferenca,efetiva,true)}</strong>{efetiva!=='pib'&&<> · {l.variacao===null?'Taxa não calculável':variacaoPercentual(l.variacao)}</>}{efetiva==='habitante'?' por habitante':''}</p>
    </li>)}</ol>
    <p className="cp-note">Categorias exclusivas do RTN. <Termo id="programacao-financeira">Sujeitas à programação financeira</Termo> reúne despesas obrigatórias com controle de fluxo e discricionárias. Aumento ou redução não determina qualidade da gestão. {efetiva==='habitante'?'Por habitante é uma razão do agregado, não benefício recebido.':efetiva==='pib'?'A razão usa o PIB nominal do próprio ano; sua mudança reflete numerador e denominador.':'Valores nominais, sem correção pela inflação.'}</p>
    <details className="cp-data-details"><summary>Conferir os valores da comparação</summary><div className="cp-table-scroll" tabIndex={0} role="region" aria-label="Tabela de comparação fiscal"><table className="cp-table"><caption>{janela} · {UNIDADES_ESCALA[efetiva]} · diferenças calculadas antes do arredondamento</caption><thead><tr><th scope="col">Categoria</th><th scope="col">{ano-1}</th><th scope="col">{ano}</th><th scope="col">Diferença{efetiva==='pib'?' (p.p.)':''}</th></tr></thead><tbody>{ordenadas.map(l=><tr key={l.id}><th scope="row">{l.nome}</th><td>{numero(l.anterior,6)}</td><td>{numero(l.atual,6)}</td><td>{numero(l.diferenca,6)}</td></tr>)}</tbody></table></div><p className="cp-note">{efetiva==='total'?'Nesta tabela e no CSV: R$ milhões correntes.':efetiva==='habitante'?'Nesta tabela e no CSV: R$ correntes por habitante.':'Nesta tabela e no CSV: % do PIB; diferença em pontos percentuais.'}</p></details>
    <a className="cp-button" download={`contas-federais-${ano}-${mes}-${efetiva}.csv`} href={`data:text/csv;charset=utf-8,${encodeURIComponent('\uFEFF'+csv)}`}>Baixar comparação · CSV ↓</a>
    {efetiva!=='total'&&<FonteEscala anos={[ano-1,ano]}/>}
  </section>;
}
