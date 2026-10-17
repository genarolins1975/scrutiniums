import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {judiciario as d} from '@/lib/eficiencia/judiciario/dados';
import {BASE_JUDICIARIO,NOMES_UF,medianaDasMedias,type TribunalJudiciario} from '@/lib/eficiencia/judiciario/modelo';
import {n,duracao} from '@/lib/eficiencia/justica/modelo';
import {SerieTribunal} from '@/components/eficiencia/judiciario/Evolucao';
import {AberturaJudiciario,FonteJudiciario,NotaJudiciario,NumerosJudiciario,SecaoJudiciario,estiloJudiciario as s} from '@/components/eficiencia/judiciario/Editoria';
export const dynamic='force-static';
export const dynamicParams=false;
export function generateStaticParams(){return d.tribunais.map(t=>({id:t.id}));}
function nome(t:TribunalJudiciario){return t.uf?NOMES_UF[t.uf]:`${t.ramo==='federal'?'Tribunal Regional Federal':'Tribunal Regional do Trabalho'} da ${t.sigla.slice(3)}ª Região`;}
export function generateMetadata({params}:{params:{id:string}}):Metadata{const t=d.tribunais.find(t=>t.id===params.id);return {title:t?t.sigla+' · Tempos, recursos e contexto':'Tribunal não encontrado',alternates:{canonical:BASE_JUDICIARIO+'/tribunais/'+params.id}};}
export default function Ficha({params}:{params:{id:string}}){
 const t=d.tribunais.find(t=>t.id===params.id);if(!t)notFound();
 const pares=d.tribunais.filter(p=>p.ramo===t.ramo&&(!t.porte||p.porte===t.porte));
 const baixa=medianaDasMedias(pares.map(p=>p.tempoBaixados)),pend=medianaDasMedias(pares.map(p=>p.idadePendentes));
 const ramo=d.ramos.find(r=>r.id===t.ramo)!;
 const anterior=t.historico.at(-2);
 const consulta=new URLSearchParams({ramo:t.ramo,t1:t.id,...(t.porte?{porte:t.porte}:{})});
 return <><AberturaJudiciario tema="tribunal" rotulo="Ficha de tribunal" titulo={`${t.sigla} · ${nome(t)}`} texto={`${ramo.nome}${t.porte?' · porte '+t.porte:''}. Tempos publicados e contexto institucional, com referência de ${pares.length} tribunais do mesmo ramo${t.porte?' e porte':''}. Uma região não é atribuída à UF de sua sede.`}/>
 <NumerosJudiciario itens={[{titulo:'Duração média dos baixados',valor:duracao(t.tempoBaixados),nota:`Processos baixados em ${t.ano} · entrada à primeira baixa · média publicada.`},{titulo:'Idade média dos pendentes',valor:duracao(t.idadePendentes),nota:`Acervo pendente em dezembro de ${t.ano} · não é tempo restante.`},{titulo:'Mediana das médias dos pares · baixados',valor:n(baixa,baixa!==null&&baixa%1?1:0)+' meses',nota:`Peso igual para cada um dos ${pares.length} tribunais compatíveis; não é mediana dos processos.`},{titulo:'Mediana das médias dos pares · pendentes',valor:n(pend,pend!==null&&pend%1?1:0)+' meses',nota:'Mesmo ramo, porte quando classificado e ano; assuntos não controlados.'}]}/><FonteJudiciario pagina={String(t.pagina)}/>
 {t.tempoBaixados>t.idadePendentes&&<aside className={`${s.notice} ${s.faxina}`}><strong>Baixados com média maior que a idade do acervo.</strong> Em {t.ano}, os processos baixados duraram em média {duracao(t.tempoBaixados)}, mais que a idade média dos que seguem pendentes ({duracao(t.idadePendentes)}). As duas médias descrevem grupos diferentes do mesmo ano. {anterior&&anterior.idadePendentes!==null&&anterior.tempoBaixados!==null&&anterior.idadePendentes>t.idadePendentes&&anterior.tempoBaixados<t.tempoBaixados?`Na série, a idade do acervo caiu de ${anterior.idadePendentes} para ${t.idadePendentes} meses entre ${anterior.ano} e ${t.ano}, enquanto a duração dos baixados subiu de ${anterior.tempoBaixados} para ${t.tempoBaixados}: padrão compatível com o encerramento concentrado de processos antigos. `:'Uma explicação possível é o encerramento concentrado de processos antigos; a série abaixo ajuda a conferir. '}A duração dos baixados, sozinha, não indica lentidão.</aside>}
 <SecaoJudiciario titulo="Como os tempos evoluíram?" texto="Valores publicados em cada edição do Justiça em Números. A série permite ver se a fila envelheceu ou se o tribunal encerrou processos antigos."><SerieTribunal sigla={t.sigla} historico={t.historico} nota={d.historicoTempos.nota}/></SecaoJudiciario>
 <SecaoJudiciario titulo="Recursos, demanda e contexto de 2025." texto="Os valores são os publicados nas tabelas e figuras do CNJ, sem rateio do agregado do ramo. Ausência é preservada como ausência."><div className={s.tableWrap} tabIndex={0} role="region" aria-label="Recursos e indicadores do tribunal"><table className={s.table}><caption>{t.sigla} · ano-base {t.ano}</caption><thead><tr><th scope="col">Medida</th><th scope="col">Valor</th><th scope="col">Unidade e localizador</th></tr></thead><tbody>{[
 ['Despesa total',t.despesaTotal===null?'Não disponível':'R$ '+n(t.despesaTotal),'Reais nominais de 2025 · tabela p. '+(t.estruturaPagina??'não disponível')],
 ...(t.despesaPorHabitante===null?[]:[['Despesa por habitante','R$ '+n(t.despesaPorHabitante,1)+' · sem inativos R$ '+n(t.despesaPorHabitanteSemInativos,1),'Reais nominais de 2025, como publicado pelo CNJ · figura 79, p. '+t.porHabitantePagina]]),
 ['Casos novos',n(t.novos),'Processos · tabela p. '+(t.estruturaPagina??'não disponível')],
 ['Casos pendentes',n(t.pendentes),'Processos · tabela p. '+(t.estruturaPagina??'não disponível')],
 ['Magistrados(as)',n(t.magistrados),'Pessoas; não equivalentes de jornada · tabela p. '+(t.estruturaPagina??'não disponível')],
 ['Servidores(as)',n(t.servidores),'Pessoas, categoria da tabela; não inclui automaticamente todas as formas de vínculo · p. '+(t.estruturaPagina??'não disponível')],
 ['Congestionamento bruto',n(t.congestionamento,1)+'%','Índice oficial · p. '+t.congestionamentoPagina],
 ['IPC-Jus oficial',n(t.ipcJus)+'%','Indicador relativo no ramo · p. '+t.ipcPagina],
 ['Execução · duração dos baixados',duracao(t.execucaoBaixados),'Primeiro grau, fase de execução · p. '+t.execucaoPagina],
 ['Execução · idade dos pendentes',duracao(t.execucaoPendentes),'Primeiro grau, fase de execução · p. '+t.execucaoPagina],
 ['Recorribilidade externa',n(t.recorribilidadeExterna,1)+'%','Primeiro grau, conhecimento; recurso a instância superior · p. '+t.recorribilidadePagina],
 ['Recorribilidade interna',n(t.recorribilidadeInterna,1)+'%','Primeiro grau, conhecimento; recurso ao próprio órgão · p. '+t.recorribilidadePagina],
 ...(t.justicaGratuita===null?[]:[['Justiça gratuita',n(t.justicaGratuita)+'%','Arquivados definitivamente com assistência gratuita · p. '+t.justicaGratuitaPagina]]),
 ].map(([titulo,valor,unidade])=><tr key={titulo}><th scope="row">{titulo}</th><td>{valor}</td><td>{unidade}</td></tr>)}</tbody></table></div>
 <p className={s.muted}>IPC-Jus é o indicador oficial do CNJ, sem reprodução do modelo pela Scrutiniums. {t.ramo==='federal'?'Na Justiça Federal, o consolidado resulta das áreas judiciárias por seção e grau; não é comparável ao indicador de outro ramo.':'O indicador da edição inclui a área administrativa e tem exclusões próprias de acervo e recursos.'} Não é uma nota de qualidade jurídica nem prova de cumprimento do direito.</p><FonteJudiciario pagina={String(t.ipcPagina)}/></SecaoJudiciario>
 <SecaoJudiciario titulo="Compare mantendo o mesmo universo." texto="A seleção abre o mesmo ramo e, quando disponível, o porte oficial. Tempos menores, isoladamente, não identificam causas nem demonstram qualidade da decisão."><div className={s.actions}><Link className={s.button} href={BASE_JUDICIARIO+'/comparar?'+consulta.toString()}>Comparar {t.sigla} com seus pares</Link>{t.uf&&<Link className={s.button} href={'/eficiencia-estatal/acesso-justica/cobertura?uf='+t.uf}>Cobertura da assistência em {t.uf}</Link>}</div></SecaoJudiciario>
 <NotaJudiciario><strong>Limites da ficha:</strong> indicadores de 2025 e tempos totais de 2021 a 2025; sem composição por assunto, proporção total de execuções, metas ou eventos de cumprimento neste recorte. Despesas individuais e porte de TRFs não estão disponíveis nas tabelas utilizadas. O agregado federal não é distribuído entre regiões ou estados.</NotaJudiciario><div className={s.links}><a download href="/eficiencia/judiciario/tribunais.csv">Baixar os 57 tribunais e metadados</a><Link href={BASE_JUDICIARIO+'/metodos'}>Consultar todos os passaportes</Link></div></>;
}
