'use client';
import {useMemo} from 'react';
import {useEstadoUrl} from '@/components/energia/useEstadoUrl';
import {Controles,GraficoBarras,TabelaDados} from '@/components/painel';
import {campo,tiposUrl} from '@/lib/energia/estadoUrl';
import {csv,formatar,ordenar,type Indicador,type Valor,type Fonte} from '@/lib/eficiencia/saneamento/modelo';
// peças do kit de painel (molde de painel, Iniciativa 1 do parecer de UX de 23/10/2026): controles junto do gráfico, barras do kit e a
// tabela do kit no lugar da tabela à mão; valores, ordem, recorte na URL, ausências e CSV são os de antes
const rotulo='rotulo block text-mineral';
const controle='mt-1 min-h-[44px] w-full min-w-0 border border-mineral bg-superficie px-2 text-sm text-carvao focus:outline focus:outline-2 focus:outline-obee';
const botao='inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao';
export function Comparacao({medidas,dados,fontes}:{medidas:Indicador[];dados:Valor[];fontes:Fonte[]}){
 const tipos=useMemo(()=>dados.some(r=>r.tipo==='UF')?['UF','Região']:['Região'],[dados]);
 const schema=useMemo(()=>({medida:campo(tiposUrl.opcao(medidas.map(m=>m.id)),medidas[0].id),territorio:campo(tiposUrl.opcao(tipos),tipos[0]),ordem:campo(tiposUrl.opcao(['nome','maior','menor']),'nome')}),[medidas,tipos]);
 const [s,set]=useEstadoUrl(schema);const m=medidas.find(m=>m.id===s.medida)??medidas[0];
 const rows=ordenar(dados.filter(r=>r.indicador===m.id&&r.tipo===s.territorio),s.ordem);const br=dados.find(r=>r.indicador===m.id&&r.id==='BR')!;const f=fontes.find(f=>f.id===m.fonte)!;
 const exportar=()=>{const texto=csv(['Território','Tipo','Indicador','Valor','Unidade','Ano','Numerador','Denominador','Universo','Localizador','Fonte'],rows.map(r=>[r.nome,r.tipo,m.id,r.valor,m.unidade,2024,r.numerador,r.denominador,m.base,r.origem,f.url]));const u=URL.createObjectURL(new Blob([texto],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=u;a.download='saneamento-'+m.id+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
 // mesma precisão de formatar(): contagens de domicílios e municípios sem casas, o resto com as casas da fonte
 const casas=['domicílios','municípios'].includes(m.unidade)?0:m.casas;
 return <section aria-label="Comparação territorial" className="space-y-5">
 <Controles rotulo="Recorte da comparação territorial" resumo={rows.length+' territórios · '+rows.filter(r=>r.valor!==null).length+' valores disponíveis · 2024'}>
 <label className="min-w-0 sm:w-64"><span className={rotulo}>Indicador</span><select aria-label="Indicador" className={controle} value={m.id} onChange={e=>set({medida:e.target.value})}>{medidas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
 <label className="min-w-0 sm:w-56"><span className={rotulo}>Territórios</span><select aria-label="Territórios" className={controle} value={s.territorio} onChange={e=>set({territorio:e.target.value})}>{tipos.map(t=><option key={t} value={t}>{t==='UF'?'27 UFs':'5 regiões'}</option>)}</select></label>
 <label className="min-w-0 sm:w-56"><span className={rotulo}>Ordenação</span><select aria-label="Ordenação" className={controle} value={s.ordem} onChange={e=>set({ordem:e.target.value as typeof s.ordem})}><option value="nome">Alfabética</option><option value="maior">Maior valor primeiro</option><option value="menor">Menor valor primeiro</option></select></label>
 <div className="flex flex-wrap gap-x-5"><button type="button" className={botao} onClick={()=>set({medida:medidas[0].id,territorio:tipos[0],ordem:'nome'})}>Limpar seleção</button><button type="button" className={botao} onClick={exportar}>Baixar comparação CSV</button></div>
 </Controles>
 <div className="max-w-prose2 space-y-2"><p className="t-corpo text-carvao">{m.nota}</p><p className="t-meta text-carvao-muted"><span className="font-medium text-carvao">Base:</span> {m.base}</p></div>
 <p className="t-corpo text-carvao"><strong className="font-medium">Brasil: {formatar(br.valor,m)}</strong>. {m.id.endsWith('_HAB')?'Razão calculada pelo OBEE sobre os totais nacionais.':'Agregado da fonte, não média simples dos territórios.'}</p>
 <div><p className="t-meta mb-2 text-carvao-muted">{m.nome} · {m.unidade}. Escala linear a partir de zero.{m.unidade==='%'?' Traço vertical: referência Brasil.':''} Ausências aparecem como “sem dado” no gráfico e “Não informado” na tabela.</p>
 <GraficoBarras semTabela titulo={m.nome+' · '+m.unidade} dados={rows.map(r=>({id:r.id,nome:r.nome,v:r.valor}))} chaveCategoria="id" chaveRotulo="nome" orientacao="horizontal" series={[{id:'v',rotulo:m.nome,cor:'var(--cor-obee)'}]} unidade={m.unidade} casas={casas} rotulosValor referencias={m.unidade==='%'&&br.valor!==null?[{valor:br.valor,rotulo:'Brasil'}]:[]} rotulosSaoNomes alturaMaxima={1300}/></div>
 <TabelaDados titulo={m.nome+' · '+m.unidade+' · 2024'} colunas={['Território','Valor ('+m.unidade+')','Numerador da razão OBEE','Denominador da razão OBEE','Origem']} linhas={rows.map(r=>[r.nome,r.valor,r.numerador,r.denominador,r.origem])} casas={[null,casas,2,0,null]} limite={rows.length} ausencia={{['Valor ('+m.unidade+')']:'Não informado','Numerador da razão OBEE':'Não se aplica','Denominador da razão OBEE':'Não se aplica'}} nota="Role a tabela horizontalmente para consultar todas as colunas."/>
 <details className="border-t border-linha pt-2"><summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">Fórmula, elegibilidade e fonte</summary><div className="t-meta max-w-prose2 space-y-3 pb-2 text-carvao-muted [overflow-wrap:anywhere]"><p><strong className="font-medium text-carvao">{m.id}:</strong> {m.formula}</p><p>Bloqueios ou regras: {m.regras}</p><p>Os indicadores oficiais já consolidados são preservados; não são recalculados a partir de totais com elegibilidade diferente. Numerador e denominador numéricos são expostos quando a razão é calculada pelo OBEE.</p><a className="underline" href={f.url}>{f.arquivo}</a><p>Origem nacional: {br.origem}.</p></div></details></section>
}
