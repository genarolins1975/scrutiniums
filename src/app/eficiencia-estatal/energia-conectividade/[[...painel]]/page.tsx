import {CabecalhoPlataforma} from '@/components/layout/CabecalhoPlataforma';
import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {PainelPrincipal} from '@/components/observatorios/PainelPrincipal';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {AcessoEnergia,QualidadeEnergia,TarifasEnergia} from '@/components/eficiencia/energia/Exploradores';
import {dadosEnergia,ROTA,numero,data,internet} from '@/lib/eficiencia/energia/dados';
import {FiguraAnalitica,GraficoBarras,GraficoPontos,LeituraGuiada,PaginaPainel,type AberturaProps,type NumeroProps} from '@/components/painel';
import {limpaProveniencia} from '@/lib/energia/qualidade';
import {provenienciaObee} from '@/lib/eficiencia/proveniencia';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
const abas=[['','Panorama'],['acesso','Acesso à energia'],['continuidade','Continuidade'],['custo','Custo e proteção'],['internet','Conectividade'],['metodos','Dados e métodos']];
/** As quatro perguntas do tema: a navegação do panorama e, desde o molde de painel, o H1 e o lead de cada visão. */
const PERGUNTAS:Record<string,[string,string]>={acesso:['Quem ainda não tem energia?','Compare acesso domiciliar e ligação à rede geral, sem confundir sistemas isolados com ausência de serviço.'],continuidade:['Por quanto tempo falta energia?','Examine duração, frequência e parcelas expurgadas, com os limites de cada distribuidora.'],custo:['Quanto custa consumir e quem recebe apoio?','Compare a parcela tarifária para o mesmo consumo e consulte a Tarifa Social e o Luz para Todos.'],internet:['Quem consegue usar a internet?','Compare domicílios urbanos e rurais na mesma pesquisa, período e unidade.']};
export const dynamic='force-static';
export function generateStaticParams(){return abas.map(([slug])=>({painel:slug?[slug]:[]}));}
export function generateMetadata({params}:{params:{painel?:string[]}}):Metadata {const slug=params.painel?.join('/')??'';return {title:'Energia e conectividade · '+(abas.find(a=>a[0]===slug)?.[1]??'Painel'),alternates:{canonical:ROTA+(slug?'/'+slug:'')}};}
function Secao({titulo,children}:{titulo:string;children:React.ReactNode}){return <section className="mt-10 border-t border-linha pt-7"><h2 className="font-serif text-2xl md:text-3xl">{titulo}</h2><div className="mt-4 space-y-4 text-base leading-relaxed">{children}</div></section>}
function Fonte({href,children}:{href:string;children:React.ReactNode}){return <p className="mt-4 text-sm text-carvao-muted">Fonte: <a className="text-obee-dark underline underline-offset-4" href={href}>{children}</a></p>}
const elo='inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4';
const Cabecalho=()=><header><CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal/energia-conectividade" navegacao="conectividade" /></header>;

export default function Pagina({params}:{params:{painel?:string[]}}){const slug=params.painel?.join('/')??'';if(!abas.some(a=>a[0]===slug))notFound();
 if(slug==='')return <PanoramaEnergia/>;
 if(slug==='acesso')return <><Cabecalho/><VisaoAcesso/></>;
 if(slug==='continuidade')return <><Cabecalho/><VisaoContinuidade/></>;
 if(slug==='custo')return <><Cabecalho/><VisaoCusto/></>;
 if(slug==='internet')return <><Cabecalho/><VisaoInternet/></>;
 const {inclusao:i,qualidade:q,conta:c}=dadosEnergia();
 // Dados e métodos é página de método: fica fora do molde de painel, no desenho de antes
 return <><Cabecalho/><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-10"><header className="pb-7"><p className="font-label text-xs uppercase tracking-label text-obee-dark">Cidade e infraestrutura · Energia e conectividade</p><h1 className="mt-4 max-w-[900px] font-serif text-[2.25rem] leading-tight md:text-5xl">{abas.find(a=>a[0]===slug)![1]}</h1><p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted">Quem tem acesso, quanto tempo a energia falta, quanto custa usá-la e quem usa a internet em casa, cada medida com o seu período e o seu universo.</p></header>
<Secao titulo="Uma publicação de energia, duas perspectivas."><p className="max-w-prose2">Este capítulo lê diretamente os arquivos de acesso, inclusão, qualidade e tarifas do Setor Elétrico. Não replica o pipeline nem grava uma cópia independente dos agregados. As atualizações dessas publicações alimentam o Setor Elétrico e a Eficiência Estatal.</p><dl className="space-y-4 text-sm">{[['Inclusão e acesso',i.gerado_em,'/energia/gold/inclusao.json'],['Qualidade do fornecimento',q.gerado_em,'/energia/gold/qualidade.json'],['Tarifas',c.gerado_em,'/energia/gold/conta.json']].map(([t,d,h])=><div key={t}><dt className="font-semibold">{t} · publicação {data(d)}</dt><dd><a className="text-obee-dark underline" href={h}>Baixar contrato completo com fontes, versões e ressalvas (JSON)</a></dd></div>)}</dl><p className="text-sm">Data de publicação do observatório, competência da fonte e vigência tarifária são datas distintas. As páginas exibem o período de cada medida.</p></Secao><Secao titulo="Regras de interpretação."><ul className="list-disc space-y-3 pl-5 text-sm"><li>Domicílio, família, pessoa e unidade consumidora não são unidades intercambiáveis.</li><li>Acesso domiciliar é uma estimativa amostral. Os coeficientes de variação e as ressalvas de arredondamento acompanham a tabela.</li><li>{q.regras.universo}</li><li>{q.regras.apurado}</li><li>Limites anuais só se comparam ao indicador do mesmo ano; parcelas expurgadas ficam separadas.</li><li>Tarifa não é fatura. O cálculo do consumo é um cenário sem tributos e demais componentes declarados.</li><li>Ausência não vira zero; 2026 parcial não se compara diretamente a um ano completo.</li><li>Não há escore composto nem inferência causal de eficiência governamental neste capítulo.</li></ul></Secao><Secao titulo="Conectividade: fonte e cobertura."><p className="max-w-prose2 text-sm">{internet.universo}. {internet.natureza} Ano {internet.ano}; divulgação {data(internet.publicado)}; verificação {data(internet.verificado)}. O arquivo contém somente Brasil, urbano e rural. Não é a base completa da PNAD.</p><Fonte href={internet.fonte}>Divulgação oficial do IBGE</Fonte><a className="text-sm text-obee-dark underline" href={ROTA+'/dados.csv'}>Baixar o recorte documentado (CSV)</a></Secao>
</main></>}

/** A abertura de uma visão: o grupo do tema, a pergunta e a frase da navegação do panorama, o recorte, o limite e as fontes recolhidas. */
function abertura(slug:string,recorte:AberturaProps['recorte'],limite:string,fontes:ReactNode):AberturaProps{const [titulo,lead]=PERGUNTAS[slug];return {grupo:TEMAS_EFICIENCIA.energia.nome,acento:'obee',titulo,lead,recorte,limite,fontesDatasSiglas:fontes};}

/** O método comum das visões: a mesma publicação do Setor Elétrico, a data da publicação lida e o caminho para Dados e métodos. */
function Metodo({children}:{children:ReactNode}){return <><p>Este capítulo lê diretamente os arquivos de acesso, inclusão, qualidade e tarifas do Setor Elétrico. Não replica o pipeline nem grava uma cópia independente dos agregados.</p>{children}<p>Detalhe de fontes, versões e ressalvas em <Link className="text-obee-dark underline underline-offset-4" href={ROTA+'/metodos'}>Dados e métodos</Link>.</p></>;}

type AnualDec=ReturnType<typeof dadosEnergia>['qualidade']['brasil']['anual'];
/**
 * DEC apurado e limite agregado, anos completos desde 2022: o visual principal do panorama e a figura da visão Continuidade, no GraficoPontos
 * do kit (antes a visão Continuidade desenhava barras à mão, com o limite só em número). A ficha é a do Setor Elétrico (DEC por conjunto,
 * agregado ao Brasil), com o limite como série própria.
 */
function FiguraDecAnual({anual,prov,limites,complemento,ressalva}:{anual:AnualDec;prov:ReturnType<typeof limpaProveniencia>;limites:ReturnType<typeof limpaProveniencia>|null;complemento?:ReactNode;ressalva?:ReactNode}){
 const anos=anual.filter(a=>a.ano>=2022&&a.completo&&a.dec!==null);
 return <FiguraAnalitica
  id="dec-anual"
  pergunta="Quanto tempo falta energia, ano a ano?"
  subtitulo="DEC apurado e limite agregado · horas por unidade consumidora · Brasil · anos completos desde 2022"
  natureza="CALCULADO"
  proveniencia={prov}
  complementares={limites?[{rotulo:'Sobre o limite agregado',p:limites}]:[]}
  idioma="pt"
  tabela={{colunas:['Ano','DEC apurado (h/UC)','Limite agregado (h/UC)'],linhas:anos.map(a=>[String(a.ano),a.dec,a.dec_limite]),casas:[null,2,2],titulo:'DEC apurado e limite agregado, Brasil'}}
  comoInterpretar="Escala comum com origem zero; o limite é indicado numericamente. Agregados publicados pelo Setor Elétrico, ponderados por unidades consumidoras."
  naoConcluir="O DEC é média do país por unidade consumidora no ano, não a experiência de cada casa. A referência nacional não substitui o limite do conjunto ou o limite individual."
  ressalva={ressalva}
  complemento={complemento}
 >
  <GraficoPontos titulo="DEC apurado e limite agregado, Brasil, anos completos desde 2022" series={[{id:'dec',nome:'DEC apurado',pontos:anos.map(a=>({x:String(a.ano),y:a.dec}))},{id:'limite',nome:'Limite agregado',pontos:anos.map(a=>({x:String(a.ano),y:a.dec_limite}))}]} eixoY={{unidade:'h/UC',zero:true,casas:2}} ordemInicial={{por:'nome',direcao:'asc'}} textoSentido={{acima:'acima do limite agregado',abaixo:'abaixo do limite agregado',igual:'igual ao limite agregado'}}/>
 </FiguraAnalitica>;
}

/**
 * Visão Acesso à energia no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta da navegação do tema como H1, o
 * recorte e o limite; a tabela das estimativas da PNAD por território, com o ano escolhido logo antes dela, na fatia de tabelas, com a nota
 * amostral, a fonte e o arquivo; os sistemas isolados no glossário de uso, com o caminho para o Setor Elétrico.
 */
function VisaoAcesso(){const {inclusao:i}=dadosEnergia();const anos=Array.from(new Set(i.acesso.pnad_serie.map(r=>r.ano))).sort();
 return <PaginaPainel rota={ROTA+'/acesso'} idioma="pt"
  abertura={abertura('acesso',{periodo:anos[0]+' a '+anos[anos.length-1]+', um ano por vez',universo:'Brasil, cinco regiões e 27 UFs, domicílios',unidade:'% dos domicílios e mil domicílios',fonte:'IBGE, PNAD Contínua'},
   'que um domicílio fora da rede geral está sem energia, nem medir a continuidade: o acesso inclui qualquer fonte, e o tempo integral é declarado pelos moradores ligados à rede, não medido.',
   <p>IBGE, PNAD Contínua, publicação de energia de {data(i.gerado_em)}. <span className="font-medium">CV:</span> coeficiente de variação da estimativa. <span className="font-medium">PNAD:</span> Pesquisa Nacional por Amostra de Domicílios.</p>)}
  aviso={<PainelPrincipal rota="/eficiencia-estatal/energia-conectividade"/>}
  tabelas={<AcessoEnergia registros={i.acesso.pnad_serie} secao="Ter energia, estar ligado à rede e receber em tempo integral."
   lead="O acesso inclui qualquer fonte, inclusive alternativas à rede geral. O fornecimento em tempo integral é declarado pelos moradores ligados à rede; não é uma medição técnica de continuidade."
   nota={<>Estimativas amostrais do IBGE. CV é o coeficiente de variação da estimativa de acesso. Um percentual de 100,0% pode resultar do arredondamento. A diferença entre contagens arredondadas em milhares não prova ausência de domicílios sem energia. Fonte: <a className="text-obee-dark underline underline-offset-4" href={i.acesso.proveniencia.pnad.fonte.url_dataset}>IBGE, PNAD Contínua · publicação de energia de {data(i.gerado_em)}</a>. <a className={elo} href="/energia/series/inclusao_acesso_pnad.csv">Baixar todas as observações de acesso (CSV)</a></>}/>}
  notas={{id:'para-ler-acesso',itens:[{termo:'Sistemas isolados também fornecem energia.',definicao:<>Estar fora do Sistema Interligado Nacional não equivale a estar sem ligação. A geração, o financiamento e a confiabilidade têm condições próprias. <Link className={elo} href="/setor-eletrico/inclusao-energetica">Examinar inclusão e sistemas isolados no Setor Elétrico →</Link></>}]}}
  metodo={<Metodo><p>Publicação lida: inclusão e acesso de {data(i.gerado_em)}. Os coeficientes de variação e as ressalvas de arredondamento acompanham a tabela.</p></Metodo>}
 />;
}

/**
 * Visão Continuidade no molde de painel: a figura do DEC apurado diante do limite agregado (a mesma do panorama, no kit, com o ano corrente
 * como ressalva), a tabela das distribuidoras com busca e ordem logo antes dela, a nota das parcelas expurgadas, a fonte, o arquivo e o
 * caminho para o Setor Elétrico; DEC, FEC e o universo do Brasil no glossário de uso.
 */
function VisaoContinuidade(){const {qualidade:q}=dadosEnergia();const anos=q.brasil.anual.filter(a=>a.ano>=2022&&a.completo&&a.dec!==null);
 return <PaginaPainel rota={ROTA+'/continuidade'} idioma="pt"
  abertura={abertura('continuidade',{periodo:(anos.length?anos[0].ano+' a '+anos[anos.length-1].ano+' no Brasil':'sem ano completo')+'; o ano de cada distribuidora na tabela',universo:'Brasil e '+q.distribuidoras.length+' distribuidoras',unidade:'horas e interrupções por unidade consumidora',fonte:'ANEEL, indicadores de continuidade'},
   'a experiência de cada morador nem o desempenho de um estado: DEC e FEC são médias por unidade consumidora, e a referência nacional não substitui o limite do conjunto ou o limite individual.',
   <><p>ANEEL, publicação de qualidade de {data(q.gerado_em)}.</p><p><span className="font-medium">DEC:</span> duração equivalente de interrupção por unidade consumidora. <span className="font-medium">FEC:</span> frequência equivalente de interrupção por unidade consumidora. <span className="font-medium">UC:</span> unidade consumidora. <span className="font-medium">ANEEL:</span> Agência Nacional de Energia Elétrica.</p></>)}
  aviso={<PainelPrincipal rota="/eficiencia-estatal/energia-conectividade"/>}
  figuras={<FiguraDecAnual anual={q.brasil.anual} prov={limpaProveniencia(q.proveniencia.conjuntos)} limites={q.proveniencia.limites?limpaProveniencia(q.proveniencia.limites):null} ressalva={<>Ano corrente: {q.parcial.aviso}</>}/>}
  tabelas={<QualidadeEnergia registros={q.distribuidoras} secao="Duração das interrupções e referência regulatória."
   lead={<>{q.regras.apurado} As parcelas expurgadas não entram no indicador apurado, mas permanecem relevantes para a experiência do consumidor. A referência nacional não substitui o limite do conjunto ou o limite individual.</>}
   nota={<>Fonte: <a className="text-obee-dark underline underline-offset-4" href="https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec">ANEEL · publicação de qualidade de {data(q.gerado_em)}</a>. <a className={elo} href="/energia/series/qualidade_distribuidoras_anual.csv">Baixar histórico por distribuidora (CSV)</a> <Link className={elo+' ml-5'} href="/setor-eletrico/qualidade">Explorar meses, conjuntos e compensações →</Link></>}/>}
  notas={{id:'para-ler-continuidade',itens:[
   {termo:'DEC',definicao:'DEC mede horas por unidade consumidora. É média, não a experiência de cada morador.'},
   {termo:'FEC',definicao:'FEC mede interrupções por unidade consumidora. É média, não a experiência de cada morador.'},
   {termo:'Brasil',definicao:q.regras.universo},
  ]}}
  metodo={<Metodo><p>Publicação lida: qualidade do fornecimento de {data(q.gerado_em)}. {q.regras.parcial}</p></Metodo>}
 />;
}

/**
 * Visão Custo e proteção no molde de painel: as contagens da Tarifa Social e do Luz para Todos no NumeroIndicador (com as notas que vinham
 * em destaque), a tabela das tarifas com a busca e o consumo de referência logo antes dela, o cálculo, a fonte e o arquivo.
 */
function VisaoCusto(){const {inclusao:i,conta:c}=dadosEnergia();const social=i.tarifa_social.kpis.uc_tsee;const luz=i.acesso.universalizacao.luz_para_todos.evidencia_total;const part=i.tarifa_social.kpis.participacao_pct;
 const numeros:NumeroProps[]=[
  {rotulo:'Unidades consumidoras com Tarifa Social',valor:social.valor,formato:'inteiro',unidade:'unidades consumidoras',periodo:data(social.mes),recorte:social.evidencia.universo,fonte:'ANEEL, SCS',natureza:'OBSERVADO',
   nota:<><p><span className="font-medium text-carvao">Tarifa Social: unidade consumidora não é pessoa.</span> Participação nas UC residenciais: {numero(part.valor)}%.</p><p className="mt-1">Esta contagem não é uma taxa de atendimento de todas as famílias elegíveis. {social.evidencia.reconciliacao?.descricao??'Contagens de faturas, famílias e unidades consumidoras têm universos próprios.'}</p><p className="mt-1">Fonte: <a className="underline underline-offset-4" href={social.evidencia.fonte.url}>ANEEL · Sistema de Controle de Subvenções e Programas Sociais</a></p></>},
  {rotulo:'Domicílios atendidos pelo Luz para Todos',valor:luz.valor_calculo,formato:'inteiro',unidade:'domicílios atendidos',periodo:data(luz.periodo.inicio)+' a '+data(luz.periodo.fim),recorte:'Brasil',fonte:'MME, Luz para Todos',natureza:'OBSERVADO',
   nota:<><p><span className="font-medium text-carvao">Luz para Todos: ligações registradas pelo programa.</span> {luz.cobertura}.</p><p className="mt-1">Contagem acumulada de atendimentos homologados; não é o número de domicílios hoje sem energia, nem a medição da qualidade após a ligação. O ano corrente é parcial.</p><Link className={elo} href="/setor-eletrico/inclusao-energetica">Consultar orçamento familiar, subsídios e recursos por contrato →</Link></>},
 ];
 return <PaginaPainel rota={ROTA+'/custo'} idioma="pt"
  abertura={abertura('custo',{periodo:'tarifas vigentes em '+data(c.data_referencia)+'; Tarifa Social de '+data(social.mes)+'; Luz para Todos de '+data(luz.periodo.inicio)+' a '+data(luz.periodo.fim),universo:'Brasil, '+c.tarifas.vigentes.length+' distribuidoras com tarifa B1 vigente',unidade:'R$/kWh, unidades consumidoras e domicílios',fonte:'ANEEL e MME'},
   'o valor da fatura nem o gasto médio das famílias: a parcela usa TE e TUSD sem tributos e demais componentes, e as contagens da Tarifa Social e do Luz para Todos não são taxas de atendimento.',
   <><p>Tarifas: ANEEL, tarifas homologadas, publicação de {data(c.gerado_em)}. Tarifa Social: ANEEL, Sistema de Controle de Subvenções e Programas Sociais (SCS). Luz para Todos: MME, dados abertos do programa.</p><p><span className="font-medium">TE:</span> tarifa de energia. <span className="font-medium">TUSD:</span> tarifa de uso do sistema de distribuição. <span className="font-medium">UC:</span> unidade consumidora. <span className="font-medium">B1:</span> classe residencial.</p></>)}
  aviso={<PainelPrincipal rota="/eficiencia-estatal/energia-conectividade"/>}
  numeros={numeros}
  notaNumeros="Domicílio, família, pessoa e unidade consumidora não são unidades intercambiáveis."
  tabelas={<TarifasEnergia registros={c.tarifas.vigentes} referencia={data(c.data_referencia)} secao="O mesmo consumo, tarifas diferentes."
   lead={<p>TE é a tarifa de energia; TUSD é a tarifa de uso do sistema de distribuição. {c.definicoes.tarifa_homologada} A comparação utiliza a mesma publicação do Observatório do Setor Elétrico.</p>}
   nota={<>Fonte: <a className="text-obee-dark underline underline-offset-4" href="https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica">ANEEL · tarifas homologadas · publicação de {data(c.gerado_em)}</a>. <a className={elo} href="/energia/series/conta_tarifas_b1_vigentes.csv">Baixar tarifas da publicação (CSV)</a></>}/>}
  metodo={<Metodo><p>Publicações lidas: tarifas de {data(c.gerado_em)}; inclusão e acesso de {data(i.gerado_em)}. Tarifa não é fatura. O cálculo do consumo é um cenário sem tributos e demais componentes declarados.</p></Metodo>}
 />;
}

/**
 * Visão Conectividade no molde de painel: o uso da internet no domicílio no Brasil e nas áreas urbana e rural, nas barras do kit (escala de
 * zero ao maior valor; antes ia até 100%), a diferença urbana e rural como leitura, a natureza do recorte e o que não foi integrado como o
 * que a figura não permite concluir, e o arquivo do recorte. Sem aviso de painel principal, como antes.
 */
function VisaoInternet(){const urbana=internet.registros.find(r=>r.territorio==='Urbana');const rural=internet.registros.find(r=>r.territorio==='Rural');
 const prov=provenienciaObee({indicador:'Domicílios com utilização da internet',natureza:'ESTIMADO',orgao:'IBGE',dataset:'PNAD Contínua TIC '+internet.ano+', divulgação oficial',recurso:'Brasil, urbano e rural, transcritos da divulgação',url:internet.fonte,unidade:'% dos domicílios',frequencia:'anual',inicio:String(internet.ano),fim:String(internet.ano),publicadoEm:internet.publicado,validadoEm:internet.verificado,
  transformacoes:['Recorte selecionado da divulgação oficial, sem microdados nem novo cálculo.'],limitacoes:[internet.natureza,'Não foram integrados a este capítulo indicadores de velocidade, interrupção da internet, cobertura 4G/5G, preços de planos ou conectividade escolar.'],download:ROTA+'/dados.csv',notas:internet.universo});
 return <PaginaPainel rota={ROTA+'/internet'} idioma="pt"
  abertura={abertura('internet',{periodo:String(internet.ano),universo:'Brasil, áreas urbana e rural, domicílios',unidade:'% dos domicílios',fonte:'IBGE, PNAD Contínua TIC'},
   'cobertura geográfica das operadoras nem velocidade: a pesquisa mede o uso da internet no domicílio.',
   <p>IBGE, PNAD Contínua TIC {internet.ano}; divulgação em {data(internet.publicado)}; verificação em {data(internet.verificado)}. <span className="font-medium">TIC:</span> tecnologias da informação e comunicação. <span className="font-medium">PNAD:</span> Pesquisa Nacional por Amostra de Domicílios.</p>)}
  figuras={<FiguraAnalitica id="internet-domicilio" idioma="pt" pergunta="Internet no domicílio: cidade e campo." subtitulo={'Percentual de domicílios com utilização da internet · Brasil, urbano e rural, '+internet.ano+' · mesma pesquisa e mesmo ano · escala linear a partir de zero'}
   natureza="ESTIMADO" proveniencia={prov}
   leitura={urbana&&rural?<LeituraGuiada>Diferença urbana–rural: {numero(urbana.valor-rural.valor)} pontos percentuais. O agregado nacional pondera os domicílios; não é a média simples dos dois recortes.</LeituraGuiada>:undefined}
   comoInterpretar="A pesquisa mede uso no domicílio; não é cobertura geográfica das operadoras nem teste de velocidade."
   naoConcluir={<>{internet.natureza} Não foram integrados a este capítulo indicadores de velocidade, interrupção da internet, cobertura 4G/5G, preços de planos ou conectividade escolar. Esses conceitos exigem bases próprias; não são inferidos do percentual de uso.</>}
   tabela={{colunas:['Recorte','Domicílios com utilização da internet (%)'],linhas:internet.registros.map(r=>[r.territorio,r.valor]),casas:[null,1],titulo:'Internet no domicílio, '+internet.ano}}
   download={{href:ROTA+'/dados.csv',rotulo:'Baixar recorte de conectividade (CSV)'}}>
   <GraficoBarras titulo={'Domicílios com utilização da internet, '+internet.ano} series={[{id:'valor',nome:'Domicílios com utilização da internet',pontos:internet.registros.map(r=>({x:r.territorio,rotulo:r.territorio,y:r.valor}))}]} eixoY={{unidade:'%',zero:true,casas:1}} orientacao="horizontal" rotulosValor/>
  </FiguraAnalitica>}
  metodo={<Metodo><p>Conectividade: {internet.universo}; {internet.natureza} Ano {internet.ano}; divulgação {data(internet.publicado)}; verificação {data(internet.verificado)}. O arquivo contém somente Brasil, urbano e rural. Não é a base completa da PNAD. <a className="underline underline-offset-4" href={internet.fonte}>Divulgação oficial do IBGE</a>.</p></Metodo>}
 />;
}

/**
 * Panorama do tema no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta, os três números do tema com natureza,
 * fonte e período, o aviso de que o painel principal é o do Setor Elétrico, as quatro perguntas como navegação do tema, a figura do DEC
 * apurado diante do limite agregado no kit e as notas sobre quem entrega o serviço. As visões acesso, continuidade, custo e conectividade
 * também estão no molde (Grupo 2); Dados e métodos é página de método e fica fora.
 */
function PanoramaEnergia(){
  const {inclusao:i,qualidade:q}=dadosEnergia();
  const acesso=i.acesso.pnad_serie.find(r=>r.territorio==='BR'&&r.ano===i.acesso.ano_referencia&&r.situacao==='total');
  const anual=q.brasil.anual.filter(r=>r.completo&&r.dec!==null).sort((a,b)=>b.ano-a.ano)[0];
  const brasilNet=internet.registros.find(r=>r.territorio==='Brasil');
  const fonteDec='ANEEL, indicadores de continuidade, publicados no Setor Elétrico';
  const numeros:NumeroProps[]=[
    acesso?.pct_com_energia!=null?{rotulo:'Domicílios com energia',valor:acesso.pct_com_energia,formato:'percentual',unidade:'%',periodo:i.acesso.ano_referencia,recorte:'Brasil, qualquer fonte',fonte:'IBGE, PNAD Contínua',natureza:'ESTIMADO'}:{rotulo:'Domicílios com energia',valor:null,motivoAusencia:'A PNAD Contínua não traz o total do Brasil neste ano da publicação.',unidade:'%',periodo:i.acesso.ano_referencia,fonte:'IBGE, PNAD Contínua',natureza:'ESTIMADO'},
    anual?{rotulo:'DEC apurado nacional',valor:anual.dec as number,formato:'decimal',casas:2,unidade:'h/UC',periodo:String(anual.ano),recorte:'distribuidoras publicadas',fonte:fonteDec,natureza:'CALCULADO'}:{rotulo:'DEC apurado nacional',valor:null,motivoAusencia:'Nenhum ano completo com DEC nesta publicação.',unidade:'h/UC',periodo:'Não disponível',fonte:fonteDec,natureza:'CALCULADO'},
    brasilNet?{rotulo:'Domicílios com uso da internet',valor:brasilNet.valor,formato:'percentual',unidade:'%',periodo:String(internet.ano),recorte:'Brasil',fonte:'IBGE, PNAD Contínua TIC',natureza:'ESTIMADO'}:{rotulo:'Domicílios com uso da internet',valor:null,motivoAusencia:'O recorte do Brasil não está na divulgação transcrita.',unidade:'%',periodo:String(internet.ano),fonte:'IBGE, PNAD Contínua TIC',natureza:'ESTIMADO'},
  ];
  // a mesma ficha de origem do Setor Elétrico (DEC por conjunto, agregado ao Brasil), com o texto de leitor e o limite como série própria
  const prov=limpaProveniencia(q.proveniencia.conjuntos);
  const limites=q.proveniencia.limites?limpaProveniencia(q.proveniencia.limites):null;
  return <><Cabecalho/>
    <PaginaPainel
      rota={ROTA}
      idioma="pt"
      abertura={{
        grupo:TEMAS_EFICIENCIA.energia.nome,
        acento:'obee',
        titulo:'A energia e a internet chegam às casas, e com que qualidade?',
        lead:'Quem tem acesso, quanto tempo a energia falta, quanto custa usá-la e quem usa a internet em casa, cada medida com o seu período e o seu universo.',
        recorte:{periodo:`${i.acesso.ano_referencia} (acesso), ${anual?.ano??'sem ano completo'} (DEC), ${internet.ano} (internet)`,universo:'Brasil, domicílios e unidades consumidoras',unidade:'% dos domicílios e horas por UC',fonte:'IBGE, PNAD Contínua; ANEEL'},
        limite:'uma nota de eficiência do Estado. Acesso à energia, interrupções por unidade consumidora e uso da internet medem universos diferentes.',
        fontesDatasSiglas:<>
          <p>Acesso: IBGE, PNAD Contínua, publicação de energia de {data(i.gerado_em)}. DEC: ANEEL, publicação de qualidade de {data(q.gerado_em)}. Internet: IBGE, PNAD Contínua TIC {internet.ano}, divulgação em {data(internet.publicado)}.</p>
          <p><span className="font-medium">DEC:</span> duração equivalente de interrupção por unidade consumidora. <span className="font-medium">UC:</span> unidade consumidora. <span className="font-medium">PNAD:</span> Pesquisa Nacional por Amostra de Domicílios. <span className="font-medium">ANEEL:</span> Agência Nacional de Energia Elétrica.</p>
        </>,
      }}
      aviso={<PainelPrincipal rota="/eficiencia-estatal/energia-conectividade"/>}
      numeros={numeros}
      notaNumeros="Acesso à energia, interrupções por unidade consumidora e uso da internet medem universos diferentes. Não formam uma nota de eficiência do Estado."
      navegacaoLocal={<nav aria-labelledby="quatro-perguntas" className="mt-8">
        <h2 id="quatro-perguntas" className="rotulo text-mineral">Quatro perguntas para o serviço essencial</h2>
        <ul className="mt-2 grid gap-x-12 md:grid-cols-2">{Object.entries(PERGUNTAS).map(([a,[t,b]])=><li key={a} className="border-b border-linha py-4"><h3 className="t-h3"><Link className="text-obee-dark underline underline-offset-4" href={ROTA+'/'+a}>{t} →</Link></h3><p className="t-meta mt-2 text-carvao-muted">{b}</p></li>)}</ul>
      </nav>}
      figuras={<FiguraDecAnual anual={q.brasil.anual} prov={prov} limites={limites}
        complemento={<Link className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline underline-offset-4" href={ROTA+'/continuidade'}>Ver distribuidoras, frequência e parcelas expurgadas →</Link>}/>}
      notas={{id:'para-ler-energia',itens:[
        {termo:'DEC',definicao:'Horas sem energia por unidade consumidora no ano, média do país. É média, não a experiência de cada casa.'},
        {termo:'Quem entrega e quem responde?',definicao:'Energia e telecomunicações envolvem prestadores, regulação e políticas públicas. O acesso domiciliar não identifica sozinho a contribuição de uma prefeitura; o desempenho de uma distribuidora não corresponde ao desempenho de um estado.'},
        {termo:'Mesma publicação',definicao:'Os dados de energia são os mesmos publicados no Observatório do Setor Elétrico. A leitura neste capítulo concentra-se no serviço ao cidadão.'},
      ]}}
      metodo={<>
        <p>Este capítulo lê diretamente os arquivos de acesso, inclusão, qualidade e tarifas do Setor Elétrico. Não replica o pipeline nem grava uma cópia independente dos agregados.</p>
        <p>Publicações lidas: inclusão e acesso de {data(i.gerado_em)}; qualidade do fornecimento de {data(q.gerado_em)}. Conectividade: {internet.universo}; {internet.natureza} Ano {internet.ano}; divulgação {data(internet.publicado)}; verificação {data(internet.verificado)}.</p>
        <p>Detalhe de fontes, versões e ressalvas em <Link className="text-obee-dark underline underline-offset-4" href={ROTA+'/metodos'}>Dados e métodos</Link>.</p>
      </>}
    />
  </>;
}
