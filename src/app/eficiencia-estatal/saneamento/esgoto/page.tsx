import type {Metadata} from 'next';
import {PaginaServico} from '@/components/eficiencia/saneamento/PaginaServico';
export const dynamic='force-static';
export const metadata:Metadata={"title": "Coletar e tratar são etapas diferentes. — Saneamento", "alternates": {"canonical": "/eficiencia-estatal/saneamento/esgoto"}};
// molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o corpo comum das páginas de serviço; textos e números são os de antes
export default function Pagina(){return <PaginaServico slug="esgoto" titulo="Coletar e tratar são etapas diferentes."
 lead="O alcance da rede e o destino do volume coletado respondem a perguntas distintas. Tratar grande parte do que é coletado não significa que toda a população esteja conectada."
 limite="quantas pessoas ficam sem tratamento: os dois percentuais de tratamento têm denominadores diferentes e não se subtraem, e tratar grande parte do que é coletado não significa que toda a população esteja conectada."
 numeros={["IES0001", "IES2003", "IES2004"]}
 notaNumeros="Os universos dos módulos de água e esgoto são diferentes. Soluções individuais e alternativas não equivalem a atendimento por rede. Os indicadores não são notas de eficiência."
 secao={{titulo:"Da rede ao tratamento",texto:"Compare separadamente população atendida e volumes tratados."}}
 explicacao={{titulo:"Dois denominadores para o tratamento",corpo:<p>O IES2003 usa água consumida como referência. O IES2004 usa esgoto coletado. As parcelas de importação e exportação seguem fórmulas próprias. Não subtraia os dois percentuais para estimar pessoas sem tratamento.</p>}}
/>}
