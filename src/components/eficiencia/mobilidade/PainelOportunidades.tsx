import Link from 'next/link';
import {dadosOportunidades} from '@/lib/eficiencia/mobilidade/oportunidades-dados';
import {dadosMobilidade} from '@/lib/eficiencia/mobilidade/dados';
import {MODOS_AOP,HORARIOS_AOP,recorteAop,rotuloGrupoAop,fontesAop,type GrupoAop} from '@/lib/eficiencia/mobilidade/oportunidades';
import {ROTA_MOBILIDADE,type Parametros} from '@/lib/eficiencia/mobilidade/modelo';
import {Controles,FiguraAnalitica,PaginaPainel,TabelaDados} from '@/components/painel';
import {Recolhido} from '@/components/observatorios/Recolhido';
import {fichaDaFigura} from '@/lib/eficiencia/fichaDaFigura';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
import s from './mobilidade.module.css';
const url=ROTA_MOBILIDADE+'/oportunidades';
const f=(n:number|null,d=1)=>n===null?'Não disponível':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:d}).format(n);
const pct=(n:number|null)=>n===null?'Não disponível':n>99.99&&n<100?'>99,99%':n>0&&n<0.01?'<0,01%':f(n,2)+'%';
// peças do kit de painel (molde de painel, Iniciativa 1 do parecer de UX de 23/10/2026): o formulário do recorte (um só, como a auditoria do
// workflow exige) dentro do Controles, as tabelas à mão na TabelaDados; as barras de domínio ficam, marcadas como legado, porque levam em
// cada linha a cobertura e a parcela sem oportunidade, que o gráfico do kit não escreve
const ROTULO='rotulo block text-mineral';
const CAMPO='mt-1 min-h-[44px] w-full min-w-0 border border-mineral bg-superficie px-2 text-sm text-carvao focus:outline focus:outline-2 focus:outline-obee';
const BOTAO='inline-flex min-h-[44px] items-center border border-carvao px-4 text-sm text-carvao hover:bg-carvao hover:text-marfim';
const LINK='inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao';
const RESUMO='flex min-h-[44px] cursor-pointer items-center py-2 text-sm font-medium text-carvao underline decoration-linha underline-offset-4';
function Barra({label,value,max,unit,detail}:{label:string;value:number|null;max:number;unit:string;detail?:string}){return <div className={s.linha}><div className={s.linhaTopo}><span>{label}</span><strong>{f(value)}{value!==null?' '+unit:''}</strong></div>{value!==null&&<div className={s.trilho} aria-hidden="true"><span className={value===0?s.zero:s.barra} style={value===0?undefined:{width:100*value/max+'%'}}/></div>}{detail&&<p className={s.legenda}>{detail}</p>}</div>;}
const COLUNAS_GRUPOS=['Áreas de renda','Média','Cobertura populacional','População coberta','População de referência','Zero oportunidades entre cobertos'];
/**
 * Acesso a oportunidades (Ipea/AOP) no molde de painel. O formulário do recorte vem logo antes das figuras; o alcance por cidade e o acesso
 * por área de renda são as duas figuras, com as tabelas do kit no mesmo lugar de antes (a do alcance continua no mesmo resumo recolhido de antes); sem cidade escolhida, a pergunta das áreas de renda fica num bloco aberto que pede a cidade. O
 * retrato histórico vira o limite e a ressalva; "Como ler e reproduzir" vai inteiro para o método; "Chegar não é ser atendido" segue no fim.
 */
export function PainelOportunidades({p}:{p:Parametros}){
 const {base:g,hash}=dadosOportunidades(),r=recorteAop(g,p),nomes=new Map(dadosMobilidade().base.territories.map(t=>[t.id,t.name]));
 const nome=(id:string)=>nomes.get(id)??g.cities.find(c=>c.id===id)?.name??id;
 const rows=[...r.rows].sort((a,b)=>nome(a.city.id).localeCompare(nome(b.city.id),'pt-BR'));
 const validos=rows.flatMap(x=>x.record?.groups.find(v=>v.group==='all')?.mean!=null?[x]:[]);
 const max=Math.max(1,...validos.map(x=>x.record!.groups[0].mean!));
 const query=new URLSearchParams({escopo:'recorte',modo:r.mode,pico:r.peak,indicador:r.metric.id,...(r.city?{cidade:r.city.id}:{})});
 const registro=r.city?rows[0]?.record:null;
 const renda=registro?.groups.filter(x=>x.group!=='all')??[],maxRenda=Math.max(1,...renda.map(x=>x.mean??0));
 const sources=registro?fontesAop(g,registro):[];
 const capturas=g.sources.map(x=>x.capturado_em).filter(Boolean).sort();
 const ficha=fichaDaFigura({indicador:'Oportunidades alcançáveis por origem, média ponderada pelos moradores, por cidade, modo, horário e área de renda',natureza:'ESTIMADO',orgao:'Ipea',conjunto:'Projeto Acesso a Oportunidades',recurso:`${g.sources.length} arquivos originais de acessibilidade e de população espacial, vinculados pela cidade e pela célula H3`,url:'https://www.ipea.gov.br/acessooportunidades/dados/',
  unidade:'oportunidades alcançáveis (empregos, escolas, serviços)',frequencia:'Edição do projeto',referencia:{inicio:String(g.referenceYear),fim:String(g.referenceYear)},capturadoEm:capturas.at(-1)?.slice(0,10)??'',sha256:hash,snapshot:'data/eficiencia_mobilidade/aop/resumo.json',versao:'resumo Ipea/AOP, esquema '+g.schemaVersion,
  formula:'Média = soma, nas células de origem, das oportunidades alcançáveis × moradores da célula ÷ moradores cobertos',transformacoes:['Agregação da OBEE por cidade, modo, horário, medida e decil de renda da área.'],limitacoes:[`Acessibilidade de ${g.referenceYear}, ponderada pela população de ${g.populationYear}: não descreve a rede nem a população atuais.`,'Acesso espacial não garante contratação, matrícula, consulta ou atendimento.',...g.notes]});
 const servico=<Recolhido id="chegar-nao-e-ser-atendido" aberto nivelTitulo={2} titulo="Chegar não é ser atendido" resumo="Conecte o acesso espacial às condições de atendimento registradas nos outros capítulos."><div className={s.acoes+' pb-6'}><Link className={s.acao} href="/eficiencia-estatal/educacao-municipal-capitais">Educação</Link><Link className={s.acao} href="/eficiencia-estatal/saude-capitais">Saúde</Link><Link className={s.acao} href="/eficiencia-estatal/assistencia-social">Assistência social</Link><Link className={s.acao} href={ROTA_MOBILIDADE+'/acesso'}>Acessibilidade física</Link></div></Recolhido>;
 const controles=<Controles rotulo="Recorte das oportunidades" resumo={r.avisos.length?r.avisos.join(' '):`${MODOS_AOP[r.mode]} · ${HORARIOS_AOP[r.peak]} · ${r.city?nome(r.city.id):'todas as cidades da base'}`}>
  <form key={JSON.stringify([r.metric.id,r.mode,r.city?.id??'',r.peak])} action={url} method="get" className="contents">
   <label className="min-w-0 sm:w-72"><span className={ROTULO}>Oportunidade e tempo</span><select className={CAMPO} name="indicador" aria-label="Oportunidade e tempo" defaultValue={r.metric.id}>{g.metrics.map(m=><option key={m.id} value={m.id}>{m.opportunity} · {m.minutes} minutos</option>)}</select></label>
   <label className="min-w-0 sm:w-56"><span className={ROTULO}>Modo de transporte</span><select className={CAMPO} name="modo" aria-label="Modo de transporte" defaultValue={r.mode}>{Object.entries(MODOS_AOP).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <label className="min-w-0 sm:w-64"><span className={ROTULO}>Cidade</span><select className={CAMPO} name="cidade" aria-label="Cidade" defaultValue={r.city?.id??''}><option value="">Todas as cidades da base</option>{[...g.cities].sort((a,b)=>nome(a.id).localeCompare(nome(b.id),'pt-BR')).map(c=><option key={c.id} value={c.id}>{nome(c.id)}</option>)}</select></label>
   <label className="min-w-0 sm:w-64"><span className={ROTULO}>Horário dos modos motorizados</span><select className={CAMPO} name="pico" aria-label="Horário dos modos motorizados" defaultValue={r.peak==='na'?'1':r.peak}><option value="1">Pico</option><option value="0">Fora do pico</option></select></label>
   <div className="flex flex-wrap items-center gap-x-5"><button className={BOTAO} type="submit">Aplicar oportunidades</button><Link className={LINK} href={url}>Limpar filtros</Link></div>
  </form>
 </Controles>;
 return <PaginaPainel rota={url}
  abertura={{grupo:TEMAS_EFICIENCIA.mobilidade.nome,acento:'obee',titulo:'O que cabe no alcance de uma viagem?',
   lead:'Compare quantos empregos, escolas e serviços podem ser alcançados a partir de onde as pessoas moram. A cidade, o modo de transporte e o tempo de viagem definem o recorte.',
   recorte:{periodo:`acessibilidade de ${g.referenceYear}, população de ${g.populationYear}`,universo:`${g.cities.length} cidades da base`,unidade:'oportunidades alcançáveis por origem',fonte:'Ipea, Projeto Acesso a Oportunidades; cálculos de agregação da OBEE'},
   limite:'a rede nem a população atuais, nem que o acesso espacial garanta contratação, matrícula, consulta ou atendimento: é um retrato histórico de hipóteses de rede, não de viagens observadas.'}}
  figuras={<>
   {controles}
   <FiguraAnalitica id="alcance" pergunta={`${r.metric.opportunity} em até ${r.metric.minutes} minutos`} subtitulo={`Média de ${r.metric.unit} alcançáveis por origem · ${MODOS_AOP[r.mode]} · ${HORARIOS_AOP[r.peak]} · ${g.referenceYear}`} natureza="ESTIMADO" idioma="pt" proveniencia={ficha}
    ressalva={<><strong className="font-medium">Retrato histórico:</strong> acessibilidade de {g.referenceYear}, ponderada pela distribuição espacial da população de {g.populationYear}. Não descreve a rede nem a população atuais. Acesso espacial não garante contratação, matrícula, consulta ou atendimento.</>}
    comoInterpretar={<>A média pondera cada ponto de partida pelo número de moradores na base de {g.populationYear}. Não é o total de oportunidades da cidade. A cobertura informa qual parcela dessa população entra no cálculo. A pé e de bicicleta não há distinção de horário nesta base; o campo de horário só afeta automóvel e transporte público.</>}
    naoConcluir="A ordem alfabética não é classificação de desempenho, e cidade fora da cobertura de um modo não tem valor inventado: sem estimativa não significa ausência de transporte ou de oportunidades."
    tabela={{naFigura:'recolhida logo abaixo das barras, com valores, cobertura, população coberta e de referência e o estado de cada cidade.'}}>
    <div data-figura-legado="" className="space-y-4">
     <p className={s.nota}>{MODOS_AOP[r.mode]} · {HORARIOS_AOP[r.peak]} · {g.referenceYear}. <strong>{validos.length} de {rows.length} cidades do recorte com estimativa.</strong></p>
     {validos.length>0&&<figure aria-label="Oportunidades alcançáveis por cidade"><figcaption className={s.nota}>Média de {r.metric.unit} alcançáveis por origem, ponderada pelos moradores. Escala de zero a {f(max)}. Ordem alfabética, sem classificação de desempenho.</figcaption>{rows.filter(x=>x.record).map(x=>{const a=x.record!.groups[0];return <Barra key={x.city.id} label={nome(x.city.id)} value={a.mean} max={max} unit={r.metric.unit} detail={'Cobertura populacional: '+pct(a.coverage)+' · Sem oportunidade alcançável entre os cobertos: '+pct(a.zeroShare)}/>;})}</figure>}
     {rows.some(x=>!x.record)&&<p className={s.aviso}><strong>Sem estimativa para este modo:</strong> {rows.filter(x=>!x.record).map(x=>nome(x.city.id)).join(', ')}. Não significa ausência de transporte ou de oportunidades.</p>}
    </div>
    <details className="border-b border-linha"><summary className={RESUMO}>Tabela equivalente: valores, cobertura e denominadores</summary>
     <TabelaDados recolhida={false} titulo={`${r.metric.opportunity} · ${r.metric.minutes} min · ${MODOS_AOP[r.mode]} · ${HORARIOS_AOP[r.peak]} · ${g.referenceYear}. Pesos populacionais de ${g.populationYear}.`} colunas={['Cidade',`Média (${r.metric.unit})`,'Cobertura','População coberta','População de referência','Estado']}
      linhas={rows.map(x=>{const a=x.record?.groups[0];return [nome(x.city.id),f(a?.mean??null),pct(a?.coverage??null),f(a?.coveredPopulation??null,0),f(a?.totalPopulation??null,0),a?.mean!=null?'Estimativa histórica':a?'Sem valor elegível':'Modo não coberto'];})} limite={rows.length}/>
    </details>
    <div className={s.acoes}><a className={s.acao} href={'/api/eficiencia-mobilidade/oportunidades?'+query}>Baixar recorte e grupos de renda (CSV)</a><a className={s.acao} href="/api/eficiencia-mobilidade/oportunidades">Baixar todos os cálculos (CSV)</a></div><p className={s.nota}>O download por recorte contém todas as linhas de cálculo existentes para os filtros. Cidade sem estimativa não produz linha de cálculo; sua ausência permanece indicada na tabela.</p>
   </FiguraAnalitica>
   {registro?<FiguraAnalitica id="renda" pergunta="O acesso muda entre áreas de renda?" subtitulo={`${nome(registro.city)} · ${r.metric.minutes} minutos · média de ${r.metric.unit} por decil de renda da área · ${g.referenceYear}`} natureza="ESTIMADO" idioma="pt" proveniencia={ficha}
    comoInterpretar={<>Os decis ordenam áreas de cada cidade pela renda domiciliar per capita em {g.populationYear}: o primeiro reúne áreas de menor renda; o décimo, de maior renda. Mesma medida, modo e horário do recorte acima.</>}
    naoConcluir="Os decis não são grupos de renda individual nem os mesmos valores de renda entre cidades: não se comparam classificações de cidades diferentes, e grupos sem população elegível não recebem barra."
    tabela={{naFigura:'recolhida logo abaixo das barras, com todos os grupos, incluindo áreas sem decil válido.'}}>
    <div data-figura-legado=""><figure aria-label="Acesso por decil de renda da área"><figcaption className={s.nota}>Mesma medida, modo e horário do recorte acima. Escala de zero a {f(maxRenda)} {r.metric.unit}. Grupos sem população elegível não recebem barra.</figcaption>{renda.map(x=><Barra key={x.group} label={rotuloGrupoAop(x.group)} value={x.mean} max={maxRenda} unit={r.metric.unit} detail={'Cobertura: '+pct(x.coverage)}/>)}</figure></div>
    <details className="border-b border-linha"><summary className={RESUMO}>Tabela completa por área de renda</summary>
     <TabelaDados recolhida={false} titulo={`Mesmos grupos do gráfico, incluindo áreas sem decil válido. População de referência de ${g.populationYear}.`} colunas={COLUNAS_GRUPOS.map((c,i)=>i===1?`Média (${r.metric.unit})`:c)}
      linhas={registro.groups.map((x:GrupoAop)=>[rotuloGrupoAop(x.group),f(x.mean),pct(x.coverage),f(x.coveredPopulation,0),f(x.totalPopulation,0),pct(x.zeroShare)])} limite={registro.groups.length}/>
    </details>
   </FiguraAnalitica>:<Recolhido id="renda" aberto nivelTitulo={2} titulo="O acesso muda entre áreas de renda?" resumo={`Os decis ordenam áreas de cada cidade pela renda domiciliar per capita em ${g.populationYear}.`}>
    <p className={s.faixa}>{r.city?'A cidade selecionada não possui estimativa neste modo. Escolha outro modo para consultar os recortes disponíveis.':'Selecione uma cidade no filtro acima para comparar suas áreas de renda, sem misturar classificações de cidades diferentes.'}</p>
   </Recolhido>}
   {servico}
  </>}
  metodo={<>
   <p>Fonte: Ipea, Projeto Acesso a Oportunidades. Cálculos de agregação: OBEE. O arquivo populacional e o arquivo de acesso são vinculados pela cidade e pela célula espacial H3. As áreas sem estimativa não viram zero; áreas sem decil válido permanecem separadas.</p>
   <div className={s.acoes}><a className={s.acao} href="https://www.ipea.gov.br/acessooportunidades/dados/">Dados oficiais do Ipea</a><a className={s.acao} href="https://ipea.github.io/aopdata/articles/data_dic_pt.html">Dicionário oficial</a><a className={s.acao} href="/api/eficiencia-mobilidade/oportunidades?formato=json">Resumo completo (JSON)</a><a className={s.acao} href="/api/eficiencia-mobilidade/oportunidades?formato=seed">Semente de reprodução (JSON comprimido)</a></div>
   <p className="font-medium text-carvao">Fórmulas, limitações e fontes do recorte</p>
   {g.notes.map(n=><p key={n}>{n}</p>)}
   <p>{g.sources.length} arquivos originais; {f(g.accessRows,0)} registros de origem, modo e horário; {f(g.populationRows,0)} células populacionais, incluindo células desabitadas. Não são contagens de viagens ou pessoas distintas.</p>
   {sources.length?sources.map(src=><p key={src.arquivo}><a className={s.acao} href={src.url}>{src.type==='population'?'População espacial de 2010':'Acessibilidade de 2019'} · {src.arquivo}</a><br/><span className={s.mono}>SHA-256: {src.sha256}</span></p>):<p>Selecione uma cidade para abrir seus dois arquivos originais. O JSON completo contém todas as fontes e os hashes.</p>}
   <p>Os estudos originais são de Pereira e colaboradores (Ipea, 2022), Textos para Discussão 2772 e 2800. Os arquivos representam as hipóteses de rede e oportunidades daquela edição, não viagens observadas.</p>
   <p className={s.mono}>SHA-256 do resumo: {hash}</p>
  </>}
 />;
}
