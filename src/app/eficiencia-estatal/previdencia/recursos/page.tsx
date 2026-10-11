import type {Metadata} from 'next';
import {Abertura,Nota} from '@/components/eficiencia/previdencia/Editoria';
import {Comparacao} from '@/components/eficiencia/previdencia/Comparacao';
import {ROTA} from '@/lib/eficiencia/previdencia/dados';
export const dynamic='force-static';
export const metadata:Metadata={title:'Previdência — valores emitidos',alternates:{canonical:ROTA+'/recursos'}};
export default function Pagina(){return <><Abertura numero="04" titulo="Que valores foram emitidos para pagamento?" texto="Compare créditos emitidos em dezembro, o acumulado anual e a razão por benefício emitido no mesmo mês. Valores em reais correntes, sem ajuste pela inflação."/><Nota>Os valores da fonte consideram descontos, inclusive consignado. Não equivalem à renda bruta, à despesa orçamentária, ao financiamento do RGPS ou ao custo de prestar o serviço. Diferenças entre anos são nominais.</Nota><Comparacao ids={['dezembro','anual','medio']}/></>}
