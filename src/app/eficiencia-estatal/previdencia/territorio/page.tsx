import type {Metadata} from 'next';
import {Abertura,Nota} from '@/components/eficiencia/previdencia/Editoria';
import {Comparacao} from '@/components/eficiencia/previdencia/Comparacao';
import {ROTA} from '@/lib/eficiencia/previdencia/dados';
export const dynamic='force-static';
export const metadata:Metadata={title:'Previdência — benefícios por território',alternates:{canonical:ROTA+'/territorio'}};
export default function Pagina(){return <><Abertura numero="03" titulo="Onde se concentram as emissões e as concessões?" texto="Compare volumes nas 27 UFs e nas cinco regiões, com a referência nacional. Selecione ano e clientela para manter a mesma definição em todos os territórios."/><Nota>Volumes absolutos dependem do tamanho e da estrutura demográfica do território. Não são taxa de cobertura de moradores, demanda elegível ou classificação de desempenho.</Nota><Comparacao ids={['emitidos','concedidos']}/></>}
