import type {Metadata} from 'next';
import {PaginaServico} from '@/components/eficiencia/saneamento/PaginaServico';
export const dynamic='force-static';
export const metadata:Metadata={"title": "Infraestrutura, exposição e impactos. — Saneamento", "alternates": {"canonical": "/eficiencia-estatal/saneamento/drenagem"}};
// molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o corpo comum das páginas de serviço; textos e números são os de antes
export default function Pagina(){return <PaginaServico slug="drenagem" titulo="Infraestrutura, exposição e impactos."
 lead="A drenagem envolve condução, retenção e infiltração da água da chuva. A existência de redes subterrâneas é apenas uma parte do sistema; chuvas, ocupação do solo e condições locais também afetam os impactos."
 limite="ocorrências nem o total de pessoas afetadas: domicílios em risco são exposição declarada, a população impactada considera desabrigados e desalojados, e as contagens não substituem os registros do S2ID."
 numeros={["IAP0002", "DOM_RISCO", "IGR0002"]}
 secao={{titulo:"Como as regiões se comparam?",texto:"Agregados do relatório de águas pluviais; declarações referentes a 2024."}}
 explicacao={{titulo:"Risco não é ocorrência",corpo:<p>Os domicílios em risco descrevem exposição identificada pelos municípios. O indicador de população impactada considera desabrigados e desalojados declarados; não todas as pessoas afetadas. As contagens não substituem os registros do S2ID ou uma avaliação de risco local.</p>}}
/>}
