import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Explorador} from '@/components/eficiencia/cultura/Explorador';
import {ControlesRecursos,FiguraEsferas,FiguraSerie,NumerosRecursos,TabelaUfs} from '@/components/eficiencia/cultura/Recursos';
import {base,fichas,ROTA,n} from '@/lib/eficiencia/cultura/dados';
import {FiguraAnalitica,PaginaPainel} from '@/components/painel';
import type {Proveniencia} from '@/lib/painel/tipos';
import {fichaDaFigura} from '@/lib/eficiencia/fichaDaFigura';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
import {dataBR} from '@/lib/painel/formato';
export const dynamic='force-static';
const capitulos={rede:['Equipamentos','Quem mantém os espaços culturais?','Natureza jurídica e distribuição regional dos sete tipos de equipamento nos cadastros oficiais. Uma biblioteca pública, um cinema privado e um ponto de cultura comunitário têm papéis e universos próprios.'],acesso:['Acesso digital','Que portas digitais estão abertas ao público?','Usar internet dentro da instituição, oferecer Wi-Fi aos visitantes e possuir website são capacidades distintas. Explore uma de cada vez.'],atividades:['Atividades','O que as instituições realizam?','Leitura, formação, exposições e apresentações. A pesquisa registra atividades das instituições; não conta participantes únicos nem mede a satisfação dos visitantes.'],acervos:['Acervos','O patrimônio também pode ser acessado online?','Ter acervo, digitalizá-lo, disponibilizar conteúdos e publicar um catálogo são etapas diferentes. O percentual se refere a instituições, não a itens do acervo.'],recursos:['Recursos','Quanto o poder público destina à cultura?','A evolução dos gastos e sua distribuição por esfera ajudam a dimensionar recursos. A despesa não identifica, sozinha, a quantidade ou a qualidade dos serviços prestados.'],metodos:['Dados e métodos','Como ler e reproduzir estes números?','Do arquivo oficial à célula de origem, com universos, precisão e transformação declarados.']} as const;
type Slug=keyof typeof capitulos;
export function generateStaticParams(){return [{painel:[]},...Object.keys(capitulos).map(s=>({painel:[s]}))];}
export function generateMetadata({params}:{params:{painel?:string[]}}):Metadata {const slug=params.painel?.[0] as Slug;return {title:capitulos[slug]?.[0]??'Cultura',alternates:{canonical:ROTA+(slug?'/'+slug:'')}};}
function Abertura({rotulo,titulo,texto}:{rotulo:string;titulo:string;texto:string}){return <header className="mt-8"><p className="rotulo text-obee-dark">{rotulo} · Brasil</p><h1 className="mt-4 max-w-[52rem] font-serif text-4xl leading-[1.12] md:text-5xl">{titulo}</h1><p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted">{texto}</p></header>;}
const TIC=base.fontes.find(f=>f.id==='tic')!;
const SIIC=base.fontes.find(f=>f.id==='ibge')!;
/** Ficha "Sobre este dado" das estimativas da TIC Cultura: a planilha lida pelo snapshot, com hash, publicação e captura; a licença não está registrada. */
function fichaTic(medidas:typeof fichas):Proveniencia{return fichaDaFigura({indicador:medidas.map(f=>f.nome).join('; '),natureza:'ESTIMADO',orgao:'Cetic.br/NIC.br',conjunto:'TIC Cultura '+TIC.referencia,recurso:TIC.titulo,url:TIC.url,unidade:'% do total de cada tipo de equipamento; margem em pontos percentuais',
 frequencia:'Edição da pesquisa',referencia:{inicio:TIC.referencia,fim:TIC.referencia},publicadoEm:TIC.publicadoEm,capturadoEm:base.capturadoEm,sha256:TIC.sha256,snapshot:'public/eficiencia/cultura/snapshot.json',versao:'snapshot da cultura, versão '+base.versao,
 limitacoes:medidas.map(f=>f.nome+': '+f.limites),notas:'O relatório metodológico descreve amostragem estratificada e estratos censitários; margens divulgadas com confiança de 95%. Não cobre todos os espaços informais, pessoas ou manifestações culturais. Relatório metodológico: '+TIC.metodo+'.'});}
/** A frase de fonte da TIC Cultura, no bloco recolhido da abertura e no método. */
function FonteTic(){return <>Fonte: <a className="underline" href={TIC.url}>Cetic.br/NIC.br · TIC Cultura 2024</a>, publicada em {dataBR(TIC.publicadoEm,'pt')}; <a className="underline" href={TIC.metodo}>relatório metodológico</a>. Captura pela Scrutiniums em {dataBR(base.capturadoEm,'pt')}.</>;}
/** A frase de fonte dos gastos (SIIC), com a revisão do arquivo. */
function FonteSiic(){return <>Fonte: <a href={SIIC.url} className="underline">IBGE, SIIC 2013–2024 · tabelas 3.1, 3.2 e 3.7</a>, dados da STN, publicado em {dataBR(SIIC.publicadoEm,'pt')}. Arquivo revisto em 10/03/2026. A publicação mantém a classificação e a consolidação de origem; o painel não reclassifica estágios da despesa.</>;}
/**
 * Capítulos da TIC Cultura (equipamentos, acesso digital, atividades e acervos) no molde de painel (Iniciativa 1 do parecer de UX de
 * 23/10/2026). Os quatro têm o mesmo corpo, o explorador das estimativas, por isso o molde vale para os quatro; recursos e panorama
 * têm corpo próprio, abaixo, e métodos (página de método) segue com a abertura de antes. O explorador fica numa FiguraAnalitica com a ficha da TIC Cultura e o "não permite concluir" da
 * própria nota de fonte do explorador.
 */
function CapituloTic({slug}:{slug:Exclude<Slug,'recursos'|'metodos'>}){
 const ficha=fichaTic(fichas.filter(f=>f.familia===slug));
 const fonte=<FonteTic/>;
 return <PaginaPainel rota={ROTA+'/'+slug} principal={false}
  abertura={{grupo:TEMAS_EFICIENCIA.cultura.nome+' · '+capitulos[slug][0],acento:'obee',titulo:capitulos[slug][1],lead:capitulos[slug][2],
   recorte:{periodo:'2024',universo:'Brasil, sete tipos de equipamento cultural',unidade:'% dos equipamentos de cada tipo',fonte:'Cetic.br/NIC.br, TIC Cultura 2024'},
   limite:'qual proporção de pessoas é atendida, porque o percentual é de equipamentos nos cadastros oficiais, públicos e privados, e não cobre todos os espaços culturais.',
   fontesDatasSiglas:<><p>{fonte}</p><p>TIC Cultura: pesquisa sobre o uso das tecnologias de informação e comunicação nos equipamentos culturais brasileiros, do Cetic.br, centro do NIC.br.</p></>}}
  figuras={<FiguraAnalitica id="estimativas" pergunta="Estimativa e margem publicada, por tipo de equipamento" subtitulo="Indicador escolhido · % do total de cada tipo de equipamento · Brasil, 2024" natureza="ESTIMADO" idioma="pt"
   naoConcluir="Equipamento não é pessoa: o percentual é de equipamentos e não mede a proporção da população atendida. Uma diferença visual pequena não comprova diferença estatística."
   comoInterpretar="O ponto mostra a estimativa; o segmento mostra a estimativa mais ou menos a margem publicada, limitado a 0–100%."
   tabela={{naFigura:'logo abaixo do gráfico, com a estimativa, a margem e a célula de origem de cada tipo de equipamento.'}} proveniencia={ficha}>
   <Explorador capitulo={slug} inicial={slug==='rede'?'A4':slug==='acesso'?'B10':slug==='acervos'?'D4B':undefined}/>
  </FiguraAnalitica>}
  metodo={<><p>{fonte}</p><p>Sete tipos de equipamentos culturais listados em cadastros oficiais. Inclui públicos e privados. O relatório metodológico descreve amostragem estratificada e estratos censitários; margens divulgadas com confiança de 95%. Não cobre todos os espaços informais, pessoas ou manifestações culturais.</p><p>Definições por indicador, arquivos e verificação em <Link className="underline" href={ROTA+'/metodos'}>Dados e métodos</Link>.</p></>}
 />;
}
export default function Pagina({params}:{params:{painel?:string[]}}){
 const slug=params.painel?.[0] as Slug;
 if((params.painel?.length??0)>1||(slug&&!capitulos[slug]))notFound();
 if(slug==='metodos')return <><Abertura rotulo="Fontes e cobertura" titulo={capitulos.metodos[1]} texto={capitulos.metodos[2]}/><section className="mt-8 grid gap-6 border-y border-linha py-6 md:grid-cols-2"><article><p className="rotulo text-obee-dark">Instituições · 2024</p><h2 className="mt-3 font-serif text-2xl">TIC Cultura</h2><p className="mt-3 text-sm leading-relaxed">Sete tipos de equipamentos culturais listados em cadastros oficiais. Inclui públicos e privados. O relatório metodológico descreve amostragem estratificada e estratos censitários; margens divulgadas com confiança de 95%. Não cobre todos os espaços informais, pessoas ou manifestações culturais.</p><a href={base.fontes[0].metodo} className="mt-3 inline-flex min-h-[44px] items-center text-sm text-obee-dark underline">Relatório metodológico oficial →</a></article><article><p className="rotulo text-obee-dark">Despesa · 2013–2023</p><h2 className="mt-3 font-serif text-2xl">IBGE / STN</h2><p className="mt-3 text-sm leading-relaxed">Tabelas 3.1, 3.2 e 3.7 do SIIC 2013–2024. O último ano dos gastos é 2023. Valores em mil reais foram convertidos para reais. A participação da tabela 3.2 está armazenada como razão decimal na planilha e foi convertida para percentual. As classificações e a consolidação são mantidas como publicadas.</p><a href={base.fontes[1].url} className="mt-3 inline-flex min-h-[44px] items-center text-sm text-obee-dark underline">Planilha oficial de gastos →</a></article></section>
 <section className="mt-8"><h2 className="font-serif text-2xl">Quatro cuidados que mudam a leitura.</h2><ol className="mt-5 grid gap-6 md:grid-cols-2">{[['01','Equipamento não é pessoa.','64,8% das bibliotecas disponibilizam Wi-Fi. Isso não significa que 64,8% da população seja atendida.'],['02','As diferenças têm incerteza.','O segmento do gráfico mostra a estimativa mais ou menos a margem publicada, limitado a 0–100%. Uma diferença visual pequena não comprova diferença estatística.'],['03','Público e privado compartilham o recorte.','Os indicadores de acesso e atividade não isolam equipamentos públicos. A natureza jurídica não permite reponderar os demais indicadores por conta própria.'],['04','Os calendários são distintos.','A pesquisa de equipamentos é de 2024; os gastos vão até 2023. Não há junção entre instituição e despesa, nem medida de efeito de políticas.']].map(([id,t,d])=><li key={id} className="border-t border-linha pt-4"><p className="rotulo text-obee-dark">{id}</p><h3 className="mt-2 font-serif text-xl">{t}</h3><p className="mt-2 text-sm leading-relaxed">{d}</p></li>)}</ol></section>
 <section className="mt-10"><h2 className="font-serif text-2xl">Arquivos e verificação.</h2><p className="mt-3 max-w-prose2 text-sm leading-relaxed">Captura: 11/10/2026. TIC publicada em 07/10/2025; SIIC publicado em 12/12/2025, arquivo de gastos revisto em 10/03/2026. As somas das três esferas e dos 27 governos estaduais/distrital foram reconciliadas nos onze anos. Os recortes guardam aba, linha, coluna e hashes dos arquivos originais.</p><div className="mt-4 flex flex-wrap gap-x-6 gap-y-1">{[['snapshot.json','Dados e fichas · JSON'],['celulas.csv','Células extraídas · CSV'],['manifesto.json','Fontes e hashes · JSON']].map(([f,t])=><a key={f} href={'/eficiencia/cultura/'+f} download className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline">{t} ↓</a>)}</div></section>
 <section className="mt-10"><h2 className="font-serif text-2xl">Definições por indicador.</h2><div className="mt-4 divide-y divide-linha">{base.catalogo.map(f=><details key={f.id} className="py-3"><summary className="min-h-[44px] cursor-pointer py-2 font-semibold">{f.nome}</summary><dl className="grid gap-3 pb-4 pt-3 text-sm md:grid-cols-2">{[['O que mede',f.o_que_mede],['Universo',f.perimetro],['Período',f.periodo],['Unidade',f.unidade],['Transformação',f.formula],['Localização',f.localizacao_registro],['Limites',f.limites]].map(([k,v])=><div key={k}><dt className="font-semibold">{k}</dt><dd className="mt-1 leading-relaxed">{v}</dd></div>)}</dl></details>)}</div></section><aside className="mt-8 border-l-4 border-obee bg-obee-suave p-5"><h2 className="font-serif text-xl">Avaliação do serviço: dados ainda insuficientes.</h2><p className="mt-2 text-sm leading-relaxed">Não há nota de qualidade ou eficiência neste capítulo. Faltam frequência individual, demanda não atendida, tempo e custo de acesso, satisfação, acessibilidade física e referências compatíveis. O diagnóstico descritivo permanece disponível.</p></aside></>;
 if(slug==='recursos')return <CapituloRecursos/>;
 if(slug)return <CapituloTic slug={slug}/>;
 return <Panorama/>;
}

/**
 * Recursos no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): os controles do recorte na abertura (a primeira ação do
 * leitor), os dois números do recorte, a evolução e a distribuição entre esferas cada uma numa FiguraAnalitica e a tabela dos governos
 * estaduais, com a busca e a ordem logo antes dela, na fatia de tabelas. O recorte vive na URL (Recursos.tsx).
 */
function CapituloRecursos(){
 return <PaginaPainel rota={ROTA+'/recursos'} principal={false}
  abertura={{grupo:TEMAS_EFICIENCIA.cultura.nome+' · '+capitulos.recursos[0],acento:'obee',titulo:capitulos.recursos[1],lead:capitulos.recursos[2],
   recorte:{periodo:'2013–2023',universo:'Brasil, três esferas de governo e 27 governos estaduais e distrital',unidade:'R$ nominais',fonte:'IBGE/STN, SIIC 2013–2024'},
   limite:'a quantidade ou a qualidade dos serviços prestados: a despesa publicada, em reais correntes de cada ano, não mede atendimento nem eficiência, e o crescimento nominal não mede o aumento do poder de compra.',
   acao:<ControlesRecursos/>,
   fontesDatasSiglas:<><p><FonteSiic/></p><p>SIIC: Sistema de Informações e Indicadores Culturais, do IBGE. STN: Secretaria do Tesouro Nacional.</p></>}}
  faixaNumeros={<NumerosRecursos/>}
  figuras={<><FiguraSerie/><FiguraEsferas/></>}
  tabelas={<TabelaUfs/>}
  metodo={<><p><FonteSiic/></p><p>Tabelas 3.1, 3.2 e 3.7 do SIIC 2013–2024. O último ano dos gastos é 2023. Valores em mil reais foram convertidos para reais. A participação da tabela 3.2 está armazenada como razão decimal na planilha e foi convertida para percentual. As classificações e a consolidação são mantidas como publicadas.</p><p>Definições, arquivos e verificação em <Link className="underline" href={ROTA+'/metodos'}>Dados e métodos</Link>.</p></>}
 />;
}

/**
 * Panorama da cultura no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): os três números no NumeroIndicador, a nota de
 * fontes junto da faixa, os caminhos por pergunta logo depois dos números e o Wi-Fi por tipo de equipamento numa FiguraAnalitica. O
 * gráfico de estimativa e margem fica como era, marcado data-figura-legado (o kit ainda não tem gráfico de intervalo, e barras apagariam
 * a margem publicada); a tabela equivalente traz estimativa e margem. O aviso "Oferta registrada" vira o limite da abertura e fica
 * inteiro no método.
 */
function Panorama(){
 const wifi=base.tic.find(r=>r.aba==='B10'&&r.tipo==='Biblioteca')!;
 const municipal=base.tic.find(r=>r.aba==='A4'&&r.tipo==='Biblioteca'&&r.categoria==='Público municipal')!;
 const gasto=base.gastos.find(r=>r.ano===2023&&r.entidade==='Total')!;
 const wifiTipos=base.tic.filter(r=>r.aba==='B10'&&r.categoria==='Sim').sort((a,b)=>b.valor-a.valor);
 return <PaginaPainel rota={ROTA} principal={false}
  abertura={{grupo:TEMAS_EFICIENCIA.cultura.nome+' · Cidadania e convivência',acento:'obee',titulo:'O que os espaços culturais oferecem ao público?',
   lead:'Bibliotecas, museus, teatros, cinemas, arquivos, bens tombados e pontos de cultura: como se organizam, o que oferecem e quanto o poder público registra de despesa com cultura.',
   recorte:{periodo:'2024 (equipamentos) e 2023 (despesa)',universo:'Brasil, sete tipos de equipamento cultural e três esferas de governo',unidade:'% dos equipamentos e R$ nominais',fonte:'Cetic.br/NIC.br, TIC Cultura 2024; IBGE/STN, SIIC'},
   limite:'a participação da população: os dados mostram capacidades e atividades declaradas, e frequência individual, demanda não atendida e satisfação dos cidadãos ainda não estão integradas. A existência de um equipamento não comprova acesso efetivo.',
   fontesDatasSiglas:<><p><FonteTic/></p><p><FonteSiic/></p><p>TIC Cultura: pesquisa sobre o uso das tecnologias de informação e comunicação nos equipamentos culturais brasileiros, do Cetic.br, centro do NIC.br. SIIC: Sistema de Informações e Indicadores Culturais, do IBGE. STN: Secretaria do Tesouro Nacional.</p></>}}
  numeros={[
   {rotulo:'Bibliotecas com Wi-Fi para o público',recorte:'Brasil',valor:wifi.valor,formato:'percentual',casas:1,unidade:'%',periodo:'2024',fonte:'Cetic.br/NIC.br, TIC Cultura, tabela B10',natureza:'ESTIMADO',nota:'Margem ± '+n(wifi.margem)+' p.p. · Brasil, 2024 · B10'},
   {rotulo:'Bibliotecas de natureza pública municipal',recorte:'Brasil',valor:municipal.valor,formato:'percentual',casas:1,unidade:'%',periodo:'2024',fonte:'Cetic.br/NIC.br, TIC Cultura, tabela A4',natureza:'ESTIMADO',nota:'Margem ± '+n(municipal.margem)+' p.p. · Brasil, 2024 · A4'},
   {rotulo:'Despesa pública com cultura',recorte:'Brasil, três esferas',valor:gasto.valor/1e9,formato:'reais',casas:2,unidade:'R$ bi',periodo:'2023',fonte:'IBGE/STN, SIIC, tabela 3.1',natureza:'OBSERVADO',nota:'Três esferas · Brasil, 2023 · reais nominais · tabela 3.1'},
  ]}
  notaNumeros={<>Fontes: <a href={TIC.url} className="underline">Cetic.br/NIC.br · TIC Cultura 2024</a> e <a href={SIIC.url} className="underline">IBGE/STN · SIIC</a>. Períodos distintos. Os valores não compõem um escore de eficiência.</>}
  navegacaoLocal={<nav aria-labelledby="caminhos-cultura" className="mt-10 border-t border-linha pt-6">
   <h2 id="caminhos-cultura" className="t-h2 text-carvao">Da estrutura à experiência cultural.</h2>
   <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">Escolha uma pergunta. Cada caminho preserva seu universo: instituição, atividade, acervo ou despesa.</p>
   <div className="mt-4 grid gap-x-10 md:grid-cols-2">{Object.entries(capitulos).map(([s,[t,p,d]])=><Link key={s} href={ROTA+'/'+s} className="group block min-h-[44px] border-t border-linha py-5"><p className="rotulo text-mineral">{t}</p><h3 className="t-h3 mt-2 text-carvao group-hover:underline">{p} <span aria-hidden="true">↗</span></h3><p className="t-meta mt-2 max-w-prose2 text-carvao-muted">{d}</p></Link>)}</div>
  </nav>}
  figuras={<FiguraAnalitica id="wifi" pergunta="Wi-Fi para o público, por tipo de equipamento" subtitulo="% dos equipamentos de cada tipo · Brasil, 2024 · barra: estimativa · traço: margem publicada (95%)" natureza="ESTIMADO" idioma="pt"
   naoConcluir="Margens que se sobrepõem não comprovam diferença entre os tipos. O percentual é de equipamentos nos cadastros oficiais, públicos e privados, e não mede a proporção da população atendida; a cultura vai além dos equipamentos pesquisados."
   tabela={{titulo:'Wi-Fi para o público, por tipo de equipamento · Brasil, 2024',colunas:['Tipo de equipamento','Estimativa (%)','Margem (p.p.)'],linhas:wifiTipos.map(r=>[r.tipo,r.valor,r.margem]),casas:[null,1,1]}}
   proveniencia={fichaTic(fichas.filter(f=>f.localizacao_registro.startsWith('B10;')))}>
   {/* visual principal do panorama (diagnóstico de 20/10/2026, item 10): a mesma medida nos sete tipos, com a margem publicada */}
   <figure data-figura-legado=""><ul className="space-y-3" aria-label="Wi-Fi para o público por tipo de equipamento, com margem">{wifiTipos.map(r=><li key={r.tipo} className="grid grid-cols-[7.5rem_1fr_3.25rem] items-center gap-3 text-sm"><span>{r.tipo}</span><span aria-hidden="true" className="relative block h-4 bg-obee-fundo"><span className="absolute inset-y-0 left-0 bg-obee" style={{width:r.valor+'%'}}/><span className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-obee-tinta" style={{left:Math.max(0,r.valor-r.margem)+'%',width:Math.min(100,r.valor+r.margem)-Math.max(0,r.valor-r.margem)+'%'}}/><span className="absolute inset-y-0 w-[2px] bg-obee-tinta" style={{left:Math.max(0,r.valor-r.margem)+'%'}}/><span className="absolute inset-y-0 w-[2px] -translate-x-full bg-obee-tinta" style={{left:Math.min(100,r.valor+r.margem)+'%'}}/></span><span className="text-right tabular-nums">{n(r.valor)}%<span className="sr-only">, margem de ± {n(r.margem)} pontos percentuais</span></span></li>)}</ul><figcaption className="t-meta mt-4 text-carvao-muted">Cadastros oficiais, públicos e privados. Margens que se sobrepõem não comprovam diferença entre os tipos. A cultura vai além dos equipamentos pesquisados.</figcaption></figure>
  </FiguraAnalitica>}
  metodo={<><p><FonteTic/></p><p><FonteSiic/></p><p><span className="font-medium text-carvao">Oferta registrada. Participação ainda não medida.</span> Os dados mostram capacidades e atividades declaradas. Frequência individual, demanda não atendida e satisfação dos cidadãos ainda não estão integradas. A existência de um equipamento não comprova acesso efetivo.</p><p>Definições por indicador, arquivos e verificação em <Link className="underline" href={ROTA+'/metodos'}>Dados e métodos</Link>.</p></>}
 />;
}
