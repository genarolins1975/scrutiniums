import type {Metadata} from 'next';
import {PainelAreas} from '@/components/contas-publicas/areas/PainelAreas';
import {MarcaVisita} from '@/components/telemetria/MarcaVisita';
import {ROTA_AREAS,lerRecorte} from '@/lib/contas-publicas/areas';

/**
 * Painel "Para onde vai o dinheiro federal, por área?" (autorizado pelo dono em 20/10/2026): complemento do capítulo
 * Panorama, que responde à metade "para onde vão" da pergunta dele com a classificação funcional do SIOP. Rota com
 * conta (não consta de src/lib/rotasPublicas.ts). O recorte (exercício, estágio, base e área) vive na URL e é lido no
 * servidor: a base por subfunção de 2000 em diante não vai para o navegador.
 *
 * No molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), dentro deste <main>, que é o destino do "Ir para o
 * conteúdo" do layout das Contas Federais (#conteudo-contas). O botão "Compartilhar recorte" saiu (seção 4.7 do prompt da
 * Iniciativa 1: o "Salvar recorte" da barra é o único), e o link para o Panorama passou para o método.
 */
export const metadata:Metadata={title:'Para onde vai o dinheiro federal, por área?',description:'Cada R$ 100 pagos pelo orçamento da União por área de governo, com a dívida pública à parte, de 2000 ao ano corrente, pelos dados abertos do SIOP.',alternates:{canonical:ROTA_AREAS}};

export default function Page({searchParams}:{searchParams:Record<string,string|string[]|undefined>}){
 const r=lerRecorte(searchParams);
 return <main id="conteudo-contas" tabIndex={-1}>
  <MarcaVisita secao="contas:por-area"/>
  <PainelAreas r={r}/>
 </main>;
}
