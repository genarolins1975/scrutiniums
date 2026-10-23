import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {ReactNode} from 'react';
import {PaginaPainel} from '@/components/painel';
import {ExploradorTrabalho, FaixaTrabalho, MetodoTrabalhoMedida} from './ExploradorTrabalho';
import {PanoramaTrabalho} from './PanoramaTrabalho';
import {MetodosTrabalho} from './MetodosTrabalho';
import {BASE, type Snapshot} from './modelo';

/**
 * Uma página de Trabalho e renda. As visões que exploram medidas (o modelo único de acesso ao trabalho, ocupações, qualidade, renda,
 * desigualdade, Cadastro Único, proteção da renda, emprego formal e comparar) saem no molde de painel (Iniciativa 1 do parecer de UX de
 * 23/10/2026): a abertura com o recorte da base lido aqui, no servidor, e a faixa, os controles, as figuras e o método da medida nas ilhas
 * do ExploradorTrabalho, que seguem o recorte da URL. O layout do tema já abre o <main>. Panorama e métodos seguem no desenho anterior.
 */
export async function PaginaTrabalho({visao='explorador',titulo='',pergunta='',ids,arquivo='snapshot.json',slug,aviso}:{visao?:'explorador'|'panorama'|'metodos';titulo?:string;pergunta?:string;ids?:string[];arquivo?:'snapshot.json'|'cadastro.json';slug?:string;aviso?:ReactNode}){
  let dados:Snapshot;
  try{dados=JSON.parse(await readFile(path.join(process.cwd(),'public/eficiencia/trabalho-renda',arquivo),'utf8')) as Snapshot}catch{return <section className="tr-empty"><h1>Base indisponível nesta publicação</h1><p>O arquivo oficial não foi encontrado. Nenhum dado é substituído por zero.</p></section>}
  const indicadores=ids??dados.indicadores.map(i=>i.id);
  const filtrado:Snapshot={...dados,indicadores:dados.indicadores.filter(i=>indicadores.includes(i.id)),observacoes:visao==='metodos'?[]:dados.observacoes.filter(o=>indicadores.includes(o.indicadorId)&&(visao!=='panorama'||o.sexo==='total'&&o.grupo==='Total'))};
  const fontesUsadas=new Set([...filtrado.indicadores.map(i=>i.fonteId),...filtrado.observacoes.map(o=>o.fonteId)]);
  filtrado.fontes=visao==='metodos'||visao==='panorama'?dados.fontes:dados.fontes.filter(f=>fontesUsadas.has(f.id));
  if(visao==='panorama')return <PanoramaTrabalho dados={filtrado}/>;
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
  return <PaginaPainel
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
    faixaNumeros={<FaixaTrabalho dados={filtrado} ids={indicadores}/>}
    figuras={<ExploradorTrabalho dados={filtrado} ids={indicadores} rota={rota}/>}
    metodo={<MetodoTrabalhoMedida dados={filtrado} ids={indicadores}/>}
  />;
}
