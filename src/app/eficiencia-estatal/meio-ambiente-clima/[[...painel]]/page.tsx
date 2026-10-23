import {CabecalhoPlataforma} from '@/components/layout/CabecalhoPlataforma';
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Comparacao} from '@/components/eficiencia/saneamento/Comparacao';
import {valores,fontes,cobertura,indicador,brasil,captura,edicao,referenciaAno} from '@/lib/eficiencia/saneamento/dados';
import {FiguraAnalitica,GraficoBarras,PaginaPainel} from '@/components/painel';
import {Recolhido} from '@/components/observatorios/Recolhido';
import {fichaSaneamento,numeroSaneamento} from '@/lib/eficiencia/saneamento/ficha';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
import {dataBR} from '@/lib/painel/formato';
import {formatar} from '@/lib/eficiencia/saneamento/modelo';
const rota='/eficiencia-estatal/meio-ambiente-clima';
const abas=[['','Panorama'],['riscos','Riscos e impactos'],['prevencao','Prevenção'],['residuos','Pressões ambientais'],['metodos','Dados e métodos']];
const recortes:Record<string,string[]>={riscos:['DOM_RISCO','IGR0002'],prevencao:['PLANO_DRENAGEM','IAP0002'],residuos:['IRS3002','IRS3010','IRS0006']};
/** Painéis do Território e Clima que completam este capítulo; a descrição repete a fonte e o período de cada um. */
const OUTROS_PAINEIS:[string,string,string][]=[['/territorio/desastres','Desastres reconhecidos','Registros municipais de desastre com reconhecimento federal, por tipo e por estado, e os danos humanos registrados. Atlas Digital de Desastres no Brasil.'],['/territorio/queimadas','Queimadas e focos de calor','Focos de calor do satélite de referência do INPE desde 2003, por estado e bioma, e a área queimada mapeada.'],['/territorio/emissoes','Emissões pelo inventário oficial','Emissões de gases de efeito estufa do Brasil pelo inventário do MCTI, por setor e categoria, com 2005 como referência da meta climática.'],['/agronegocio/ambiente','Desmatamento e uso da terra','Desmatamento medido pelo INPE (PRODES) por bioma e área ocupada pela agropecuária no MapBiomas.'],];
export const dynamic='force-static';
export function generateStaticParams(){return abas.map(([slug])=>({painel:slug?[slug]:[]}));}
export function generateMetadata({params}:{params:{painel?:string[]}}):Metadata{return {title:`${abas.find(a=>a[0]===(params.painel?.join('/')??''))?.[1]??'Painel'} · Meio ambiente e clima`,alternates:{canonical:rota+(params.painel?.length?'/'+params.painel.join('/'): '')}};}
function Secao({titulo,children}:{titulo:string;children:React.ReactNode}){return <section className="mt-10 border-t border-linha pt-7"><h2 className="font-serif text-2xl md:text-3xl">{titulo}</h2><div className="mt-5 space-y-4 leading-relaxed">{children}</div></section>}
const leituras:Record<string,{titulo:string;texto:string;limite:string}>={riscos:{titulo:'Onde a água ameaça a moradia?',texto:'Domicílios em áreas de risco descrevem exposição. Desabrigados e desalojados descrevem impactos declarados no ano. Compare as regiões dentro de cada medida.',limite:'Os registros municipais não são um cadastro deduplicado de pessoas e não equivalem ao total de ocorrências do S2ID. A base não permite atribuir cada impacto à mudança climática.'},prevencao:{titulo:'O que existe antes da emergência?',texto:'Planejamento e infraestrutura são capacidades distintas. A existência de um plano não informa se ele foi executado; a extensão de redes subterrâneas não representa todas as soluções de drenagem.',limite:'Não há nesta base medidas de execução dos planos, manutenção, sistemas de alerta ou eficácia das obras. Municípios com plano são uma contagem, não uma taxa de qualidade da gestão.'},residuos:{titulo:'O destino dos resíduos também é qualidade ambiental.',texto:'Coleta seletiva, recuperação e disposição final acompanham etapas diferentes. O atendimento da população não deve ser confundido com a quantidade de materiais recuperados.',limite:'Disposição inadequada é uma participação da massa coletada e não recuperada nos municípios da amostra. Não mede diretamente contaminação da água, do solo ou exposição individual.'}};
/**
 * Visual principal do panorama (diagnóstico de 20/10/2026, item 10): a mesma medida em percentual nas cinco regiões, com o Brasil como
 * referência. No molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026) é uma FiguraAnalitica com as barras do kit: a escala começa
 * em zero e vai até o maior valor (antes ia até 100%), o Brasil é a linha de referência e a tabela equivalente traz os cinco valores.
 */
function FiguraRegioes(){const m=indicador('IRS3002');const br=brasil('IRS3002');const regioes=valores.filter(r=>r.indicador==='IRS3002'&&r.tipo==='Região'&&r.valor!==null).sort((a,b)=>(b.valor??0)-(a.valor??0));const base=m.base.charAt(0).toLowerCase()+m.base.slice(1).replace(/\.$/,'');
 return <FiguraAnalitica id="regioes" idioma="pt" pergunta="Quanto do lixo coletado vai para destino inadequado?" subtitulo={m.nome+': % da '+base+' · regiões, '+referenciaAno+' · escala linear a partir de zero · traço: Brasil, '+formatar(br,m)}
  natureza="OBSERVADO" proveniencia={fichaSaneamento(['IRS3002'])}
  ressalva="SINISA 2025, referência 2024, municípios da amostra de cada região."
  tabela={{colunas:['Região',m.nome+' (%)'],linhas:regioes.map(r=>[r.nome,r.valor]),casas:[null,m.casas],titulo:m.nome+' por região, '+referenciaAno}}
  naoConcluir="Não mede diretamente contaminação da água, do solo ou exposição de pessoas. A disposição inadequada é uma participação da massa coletada e não recuperada nos municípios da amostra."
  complemento={<Link className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline underline-offset-4" href={rota+'/residuos'}>Ver coleta seletiva e recuperação →</Link>}>
  <GraficoBarras titulo={m.nome+' por região, '+referenciaAno} series={[{id:'valor',nome:m.nome,pontos:regioes.map(r=>({x:r.id,rotulo:r.nome,y:r.valor}))}]} eixoY={{unidade:'%',zero:true,casas:m.casas}} orientacao="horizontal" rotulosValor rotulosSaoNomes referencias={br!==null?[{valor:br,rotulo:'Brasil'}]:[]}/>
 </FiguraAnalitica>;}
/**
 * Capítulos de medida (riscos, prevenção e pressões ambientais) no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o corpo é
 * o mesmo para os três, por isso o molde vale para os três. A frase de limite que vinha em destaque vira o "não permite concluir" da
 * abertura, a comparação vira uma FiguraAnalitica com a ficha da publicação do SINISA, e a pergunta sobre quem responde pelos
 * resultados fica logo depois da figura. Panorama e métodos seguem fora do molde.
 */
function Capitulo({slug,leitura,ids}:{slug:string;leitura:{titulo:string;texto:string;limite:string};ids:string[]}){
 const medidas=ids.map(indicador);const f=fontes.find(x=>x.id===medidas[0].fonte)!;const ano=String(referenciaAno);
 // a ficha do SINISA é a mesma das páginas de saneamento do OBEE (fichaSaneamento): um arquivo por capítulo, com o hash e a captura
 const ficha=fichaSaneamento(ids);
 const limite=leitura.limite.charAt(0).toLowerCase()+leitura.limite.slice(1);
 return <PaginaPainel rota={rota+'/'+slug}
  abertura={{grupo:TEMAS_EFICIENCIA.ambiente.nome,acento:'obee',titulo:leitura.titulo,lead:leitura.texto,recorte:{periodo:'referência '+ano,universo:'Brasil e cinco regiões',fonte:edicao},limite,
   fontesDatasSiglas:<><p>Recorte inicial · {edicao} · referência {ano} · Brasil e cinco regiões. Captura pela Scrutiniums em {dataBR(captura,'pt')}.</p><p>SINISA: Sistema Nacional de Informações em Saneamento Básico, do Ministério das Cidades.</p></>}}
  figuras={<FiguraAnalitica id="comparacao" pergunta="Compare medidas, sem transformar diferenças em notas" subtitulo={medidas.map(m=>m.nome).join(' · ')+' · Brasil e cinco regiões, '+ano} natureza="OBSERVADO" idioma="pt"
   naoConcluir="Comparar valores não identifica, por si só, o efeito de uma gestão. Contagens absolutas não são taxas de risco: municípios maiores podem ter mais domicílios expostos."
   tabela={{naFigura:'logo abaixo do gráfico, com valor, numerador, denominador e origem de cada território na medida escolhida.'}} proveniencia={ficha}
   depois={<section aria-labelledby="quem-responde-titulo" className="space-y-3"><h3 id="quem-responde-titulo" className="t-h3 text-carvao">Quem responde por esses resultados?</h3><p className="t-corpo max-w-prose2 text-carvao-muted">Os registros descrevem serviços e condições locais. Chuvas, relevo, ocupação do território, cobertura da declaração e capacidade de atendimento influenciam os resultados. Comparar valores não identifica, por si só, o efeito de uma gestão.</p><Link className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4" href={'/eficiencia-estatal/saneamento/'+(slug==='residuos'?'residuos':'drenagem')}>Examinar o serviço no capítulo de Saneamento →</Link></section>}>
   <Comparacao medidas={medidas} dados={valores.filter(r=>ids.includes(r.indicador))} fontes={fontes}/>
  </FiguraAnalitica>}
  metodo={<><p>Os indicadores são lidos diretamente da publicação de Saneamento. Não há uma segunda cópia dos números nem média simples dos percentuais regionais. Ano de referência: {ano}; edição: {edicao}.</p><p><a className="underline" href={f.url}>{f.arquivo}</a>, SHA-256 <span className="break-all">{f.sha256}</span>. Captura pela Scrutiniums em {dataBR(captura,'pt')}.</p><p>Cobertura das declarações, fontes auditáveis e regras para interpretar em <Link className="underline" href={rota+'/metodos'}>Dados e métodos</Link>.</p></>}
 />;
}
/** A frase de abertura do tema, a mesma no panorama e em Dados e métodos. */
const LEAD='Exposição a inundações, capacidade de prevenção e destino dos resíduos: uma leitura ambiental dos serviços públicos, com a cobertura de cada medida à vista.';
/**
 * Panorama do tema no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta (encurtada para caber nos 60 caracteres do
 * H1, "têm risco de inundação" é o nome do indicador DOM_RISCO), o recorte da edição e o limite; os três números do Brasil no
 * NumeroIndicador; os três capítulos como navegação do tema, a um clique; a disposição inadequada por região numa FiguraAnalitica; os outros
 * painéis de clima e território e as fronteiras do recorte em blocos abertos, à vista como antes. Dados e métodos segue fora do molde.
 */
function Panorama(){const ano=String(referenciaAno);
 return <PaginaPainel rota={rota} idioma="pt"
  abertura={{grupo:TEMAS_EFICIENCIA.ambiente.nome,acento:'obee',titulo:'Quantas casas têm risco de inundação e para onde vai o lixo?',lead:LEAD,
   recorte:{periodo:'referência '+ano,universo:'Brasil e cinco regiões',fonte:edicao},
   limite:'um diagnóstico completo do clima ou do patrimônio natural, nem tendência temporal ou atribuição climática: a publicação do SINISA cobre riscos hidrológicos e resíduos num só ano de referência.',
   fontesDatasSiglas:<><p>Recorte inicial · {edicao} · referência {ano} · Brasil e cinco regiões. Captura pela Scrutiniums em {dataBR(captura,'pt')}.</p><p>SINISA: Sistema Nacional de Informações em Saneamento Básico, do Ministério das Cidades.</p></>}}
  numeros={['DOM_RISCO','PLANO_DRENAGEM','IRS3002'].map(id=>numeroSaneamento(id,indicador(id).base))}
  navegacaoLocal={<nav aria-labelledby="exposicao-resposta" className="mt-8">
   <h2 id="exposicao-resposta" className="rotulo text-mineral">Da exposição à resposta pública</h2>
   <ul className="mt-2 grid gap-x-10 md:grid-cols-3">{Object.entries(leituras).map(([id,l])=><li key={id} className="border-b border-linha py-4"><h3 className="t-h3"><Link className="text-obee-dark underline underline-offset-4" href={rota+'/'+id}>{l.titulo} →</Link></h3><p className="t-meta mt-2 text-carvao-muted">{l.texto}</p></li>)}</ul>
  </nav>}
  figuras={<><FiguraRegioes/>
   <Recolhido id="outros-paineis" aberto nivelTitulo={2} titulo="Os outros painéis de clima e território" resumo="Desastres, fogo, emissões e desmatamento, cada um com a sua fonte e o seu período.">
    <p className="t-corpo max-w-prose2 text-carvao">Este capítulo é o painel principal de drenagem e resíduos do SINISA. Desastres, fogo, emissões e desmatamento têm painéis próprios no Observatório do Território e Clima, cada um com a sua fonte e o seu período.</p>
    <ul className="mt-4 grid gap-x-8 border-t border-linha md:grid-cols-2">{OUTROS_PAINEIS.map(([href,titulo,texto])=><li key={href} className="border-b border-linha"><Link className="flex min-h-[44px] flex-col py-4" href={href} prefetch={false}><span className="t-h3 text-obee-dark underline decoration-1 underline-offset-4">{titulo} →</span><span className="t-meta mt-1 text-carvao-muted">{texto}</span></Link></li>)}</ul>
   </Recolhido>
   <Recolhido id="fronteiras" aberto nivelTitulo={2} titulo="Um primeiro recorte, com fronteiras explícitas" resumo="O que a publicação do SINISA permite analisar e o que ainda não está integrado.">
    <div className="max-w-prose2 space-y-3"><p className="t-corpo text-carvao">O capítulo compartilha a publicação do SINISA já utilizada em Saneamento. Ela permite analisar riscos hidrológicos e pressões dos resíduos, mas não oferece um diagnóstico completo do clima ou do patrimônio natural.</p><p className="t-meta text-carvao-muted">Qualidade do ar, arborização, biodiversidade e gastos específicos em adaptação ainda não estão integrados. Ausência de indicador não significa ausência de problema.</p></div>
   </Recolhido></>}
  metodo={<><p>Os indicadores são lidos diretamente da publicação de Saneamento. Não há uma segunda cópia dos números nem média simples dos percentuais regionais. Ano de referência: {ano}; edição: {edicao}.</p><p>Cobertura das declarações, fontes auditáveis e regras para interpretar em <Link className="underline" href={rota+'/metodos'}>Dados e métodos</Link>.</p></>}
 />;
}
export default function Pagina({params}:{params:{painel?:string[]}}){const slug=params.painel?.join('/')??'';if(!abas.some(a=>a[0]===slug))notFound();const leitura=leituras[slug];const ids=recortes[slug];
if(leitura&&ids)return <><header><CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal/meio-ambiente-clima" navegacao="cidades-clima" /></header><Capitulo slug={slug} leitura={leitura} ids={ids}/></>;
if(slug==='')return <><header><CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal/meio-ambiente-clima" navegacao="cidades-clima" /></header><Panorama/></>;
return <><header><CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal/meio-ambiente-clima" navegacao="cidades-clima" /></header><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-10"><header className="pb-7"><p className="font-label text-xs uppercase tracking-label text-obee-dark">Cidade e infraestrutura · Meio ambiente e clima</p><h1 className="mt-4 max-w-[900px] font-serif text-4xl leading-tight md:text-5xl">O que os dados permitem afirmar.</h1><p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted">{LEAD}</p><p className="mt-4 text-sm">Recorte inicial · SINISA 2025 · referência 2024 · Brasil e cinco regiões</p></header>
{slug==='metodos'&&<><Secao titulo="Mesma fonte, leitura ambiental"><p className="max-w-prose2">Os sete indicadores são lidos diretamente da publicação de Saneamento. Não há uma segunda cópia dos números nem média simples dos percentuais regionais. Ano de referência: 2024; edição: SINISA 2025.</p><a href="/eficiencia/saneamento/snapshot.json" className="text-obee-dark underline">Baixar dados, indicadores, localizadores e fontes (JSON)</a><p className="text-sm">Nas páginas temáticas, o CSV exporta os territórios selecionados com unidade, período, universo e fonte. A tabela apresenta o localizador de cada valor.</p></Secao><Secao titulo="Cobertura das declarações"><div className="grid gap-6 sm:grid-cols-2">{cobertura.filter(c=>['Resíduos','Drenagem'].includes(c.modulo)).map(c=><article key={c.modulo}><h3 className="font-serif text-xl">{c.modulo}</h3><p>{c.municipios.toLocaleString('pt-BR')} municípios participantes</p><p className="mt-2 text-sm">{c.fonte}. O universo elegível de cada indicador pode ser menor que o universo do módulo.</p></article>)}</div></Secao><Secao titulo="Fontes auditáveis"><div className="space-y-5">{fontes.filter(f=>['residuos-relatorio','drenagem-relatorio'].includes(f.id)).map(f=><article key={f.id} className="break-words text-sm"><a className="text-obee-dark underline" href={f.url}>{f.arquivo}</a><p className="mt-2 break-all">SHA-256: {f.sha256}</p></article>)}</div></Secao><Secao titulo="Regras para interpretar"><ul className="max-w-prose2 list-disc space-y-3 pl-5 text-sm"><li>Ausência permanece “Não informado”; zero declarado permanece zero.</li><li>Contagens absolutas não são taxas de risco. Municípios maiores podem ter mais domicílios expostos.</li><li>Plano existente não comprova implementação. Infraestrutura instalada não comprova proteção.</li><li>Indicadores de massa e população têm denominadores distintos.</li><li>O recorte não estima tendência temporal, atribuição climática ou eficiência causal e não produz um escore composto.</li></ul></Secao></>}
</main></>}
