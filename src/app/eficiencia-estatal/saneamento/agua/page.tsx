import type {Metadata} from 'next';
import {PaginaServico} from '@/components/eficiencia/saneamento/PaginaServico';
export const dynamic='force-static';
export const metadata:Metadata={"title": "Onde a água chega por rede? — Saneamento", "alternates": {"canonical": "/eficiencia-estatal/saneamento/agua"}};
// molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o corpo comum das páginas de serviço; textos e números são os de antes
export default function Pagina(){return <PaginaServico slug="agua" titulo="Onde a água chega por rede?"
 lead="Atendimento, medição, perdas e duração das interrupções descrevem etapas diferentes do serviço. A ligação à rede, sozinha, não assegura fornecimento contínuo nem comprova potabilidade."
 limite="que a ligação à rede assegura fornecimento contínuo ou comprova potabilidade. Soluções individuais e alternativas não equivalem a atendimento por rede, e os indicadores não são notas de eficiência."
 numeros={["IAG0001", "IAG2013", "IAG3004"]}
 notaNumeros="Os universos dos módulos de água e esgoto são diferentes. Soluções individuais e alternativas não equivalem a atendimento por rede. Os indicadores não são notas de eficiência."
 secao={{titulo:"Acesso e operação",texto:"27 UFs e cinco regiões. As regras de elegibilidade variam por indicador."}}
 explicacao={{titulo:"O que significa perder água?",corpo:<p>O indicador de perdas inclui volumes que se perdem fisicamente e diferenças de medição ou contabilização. Não permite atribuir todo o percentual a vazamentos, nem converter automaticamente o volume em uma medida de perda financeira.</p>}}
/>}
