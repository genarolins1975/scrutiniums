import type {Metadata} from 'next';
import Link from 'next/link';
import {Controles, FiguraAnalitica, GraficoBarras, PaginaPainel, TabelaDados, type NumeroProps} from '@/components/painel';
import {SeloComConta} from '@/components/acesso/SeloComConta';
import {consultaCursos,type RecorteCursos} from '@/lib/eficiencia/trabalho-renda/cursos';
import {provenienciaObee} from '@/lib/eficiencia/proveniencia';
export const metadata:Metadata={title:'Qualificação: cursos autorizados de aprendizagem',description:'Explore os registros de cursos de aprendizagem profissional autorizados pelo MTE, por localidade, entidade, modalidade e prazo de validade.'};
export const dynamic='force-dynamic';
const BASE='/eficiencia-estatal/trabalho-renda/qualificacao';
const POR_PAGINA=30;
const inteiro=(v:number)=>v.toLocaleString('pt-BR');
const data=(v:string|null)=>v?new Date(v+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC'}):'Não informada';
const SITUACAO={vigente:'Vigente no recorte',vencido:'Prazo vencido',futuro:'Aprovação futura','sem-data':'Sem datas'} as const;
const link='inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4';
const campo='mt-1 block min-h-[44px] w-full border border-linha bg-superficie px-3 text-sm text-carvao';
const rotuloCampo='flex min-w-[12rem] flex-1 flex-col text-sm text-carvao';

/**
 * Qualificação no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a busca dos cursos de aprendizagem autorizados pelo MTE
 * é a primeira ação da abertura (formulário GET, o recorte vive na URL e o servidor responde já filtrado, também sem JavaScript); depois,
 * os três números do recorte, a distribuição por modalidade na figura do kit, a lista paginada dos cursos na TabelaDados (à vista, como
 * antes, com a exportação de todo o recorte e a navegação entre páginas), o que o cadastro permite observar e as fontes no método.
 */
export default function Qualificacao({searchParams={}}:{searchParams?:RecorteCursos}){
  const {indice,uf,selecionados,recorte}=consultaCursos(searchParams);
  const paginas=Math.max(1,Math.ceil(selecionados.length/POR_PAGINA));
  const pag=Math.min(Math.max(1,Number.parseInt(recorte.pagina??'1')||1),paginas);
  const exibidos=selecionados.slice((pag-1)*POR_PAGINA,pag*POR_PAGINA);
  const filtro=new URLSearchParams();if(uf)filtro.set('uf',uf);if(recorte.q)filtro.set('q',recorte.q.slice(0,200));if(recorte.modalidade)filtro.set('modalidade',recorte.modalidade);if(recorte.status)filtro.set('status',recorte.status);
  const urlPagina=(n:number)=>{const q=new URLSearchParams(filtro);q.set('pagina',String(n));return BASE+'?'+q.toString();};
  const modalidades=Array.from(new Set(selecionados.map(c=>c.modalidade))).map(m=>({nome:m,n:selecionados.filter(c=>c.modalidade===m).length}));
  const padrao=!uf&&!recorte.q&&!recorte.modalidade&&(recorte.status??'vigente')==='vigente';
  const planilha=indice.fonte.referencia.split(';')[0];
  const territorio=uf||'Brasil';
  const fonte='MTE, Aprendizagem Profissional';
  const situacao=({vigente:'vigente na data de captura',vencido:'prazo vencido no recorte',futuro:'aprovação posterior ao recorte','sem-data':'datas não informadas',todos:'todos os registros'} as Record<string,string>)[recorte.status??'vigente'];
  // contagens sobre os registros do recorte, feitas aqui: a natureza é calculada
  const numeros:NumeroProps[]=[
    {rotulo:'Registros no recorte',valor:selecionados.length,formato:'inteiro',unidade:'registros',periodo:planilha,recorte:territorio,fonte,natureza:'CALCULADO',nota:'Autorizações e localidades indicadas; um curso pode aparecer em mais de uma linha.'},
    {rotulo:'Códigos de curso distintos',valor:new Set(selecionados.map(c=>c.id)).size,formato:'inteiro',unidade:'códigos',periodo:planilha,recorte:territorio,fonte,natureza:'CALCULADO',nota:'Deduplicação apenas pelo código declarado pelo MTE.'},
    {rotulo:'Localidades indicadas',valor:new Set(selecionados.map(c=>c.uf+'|'+c.cidade.toLocaleUpperCase('pt-BR'))).size,formato:'inteiro',unidade:'localidades',periodo:planilha,recorte:territorio,fonte,natureza:'CALCULADO',nota:'Sede ou localidade da autorização a distância, conforme a planilha.'},
  ];
  const proveniencia=provenienciaObee({
    indicador:'Registros de autorização de cursos de aprendizagem por modalidade',
    natureza:'CALCULADO',
    orgao:'Ministério do Trabalho e Emprego',
    dataset:'Aprendizagem Profissional, cursos autorizados',
    recurso:indice.fonte.bruto,
    url:indice.fonte.pagina,
    urlPrimaria:indice.fonte.url,
    unidade:'registros',
    frequencia:'não registrada no snapshot',
    inicio:'2026-10',
    fim:'2026-10',
    capturadoEm:indice.fonte.capturadoEm,
    transformacoes:['As grafias “À distância” e “À Distância” são agrupadas; a exportação preserva a modalidade original.','A classificação de vigência usa as datas declaradas, não uma verificação de funcionamento atual.'],
    limitacoes:indice.fonte.limitacoes,
    notas:indice.fonte.referencia,
    snapshot:{id:indice.fonte.bruto,sha256:indice.fonte.sha256Zip},
  });
  const csv=BASE+'/dados.csv?'+filtro.toString();
  return <PaginaPainel
    rota={BASE}
    principal={false}
    idioma="pt"
    abertura={{
      grupo:'Trabalho e renda',
      acento:'obee',
      titulo:'Onde encontrar cursos de aprendizagem?',
      lead:'Consulte autorizações de cursos por localidade, instituição e modalidade. A fonte informa aprovação e validade; disponibilidade de turmas, matrículas e vagas precisa ser confirmada com a entidade.',
      recorte:{periodo:planilha,universo:`${territorio}, registros de cursos de aprendizagem autorizados`,unidade:'registros',fonte:'MTE, Cadastro Nacional da Aprendizagem Profissional'},
      limite:'que há vaga, turma ou atendimento: a presença de um curso não demonstra atendimento ou efeito sobre o emprego.',
      acao:<form key={JSON.stringify([uf,recorte.q,recorte.modalidade,recorte.status])} action={BASE} method="get" aria-label="Filtrar cursos de aprendizagem">
        <Controles rotulo="Filtrar cursos de aprendizagem" idioma="pt" resumo={`Mostrando ${territorio}, ${situacao}${recorte.modalidade?`, ${recorte.modalidade}`:''}${recorte.q?`, busca “${recorte.q}”`:''}.`} limpar={padrao?undefined:{href:BASE}}>
          <label className={`${rotuloCampo} basis-full md:basis-auto`}>Buscar curso, ocupação ou cidade<input type="search" name="q" defaultValue={recorte.q??''} maxLength={200} placeholder="Ex.: logística, Recife, 411005" className={campo}/></label>
          <label className={rotuloCampo}>Unidade da Federação<select name="uf" defaultValue={uf} className={campo}><option value="">Todas as UFs</option>{indice.porUF.map(r=><option value={r.uf} key={r.uf}>{r.uf}</option>)}</select></label>
          <label className={rotuloCampo}>Modalidade<select name="modalidade" defaultValue={recorte.modalidade??''} className={campo}><option value="">Todas as modalidades</option>{indice.modalidades.map(m=><option key={m}>{m}</option>)}</select></label>
          <label className={rotuloCampo}>Prazo da autorização<select name="status" defaultValue={recorte.status??'vigente'} className={campo}><option value="vigente">Vigente na data de captura</option><option value="vencido">Prazo vencido no recorte</option><option value="futuro">Aprovação posterior ao recorte</option><option value="sem-data">Datas não informadas</option><option value="todos">Todos os registros</option></select></label>
          <button type="submit" className="inline-flex min-h-[44px] items-center border border-carvao px-4 text-sm text-carvao hover:bg-carvao hover:text-marfim">Aplicar filtros</button>
        </Controles>
      </form>,
      fontesDatasSiglas:<>
        <p>Captura da planilha do MTE: {new Date(indice.fonte.capturadoEm).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})}.</p>
        <p><span className="font-medium">MTE:</span> Ministério do Trabalho e Emprego. <span className="font-medium">CBO:</span> Classificação Brasileira de Ocupações. <span className="font-medium">Sine:</span> Sistema Nacional de Emprego.</p>
      </>,
    }}
    numeros={numeros}
    notaNumeros={`${indice.fonte.referencia} A classificação de vigência usa as datas declaradas, não uma verificação de funcionamento atual.`}
    figuras={<FiguraAnalitica
      id="modalidades"
      idioma="pt"
      pergunta="Como as autorizações se distribuem por modalidade?"
      subtitulo={`Registros de autorização · ${territorio} · ${situacao}`}
      natureza="CALCULADO"
      proveniencia={proveniencia}
      comoInterpretar="Quantidade de registros no mesmo recorte da consulta. As grafias “À distância” e “À Distância” são agrupadas; a exportação preserva a modalidade original."
      naoConcluir="Registros não são matrículas nem pessoas atendidas: a presença de um curso não demonstra atendimento ou efeito sobre o emprego."
      tabela={{titulo:`Registros por modalidade · ${territorio}`,colunas:['Modalidade','Registros'],linhas:modalidades.map(m=>[m.nome||'Não informada',m.n]),casas:[null,0]}}
    >
      {modalidades.length
        ?<GraficoBarras titulo={`Registros de autorização por modalidade, ${territorio}`} series={[{id:'registros',nome:'Registros',pontos:modalidades.map(m=>({x:m.nome||'nao-informada',rotulo:m.nome||'Não informada',y:m.n}))}]} eixoY={{unidade:'registros',zero:true,casas:0}} orientacao="horizontal" rotulosValor/>
        :<p data-grafico="sem-dado" className="t-corpo max-w-prose2 text-carvao">Nenhum registro corresponde aos filtros. Experimente ampliar a localidade ou retirar um termo da busca.</p>}
    </FiguraAnalitica>}
    tabelas={<TabelaDados
      idioma="pt"
      recolhida={false}
      id="cursos"
      tituloVisivel="Cursos e entidades no seu recorte"
      lead={<>
        <p>{selecionados.length?`Registros ${(pag-1)*POR_PAGINA+1} a ${Math.min(pag*POR_PAGINA,selecionados.length)} de ${inteiro(selecionados.length)}. Página ${pag} de ${paginas}.`:'Nenhum registro encontrado.'}</p>
        <a download="cursos-aprendizagem-recorte.csv" href={csv} className={link}>Exportar todo o recorte CSV<SeloComConta href={csv}/></a>
      </>}
      titulo={`Autorizações de aprendizagem · ${territorio} · referência da planilha de outubro de 2026`}
      colunas={['Curso e programa','Entidade e localidade','Modalidade e carga','Validade e detalhes']}
      limite={POR_PAGINA}
      linhas={exibidos.map(c=>[
        <div key="curso"><strong className="font-medium">{c.nome}</strong><span className="block text-xs text-carvao-muted">Código {c.id} · {c.programa}</span></div>,
        <div key="entidade">{c.entidade}<span className="block text-xs text-carvao-muted">{c.cidade} ({c.uf}) · {c.localidade==='oferta-ead'?'localidade indicada para oferta a distância':'sede declarada da entidade'}</span></div>,
        <div key="modalidade">{c.modalidade||'Não informada'}<span className="block text-xs text-carvao-muted">{c.horasTotal===null?'Carga horária não informada':inteiro(c.horasTotal)+' horas totais'}</span></div>,
        <div key="validade">{SITUACAO[c.status]}<span className="block text-xs text-carvao-muted">Até {data(c.validadeISO)}</span><details><summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm text-obee-dark underline underline-offset-4">Ocupações e aprovação</summary><span className="block">Aprovação: {data(c.aprovacaoISO)}.</span><span className="block">CBO: {c.cbo||'Não informada'}.</span><span className="block">{c.ocupacoes||'Título das ocupações não informado.'}</span></details></div>,
      ])}
      nota={<span className="flex flex-wrap justify-between gap-x-6" role="navigation" aria-label="Páginas de resultados">{pag>1?<Link className={link} href={urlPagina(pag-1)}>← Página anterior</Link>:<span/>}{pag*POR_PAGINA<selecionados.length&&<Link className={link} href={urlPagina(pag+1)}>Próxima página →</Link>}</span>}
    />}
    notas={{id:'o-que-observar',titulo:'O que este cadastro permite observar?',itens:[
      {termo:'Autorizações e presença territorial',definicao:'A planilha permite localizar instituições, cursos, ocupações associadas, modalidades e prazos. O recorte distingue linhas de autorização e códigos de curso.'},
      {termo:'O que falta para medir resultados',definicao:'Vagas disponíveis, matrículas, concluintes, colocações pelo Sine e renda após o curso não são informados nesta base. A presença de um curso não demonstra atendimento ou efeito sobre o emprego.'},
    ]}}
    metodo={<>
      <p><a href={indice.fonte.pagina} className={link}>Ministério do Trabalho e Emprego, Aprendizagem Profissional</a>. Captura: {new Date(indice.fonte.capturadoEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} (Brasília).</p>
      <ul className="list-disc pl-5">{indice.fonte.limitacoes.map(l=><li key={l}>{l}</li>)}</ul>
      <p>SHA-256 do CSV original: <code className="break-all">{indice.fonte.sha256Csv}</code>.</p>
      <p className="flex flex-wrap gap-x-6"><a href={indice.fonte.bruto} download className={link}>Baixar planilha original ZIP<SeloComConta href={indice.fonte.bruto}/></a><Link href="/eficiencia-estatal/trabalho-renda/metodos" className={link}>Método e cobertura →</Link><Link href="/eficiencia-estatal/trabalho-renda" className={link}>Voltar ao panorama →</Link></p>
    </>}
  />;
}
