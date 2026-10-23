import type {Metadata} from 'next';
import {PainelPrincipal} from '@/components/observatorios/PainelPrincipal';
import Link from 'next/link';
import {FonteSaneamento,aberturaSaneamento} from '@/components/eficiencia/saneamento/PaginaServico';
import {PaginaPainel,TabelaDados} from '@/components/painel';
import {captura,cobertura,edicao,indicador,referenciaAno} from '@/lib/eficiencia/saneamento/dados';
import {numeroSaneamento} from '@/lib/eficiencia/saneamento/ficha';
import {ROTA} from '@/lib/eficiencia/saneamento/modelo';
import {dataBR} from '@/lib/painel/formato';
export const dynamic='force-static';
export const metadata:Metadata={title:'Saneamento — panorama',alternates:{canonical:ROTA}};

const SERVICOS=[['agua','Água','Quem está conectado à rede? Como se medem volumes, perdas e interrupções?'],['esgoto','Esgoto','Qual é o alcance da coleta e quanto do volume é tratado?'],['residuos','Resíduos','Onde há coleta seletiva? Quanto se recupera e qual é a destinação?'],['drenagem','Drenagem','Que infraestrutura está declarada e qual exposição foi identificada?']];
const link='text-obee-dark underline underline-offset-4';

/**
 * Panorama do saneamento no OBEE no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a abertura com a pergunta, o recorte da
 * edição e o limite que vinha na nota; os três números do Brasil no NumeroIndicador; os quatro serviços e os recursos como navegação do
 * tema, logo depois dos números; a participação declarada por módulo na tabela do kit, à vista. O layout do tema já abre o <main>.
 */
export default function Pagina(){return <PaginaPainel rota={ROTA} principal={false} idioma="pt"
 abertura={aberturaSaneamento({titulo:'Da água que chega ao destino dos resíduos.',universo:'Brasil, cinco regiões e 27 UFs',
  lead:'Saneamento reúne serviços com redes, operações e universos próprios. Este capítulo acompanha acesso, funcionamento, destino e recursos declarados, com referências territoriais e limites de comparação.',
  limite:'uma nota de saneamento nem a eficiência de um governo: os três percentuais têm denominadores diferentes e não medem isoladamente a gestão.'})}
 aviso={<PainelPrincipal rota="/eficiencia-estatal/saneamento"/>}
 numeros={['IAG0001','IES0001','IAP0002'].map(id=>numeroSaneamento(id,indicador(id).base))}
 notaNumeros="Os três percentuais têm denominadores diferentes. Não formam uma nota de saneamento nem medem isoladamente a eficiência de um governo."
 navegacaoLocal={<nav aria-labelledby="quatro-servicos" className="mt-8">
  <h2 id="quatro-servicos" className="rotulo text-mineral">Quatro serviços, perguntas diferentes.</h2>
  <p className="t-meta mt-1 max-w-prose2 text-carvao-muted">Escolha uma etapa para examinar os indicadores, as comparações territoriais e os arquivos de dados.</p>
  <ul className="mt-2 grid gap-x-12 md:grid-cols-2">{SERVICOS.map(([slug,titulo,texto])=><li key={slug} className="border-b border-linha py-4"><h3 className="t-h3"><Link className={link} href={ROTA+'/'+slug}>{titulo} →</Link></h3><p className="t-meta mt-2 text-carvao-muted">{texto}</p></li>)}</ul>
  <div className="mt-6 max-w-prose2"><h3 className="t-h3 text-carvao">Recursos e serviços na mesma leitura.</h3><p className="t-meta mt-2 text-carvao-muted">Despesas e investimentos de água e esgoto estão disponíveis em valores totais e por residente. O recorte reúne prestadores de diferentes naturezas jurídicas e não corresponde apenas ao gasto público. As diferenças de acesso, operação e território precisam acompanhar qualquer interpretação financeira.</p><Link className={'mt-2 inline-flex min-h-[44px] items-center text-sm '+link} href={ROTA+'/recursos'}>Comparar recursos declarados →</Link></div>
 </nav>}
 tabelas={<TabelaDados recolhida={false} idioma="pt" id="participacao" tituloVisivel="O que os municípios informaram?" lead="Participação declarada nos relatórios, referência 2024. A população representada na coleta não é a população atendida pelo serviço."
  titulo="Cobertura da coleta SINISA 2025" colunas={['Módulo','Municípios','População representada']} linhas={cobertura.map(c=>[c.modulo,c.municipios,c.populacao])} casas={[null,0,0]} limite={cobertura.length}
  nota={<>A planilha consolidada de esgoto publica uma população diferente da apresentada no relatório de participação. As duas referências estão identificadas em <Link className={link} href={ROTA+'/dados'}>Dados e métodos</Link>. A elegibilidade também pode variar de indicador para indicador. Relatórios: Água, p. 17; Esgoto, p. 17; Resíduos, p. 18; Águas Pluviais, p. 17.</>}/>}
 metodo={<><FonteSaneamento>Relatórios: Água, p. 17; Esgoto, p. 17; Resíduos, p. 18; Águas Pluviais, p. 17.</FonteSaneamento><p>Referência {referenciaAno} · {edicao} · Ministério das Cidades. Captura pela Scrutiniums em {dataBR(captura,'pt')}. Água e esgoto: Brasil, cinco regiões e 27 UFs; resíduos e drenagem: Brasil e cinco regiões.</p></>}
/>}
