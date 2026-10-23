import type {Metadata} from 'next';
import Link from 'next/link';
import {PaginaPainel, TabelaDados, type NumeroProps} from '@/components/painel';
import {FiguraSuasDoPainel} from '@/components/eficiencia/assistencia/PainelSuas';
import {dadosAssistencia} from '@/lib/eficiencia/assistencia/dados';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
import {dataBr} from '@/lib/eficiencia/formato';
export const dynamic='force-static';
export const metadata:Metadata={title:'Necessidades de proteção social'};

const ROTA='/eficiencia-estatal/assistencia-social/necessidades';
/** As três medidas da página: a oferta de proteção básica no domicílio e quem ela atende, nos CRAS. */
const IDS=['CRAS.q34','CRAS.q36_2','CRAS.q36_3'];

/**
 * Necessidades de proteção social, no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta, os números da rede
 * no Brasil (os mesmos resumos que a figura desenha), as respostas da rede por território e a tabela das perguntas de demanda que a
 * base ainda não mede, que era uma tabela escrita à mão e passa a ser a TabelaDados do kit. O layout da Assistência social já abre o
 * <main>: o molde entra como <div>.
 */
export default function Page(){
  const g=dadosAssistencia();
  const b=g.stats.Brasil.metrics;
  const ficha=(id:string)=>g.catalog.find(c=>c.id===id)!;
  const oferta=b['CRAS.q34'];
  const sim=oferta.categories.find(c=>c.label==='Sim')??null;
  const fonte='MDS, Censo SUAS 2025';
  // os números são os resumos do Brasil que a figura também desenha: unidades que declaram a oferta e as pessoas que elas declaram atender;
  // contagem e soma das respostas são feitas pelo OBEE sobre os registros do Censo, por isso a natureza é calculada
  const numeros:NumeroProps[]=[
    sim?{rotulo:'CRAS que ofertam proteção básica no domicílio',valor:sim.count,formato:'inteiro',unidade:`de ${oferta.observed.toLocaleString('pt-BR')} unidades`,periodo:ficha('CRAS.q34').period,recorte:'Brasil',fonte,natureza:'CALCULADO',nota:`${sim.percent.toLocaleString('pt-BR',{maximumFractionDigits:1})}% das respostas observadas. Oferta declarada; não comprova atendimento de cada pessoa.`}:{rotulo:'CRAS que ofertam proteção básica no domicílio',valor:null,motivoAusencia:'A resposta "Sim" não aparece no resumo desta publicação.',unidade:'unidades',periodo:ficha('CRAS.q34').period,recorte:'Brasil',fonte,natureza:'CALCULADO'},
    ...(['CRAS.q36_2','CRAS.q36_3'] as const).map((id):NumeroProps=>{const s=b[id];const f=ficha(id);return s.sum===null?{rotulo:f.name,valor:null,motivoAusencia:'Nenhuma unidade informou a contagem neste recorte.',unidade:'pessoas',periodo:f.period,recorte:'Brasil',fonte,natureza:'CALCULADO'}:{rotulo:f.name,valor:s.sum,formato:'inteiro',unidade:'pessoas (soma declarada)',periodo:f.period,recorte:'Brasil',fonte,natureza:'CALCULADO',nota:`Soma de ${s.observed.toLocaleString('pt-BR')} unidades com resposta. Pode haver pessoas em mais de uma unidade; não é cobertura populacional.`}}),
  ];
  const demanda=[['Acompanhamento familiar','Famílias que necessitam e são elegíveis ao acompanhamento','Atendimento registrado não mede procura reprimida.'],['Proteção contra violações','Pessoas com necessidade de proteção especializada','Mais registros podem refletir mais violência ou melhor identificação.'],['Cuidado a idosos e pessoas com deficiência','Pessoas com dependência e necessidade do serviço específico','Idade ou deficiência isoladamente não medem dependência.']];
  return <PaginaPainel
    rota={ROTA}
    principal={false}
    idioma="pt"
    abertura={{
      grupo:TEMAS_EFICIENCIA.assistencia.nome,
      acento:'obee',
      titulo:'Quem precisa de apoio e quem consegue recebê-lo?',
      lead:'Baixa renda, violações de direitos e necessidade de cuidado são situações diferentes. O número de inscritos no Cadastro Único não é um denominador universal para todos os serviços.',
      recorte:{periodo:`${g.year}, volumes de agosto de ${g.year}`,universo:'unidades CRAS respondentes, Brasil e UFs',unidade:'unidades e pessoas declaradas',fonte},
      limite:'o tamanho da demanda, porque a população que precisa e não consegue atendimento ainda não foi medida neste recorte.',
      fontesDatasSiglas:<>
        <p>Censo SUAS {g.year}, questionário dos CRAS, publicado pelo Ministério do Desenvolvimento e Assistência Social (MDS); capturado em {dataBr(g.manifest.captured_at)}. As contagens de pessoas atendidas no domicílio se referem a agosto de {g.year}.</p>
        <p><span className="font-medium">CRAS:</span> Centro de Referência de Assistência Social. <span className="font-medium">SUAS:</span> Sistema Único de Assistência Social. <span className="font-medium">MDS:</span> Ministério do Desenvolvimento e Assistência Social.</p>
      </>,
    }}
    numeros={numeros}
    notaNumeros="Respostas declaradas pelas próprias unidades. Pessoas idosas e com deficiência podem pertencer aos dois grupos; não some essas categorias."
    figuras={<FiguraSuasDoPainel ids={IDS} rota={ROTA}/>}
    tabelas={<TabelaDados
      titulo="Perguntas de demanda que orientam a avaliação; estimativas ainda não integradas"
      tituloVisivel="O que seria preciso medir para responder à pergunta?"
      lead="Perguntas de demanda que orientam a avaliação; estimativas ainda não integradas."
      id="demanda"
      recolhida={false}
      colunas={['Necessidade','Denominador necessário','Limite dos registros atuais']}
      linhas={demanda}
      nota={<>
        <span className="font-medium text-carvao">Contexto de renda já publicado no OBEE.</span> Consulte o Cadastro Único e a proteção da renda no capítulo de Trabalho e renda. Esses dados permanecem com suas fontes e universos originais; não são somados novamente ao escore de assistência.{' '}
        <Link href="/eficiencia-estatal/trabalho-renda/cadastro-unico" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Cadastro Único →</Link>{' '}
        <Link href="/eficiencia-estatal/trabalho-renda/protecao-da-renda" className="ml-4 inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Proteção da renda →</Link>
      </>}
    />}
    metodo={<>
      {IDS.map(id=>{const f=ficha(id);return <div key={id}>
        <p className="font-medium text-carvao">{f.kind} · {f.name}</p>
        <p>{f.definition}{/[.?!]$/.test(f.definition)?'':'.'} Universo: {f.universe}. Período: {f.period}. Fórmula: {f.formula}. Ausências: {f.missing}. Série: {f.breaks}. Registro: {f.record}.</p>
      </div>;})}
      <p>Arquivos oficiais lidos: {g.manifest.sources.map(s=><a key={s.file} href={s.url} className="mr-3 text-obee-dark underline underline-offset-4">{s.file}</a>)} Capturados em {dataBr(g.manifest.captured_at)}.</p>
      <p>Todas as observações de todas as unidades e o dicionário completo estão em <Link href="/eficiencia-estatal/assistencia-social/metodos" className="text-obee-dark underline underline-offset-4">Dados e métodos</Link> e na <Link href="/eficiencia-estatal/assistencia-social/dados" className="text-obee-dark underline underline-offset-4">consulta por unidade</Link>.</p>
    </>}
  />;
}
