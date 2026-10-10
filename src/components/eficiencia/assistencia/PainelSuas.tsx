import {dadosAssistencia} from '@/lib/eficiencia/assistencia/dados';
import {DistribuicaoSuas} from './DistribuicaoSuas';
export function PainelSuas({ids}:{ids:string[]}){const g=dadosAssistencia();const metrics=ids.map(id=>g.catalog.find(c=>c.id===id)!);return <DistribuicaoSuas metrics={metrics} ufs={g.ufs} stats={Object.fromEntries(Object.entries(g.stats).map(([s,v])=>[s,Object.fromEntries(ids.map(id=>[id,v.metrics[id]]))]))}/>}
