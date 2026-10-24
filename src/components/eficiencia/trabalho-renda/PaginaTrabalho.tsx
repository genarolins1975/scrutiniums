import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {ReactNode} from 'react';
import {PaginaPainel} from '@/components/painel';
import {ExploradorTrabalho, FaixaTrabalho, MetodoTrabalhoMedida, ProvedorTrabalho} from './ExploradorTrabalho';
import Link from 'next/link';
import {FaixaPanoramaTrabalho, FiguraPanoramaTrabalho, PercursosTrabalho} from './PanoramaTrabalho';
import {MetodosTrabalho} from './MetodosTrabalho';
import {BASE, DIMENSOES, type Snapshot} from './modelo';
import {Recolhido} from '@/components/observatorios/Recolhido';
import {SeloProntidao} from '@/components/observatorios/SeloProntidao';

/**
 * Uma página de Trabalho e renda. As visões que exploram medidas (o modelo único de acesso ao trabalho, ocupações, qualidade, renda,
 * desigualdade, Cadastro Único, proteção da renda, emprego formal e comparar) saem no molde de painel (Iniciativa 1 do parecer de UX de
 * 23/10/2026): a abertura com o recorte da base lido aqui, no servidor, e a faixa, os controles, as figuras e o método da medida nas ilhas
 * do ExploradorTrabalho, que seguem o recorte da URL. O panorama também (PR 2 do molde): a faixa, a desocupação e os percursos seguem o
 * território da URL, as doze dimensões ficam recolhidas e as fontes vão para o método. O layout do tema já abre o <main>. Métodos segue
 * no desenho anterior (página de método, fora do molde).
 */
export async function PaginaTrabalho({visao='explorador',titulo='',pergunta='',ids,arquivo='snapshot.json',slug,aviso}:{visao?:'explorador'|'panorama'|'metodos';titulo?:string;pergunta?:string;ids?:string[];arquivo?:'snapshot.json'|'cadastro.json';slug?:string;aviso?:ReactNode}){
  let dados:Snapshot;
  try{dados=JSON.parse(await readFile(path.join(process.cwd(),'public/eficiencia/trabalho-renda',arquivo),'utf8')) as Snapshot}catch{return <section className="tr-empty"><h1>Base indisponível nesta publicação</h1><p>O arquivo oficial não foi encontrado. Nenhum dado é substituído por zero.</p></section>}
  const indicadores=ids??dados.indicadores.map(i=>i.id);
  const filtrado:Snapshot={...dados,indicadores:dados.indicadores.filter(i=>indicadores.includes(i.id)),observacoes:visao==='metodos'?[]:dados.observacoes.filter(o=>indicadores.includes(o.indicadorId)&&(visao!=='panorama'||o.sexo==='total'&&o.grupo==='Total'))};
  const fontesUsadas=new Set([...filtrado.indicadores.map(i=>i.fonteId),...filtrado.observacoes.map(o=>o.fonteId)]);
  filtrado.fontes=visao==='metodos'||visao==='panorama'?dados.fontes:dados.fontes.filter(f=>fontesUsadas.has(f.id));
  if(visao==='panorama')return <PanoramaTrabalho dados={dados} filtrado={filtrado}/>;
  if(visao==='metodos')return <MetodosTrabalho dados={filtrado}/>;
  // recorte da abertura: o primeiro e o último período publicados de cada fonte, os níveis territoriais, as unidades e as fontes
  const porFonte=new Map<string,{primeiro:string;ultimo:string;pNome:string;uNome:string}>();
  for(const o of filtrado.observacoes){
    const nome=(filtrado.fontes.find(f=>f.id===o.fonteId)?.nome??o.fonteId).split(' · ').slice(0,2).join(', ');
    const atual=porFonte.get(nome);
    if(!atual)porFonte.set(nome,{primeiro:o.periodo,ultimo:o.periodo,pNome:o.periodoNome,uNome:o.periodoNome});
    else{if(o.periodo<atual.primeiro){atual.primeiro=o.periodo;atual.pNome=o.periodoNome}if(o.periodo>atual.ultimo){atual.ultimo=o.periodo;atual.uNome=o.periodoNome}}
  }
  const periodo=[...porFonte.values()].map(v=>v.pNome===v.uNome?v.uNome:`${v.pNome} a ${v.uNome}`).filter((v,i,a)=>a.indexOf(v)===i).join('; ')||'sem período publicado';
  const comDado=new Set(filtrado.observacoes.map(o=>o.territorioId));
  const niveis=new Set(filtrado.territorios.filter(t=>comDado.has(t.id)).map(t=>t.nivel));
  const universo=[niveis.has('brasil')&&'Brasil',niveis.has('uf')&&'Unidades da Federação',niveis.has('municipio')&&'municípios'].filter(Boolean).join(', ')||'Brasil';
  const unidades=Array.from(new Set(filtrado.indicadores.map(i=>i.unidade))).join(', ');
  const fontes=Array.from(new Set([...porFonte.keys()].map(n=>n.split(', ')[0]))).join(', ');
  // o endereço público da página (o molde marca o painel por ele): a página passa o próprio trecho do caminho
  const rota=slug?`${BASE}/${slug}`:BASE;
  // a base vai ao navegador uma vez, pelo provedor; as três ilhas de cliente a leem dele (ver ProvedorTrabalho)
  return <ProvedorTrabalho dados={filtrado}><PaginaPainel
    rota={rota}
    principal={false}
    idioma="pt"
    aviso={aviso}
    abertura={{
      grupo:'Trabalho e renda',
      acento:'obee',
      titulo,
      lead:pergunta,
      recorte:{periodo,universo,unidade:unidades,fonte:fontes},
      limite:'causas, qualidade da gestão ou trajetória de uma pessoa, porque diferenças observadas não demonstram efeito de uma política pública.',
      fontesDatasSiglas:<>
        {filtrado.fontes.map(f=><p key={f.id}><span className="font-medium">{f.nome}.</span> {f.universo} Captura: {new Date(f.capturadoEm).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}.</p>)}
      </>,
    }}
    faixaNumeros={<FaixaTrabalho ids={indicadores}/>}
    figuras={<ExploradorTrabalho ids={indicadores} rota={rota}/>}
    metodo={<MetodoTrabalhoMedida ids={indicadores}/>}
  /></ProvedorTrabalho>;
}

/** Estado de cada dimensão da agenda: o SeloProntidao para publicado e parcial; o que não tem conteúdo publicado é dito em texto. */
function EstadoDimensao({estado}:{estado:string}){
  if(estado==='publicado')return <SeloProntidao valor="publicado"/>;
  if(estado==='parcial')return <SeloProntidao valor="parcial"/>;
  return <span className="t-meta text-carvao-muted">não publicado nesta edição</span>;
}

/**
 * O panorama de Trabalho e renda no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta, os três números do
 * território, os percursos de leitura, a desocupação ao longo do tempo, as doze dimensões da agenda recolhidas, os dois calendários no
 * glossário do ponto de uso e as fontes no método. Só o Brasil e as Unidades da Federação vão ao navegador: o panorama não desce ao
 * município, e a lista de 5.598 territórios deixava o HTML maior sem uso.
 */
function PanoramaTrabalho({dados,filtrado}:{dados:Snapshot;filtrado:Snapshot}){
  const fontesUsadas=new Set(filtrado.indicadores.map(i=>i.fonteId));
  const enxuto:Snapshot={...filtrado,territorios:filtrado.territorios.filter(t=>t.nivel!=='municipio'),fontes:dados.fontes.filter(f=>fontesUsadas.has(f.id))};
  const periodos=[...new Map(enxuto.observacoes.map(o=>[o.periodo,o.periodoNome])).entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  const captura=new Date(dados.capturadoEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
  const fonteLink='text-obee-dark underline underline-offset-4';
  return <ProvedorTrabalho dados={enxuto}><PaginaPainel
    rota={BASE}
    principal={false}
    idioma="pt"
    abertura={{
      grupo:'Trabalho e renda',
      acento:'obee',
      titulo:'Trabalho e renda na vida das pessoas.',
      lead:'Quem consegue trabalhar, em quais condições e com que renda? Explore a conjuntura do mercado de trabalho e o retrato das famílias, com os universos e calendários de cada fonte à vista.',
      recorte:{periodo:periodos.length?`${periodos[0][1]} a ${periodos.at(-1)![1]}`:'sem período publicado',universo:'Brasil e Unidades da Federação, pessoas de 14 anos ou mais',unidade:'% e R$',fonte:'IBGE, PNAD Contínua'},
      limite:'a eficiência de uma prefeitura. Contexto e atuação pública são dimensões distintas: emprego e renda descrevem a situação dos moradores.',
      fontesDatasSiglas:<>
        {enxuto.fontes.map(f=><p key={f.id}><span className="font-medium">{f.nome}.</span> {f.universo} Captura: {new Date(f.capturadoEm).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}.</p>)}
        <p><span className="font-medium">PNAD:</span> Pesquisa Nacional por Amostra de Domicílios. <span className="font-medium">IBGE:</span> Instituto Brasileiro de Geografia e Estatística.</p>
      </>,
    }}
    faixaNumeros={<FaixaPanoramaTrabalho/>}
    navegacaoLocal={<PercursosTrabalho/>}
    figuras={<>
      <FiguraPanoramaTrabalho rota={BASE}/>
      <Recolhido id="dimensoes" nivelTitulo={2} titulo="Todas as dimensões, cobertura explícita." resumo="A agenda tem 12 dimensões. Uma dimensão parcial não significa que todas as suas perguntas estejam respondidas; as lacunas permanecem identificadas.">
        <ul className="divide-y divide-linha border-y border-linha">
          {DIMENSOES.map(d=><li key={d.nome} className="py-4">
            <h3 className="t-h3 flex flex-wrap items-center gap-x-3 gap-y-1 text-carvao"><span>{d.nome}</span> <EstadoDimensao estado={d.estado}/></h3>
            <p className="t-corpo mt-1 font-medium text-carvao">{d.pergunta}</p>
            <p className="t-meta mt-1 max-w-prose2 text-carvao-muted">{d.nota}</p>
            {d.slug!==undefined&&<Link href={`${BASE}${d.slug?`/${d.slug}`:''}`} className={`inline-flex min-h-[44px] items-center text-sm ${fonteLink}`}>Abrir conteúdo publicado →</Link>}
          </li>)}
        </ul>
      </Recolhido>
    </>}
    notas={{id:'dois-calendarios',titulo:'Dois calendários, duas perguntas.',itens:[
      {termo:'Conjuntura · PNAD Contínua',definicao:'Séries trimestrais do Brasil e das Unidades da Federação. A pesquisa amostral permite acompanhar trabalho e rendimento ao longo do tempo; estimativas estão sujeitas à incerteza amostral.'},
      {termo:'Estrutura · Censo 2022',definicao:'Retrato da renda domiciliar por pessoa no ano do Censo. Detalha o território, mas não atualiza a conjuntura. O município descreve moradores, não postos de trabalho localizados nele.'},
      {termo:'Atuação pública',definicao:'Emprego e renda, isoladamente, não medem a eficiência de uma prefeitura. A despesa municipal na função Trabalho está disponível em Recursos públicos, com seu próprio perímetro e conferência contábil.'},
    ],nota:<><Link href={`${BASE}/comparar`} className={`inline-flex min-h-[44px] items-center ${fonteLink}`}>Comparar territórios e medidas →</Link>{' '}<Link href={`${BASE}/recursos`} className={`ml-4 inline-flex min-h-[44px] items-center ${fonteLink}`}>Recursos públicos →</Link></>}}
    metodo={<>
      <p>Captura: {captura} (Brasília). Cada indicador conserva seu período de referência, universo e limitação. A data da captura não atualiza o período dos dados.</p>
      <div><p className="font-medium text-carvao">IBGE · pesquisas domiciliares e Censo</p><p>PNAD Contínua: trabalho, rendimento e programas sociais. Censo 2022: retrato da renda domiciliar por pessoa.</p><ul className="mt-1 list-disc pl-5">{dados.fontes.filter(f=>!f.id.includes('caged')).map(f=><li key={f.id}><a href={f.consulta} className={`inline-flex min-h-[44px] items-center ${fonteLink}`}>{f.nome}</a></li>)}</ul></div>
      <div><p className="font-medium text-carvao">Ministério do Trabalho · emprego formal</p><p>Estoque nacional de vínculos do Novo Caged divulgado no SGS do Banco Central e sua variação mensal calculada. Sem ajuste sazonal.</p><ul className="mt-1 list-disc pl-5">{dados.fontes.filter(f=>f.id.includes('caged')).map(f=><li key={f.id}><a href={f.consulta} className={`inline-flex min-h-[44px] items-center ${fonteLink}`}>{f.nome}</a></li>)}</ul></div>
      <div><p className="font-medium text-carvao">Tesouro Nacional · recursos municipais</p><p>Siconfi: despesa liquidada na função 11 Trabalho, nas 26 capitais estaduais, com conferência DCA × RREO. Fontes individuais e notas estão no painel. <Link href={`${BASE}/recursos`} className={`inline-flex min-h-[44px] items-center ${fonteLink}`}>Consultar recursos e proveniência →</Link></p></div>
      <p className="flex flex-wrap gap-x-6"><Link href={`${BASE}/metodos`} className={`inline-flex min-h-[44px] items-center ${fonteLink}`}>Definições, reprodução e limites →</Link><Link href="/eficiencia-estatal" className={`inline-flex min-h-[44px] items-center ${fonteLink}`}>Todos os recursos do Estado →</Link></p>
    </>}
  /></ProvedorTrabalho>;
}
