import type {Metadata} from 'next';
import Link from 'next/link';
import {Comparador,type Medida} from '@/components/eficiencia/justica/Exploradores';
import {FiguraAnalitica,GraficoBarras,GraficoLinhas,PaginaPainel} from '@/components/painel';
import {dadosJustica as d} from '@/lib/eficiencia/justica/dados';
import {FONTE_CNJ,FONTE_DEFENSORIA,fichaJustica} from '@/lib/eficiencia/justica/molde';
import {ROTA_JUSTICA} from '@/lib/eficiencia/justica/modelo';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
export const dynamic='force-static';
export const metadata:Metadata={title:'Soluções consensuais',alternates:{canonical:ROTA_JUSTICA+'/conciliacao'}};
const medidas:Medida[]=[{id:'acordos',nome:'Acordos extrajudiciais declarados',unidade:'acordos',formato:'numero',nota:'Contagem declarada pelas Defensorias em 2024. Pará e São Paulo não informaram; Roraima informou zero. O volume de Minas Gerais é muito superior aos demais e foi mantido como publicado. Métodos de registro podem diferir; não representa taxa de sucesso, pessoas únicas ou acordos judiciais.'},{id:'atendimentos',nome:'Atendimentos declarados',unidade:'atendimentos',formato:'numero',nota:'Registros de atendimento em 2024; uma pessoa pode aparecer mais de uma vez. Não usar como denominador de uma taxa de acordos: atendimento e acordo não formam uma mesma coorte de conflitos.'}];
/**
 * Soluções consensuais no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). A série da conciliação passa ao gráfico de linhas
 * do kit, com a tabela anual de antes como tabela equivalente; as barras dos centros de solução de conflitos passam ao gráfico de barras do
 * kit (que parte de zero e escolhe o topo da escala pelos dados, no lugar da escala fixa de 0 a 2.000 de antes); a comparação das
 * Defensorias é a figura do comparador. A nota final vira o limite e fica inteira no método.
 */
export default function Pagina(){const rows=d.defensorias.filter(r=>r.ano===2024);const serie=d.cnj.conciliacaoSerie;const ano=String(d.cnj.ano);
 const fichaSerie=fichaJustica('cnj',{indicador:'Índice nacional de conciliação',natureza:'OBSERVADO',unidade:'% das sentenças e decisões terminativas',inicio:String(serie[0].ano),fim:String(serie.at(-1)!.ano),recurso:'Relatório integral em PDF, figura 190 (p. 234); definição na p. 232',formula:'Sentenças e decisões homologatórias de acordo ÷ total de sentenças e decisões terminativas × 100',limitacoes:['Índice nacional publicado; numeradores e denominadores anuais não estão no recorte.','A composição de matérias e fases processuais influencia a proporção.']});
 const fichaCejusc=fichaJustica('cnj',{indicador:'Centros Judiciários de Solução de Conflitos e Cidadania instalados, por ramo',natureza:'OBSERVADO',unidade:'unidades',inicio:ano,fim:ano,recurso:'Relatório integral em PDF, p. 233',limitacoes:['Oferta de estrutura, sem medida de capacidade ou atendimento.']});
 const fichaDef=fichaJustica('defensoria',{indicador:'Acordos extrajudiciais e atendimentos declarados pelas Defensorias, por UF',natureza:'OBSERVADO',unidade:'acordos; atendimentos',inicio:'2024',fim:'2024',recurso:'Relatório Administrativo, colunas AC (acordos), AD (nota), S (atendimentos) e T (nota)',limitacoes:['Métodos de registro e abrangência podem diferir entre instituições.','Ausência de informação não recebe valor zero; Roraima declarou zero.']});
 return <PaginaPainel rota={ROTA_JUSTICA+'/conciliacao'} principal={false}
  abertura={{grupo:TEMAS_EFICIENCIA.justica.nome,acento:'obee',titulo:'Quais conflitos chegam a um acordo?',
   lead:'O CNJ mede homologações de acordos dentro do Judiciário. As Defensorias também informam acordos extrajudiciais. São mecanismos distintos, com diferentes unidades de contagem e denominadores.',
   recorte:{periodo:'conciliação judicial: '+ano+' · acordos e atendimentos das Defensorias: 2024',universo:'Judiciário e 27 Defensorias estaduais e distrital',unidade:'%, unidades e registros',fonte:FONTE_CNJ+' e '+FONTE_DEFENSORIA},
   limite:'que um percentual maior proteja melhor os direitos: nem todo conflito admite ou requer conciliação, e os acordos das Defensorias não se somam às homologações judiciais.'}}
  numeros={[
   {rotulo:'Índice de conciliação judicial',valor:d.cnj.conciliacao,formato:'percentual',casas:1,unidade:'',periodo:ano,fonte:FONTE_CNJ+', p. 233',natureza:'OBSERVADO',nota:'Sentenças e decisões homologatórias de acordo / total de sentenças e decisões terminativas.'},
   {rotulo:'Centros de solução de conflitos',valor:d.cnj.cejuscs.reduce((a,r)=>a+r.valor,0),formato:'inteiro',unidade:'CEJUSCs',periodo:'fim de '+ano,fonte:FONTE_CNJ+', p. 233',natureza:'CALCULADO',nota:'Soma dos três ramos; oferta de estrutura, sem medida de capacidade ou atendimento.'},
   {rotulo:'Defensorias com contagem de acordos',valor:rows.filter(r=>r.acordos!==null).length,formato:'inteiro',unidade:'de 27',periodo:'2024',fonte:FONTE_DEFENSORIA,natureza:'CALCULADO',nota:'Acordos extrajudiciais; ausência de informação não recebe valor zero.'},
  ]}
  figuras={<>
   <FiguraAnalitica id="serie" pergunta="Uma década de conciliação judicial" subtitulo={`Índice nacional de conciliação · % das sentenças e decisões terminativas · ${serie[0].ano} a ${serie.at(-1)!.ano}`} natureza="OBSERVADO" idioma="pt" proveniencia={fichaSerie}
    comoInterpretar="Índice nacional, na mesma edição do relatório. A composição de matérias e fases processuais influencia a proporção."
    naoConcluir="O índice não diz quantos acordos foram cumpridos nem se a proteção de direitos melhorou; numeradores e denominadores anuais não estão no recorte e não são reconstruídos dos percentuais."
    tabela={{titulo:'Índice nacional de conciliação, em porcentagem',colunas:['Ano','Índice (%)'],linhas:serie.map(r=>[String(r.ano),r.valor]),casas:[null,1]}}>
    <GraficoLinhas semTabela titulo="Homologações de acordo em % das sentenças e decisões terminativas" dados={serie.map(r=>({ano:String(r.ano),v:r.valor}))} chaveX="ano" formatoX="texto" series={[{id:'v',rotulo:'Índice nacional',cor:'var(--cor-obee)'}]} unidade="%" casas={1} zeroNoEixo/>
   </FiguraAnalitica>
   <FiguraAnalitica id="cejuscs" pergunta="Onde estão os centros de solução de conflitos?" subtitulo={`CEJUSCs instalados em dezembro de ${ano} · unidades · três ramos do Judiciário`} natureza="OBSERVADO" idioma="pt" proveniencia={fichaCejusc}
    comoInterpretar="Barras partem de zero, na mesma escala para os três ramos."
    naoConcluir="A contagem de centros mostra estrutura instalada; não mede capacidade, atendimento, demanda nem acesso de cada morador."
    tabela={{colunas:['Ramo','CEJUSCs instalados'],linhas:d.cnj.cejuscs.map(r=>[r.ramo,r.valor]),casas:[null,0]}}>
    <GraficoBarras semTabela titulo="CEJUSCs instalados por ramo do Judiciário" dados={d.cnj.cejuscs.map(r=>({id:r.ramo,nome:r.ramo,v:r.valor}))} chaveCategoria="id" chaveRotulo="nome" orientacao="horizontal" series={[{id:'v',rotulo:'CEJUSCs',cor:'var(--cor-obee)'}]} unidade="unidades" casas={0} rotulosValor/>
   </FiguraAnalitica>
   <FiguraAnalitica id="defensorias" pergunta="Acordos e atendimentos fora do Judiciário" subtitulo="Atividade declarada pelas Defensorias estaduais e distrital · acordos ou atendimentos · 27 UFs, 2024" natureza="OBSERVADO" idioma="pt" proveniencia={fichaDef}
    comoInterpretar="Registros administrativos das Defensorias estaduais e distrital, separados dos indicadores do CNJ. Escolha a medida, destaque uma UF e mude a ordem."
    naoConcluir="Os acordos das Defensorias não são taxa de sucesso nem pessoas únicas, e não se somam às homologações judiciais: pode haver sobreposição e os períodos são distintos."
    tabela={{naFigura:'logo abaixo das barras, com o valor exato e a nota de cada Defensoria.'}}>
    <Comparador linhas={rows.map(r=>({id:r.uf,nome:r.estado,valores:{acordos:r.acordos,atendimentos:r.atendimentos},nota:[r.notaAcordos,r.notaAtendimentos,r.uf==='MG'?'Minas Gerais declara 1.335.367 acordos. Valor preservado da célula AC17; requer cautela na comparação com as demais instituições.':''].filter(Boolean).join(' ')}))} medidas={medidas} titulo="Atividade declarada das Defensorias" fonte="Pesquisa Nacional da Defensoria Pública 2025, Relatório Administrativo" periodo="2024"/>
   </FiguraAnalitica>
  </>}
  metodo={<><p>Nem todo conflito admite ou requer conciliação. Um percentual maior não demonstra, por si só, melhor proteção de direitos. Não somamos os acordos extrajudiciais das Defensorias às homologações judiciais: pode haver sobreposição e os períodos são distintos.</p><p>Conciliação: {FONTE_CNJ}, série do total nacional na figura 190 (p. 234), definição na p. 232; CEJUSCs na p. 233. Defensorias: {FONTE_DEFENSORIA}, Relatório Administrativo, colunas AC (acordos), AD (nota), S (atendimentos) e T (nota); métodos de registro e abrangência podem diferir entre instituições.</p><p>Fontes, recortes, hashes e arquivos em <Link className="underline" href={ROTA_JUSTICA+'/dados'}>Dados e métodos</Link>.</p></>}
 />;}
