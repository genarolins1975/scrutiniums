import type {Metadata} from 'next';
import Link from 'next/link';
import {BarrasCobertura,ConsultaComarcas} from '@/components/eficiencia/justica/Exploradores';
import {FiguraAnalitica,PaginaPainel} from '@/components/painel';
import {Recolhido} from '@/components/observatorios/Recolhido';
import {dadosJustica as d,coberturaJustica as c} from '@/lib/eficiencia/justica/dados';
import {FONTE_DEFENSORIA,fichaJustica} from '@/lib/eficiencia/justica/molde';
import {n,ROTA_JUSTICA} from '@/lib/eficiencia/justica/modelo';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
import {dataBR} from '@/lib/painel/formato';
export const dynamic='force-static';
export const metadata:Metadata={title:'Cobertura territorial da assistência jurídica',alternates:{canonical:ROTA_JUSTICA+'/cobertura'}};
/**
 * Cobertura territorial no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a comparação por UF é a figura, com as barras
 * de composição de domínio (marcadas como legado) e a tabela do kit; a consulta das comarcas segue à vista na fatia de tabelas, num bloco
 * aberto; a nota de leitura vira o limite e fica inteira no método.
 */
export default function Pagina(){
 const ficha=fichaJustica('defensoria',{indicador:'Comarcas e população residente por situação de atendimento da Defensoria, por UF',natureza:'CALCULADO',unidade:'comarcas; pessoas; % do total da UF',inicio:d.coberturaEm,fim:d.coberturaEm,recurso:'Aba Comarcas, colunas A a I; população estimada de 2024 da própria base',formula:'Comarcas (ou moradores) em cada situação ÷ total da UF × 100',limitacoes:['População residente em comarca coberta não é população atendida.','A atuação parcial não é equiparada à regular.','A rede da Defensoria Pública da União não está somada a este recorte.']});
 return <PaginaPainel rota={ROTA_JUSTICA+'/cobertura'} principal={false}
  abertura={{grupo:TEMAS_EFICIENCIA.justica.nome,acento:'obee',titulo:'Onde a assistência jurídica está presente?',
   lead:'A base distingue atuação regular, atendimento parcial ou excepcional e comarcas sem atendimento pela Defensoria Pública estadual ou do Distrito Federal. É um retrato da oferta territorial declarada.',
   recorte:{periodo:'cobertura em '+dataBR(d.coberturaEm,'pt')+' · população estimada de 2024',universo:`27 UFs, ${n(d.comarcas.length)} comarcas`,unidade:'comarcas e moradores',fonte:FONTE_DEFENSORIA},
   limite:'que a população residente em comarca coberta seja atendida: a atuação parcial não é equiparada à regular, e a rede própria da Defensoria Pública da União não está somada.'}}
  numeros={[
   {rotulo:'Comarcas na base',valor:d.comarcas.length,formato:'inteiro',unidade:'comarcas',periodo:dataBR(d.coberturaEm,'pt'),fonte:FONTE_DEFENSORIA,natureza:'OBSERVADO',nota:'Circunscrições judiciais; uma comarca pode reunir mais de um município.'},
   {rotulo:'UFs com todas as comarcas regulares',valor:c.filter(r=>r.regular===r.total).length,formato:'inteiro',unidade:'UFs',periodo:dataBR(d.coberturaEm,'pt'),fonte:FONTE_DEFENSORIA,natureza:'CALCULADO',nota:'Critério: número de comarcas regulares igual ao total da UF.'},
   {rotulo:'Comarcas sem atendimento da Defensoria',valor:c.reduce((a,r)=>a+r.sem,0),formato:'inteiro',unidade:'comarcas',periodo:dataBR(d.coberturaEm,'pt'),fonte:FONTE_DEFENSORIA,natureza:'CALCULADO',nota:'A fonte não cobre integralmente advogados dativos, núcleos universitários ou assistência privada.'},
  ]}
  figuras={<FiguraAnalitica id="por-uf" pergunta="Como a cobertura varia entre as UFs?" subtitulo="Comarcas ou moradores por situação de atendimento · % do total da UF · 27 UFs" natureza="CALCULADO" idioma="pt" proveniencia={ficha}
   comoInterpretar="Escolha comparar comarcas (cada uma com o mesmo peso) ou moradores nas comarcas (população estimada de 2024). O valor à direita de cada barra é a participação com atendimento regular."
   naoConcluir="População residente em comarca coberta não é população atendida, e a presença declarada não mede elegibilidade nem demanda satisfeita; a atuação parcial não equivale à regular."
   ressalva="A Defensoria Pública da União tem uma rede de seções e subseções federais própria e não está somada a este recorte."
   tabela={{naFigura:'logo abaixo das barras, com as contagens e os denominadores de cada UF na unidade escolhida.'}}>
   <BarrasCobertura dados={c}/>
  </FiguraAnalitica>}
  tabelas={<Recolhido id="comarcas" aberto nivelTitulo={2} titulo="Consulte cada comarca." resumo="A consulta opera sobre toda a base. O download leva todas as linhas do recorte, incluindo as que estão nas páginas seguintes.">
   <div className="pb-6"><ConsultaComarcas dados={d.comarcas}/></div>
  </Recolhido>}
  metodo={<><p>Fonte: {FONTE_DEFENSORIA}, base “Comarcas”, linhas preservadas no CSV. População estimada de 2024 da própria base.</p><p>População residente em comarca coberta não é população atendida. A atuação parcial não é equiparada à regular. A Defensoria Pública da União tem uma rede de seções e subseções federais própria e não está somada a este recorte.</p><p>Fontes, recortes, hashes e arquivos em <Link className="underline" href={ROTA_JUSTICA+'/dados'}>Dados e métodos</Link>.</p></>}
 />;
}
