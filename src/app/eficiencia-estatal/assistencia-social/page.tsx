import type {Metadata} from 'next';
import Link from 'next/link';
import {PaginaPainel, type NumeroProps} from '@/components/painel';
import {dadosAssistencia} from '@/lib/eficiencia/assistencia/dados';
import {EscoresServicos} from '@/components/eficiencia/EscoresServicos';
import {FONTE_SUAS, FiguraSuasDoPainel, FontesSuas, MetodoSuas} from '@/components/eficiencia/assistencia/PainelSuas';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
import {dataBr} from '@/lib/eficiencia/formato';
import { tituloNaColecao } from "@/lib/observatorios/contexto";
export const dynamic='force-static';
export const metadata:Metadata={title:tituloNaColecao('Assistência social e cuidado','/eficiencia-estatal/assistencia-social'),description:'Rede SUAS, acompanhamento familiar e cuidado: dados oficiais, consulta por unidade e critérios de qualidade dos serviços públicos.',alternates:{canonical:'/eficiencia-estatal/assistencia-social'}};

const ROTA='/eficiencia-estatal/assistencia-social';
const IDS=['CRAS.q34','CRAS.q9_1','CREAS.q9_1','DIA.q15_1'];
const TIPOS=[['CRAS','Apoio e acompanhamento familiar'],['CREAS','Proteção especializada'],['DIA','Centros-dia e modalidades similares']] as const;
const CAPITULOS=[['necessidades','Quem precisa de apoio?','Contexto social e limites da demanda elegível.'],['acesso','Quais barreiras a rede declara?','Acessibilidade, horários e espera para o Cadastro Único.'],['acompanhamento','Existe acompanhamento das famílias?','PAIF, PAEFI e registros mensais dos CRAS.'],['cuidado','Como idosos e pessoas com deficiência são apoiados?','Oferta no domicílio, volumes de agosto e centros-dia.'],['recursos','Qual é a capacidade disponível?','Vínculos de trabalho, horários e natureza das unidades.'],['dados','O que cada unidade informou?','Consulta por UF, município, unidade e variável.'],['metodos','Como os dados foram preparados?','Dicionário, originais, tratamento e memória do escore.']] as const;

/**
 * Panorama da Assistência social no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta, as unidades respondentes
 * de cada tipo de rede (com as regionais, as estaduais e os questionários completos na nota de cada número), os sete capítulos do tema
 * como navegação, as respostas da rede por território e o método. A proposta de escores do capítulo segue logo depois do painel, como na
 * Saúde e em Trabalho e renda, no <main> do layout.
 */
export default function Panorama(){
  const g=dadosAssistencia();
  const counts=g.stats.Brasil.counts;
  // contagem das unidades respondentes de cada questionário, feita pelo OBEE sobre os registros do Censo: natureza calculada
  const numeros:NumeroProps[]=TIPOS.map(([k,n])=>({rotulo:`${k} · ${n}`,valor:counts[k].total,formato:'inteiro',unidade:'unidades respondentes',periodo:String(g.year),recorte:'Brasil',fonte:FONTE_SUAS,natureza:'CALCULADO',nota:`${counts[k].regional?`${counts[k].regional} regionais incluídas · `:''}${counts[k].state?`${counts[k].state} estaduais incluídas · `:''}${counts[k].complete.toLocaleString('pt-BR')} com questionário completo`}));
  return <>
    <PaginaPainel
      rota={ROTA}
      principal={false}
      idioma="pt"
      abertura={{
        grupo:TEMAS_EFICIENCIA.assistencia.nome,
        acento:'obee',
        titulo:'Quando a pessoa precisa, o apoio público chega?',
        lead:'Proteção às famílias, acompanhamento especializado e cuidado a pessoas com deficiência e idosas.',
        recorte:{periodo:`${g.year}, capturado em ${dataBr(g.manifest.captured_at)}`,universo:'unidades CRAS, CREAS e centros-dia respondentes, Brasil e UFs',unidade:'unidades e respostas declaradas',fonte:FONTE_SUAS},
        limite:'a qualidade do serviço. A rede declarada e o volume de atendimento ajudam a examinar a oferta; a qualidade do serviço exige acesso efetivo, continuidade, segurança e experiência de quem precisa.',
        fontesDatasSiglas:<FontesSuas siglas={[['CRAS','Centro de Referência de Assistência Social'],['CREAS','Centro de Referência Especializado de Assistência Social'],['DIA','Centro-dia e modalidades similares'],['SUAS','Sistema Único de Assistência Social']]}/>,
      }}
      numeros={numeros}
      notaNumeros="Recorte de 2025, capturado em 10/10/2026; não representa a situação atual da rede. Centros-dia e similares incluem unidades governamentais e organizações da sociedade civil; não se presume financiamento público. A UF de unidades regionais ou estaduais não define todos os territórios atendidos. Ausência de resposta não é ausência de serviço."
      navegacaoLocal={<nav aria-labelledby="da-necessidade-ao-cuidado" className="mt-8">
        <h2 id="da-necessidade-ao-cuidado" className="t-h2 text-carvao">Da necessidade ao cuidado.</h2>
        <ul className="mt-2 grid gap-x-12 md:grid-cols-2">{CAPITULOS.map(([r,n,t])=><li key={r} className="border-b border-linha py-4"><h3 className="t-h3"><Link href={`${ROTA}/${r}`} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">{n} →</Link></h3><p className="t-meta mt-1 text-carvao-muted">{t}</p></li>)}</ul>
      </nav>}
      figuras={<FiguraSuasDoPainel ids={IDS} rota={ROTA}/>}
      metodo={<MetodoSuas ids={IDS}/>}
    />
    <EscoresServicos capitulo="assistance"/>
  </>;
}
