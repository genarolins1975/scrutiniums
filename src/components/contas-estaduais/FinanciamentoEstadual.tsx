import { financiamentoEstadual, ROTULOS_FINANCIAMENTO } from '@/lib/contas-estaduais/financiamento';
import { CAMPOS_RECEITA } from '@/lib/contas-estaduais/comparacao';
import { primarios } from '@/lib/contas-estaduais/dados';

const n=(v:number,c=2)=>v.toLocaleString('pt-BR',{minimumFractionDigits:c,maximumFractionDigits:c});
export default function FinanciamentoEstadual({uf,ano}:{uf:string;ano:number}) {
 const f=financiamentoEstadual(uf,ano); if(!f) return null;
 const v=f.valores, escala=Math.max(v.receitas_correntes,v.despesas_correntes), total=f.dado.valores.receita_arrecadada;
 const comparar=(id:string)=>`/contas-publicas-estaduais?uf=${uf}&ano=${ano}&indicador=${id}&regiao=Todas&df=0&ordem=uf#comparacao`;
 return <section id="financiamento" tabIndex={-1} className="ce-financing" aria-labelledby="financiamento-titulo">
  <div className="ce-section-heading"><div><p className="ce-kicker">Financiamento / {uf} / {ano}</p><h3 id="financiamento-titulo">De onde vêm as receitas?</h3></div><a className="ce-download" href={`/contas-publicas-estaduais/financiamento.csv?uf=${uf}&ano=${ano}`}>Baixar este recorte · CSV ↓</a></div>
  <p className="ce-note">RREO Anexo 01 · janeiro a dezembro · valores nominais · receitas e despesas exceto intra-orçamentárias; refinanciamento destacado fora deste perímetro.</p>
  <div className="ce-finance-total"><p><span>Receita arrecadada no perímetro</span><strong>R$ {n(total/1e9)} bi</strong></p><p><span>Receitas correntes</span><strong>R$ {n(v.receitas_correntes/1e9)} bi</strong><small>{n(100*v.receitas_correntes/total,1)}% da arrecadação</small></p><p><span>Receitas de capital</span><strong>R$ {n(v.receitas_capital/1e9)} bi</strong><small>{n(100*v.receitas_capital/total,1)}% da arrecadação</small></p></div>
  <div className="ce-finance-grid">
   <figure><figcaption>Composição das receitas correntes <span>Base: R$ {n(v.receitas_correntes/1e9)} bi · 100%</span></figcaption>
    <div className="ce-finance-stack" aria-hidden="true">{f.partes.map((p,i)=><span key={p.id} className={`ce-finance-color-${i}`} style={{width:`${p.percentual}%`}}/>)}</div>
    <ol className="ce-finance-legend">{f.partes.map((p,i)=><li key={p.id}><span className={`ce-finance-dot ce-finance-color-${i}`} aria-hidden="true"/><span><a className="inline-flex min-h-[44px] items-center" href={comparar(Object.entries(CAMPOS_RECEITA).find(([,campo])=>campo===p.id)![0])} aria-label={`Comparar ${p.nome.toLowerCase()} entre estados`}>{p.nome} ↗</a><small>R$ {n(p.valor/1e9)} bi</small></span><strong>{n(p.percentual,1)}%</strong></li>)}</ol>
    <p className="ce-note">Selecione uma categoria para comparar sua participação entre estados. O último grupo reúne receitas patrimoniais, agropecuárias, industriais, de serviços e outras correntes. É calculado por diferença, sem somar linhas que já contêm subtotais.</p>
    <p className="ce-finance-reading"><span>CE-14 · participação das transferências</span><strong>{n(f.indicadores['CE-14'])}%</strong><a href={comparar('CE-14')}>Comparar entre estados →</a></p>
   </figure>
   <figure><figcaption>Receitas e despesas correntes <span>R$ bilhões nominais · mesma escala, a partir de zero</span></figcaption>
    {[{nome:'Receitas arrecadadas',valor:v.receitas_correntes},{nome:'Despesas liquidadas',valor:v.despesas_correntes}].map((p,i)=><div className="ce-finance-pair" key={p.nome}><div><span>{p.nome}</span><strong>R$ {n(p.valor/1e9)} bi</strong></div><div className="ce-bar-track" aria-hidden="true"><span className={`ce-finance-color-${i===0?0:2}`} style={{width:`${p.valor/escala*100}%`}}/></div></div>)}
    <p className="ce-finance-reading"><span>CE-10 · margem corrente</span><strong>{n(f.indicadores['CE-10'])}% <small>· R$ {n(f.margem_nominal/1e9)} bi</small></strong><a href={comparar('CE-10')}>Comparar entre estados →</a></p>
    <p className="ce-note">Margem = receitas correntes arrecadadas menos despesas correntes liquidadas, dividida pelas receitas correntes. Valores negativos, quando presentes, são preservados.</p>
    <p className="ce-budget-caution">Essa diferença contábil não é caixa livre nem resultado primário. A participação das transferências descreve o financiamento e não mede, isoladamente, autonomia ou eficiência.</p>
   </figure>
  </div>
  <details><summary>Conferir composição, cálculos e fonte</summary><p className="ce-note">Receitas correntes não equivalem à Receita Corrente Líquida (RCL). As linhas são usadas como declaradas no RREO, sem recompor uma receita bruta ou aplicar ajustes de RCL. A conferência não é auditoria das contas.</p><div className="ce-table-scroll" role="region" tabIndex={0} aria-label="Valores e contas do financiamento estadual"><table><caption>{uf} · {ano} · valores em R$ nominais · captura de 12/10/2026</caption><thead><tr><th scope="col">Medida</th><th scope="col">Valor (R$)</th><th scope="col">Conta ou cálculo</th></tr></thead><tbody>{Object.entries(v).map(([id,valor])=><tr key={id}><th scope="row">{ROTULOS_FINANCIAMENTO[id as keyof typeof ROTULOS_FINANCIAMENTO]}</th><td className="ce-num">{n(valor)}</td><td>{id==='demais_correntes_agrupadas'?'Correntes − tributária − contribuições − transferências':primarios.campos_financiamento[id as keyof typeof primarios.campos_financiamento].cod_conta}</td></tr>)}<tr><th scope="row">Margem corrente em reais</th><td className="ce-num">{n(f.margem_nominal)}</td><td>Receitas correntes − despesas correntes liquidadas</td></tr></tbody></table></div><p className="ce-note">Percentuais arredondados podem não somar exatamente 100%. O CSV preserva valores, fórmulas e proveniência. Os valores de capital são apresentados separadamente e não integram o denominador de CE-10 ou CE-14.</p>{f.dado.fontes.map(s=><p className="ce-source-links" key={s.sha256}><a href={s.arquivo} download>Resposta original do financiamento · JSON ↓</a><a href={s.url}>Consulta no Tesouro ↗</a><small className="ce-hash">SHA-256: {s.sha256}</small></p>)}</details>
 </section>;
}
