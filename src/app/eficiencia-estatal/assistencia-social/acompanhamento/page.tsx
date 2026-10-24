import type {Metadata} from 'next';
import {PaginaPainel, type NumeroProps} from '@/components/painel';
import {dadosAssistencia} from '@/lib/eficiencia/assistencia/dados';
import {FONTE_SUAS, FiguraSuasDoPainel, FontesSuas, MetodoSuas, numerosSuas} from '@/components/eficiencia/assistencia/PainelSuas';
import {SerieRma} from '@/components/eficiencia/assistencia/SerieRma';
import {provenienciaObee} from '@/lib/eficiencia/proveniencia';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
export const dynamic='force-static';
export const metadata:Metadata={title:'Acompanhamento das famílias'};

const ROTA='/eficiencia-estatal/assistencia-social/acompanhamento';
const IDS=['CRAS.q12_12','CRAS.q12_14','CREAS.q12_4','CREAS.q12_6'];
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

/**
 * Acompanhamento das famílias no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta, três números do Brasil (os
 * planos de acompanhamento declarados no PAIF e no PAEFI, os mesmos resumos que a figura das respostas desenha, e as famílias em
 * acompanhamento PAIF no último mês do RMA), o volume mensal do RMA CRAS e as respostas da rede, cada figura com os seus controles, e o
 * método das medidas do Censo e do RMA. As duas figuras leem o mesmo território da URL (?ter=).
 */
export default function Page(){
  const g=dadosAssistencia();
  const rma=Object.fromEntries(g.catalog.filter(c=>c.kind==='RMA').map(c=>[c.variable,c]));
  const fonteRma=g.manifest.sources.find(s=>s.file.startsWith('rma'))??g.manifest.sources[0];
  // a ficha de cada medida do RMA, do catálogo e do manifesto da captura, como as do Censo
  const proveniencias=Object.fromEntries(Object.values(rma).map(m=>{const [orgao,dataset]=m.source.split(' / ');return [m.variable,provenienciaObee({indicador:m.name,natureza:'CALCULADO',orgao:orgao??m.source,dataset:dataset??m.source,recurso:m.record,url:fonteRma.url,unidade:'contagem declarada no formulário',frequencia:m.frequency,inicio:`${g.year}-01`,fim:`${g.year}-12`,capturadoEm:g.manifest.captured_at,formula:m.formula,transformacoes:[`Numerador: ${m.numerator}.`,`Denominador: ${m.denominator}.`,`Ausências: ${m.missing}.`],limitacoes:[m.limitations,m.breaks,`Universo: ${m.universe}.`],notas:m.definition})];}));
  const mensal=g.stats.Brasil.monthly;
  const ultimo=[...mensal].reverse().find(r=>r.values.a1.sum!==null);
  const familias:NumeroProps=ultimo?{rotulo:'Famílias em acompanhamento PAIF no último mês do RMA',valor:ultimo.values.a1.sum!,formato:'inteiro',unidade:'famílias (soma declarada)',periodo:`${MESES[ultimo.month-1]} de ${g.year}`,recorte:'Brasil',fonte:'MDS, RMA CRAS 2025',natureza:'CALCULADO',nota:`Soma de ${ultimo.values.a1.observed.toLocaleString('pt-BR')} formulários com valor entre ${ultimo.values.a1.total.toLocaleString('pt-BR')} presentes. Estoque do mês; não se soma no ano.`}:{rotulo:'Famílias em acompanhamento PAIF no último mês do RMA',valor:null,motivoAusencia:'Nenhum mês do RMA tem valor observado para esta medida.',unidade:'famílias',periodo:String(g.year),recorte:'Brasil',fonte:'MDS, RMA CRAS 2025',natureza:'CALCULADO'};
  return <PaginaPainel
    rota={ROTA}
    principal={false}
    idioma="pt"
    abertura={{
      grupo:TEMAS_EFICIENCIA.assistencia.nome,
      acento:'obee',
      titulo:'Atender, acompanhar e dar continuidade.',
      lead:'O PAIF é o Serviço de Proteção e Atendimento Integral à Família, realizado nos CRAS. O PAEFI é o Serviço de Proteção e Atendimento Especializado a Famílias e Indivíduos, realizado nos CREAS.',
      recorte:{periodo:`${g.year}; meses de janeiro a dezembro no RMA`,universo:'CRAS e CREAS respondentes e formulários do RMA CRAS, Brasil e UFs',unidade:'unidades e contagens declaradas',fonte:`${FONTE_SUAS}; RMA CRAS 2025`},
      limite:'que cada pessoa recebeu acompanhamento contínuo: planos e acompanhamento de encaminhamentos são práticas declaradas.',
      fontesDatasSiglas:<FontesSuas extra={<>Registro Mensal de Atendimentos (RMA) dos CRAS de {g.year}, base tratada pelo MDS.</>} siglas={[['PAIF','Serviço de Proteção e Atendimento Integral à Família'],['PAEFI','Serviço de Proteção e Atendimento Especializado a Famílias e Indivíduos'],['CRAS','Centro de Referência de Assistência Social'],['CREAS','Centro de Referência Especializado de Assistência Social'],['RMA','Registro Mensal de Atendimentos']]}/>,
    }}
    numeros={[...numerosSuas([
      {id:'CRAS.q12_14',rotulo:'CRAS com plano de acompanhamento familiar no PAIF',resposta:'Sim',nota:'Prática declarada.'},
      {id:'CREAS.q12_6',rotulo:'CREAS com plano de acompanhamento familiar ou individual no PAEFI',resposta:'Sim',nota:'Prática declarada.'},
    ]),familias]}
    notaNumeros="Respostas e registros declarados pelas próprias unidades. Famílias em acompanhamento são um estoque mensal; somá-las no ano repetiria famílias."
    figuras={<>
      <SerieRma ufs={g.ufs} rota={ROTA} proveniencias={proveniencias} series={Object.fromEntries(Object.entries(g.stats).map(([k,v])=>[k,v.monthly]))}/>
      <FiguraSuasDoPainel ids={IDS} rota={ROTA}/>
    </>}
    metodo={<MetodoSuas ids={IDS} extra={Object.values(rma).map(f=><div key={f.id}>
      <p className="font-medium text-carvao">{f.kind} · {f.name}</p>
      <p>{f.definition}{/[.?!]$/.test(f.definition)?'':'.'} Universo: {f.universe}. Período: {f.period}. Fórmula: {f.formula}. Ausências: {f.missing}. Série: {f.breaks}. Registro: {f.record}.</p>
    </div>)}/>}
  />;
}
