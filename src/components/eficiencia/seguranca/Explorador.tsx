'use client';

import {useState} from 'react';
import {base,csv,grupos,numero,percentual,seleciona,type Grupo} from '@/lib/eficiencia/seguranca/dados';

export function Explorador({grupo}:{grupo:Grupo}){
  const [busca,setBusca]=useState(''),[ordem,setOrdem]=useState('titulo');
  const linhas=seleciona(grupo,busca,ordem),config=grupos[grupo];
  function baixar(){const url=URL.createObjectURL(new Blob([csv(linhas)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`seguranca-${grupo}-2025.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section aria-labelledby="pergunta-painel" className="mt-8">
    <p className="rotulo text-obee-dark">Brasil · janeiro a dezembro de 2025</p>
    <h1 id="pergunta-painel" className="mt-3 max-w-3xl font-serif text-3xl sm:text-4xl">{config.pergunta}</h1>
    <p className="mt-4 max-w-3xl leading-relaxed">{config.nota}</p>
    <div className="mt-6 flex flex-wrap items-end gap-4 border-y border-linha bg-superficie p-4">
      <label className="flex w-full min-w-0 flex-col sm:w-auto sm:flex-1 gap-2 text-sm">Buscar indicador<input value={busca} onChange={e=>setBusca(e.target.value)} className="min-h-[44px] w-full border border-obee-dark bg-superficie px-3" type="search"/></label>
      <label className="flex max-w-full flex-col gap-2 text-sm">Ordenar por<select value={ordem} onChange={e=>setOrdem(e.target.value)} className="min-h-[44px] max-w-full border border-obee-dark bg-superficie px-3"><option value="titulo">Nome</option><option value="variacao">Variação, maior primeiro</option><option value="valor">Volume, maior primeiro</option></select></label>
      <button onClick={()=>{setBusca('');setOrdem('titulo');}} className="min-h-[44px] px-3 text-obee-dark underline">Limpar</button>
      <button onClick={baixar} disabled={!linhas.length} className="min-h-[44px] border border-obee-dark px-4 disabled:opacity-50">Baixar este recorte · CSV</button>
    </div>
    <p className="mt-3 text-sm text-carvao-muted">{linhas.length} indicadores no recorte. Os volumes têm unidades e conceitos próprios; a ordem não representa gravidade.</p>
    {linhas.length===0?<p role="status" className="mt-8 border-l-4 border-obee pl-4">Nenhum indicador corresponde à busca. Limpe o campo para recuperar o recorte.</p>:<>
    <figure className="mt-8" aria-labelledby="titulo-variacao"><figcaption id="titulo-variacao" className="font-serif text-2xl">Variação publicada em relação a 2024</figcaption><p className="mt-2 text-sm">Percentual · comparação de cada indicador com sua própria base. Esquerda: redução; direita: aumento. Escala fixa de −50% a +50%.</p>
    <div className="mt-5 divide-y divide-linha">{linhas.map(i=><div key={i.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_5rem] sm:items-center"><span className="text-sm">{i.titulo}{i.ressalva&&<span className="mt-1 block text-xs font-semibold">Cobertura parcial: {i.ressalva}</span>}</span><div aria-hidden="true" className="relative h-7 bg-obee-suave"><span className="absolute inset-y-0 left-1/2 border-l border-obee-dark"/><span className="absolute top-2 h-3 bg-obee" style={{left:`${i.variacao<0?50+i.variacao:50}%`,width:`${Math.abs(i.variacao)}%`}}/></div><span className="text-right font-semibold tabular-nums">{percentual(i.variacao)}</span></div>)}</div>
    <p className="mt-4 text-sm text-carvao-muted">Fonte: <a className="text-obee-dark underline" href={base.url}>MJSP, Infográficos Mapa 2026</a>. Extração no Sinesp em 25/02/2026. Dados sujeitos a revisão pelas UFs. Percentuais transcritos da fonte; os totais de 2024 não foram reconstruídos a partir de percentuais arredondados.</p></figure>
    <div className="mt-10"><h2 className="font-serif text-2xl">Valores, unidades e cobertura</h2><p id="ajuda-tabela" className="mt-2 text-sm">Em telas estreitas, role a tabela horizontalmente. O CSV contém todos os indicadores do recorte selecionado.</p><div role="region" aria-label="Tabela de indicadores" aria-describedby="ajuda-tabela" tabIndex={0} className="mt-4 overflow-x-auto border-y border-linha"><table className="w-full min-w-[720px] text-sm"><caption className="sr-only">Brasil, 2025. Fonte Sinesp, extração de 25 de fevereiro de 2026.</caption><thead className="bg-obee-suave"><tr>{['Indicador','Volume em 2025','Unidade','Variação vs. 2024','Cobertura e origem'].map(t=><th key={t} scope="col" className="p-3 text-left">{t}</th>)}</tr></thead><tbody>{linhas.map(i=><tr key={i.id} className="border-t border-linha"><th scope="row" className="p-3 text-left font-medium">{i.titulo}</th><td className="p-3 text-right tabular-nums">{numero(i.valor)}</td><td className="p-3">{i.unidade}</td><td className="p-3 text-right tabular-nums">{percentual(i.variacao)}</td><td className="max-w-xs p-3">{i.ressalva??'Total Brasil publicado'}<a href={`${base.url}#page=${i.pagina}`} className="mt-2 block min-h-[44px] text-obee-dark underline">Fonte · página {i.pagina}</a></td></tr>)}</tbody></table></div></div>
    </>}
  </section>;
}
