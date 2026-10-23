import type {Metadata} from 'next';
import {PainelPrincipal} from '@/components/observatorios/PainelPrincipal';
import {PaginaServico} from '@/components/eficiencia/saneamento/PaginaServico';
export const dynamic='force-static';
export const metadata:Metadata={"title": "O que acontece depois da coleta? — Saneamento", "alternates": {"canonical": "/eficiencia-estatal/saneamento/residuos"}};
// molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o corpo comum das páginas de serviço; textos e números são os de antes
export default function Pagina(){return <PaginaServico slug="residuos" aviso={<PainelPrincipal rota="/eficiencia-estatal/saneamento/residuos"/>} titulo="O que acontece depois da coleta?"
 lead="A coleta seletiva cria uma rota para separar materiais. A recuperação mede quanto retorna ao ciclo produtivo, enquanto a disposição final acompanha o destino dos rejeitos."
 limite="uma composição do destino dos resíduos: cobertura de coleta seletiva, recuperação e disposição inadequada usam bases diferentes (população, massas e a amostra) e não se somam."
 numeros={["IRS0006", "IRS3010", "IRS3002"]}
 secao={{titulo:"Coleta, recuperação e destino",texto:"Brasil e cinco regiões, conforme os agregados publicados nos relatórios."}}
 explicacao={{titulo:"Três medidas que não formam uma composição",corpo:<p>A cobertura de coleta seletiva é uma medida populacional. A recuperação é uma razão de massas. A disposição inadequada usa a massa coletada e não recuperada na amostra. Esses percentuais não devem ser somados, nem desenhados como partes de uma única barra.</p>}}
/>}
