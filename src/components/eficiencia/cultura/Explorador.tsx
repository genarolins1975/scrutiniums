'use client';
import {useState} from 'react';
import {Controles,TabelaDados} from '@/components/painel';
import {base,fichas,n,seleciona,csvTic,download} from '@/lib/eficiencia/cultura/dados';
const rotulo='rotulo block text-mineral';
const controle='mt-1 min-h-[44px] w-full min-w-0 border border-mineral bg-superficie px-2 text-sm text-carvao focus:outline focus:outline-2 focus:outline-obee';
const botao='inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao';
export function Explorador({capitulo, inicial}:{capitulo:string; inicial?:string}) {
  const medidas=fichas.filter(f=>f.familia===capitulo);
  const abas=medidas.map(f=>f.localizacao_registro.split(';')[0]);
  const [aba,setAba]=useState(inicial??abas[0]);
  const categorias=Array.from(new Set(base.tic.filter(r=>r.aba===aba).map(r=>r.categoria)));
  const [categoria,setCategoria]=useState(categorias[0]);
  const [busca,setBusca]=useState('');
  const [ordem,setOrdem]=useState('tipo');
  const ficha=medidas.find(f=>f.localizacao_registro.startsWith(aba+';'))!;
  const linhas=[...seleciona(aba,categoria,busca)].sort((a,b)=>ordem==='valor'?b.valor-a.valor:base.tipos.indexOf(a.tipo)-base.tipos.indexOf(b.tipo));
  const muda=(a:string)=>{setAba(a);setCategoria(base.tic.find(r=>r.aba===a)!.categoria);};
  // peças do kit de painel (molde de painel, Iniciativa 1 do parecer de UX de 23/10/2026): os controles no Controles e a tabela à mão na
  // TabelaDados. O gráfico de estimativa e margem fica como era, marcado data-figura-legado: o kit ainda não tem gráfico de intervalo, e
  // trocá-lo por barras apagaria a margem publicada
  return <section aria-label="Explorar estimativas culturais" className="space-y-6">
    <Controles rotulo="Recorte das estimativas culturais" resumo={linhas.length+' tipos no recorte'}>
      <label className="min-w-0 sm:w-72"><span className={rotulo}>Indicador</span><select className={controle} value={aba} onChange={e=>muda(e.target.value)}>{medidas.map((f,i)=><option key={f.id} value={abas[i]}>{f.nome}</option>)}</select></label>
      <label className="min-w-0 sm:w-56"><span className={rotulo}>Categoria</span><select className={controle} value={categoria} onChange={e=>setCategoria(e.target.value)}>{categorias.map(c=><option key={c}>{c}</option>)}</select></label>
      <label className="min-w-0 sm:w-56"><span className={rotulo}>Buscar equipamento</span><input type="search" className={controle} value={busca} onChange={e=>setBusca(e.target.value)}/></label>
      <label className="min-w-0 sm:w-56"><span className={rotulo}>Ordenar por</span><select className={controle} value={ordem} onChange={e=>setOrdem(e.target.value)}><option value="tipo">Tipo de equipamento</option><option value="valor">Estimativa, maior primeiro</option></select></label>
      <div className="flex flex-wrap gap-x-5"><button type="button" className={botao} onClick={()=>{muda(inicial??abas[0]);setBusca('');setOrdem('tipo');}}>Limpar</button><button type="button" disabled={!linhas.length} className={botao+' disabled:opacity-50'} onClick={()=>download(csvTic(linhas),'cultura-'+aba+'.csv')}>Baixar este recorte · CSV</button></div>
    </Controles>
    <figure aria-labelledby="titulo-estimativa" data-figura-legado=""><figcaption id="titulo-estimativa" className="t-h3 text-carvao">{ficha.nome}{categoria!=='Sim'?' · '+categoria:''}</figcaption><p className="t-meta mt-2 max-w-prose2 text-carvao-muted">Brasil, 2024 · % do total de cada tipo de equipamento. O ponto mostra a estimativa; o segmento mostra valor ± margem publicada, com confiança de 95%. Escala fixa de 0 a 100%.</p>
    <p className="t-meta mt-3 max-w-prose2 text-carvao" data-ressalva=""><span className="font-medium">Ressalva: </span>{ficha.limites}</p>
    {!linhas.length?<p className="mt-8 border-y border-linha py-8">Nenhum equipamento corresponde à busca. Use Limpar para restaurar o recorte.</p>:<div className="mt-6"><div aria-hidden="true" className="mb-2 hidden grid-cols-[12rem_minmax(0,1fr)_9rem] gap-4 md:grid"><span/><div className="flex justify-between text-xs text-carvao-muted"><span>0%</span><span>50%</span><span>100%</span></div><span/></div>{linhas.map(r=>{const lo=Math.max(0,r.valor-r.margem),hi=Math.min(100,r.valor+r.margem);return <div key={r.tipo} className="grid gap-3 border-t border-linha py-5 md:grid-cols-[12rem_minmax(0,1fr)_9rem] md:items-center"><span className="text-sm font-semibold">{r.tipo}</span><div aria-hidden="true" className="relative h-8 border-x border-linha bg-obee-suave"><span className="absolute inset-y-0 left-1/2 border-l border-linha"/><span className="absolute top-[15px] h-[2px] bg-obee-dark" style={{left:lo+'%',width:(hi-lo)+'%'}}/><span className="absolute top-2 h-4 border-l-2 border-obee-dark" style={{left:lo+'%'}}/><span className="absolute top-2 h-4 border-l-2 border-obee-dark" style={{left:hi+'%'}}/><span className="absolute top-2 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-superficie bg-obee" style={{left:r.valor+'%'}}/></div><span className="text-right text-sm tabular-nums"><strong>{n(r.valor)}%</strong><span className="ml-2 text-xs">± {n(r.margem)} p.p.</span></span></div>})}</div>}
    <p className="t-meta mt-4 max-w-prose2 text-carvao-muted">Fonte: <a className="underline" href={base.fontes[0].url}>Cetic.br/NIC.br · TIC Cultura 2024, tabela {aba}</a>. Inclui equipamentos públicos e privados presentes nos cadastros oficiais. Não mede todos os espaços culturais nem a proporção de pessoas atendidas.</p></figure>
    <TabelaDados recolhida={false} id="tabela-estimativas" tituloVisivel="Estimativas e precisão, lado a lado." lead="A margem é expressa em pontos percentuais. No celular, role somente a tabela." titulo={ficha.nome+' · '+categoria+' · Brasil, 2024'} colunas={['Tipo de equipamento','Estimativa (%)','Margem (p.p.)','Fonte: aba · linha · coluna']} linhas={linhas.map(r=>[r.tipo,r.valor,r.margem,r.aba+' · '+r.origem.linha+' · '+r.origem.coluna])} casas={[null,2,2,null]} limite={Math.max(1,linhas.length)}/>
  </section>;
}
