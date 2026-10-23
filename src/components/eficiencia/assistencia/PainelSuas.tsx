import {dadosAssistencia} from '@/lib/eficiencia/assistencia/dados';
import {provenienciaObee} from '@/lib/eficiencia/proveniencia';
import {DistribuicaoSuas} from './DistribuicaoSuas';
import {FiguraSuas} from './FiguraSuas';
export function PainelSuas({ids}:{ids:string[]}){const g=dadosAssistencia();const metrics=ids.map(id=>g.catalog.find(c=>c.id===id)!);return <DistribuicaoSuas metrics={metrics} ufs={g.ufs} stats={recorteDasMedidas(ids)}/>}

/** Resumo de cada território só para as medidas pedidas: o que vai ao navegador. */
function recorteDasMedidas(ids:string[]){const g=dadosAssistencia();return Object.fromEntries(Object.entries(g.stats).map(([s,v])=>[s,Object.fromEntries(ids.map(id=>[id,v.metrics[id]]))]))}

/** Unidade do catálogo em palavras de leitor (o catálogo usa códigos curtos). */
const UNIDADE:Record<string,string>={binario:'% das respostas observadas',contagem:'contagem declarada pela unidade',dias:'dias'};

/**
 * A mesma distribuição no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), para as páginas da Assistência social que
 * já migraram: a FiguraSuas do kit, com a proveniência de cada medida montada da ficha do catálogo e do manifesto da captura (o arquivo
 * oficial de onde a variável foi lida, a data da captura, a fórmula, as ausências e as limitações declaradas).
 */
export function FiguraSuasDoPainel({ids,rota}:{ids:string[];rota:string}){
  const g=dadosAssistencia();
  const metrics=ids.map(id=>g.catalog.find(c=>c.id===id)!);
  const proveniencias=Object.fromEntries(metrics.map(m=>{
    // o registro começa pelo arquivo baixado ("1_CRAS.zip / ..."): é ele que dá a página oficial da medida
    const f=g.manifest.sources.find(s=>m.record.startsWith(s.file))??g.manifest.sources[0];
    const [orgao,dataset]=m.source.split(' / ');
    return [m.id,provenienciaObee({indicador:`${m.kind} · ${m.name}`,natureza:'CALCULADO',orgao:orgao??m.source,dataset:dataset??m.source,recurso:m.record,url:f.url,unidade:UNIDADE[m.unit]??m.unit,frequencia:m.frequency,inicio:String(g.year),fim:String(g.year),capturadoEm:g.manifest.captured_at,formula:m.formula,transformacoes:[`Numerador: ${m.numerator}.`,`Denominador: ${m.denominator}.`,`Ausências: ${m.missing}.`],limitacoes:[m.limitations,m.breaks,`Universo: ${m.universe}.`],notas:m.definition})];
  }));
  return <FiguraSuas metrics={metrics} ufs={g.ufs} rota={rota} proveniencias={proveniencias} download={{href:'/eficiencia/assistencia-social/unidades.csv',rotulo:'Baixar recorte nacional completo, todas as variáveis (CSV)'}} stats={recorteDasMedidas(ids)}/>;
}
