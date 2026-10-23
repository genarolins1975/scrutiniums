'use client';
import Link from 'next/link';
import {useMemo} from 'react';
import {useEstadoUrl} from '@/components/energia/useEstadoUrl';
import {campo,tiposUrl} from '@/lib/energia/estadoUrl';
import {BASE_JUDICIARIO,MEDIDAS_TRIBUNAL,medianaDasMedias,csvJudiciario,type TribunalJudiciario,type MedidaTribunal,type RamoAgregado} from '@/lib/eficiencia/judiciario/modelo';
import {n,duracao} from '@/lib/eficiencia/justica/modelo';
import {HalteresTribunais} from './Halteres';
import {Controles,GraficoBarras,TabelaDados} from '@/components/painel';
import s from './Judiciario.module.css';

function salvar(nome:string,conteudo:string){const url=URL.createObjectURL(new Blob([conteudo],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=nome;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
type MedidaRamo = 'novos'|'baixados'|'pendentes'|'idadePendente'|'conhecimento'|'execucao'|'cejuscs';
const medidasRamo:Record<MedidaRamo,{titulo:string;unidade:string}>={
 novos:{titulo:'Casos novos no ano',unidade:'processos'},baixados:{titulo:'Processos baixados no ano',unidade:'processos'},pendentes:{titulo:'Processos pendentes em dezembro',unidade:'processos'},
 idadePendente:{titulo:'Idade média dos pendentes · todas as fases',unidade:'meses'},conhecimento:{titulo:'Idade média dos pendentes · conhecimento',unidade:'meses'},execucao:{titulo:'Idade média dos pendentes · execução',unidade:'meses'},cejuscs:{titulo:'Centros de solução de conflitos',unidade:'unidades'},
};
// peças do kit de painel (molde de painel, Iniciativa 1 do parecer de UX de 23/10/2026): controles junto do gráfico, barras e tabela do kit
// no lugar das barras e da tabela à mão; o gráfico desenha sempre os três ramos, com o escolhido em destaque, para a escala continuar comum
const rotuloControle='rotulo block text-mineral';
const controleKit='mt-1 min-h-[44px] w-full min-w-0 border border-mineral bg-superficie px-2 text-sm text-carvao focus:outline focus:outline-2 focus:outline-obee';
// comparador: os mesmos rótulos, estados e botões que scripts/obee/judiciario-verificacao.mjs lê; seleção e tabelas no kit
const botaoKit='inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao';
export function ExploradorRamos({ramos,medidas,fonte,ano}:{ramos:RamoAgregado[];medidas:MedidaRamo[];fonte:string;ano:number}){
 const schema=useMemo(()=>({ramo:campo(tiposUrl.opcao(['todos','estadual','federal','trabalho']),'todos'),medida:campo(tiposUrl.opcao(medidas),medidas[0])}),[medidas]);
 const [state,set]=useEstadoUrl(schema);
 const rows=ramos.filter(r=>state.ramo==='todos'||r.id===state.ramo),m=medidasRamo[state.medida];
 const valor=(v:number)=>m.unidade==='meses'?duracao(v):n(v);
 const precisao=m.unidade==='processos'?'Arredondado a 100 mil processos':m.unidade==='meses'?'Média publicada, não mediana':'Centros instalados';
 return <section aria-label="Explorar agregados dos ramos" className="space-y-5">
 <Controles rotulo="Recorte dos ramos" resumo={(state.ramo==='todos'?'Três ramos selecionados':ramos.find(r=>r.id===state.ramo)?.nome)+' · '+m.titulo+' · '+ano}>
 <label className="min-w-0 sm:w-64"><span className={rotuloControle}>Ramo</span><select aria-label="Ramo" className={controleKit} value={state.ramo} onChange={e=>set({ramo:e.target.value as typeof state.ramo})}><option value="todos">Três ramos selecionados</option>{ramos.map(r=><option key={r.id} value={r.id}>{r.nome}</option>)}</select></label>
 <label className="min-w-0 sm:w-72"><span className={rotuloControle}>Medida por ramo</span><select aria-label="Medida por ramo" className={controleKit} value={state.medida} onChange={e=>set({medida:e.target.value as MedidaRamo})}>{medidas.map(k=><option key={k} value={k}>{medidasRamo[k].titulo}</option>)}</select></label>
 <div className="flex flex-wrap gap-x-5"><button type="button" className={botaoKit} onClick={()=>set({ramo:'todos',medida:medidas[0]})}>Limpar filtros</button><button type="button" className={botaoKit} onClick={()=>salvar('judiciario-ramos-'+state.medida+'.csv',csvJudiciario(['Ramo','Indicador','Valor','Unidade','Ano','Fonte','Nota'],rows.map(r=>[r.nome,m.titulo,r[state.medida],m.unidade,ano,fonte,m.unidade==='processos'?r.nota:m.unidade==='meses'?MEDIDAS_TRIBUNAL.idadePendentes.nota:'Centros instalados; não mede acesso efetivo.'])))}>Baixar recorte completo CSV</button></div>
 </Controles>
 <p className="t-meta max-w-prose2 text-carvao-muted">Os controles afetam somente este gráfico, sua tabela e seu CSV. Referência {ano}. Escala comum aos três ramos, mesmo ao selecionar apenas um: o ramo escolhido fica destacado no gráfico, e a tabela e o CSV trazem só ele. Escala começa em zero; valores exatos do recorte na tabela.</p>
 <GraficoBarras semTabela titulo={m.titulo+' · '+m.unidade+' · '+ano} dados={ramos.map(r=>({id:r.id,nome:r.nome,v:r[state.medida]}))} chaveCategoria="id" chaveRotulo="nome" orientacao="horizontal" series={[{id:'v',rotulo:m.titulo,cor:'var(--cor-obee)'}]} unidade={m.unidade} casas={0} rotulosValor selecionado={state.ramo==='todos'?null:state.ramo} onSelecionar={id=>set({ramo:(id??'todos') as typeof state.ramo})}/>
 <TabelaDados titulo={m.titulo+' · '+ano+' · '+m.unidade} colunas={['Ramo','Valor','Unidade','Precisão e universo']} linhas={rows.map(r=>[r.nome,m.unidade==='meses'?valor(r[state.medida]):r[state.medida],m.unidade,precisao])} casas={[null,0,null,null]} limite={rows.length} recolhida={false}/>
 </section>;
}

export function ComparadorJudiciario({tribunais,fonte,ano}:{tribunais:TribunalJudiciario[];fonte:string;ano:number}){
 const ids=useMemo(()=>['',...tribunais.map(t=>t.id)],[tribunais]);
 const schema=useMemo(()=>({ramo:campo(tiposUrl.opcao(['estadual','federal','trabalho']),'estadual'),porte:campo(tiposUrl.opcao(['','Grande','Médio','Pequeno']),''),medida:campo(tiposUrl.opcao(['tempoBaixados','idadePendentes']),'tempoBaixados'),t1:campo(tiposUrl.opcao(ids),''),t2:campo(tiposUrl.opcao(ids),''),t3:campo(tiposUrl.opcao(ids),'')}),[ids]);
 const [state,set]=useEstadoUrl(schema);
 const metric=state.medida as MedidaTribunal;
 const selected=[...new Set([state.t1,state.t2,state.t3].filter(Boolean))];
 const rows=tribunais.filter(t=>t.ramo===state.ramo&&(!state.porte||t.porte===state.porte)).sort((a,b)=>a.sigla.localeCompare(b.sigla,'pt-BR'));
 const values=rows.map(t=>t[metric]),median=medianaDasMedias(values),max=Math.max(...values,1);
 const picked=rows.filter(t=>selected.includes(t.id)),duplicate=[state.t1,state.t2,state.t3].filter(Boolean).length!==selected.length;
 const empty=rows.length===0;
 return <section aria-label="Comparar até três tribunais" className="space-y-5"><Controles rotulo="Recorte da comparação"><label className="min-w-0 sm:w-64"><span className={rotuloControle}>Ramo dos tribunais</span><select aria-label="Ramo dos tribunais" className={controleKit} value={state.ramo} onChange={e=>set({ramo:e.target.value as typeof state.ramo,porte:'',t1:'',t2:'',t3:''})}><option value="estadual">Justiça Estadual · 27 TJs</option><option value="federal">Justiça Federal · 6 TRFs</option><option value="trabalho">Justiça do Trabalho · 24 TRTs</option></select></label><label className="min-w-0 sm:w-48"><span className={rotuloControle}>Porte oficial</span><select aria-label="Porte oficial" className={controleKit} value={state.porte} onChange={e=>set({porte:e.target.value as typeof state.porte,t1:'',t2:'',t3:''})}><option value="">Todos os portes</option>{['Grande','Médio','Pequeno'].map(p=><option key={p} value={p}>{p}</option>)}</select></label><label className="min-w-0 sm:w-72"><span className={rotuloControle}>Medida dos tribunais</span><select aria-label="Medida dos tribunais" className={controleKit} value={metric} onChange={e=>set({medida:e.target.value as MedidaTribunal})}>{Object.entries(MEDIDAS_TRIBUNAL).map(([key,m])=><option key={key} value={key}>{m.titulo}</option>)}</select></label></Controles>
 {empty?<aside className={s.notice}><h3>Nenhum tribunal corresponde ao recorte.</h3><p>A fonte não classifica TRFs por porte nesta edição. Limpe o filtro de porte para comparar os seis tribunais federais. Não se atribui um porte a partir da UF da sede.</p><button className={s.button} onClick={()=>set({porte:'',t1:'',t2:'',t3:''})}>Limpar porte</button></aside>:<>
 <p className={s.muted}>Mesma edição, ano e ramo · {rows.length} tribunais · {ano}. A seleção destaca até três; a distribuição e a exportação preservam todos os pares elegíveis.</p>
 <Controles rotulo="Tribunais em destaque">{(['t1','t2','t3'] as const).map((key,i)=><label key={key} className="min-w-0 sm:w-56"><span className={rotuloControle}>Tribunal {i+1}</span><select aria-label={`Tribunal ${i+1}`} className={controleKit} value={state[key]} onChange={e=>set({[key]:e.target.value})}><option value="">Selecionar tribunal</option>{rows.map(t=><option key={t.id} value={t.id} disabled={selected.includes(t.id)&&state[key]!==t.id}>{t.sigla}{t.uf?' · '+t.uf:' · jurisdição regional'}</option>)}</select></label>)}</Controles>
 {duplicate&&<p role="status" className={s.notice}>A URL repetia um tribunal. Cada tribunal aparece uma única vez na comparação.</p>}
 <p className={s.summary}>{MEDIDAS_TRIBUNAL[metric].titulo}. <strong>{n(median,median!==null&&median%1?1:0)} meses</strong> é a mediana das médias publicadas dos {rows.length} tribunais do recorte.</p>
 <p className={s.muted}>{MEDIDAS_TRIBUNAL[metric].nota} A mediana entre tribunais dá o mesmo peso a cada tribunal; não representa a mediana dos processos nem a duração média nacional.</p>
 <div className={s.reference}>Distribuição dos pares: mínimo <span>{n(Math.min(...values))} meses</span> · mediana <span>{n(median,1)} meses</span> · máximo <span>{n(max)} meses</span>. O filtro de porte usa a classificação oficial de 2025 quando disponível. Assuntos e proporção de execuções não estão controlados.</div>
 {picked.length>0&&<div className={s.selectionCards}>{picked.map(t=><article className={s.selectionCard} key={t.id}><p>{ano} · {t.porte??'Porte não classificado'}</p><h3>{t.sigla}</h3><strong>{duracao(t[metric])}</strong><p>{MEDIDAS_TRIBUNAL[metric].titulo}. Diferença de {n(t[metric]-median!,1)} meses para a mediana das médias dos pares.</p><Link href={BASE_JUDICIARIO+'/tribunais/'+t.id}>Conhecer o tribunal</Link></article>)}</div>}
 {picked.length>0&&<TabelaDados recolhida={false} titulo={`Comparação selecionada · ${ano} · meses`} colunas={['Tribunal','Média publicada','Diferença para a mediana dos pares','Ficha']} linhas={picked.map(t=>[t.sigla,duracao(t[metric]),n(t[metric]-median!,1)+' meses','Abrir '+t.sigla])} links={{Ficha:picked.map(t=>BASE_JUDICIARIO+'/tribunais/'+t.id)}} limite={picked.length}/>}
 {picked.length>0&&<TabelaDados recolhida={false} titulo={`Contexto da comparação · ${ano} · IPC-Jus oficial, sem reprodução do modelo`} colunas={['Tribunal','Porte','Despesa · R$ nominais','Congestionamento bruto (%)','IPC-Jus (%)']} linhas={picked.map(t=>[t.sigla,t.porte??'Não classificado na edição',t.despesaTotal,t.congestionamento,t.ipcJus])} casas={[null,null,0,1,0]} ausencia={{'Despesa · R$ nominais':'Não disponível'}} limite={picked.length} nota="IPC-Jus: indicador oficial relativo aos pares do mesmo ramo; na Justiça Federal, consolidado das áreas judiciárias a partir das seções e graus. Não comparar percentuais entre ramos nem interpretá-los como qualidade jurídica. Despesa individual de TRFs não disponível. Fontes: p. 40–41, 313/384/440 e 353/407/473."/>}
 {selected.some(id=>!rows.some(t=>t.id===id))&&<p className={s.notice} role="status">A URL contém tribunal de outro ramo ou porte. Ele não participa da comparação deste recorte.</p>}
 {/* as halteres (as duas médias juntas, com o link de cada tribunal) são forma de domínio, marcada como legado dentro da figura */}
 <div data-figura-legado=""><HalteresTribunais key={state.ramo+state.porte+metric} linhas={rows} medida={metric} selecionados={selected} titulo={`${MEDIDAS_TRIBUNAL[metric].titulo} e a outra medida de tempo, em cada tribunal`} ano={ano}/></div>
 <details className={s.passport}><summary>Ver tabela dos {rows.length} tribunais</summary><TabelaDados recolhida={false} titulo={`Universo completo da comparação · ${ano} · meses`} colunas={['Tribunal','UF / jurisdição','Duração média dos baixados (meses)','Idade média dos pendentes (meses)','Selecionado']} linhas={rows.map(t=>[t.sigla,t.uf==='DF'?'DF e Territórios':t.uf??'Regional; não atribuída à UF da sede',t.tempoBaixados,t.idadePendentes,selected.includes(t.id)?'Sim':'Não'])} casas={[null,null,0,0,null]} links={{Tribunal:rows.map(t=>BASE_JUDICIARIO+'/tribunais/'+t.id)}} limite={rows.length}/></details>
 <div className={s.actions}><button className={s.button} onClick={()=>set({ramo:'estadual',porte:'',medida:'tempoBaixados',t1:'',t2:'',t3:''})}>Limpar comparação</button><button className={s.button} onClick={()=>salvar('judiciario-tribunais-'+metric+'.csv',csvJudiciario(['Tribunal','Ramo','Ano','Indicador','Valor','Unidade','Duracao media dos baixados','Idade media dos pendentes','Selecionado','Mediana das medias dos pares','Fonte','Pagina','Limite'],rows.map(t=>[t.sigla,t.ramo,ano,MEDIDAS_TRIBUNAL[metric].titulo,t[metric],'meses',t.tempoBaixados,t.idadePendentes,selected.includes(t.id)?'Sim':'Não',median,fonte,t.pagina,'Mesmo ramo e porte selecionado; composição não controlada; não é mediana de processos.'])))}>Baixar todos os pares CSV</button></div></>}
 </section>;
}
