'use client';
import {Controles,FaixaNumeros,FiguraAnalitica,GraficoBarras,LeituraGuiada,NumeroIndicador,TabelaDados} from '@/components/painel';
import {useEstadoUrl} from '@/components/painel/useEstadoUrl';
import {fichaDaFigura} from '@/lib/eficiencia/fichaDaFigura';
import {base,n,normaliza,download} from '@/lib/eficiencia/cultura/dados';
import {campo,tiposUrl} from '@/lib/painel/estadoUrl';
import {dataBR} from '@/lib/painel/formato';

/*
 * Recursos da cultura no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). O recorte (ano, esfera, busca e ordem dos
 * governos estaduais) passa do estado local para a URL, como pede o kit: as peças da página (os controles da abertura, os dois números,
 * a evolução, a distribuição entre esferas e a tabela dos governos estaduais) são ilhas separadas que leem o mesmo recorte, e o link
 * copiado reproduz a página. A base vem do módulo, não de prop: nenhuma ilha a recebe serializada. Os valores, as contas, o CSV e as
 * frases são os de antes; o gráfico de barras e as tabelas passam a ser os do kit.
 */
const ANOS=Array.from(new Set(base.gastos.map(r=>r.ano)));
const ESFERAS=['Total','Federal','Estadual','Municipal'] as const;
const ESQUEMA={
 ano:campo(tiposUrl.inteiro({min:ANOS[0],max:ANOS.at(-1)}),2023),
 esfera:campo(tiposUrl.opcao(ESFERAS),'Total'),
 busca:campo(tiposUrl.texto({max:60}),'',{historico:'replace'}),
 ordem:campo(tiposUrl.opcao(['nome','valor']),'nome'),
};
const PADRAO={ano:2023,esfera:'Total' as const,busca:'',ordem:'nome' as const};
function useRecorte(){return useEstadoUrl(ESQUEMA);}
const rotulo='rotulo block text-mineral';
const controle='mt-1 min-h-[44px] w-full min-w-0 border border-mineral bg-superficie px-2 text-sm text-carvao focus:outline focus:outline-2 focus:outline-obee';
const botao='inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao';
const SIIC=base.fontes[1];
const fonteSiic=(o:{indicador:string;natureza:'OBSERVADO'|'CALCULADO';recurso:string;transformacoes?:string[]})=>fichaDaFigura({...o,orgao:'IBGE',conjunto:'Sistema de Informações e Indicadores Culturais (SIIC) 2013–2024, gastos da administração pública (dados da STN)',
 url:SIIC.url,unidade:'R$ nominais; % da despesa da esfera',frequencia:'Anual',referencia:{inicio:'2013',fim:'2023'},publicadoEm:SIIC.publicadoEm,capturadoEm:base.capturadoEm,sha256:SIIC.sha256,
 snapshot:'public/eficiencia/cultura/snapshot.json',versao:'snapshot da cultura, versão '+base.versao,
 limitacoes:['Valores correntes de cada ano; variação nominal não mede variação do poder de compra.','A publicação mantém a classificação e a consolidação de origem; o painel não reclassifica estágios da despesa.','Arquivo de gastos revisto em '+dataBR(SIIC.revisaoArquivo??SIIC.publicadoEm,'pt')+'.'],
 notas:'IBGE, SIIC 2013–2024 · tabelas 3.1, 3.2 e 3.7, dados da STN.'});
const FICHA_SERIE=fonteSiic({indicador:'Despesa com cultura por esfera de governo',natureza:'OBSERVADO',recurso:'Tabelas 3.1 e 3.2',transformacoes:['Valores de origem em mil reais convertidos para reais (× 1.000); participação no orçamento da Tabela 3.2 convertida para percentual (× 100).']});
const FICHA_ESFERAS=fonteSiic({indicador:'Participação de cada esfera na despesa total com cultura',natureza:'CALCULADO',recurso:'Tabela 3.1',transformacoes:['Participação calculada como despesa da esfera dividida pelo total das três esferas no mesmo ano.']});

/** Os controles do recorte, na abertura (a primeira ação do leitor): ano, esfera da evolução, limpar e o CSV do recorte. */
export function ControlesRecursos(){
 const [s,set]=useRecorte();
 const ufs=base.ufs.filter(r=>r.ano===s.ano&&normaliza(r.entidade).includes(normaliza(s.busca))).sort((a,b)=>s.ordem==='valor'?b.valor-a.valor:a.entidade.localeCompare(b.entidade,'pt-BR'));
 const csv=()=>{
 const q=(v:unknown)=>'"'+String(v).replace(/"/g,'""')+'"';
 const linhas=[...base.gastos.filter(r=>r.ano===s.ano),...ufs];
 download(['ano;entidade;despesa_reais_nominais;perimetro;fonte;aba;linha;coluna',...linhas.map(r=>[r.ano,r.entidade,r.valor,r.origem.aba==='Tabela 3.7'?'Governo estadual/distrital':'Esfera de governo',base.fontes[1].url,r.origem.aba,r.origem.linha,r.origem.coluna].map(q).join(';'))].join('\r\n'),'cultura-recursos-'+s.ano+'.csv');
 };
 return <Controles rotulo="Recorte dos recursos da cultura" resumo={'Mostrando a esfera '+s.esfera+' e o ano '+s.ano+'.'}>
  <label className="min-w-0 sm:w-48"><span className={rotulo}>Ano do recorte</span><select className={controle} value={s.ano} onChange={e=>set({ano:Number(e.target.value)})}>{ANOS.map(a=><option key={a}>{a}</option>)}</select></label>
  <label className="min-w-0 sm:w-48"><span className={rotulo}>Esfera na evolução</span><select className={controle} value={s.esfera} onChange={e=>set({esfera:e.target.value as typeof s.esfera})}>{ESFERAS.map(a=><option key={a}>{a}</option>)}</select></label>
  <div className="flex flex-wrap gap-x-5"><button type="button" onClick={()=>set(PADRAO)} className={botao}>Limpar</button><button type="button" onClick={csv} className={botao}>Baixar recorte · CSV</button></div>
 </Controles>;
}

/** Os dois números do recorte: a despesa da esfera no ano e a participação na despesa total da própria esfera. */
export function NumerosRecursos(){
 const [s]=useRecorte();
 const atual=base.gastos.find(r=>r.entidade===s.esfera&&r.ano===s.ano)!;
 return <FaixaNumeros rotulo="Despesa com cultura no recorte" idioma="pt">
  <NumeroIndicador rotulo={'Despesa com cultura · '+s.esfera+' · '+s.ano} valor={atual.valor/1e9} formato="reais" casas={2} unidade="R$ bilhões" periodo={String(s.ano)} recorte={s.esfera} fonte="IBGE/STN, SIIC, tabela 3.1" natureza="OBSERVADO" nota="Reais nominais · tabela 3.1" tamanho="g" idioma="pt"/>
  <NumeroIndicador rotulo="Participação na despesa total da própria esfera" valor={atual.pesoOrcamento} formato="percentual" casas={2} unidade="%" periodo={String(s.ano)} recorte={s.esfera} fonte="IBGE/STN, SIIC, tabela 3.2" natureza="OBSERVADO" nota={s.esfera+' · '+s.ano+' · tabela 3.2. Não é participação no gasto cultural.'} tamanho="g" idioma="pt"/>
 </FaixaNumeros>;
}

/** Onze anos de despesa publicada, na esfera escolhida; o ano do recorte em destaque, e o clique numa barra escolhe o ano. */
export function FiguraSerie(){
 const [s,set]=useRecorte();
 const serie=base.gastos.filter(r=>r.entidade===s.esfera);
 return <FiguraAnalitica id="evolucao" pergunta="Onze anos de despesa publicada." subtitulo={s.esfera+' · 2013–2023 · R$ bilhões correntes de cada ano'} natureza="OBSERVADO" idioma="pt"
  comoInterpretar="O crescimento nominal não mede o aumento do poder de compra."
  naoConcluir="A despesa não identifica, sozinha, a quantidade ou a qualidade dos serviços prestados; valores correntes de cada ano não mostram a variação do poder de compra."
  tabela={{titulo:'Despesa com cultura · '+s.esfera+' · R$ nominais',colunas:['Ano','Despesa (R$ milhões)','% do orçamento da esfera'],linhas:serie.map(r=>[String(r.ano),r.valor/1e6,r.pesoOrcamento]),casas:[null,2,2],limite:serie.length}}
  proveniencia={FICHA_SERIE} extraFonte="Arquivo revisto em 10/03/2026.">
  <p className="t-meta mb-2 text-carvao-muted">Escala linear a partir de zero. Ano do recorte em destaque; escolha outro ano no gráfico ou no seletor acima.</p>
  <GraficoBarras titulo={'Evolução da despesa com cultura da esfera '+s.esfera+', em reais nominais'} series={[{id:'despesa',nome:'Despesa com cultura',pontos:serie.map(r=>({x:String(r.ano),y:r.valor/1e9}))}]} eixoY={{unidade:'R$ bilhões',zero:true,casas:2}} orientacao="vertical" rotulosValor selecionado={String(s.ano)} onSelecionar={id=>id&&set({ano:Number(id)})}/>
 </FiguraAnalitica>;
}

/** Como o total do ano se distribui entre as três esferas: participação calculada no total, com o valor de cada uma. */
export function FiguraEsferas(){
 const [s]=useRecorte();
 const esferas=base.gastos.filter(r=>r.ano===s.ano&&r.entidade!=='Total');
 const total=base.gastos.find(r=>r.ano===s.ano&&r.entidade==='Total')!;
 return <FiguraAnalitica id="esferas" pergunta="Como o total se distribui entre esferas?" subtitulo={'Participação no total de R$ '+n(total.valor/1e9,2)+' bilhões · Brasil, '+s.ano} natureza="CALCULADO" idioma="pt"
  leitura={<LeituraGuiada rotulo="Em números">{esferas.map(r=>r.entidade+': '+n(100*r.valor/total.valor)+'% · R$ '+n(r.valor/1e9,2)+' bi').join('; ')}.</LeituraGuiada>}
  naoConcluir="Não identifica a origem de transferências: a despesa de cada esfera é a registrada por ela, e o tamanho do gasto não é uma medida de atendimento ou eficiência."
  tabela={{titulo:'Despesa com cultura por esfera · Brasil, '+s.ano,colunas:['Esfera','Participação (%)','Despesa (R$ bilhões)'],linhas:esferas.map(r=>[r.entidade,100*r.valor/total.valor,r.valor/1e9]),casas:[null,1,2]}}
  proveniencia={FICHA_ESFERAS}>
  <p className="t-meta mb-2 text-carvao-muted">Brasil, {s.ano} · participação calculada no total de R$ {n(total.valor/1e9,2)} bilhões. Escala linear a partir de zero.</p>
  <GraficoBarras titulo={'Participação de cada esfera na despesa com cultura, '+s.ano} series={[{id:'pct',nome:'Participação',pontos:esferas.map(r=>({x:r.entidade,y:100*r.valor/total.valor}))}]} eixoY={{unidade:'%',zero:true,casas:1}} orientacao="horizontal" rotulosValor/>
 </FiguraAnalitica>;
}

/** Governos estaduais e Distrito Federal no ano do recorte, com a busca e a ordem logo antes da tabela. */
export function TabelaUfs(){
 const [s,set]=useRecorte();
 const ufs=base.ufs.filter(r=>r.ano===s.ano&&normaliza(r.entidade).includes(normaliza(s.busca))).sort((a,b)=>s.ordem==='valor'?b.valor-a.valor:a.entidade.localeCompare(b.entidade,'pt-BR'));
 return <section id="governos-estaduais" data-bloco-tabela="" aria-labelledby="governos-estaduais-titulo" className="scroll-mt-28 space-y-3 border-t border-linha pt-6">
  <h3 id="governos-estaduais-titulo" className="t-h3 text-carvao">Governos estaduais e Distrito Federal.</h3>
  <p className="t-meta max-w-prose2 text-carvao-muted">Despesa do governo estadual ou distrital, {s.ano}. Não soma as prefeituras localizadas na UF. O tamanho do gasto não é uma medida de atendimento ou eficiência. O DF acumula competências próprias.</p>
  <Controles rotulo="Busca e ordem dos governos estaduais" resumo={ufs.length+' governos estaduais/distrital no recorte.'}>
   <label className="min-w-0 sm:w-64"><span className={rotulo}>Buscar UF</span><input className={controle} type="search" value={s.busca} onChange={e=>set({busca:e.target.value})}/></label>
   <label className="min-w-0 sm:w-64"><span className={rotulo}>Ordenar governos</span><select className={controle} value={s.ordem} onChange={e=>set({ordem:e.target.value as typeof s.ordem})}><option value="nome">Nome da UF</option><option value="valor">Despesa, maior primeiro</option></select></label>
  </Controles>
  {!ufs.length?<p className="t-corpo border-y border-linha py-6 text-carvao">Nenhuma UF corresponde à busca. Use Limpar.</p>:
  <TabelaDados recolhida={false} idioma="pt" titulo={'Despesa estadual e distrital com cultura · '+s.ano} colunas={['Governo','Despesa (R$ milhões)','Aba · linha · coluna']} linhas={ufs.map(r=>[r.entidade,r.valor/1e6,'3.7 · '+r.origem.linha+' · '+r.origem.coluna])} casas={[null,2,null]} limite={Math.max(1,ufs.length)}
   nota={<>Fonte: <a href={base.fontes[1].url} className="underline">IBGE, SIIC 2013–2024 · tabelas 3.1, 3.2 e 3.7</a>, dados da STN. Arquivo revisto em 10/03/2026. A publicação mantém a classificação e a consolidação de origem; o painel não reclassifica estágios da despesa.</>}/>}
 </section>;
}
