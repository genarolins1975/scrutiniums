'use client';
import {useMemo} from 'react';
import {useEstadoUrl} from '@/components/energia/useEstadoUrl';
import {Controles,GraficoBarras,TabelaDados} from '@/components/painel';
import {campo,tiposUrl} from '@/lib/energia/estadoUrl';
import {MEDIDAS,valor,n,csv,type Territorio} from '@/lib/eficiencia/habitacao/modelo';
// peças do kit de painel (molde de painel, Iniciativa 1 do parecer de UX de 23/10/2026): controles junto do gráfico, barras do kit e a
// tabela do kit no lugar da tabela à mão; os valores, a ordem, o recorte na URL e o CSV são os mesmos de antes
const rotulo='rotulo block text-mineral';
const controle='mt-1 min-h-[44px] w-full min-w-0 border border-mineral bg-superficie px-2 text-sm text-carvao focus:outline focus:outline-2 focus:outline-obee';
const botao='inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao';
export function Comparacao({dados,grupo}:{dados:Territorio[];grupo:'deficit'|'aluguel'|'inadequacao'}){
 const medidas=useMemo(()=>grupo==='aluguel'?[...MEDIDAS.aluguel,...MEDIDAS.renda]:MEDIDAS[grupo],[grupo]);
 const schema=useMemo(()=>({medida:campo(tiposUrl.opcao(medidas.map(m=>m.id)),medidas[0].id),unidade:campo(tiposUrl.opcao(['relativo','absoluto']),'relativo'),territorio:campo(tiposUrl.opcao(['UF','Região']),'UF'),destaque:campo(tiposUrl.opcao(['',...dados.map(d=>d.id)]),''),ordem:campo(tiposUrl.opcao(['nome','maior','menor']),'nome')}),[medidas,dados]);
 const [s,set]=useEstadoUrl(schema);const m=medidas.find(m=>m.id===s.medida)??medidas[0];
 const rows=dados.filter(r=>r.tipo===s.territorio).sort((a,b)=>s.ordem==='nome'?a.nome.localeCompare(b.nome,'pt-BR'):(s.ordem==='maior'?-1:1)*((valor(a,m,s.unidade)??-1)-(valor(b,m,s.unidade)??-1))||a.nome.localeCompare(b.nome,'pt-BR'));
 const br=dados.find(r=>r.id==='BR')!;const ref=valor(br,m,s.unidade);
 const f=(v:number|null)=>n(v,s.unidade==='relativo'?1:0)+(s.unidade==='relativo'?'%':'');
 const exportar=()=>{const texto=csv(['Territorio','Tipo','Indicador','Valor','Unidade','Numerador estimado','Denominador','Base do denominador','Ano','Fonte','Localizadores'],rows.map(r=>[r.nome,r.tipo,m.nome,valor(r,m,s.unidade),s.unidade==='relativo'?'%':'estimativa',r[m.id],r[m.denominador],m.base,r.ano,'Fundação João Pinheiro, edição 2026',JSON.stringify(r.origem)]));const u=URL.createObjectURL(new Blob([texto],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=u;a.download='habitacao-'+m.id+'-'+s.territorio+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 const unidade=s.unidade==='relativo'?'% de '+m.base:'número estimado';
 const destacada=rows.findIndex(r=>r.id===s.destaque);
 return <section aria-label="Comparação territorial" className="space-y-5">
 <Controles rotulo="Recorte da comparação territorial" resumo={rows.length+' territórios · 2024 · estimativas FJP'}>
 <label className="min-w-0 sm:w-56"><span className={rotulo}>Indicador</span><select aria-label="Indicador" className={controle} value={m.id} onChange={e=>set({medida:e.target.value as typeof s.medida})}>{medidas.map(m=><option value={m.id} key={m.id}>{m.nome}</option>)}</select></label>
 <label className="min-w-0 sm:w-56"><span className={rotulo}>Forma de comparação</span><select aria-label="Forma de comparação" className={controle} value={s.unidade} onChange={e=>set({unidade:e.target.value as typeof s.unidade})}><option value="relativo">Percentual e denominador</option><option value="absoluto">Número estimado</option></select></label>
 <label className="min-w-0 sm:w-56"><span className={rotulo}>Territórios</span><select aria-label="Territórios" className={controle} value={s.territorio} onChange={e=>set({territorio:e.target.value as typeof s.territorio,destaque:''})}><option value="UF">27 Unidades da Federação</option><option value="Região">5 grandes regiões</option></select></label>
 <label className="min-w-0 sm:w-56"><span className={rotulo}>Destacar território</span><select aria-label="Destacar território" className={controle} value={s.destaque} onChange={e=>set({destaque:e.target.value})}><option value="">Nenhuma seleção</option>{rows.map(r=><option key={r.id} value={r.id}>{r.nome}</option>)}</select></label>
 <label className="min-w-0 sm:w-56"><span className={rotulo}>Ordenação</span><select aria-label="Ordenação" className={controle} value={s.ordem} onChange={e=>set({ordem:e.target.value as typeof s.ordem})}><option value="nome">Alfabética</option><option value="maior">Maior valor primeiro</option><option value="menor">Menor valor primeiro</option></select></label>
 <div className="flex flex-wrap gap-x-5"><button type="button" className={botao} onClick={()=>set({medida:medidas[0].id,unidade:'relativo',territorio:'UF',destaque:'',ordem:'nome'})}>Limpar seleção</button><button type="button" className={botao} onClick={exportar}>Baixar comparação CSV</button></div>
 </Controles>
 <div className="max-w-prose2 space-y-2"><p className="t-corpo text-carvao">{m.nota}</p><p className="t-meta text-carvao-muted">Denominador: {m.base}. Brasil: {n(br[m.id])} / {n(br[m.denominador])} = {n(valor(br,m,'relativo'),1)}%. O percentual nacional é uma razão de totais, não a média simples das UFs.</p></div>
 {m.id.startsWith('renda')&&<p className="t-meta max-w-prose2 text-carvao" data-ressalva=""><span className="font-medium">Ressalva: </span>Piauí e Ceará apresentam diferenças de aproximadamente 546 unidades entre a tabela de renda e a tabela geral, em sentidos opostos. Preservamos as duas bases; as participações de renda usam exclusivamente o total da tabela de renda.</p>}
 <div><p className="t-meta mb-2 text-carvao-muted">{m.nome} · {unidade}. Escala linear a partir de zero.{s.unidade==='relativo'&&ref!==null?' Traço vertical: Brasil ('+f(ref)+'), referência descritiva.':''}</p>
 <GraficoBarras semTabela titulo={m.nome+' · '+unidade} dados={rows.map(r=>({id:r.id,nome:r.nome,v:valor(r,m,s.unidade)}))} chaveCategoria="id" chaveRotulo="nome" orientacao="horizontal" series={[{id:'v',rotulo:m.nome,cor:'var(--cor-obee)'}]} unidade={s.unidade==='relativo'?'%':'número estimado'} casas={s.unidade==='relativo'?1:0} rotulosValor referencias={s.unidade==='relativo'&&ref!==null?[{valor:ref,rotulo:'Brasil'}]:[]} selecionado={s.destaque||null} onSelecionar={id=>set({destaque:id??''})} rotulosSaoNomes alturaMaxima={1300}/></div>
 <TabelaDados titulo={m.nome+' · 2024. Denominador: '+m.base+'.'} colunas={['Território','Estimativa','Denominador','Percentual (%)']} linhas={rows.map(r=>[r.nome,r[m.id],r[m.denominador],valor(r,m,'relativo')])} casas={[null,0,0,1]} limite={rows.length} ausencia={{'Percentual (%)':'Não informado'}} linhasDestacadas={destacada>=0?[destacada]:[]} nota={'Denominador: '+m.base+'. Estimativas da FJP arredondadas à unidade.'}/>
 </section>;
}
