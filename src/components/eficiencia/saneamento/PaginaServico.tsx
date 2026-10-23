import Link from 'next/link';
import type {ReactNode} from 'react';
import {PainelPrincipal} from '@/components/observatorios/PainelPrincipal';
import {FiguraAnalitica,PaginaPainel} from '@/components/painel';
import {Comparacao} from '@/components/eficiencia/saneamento/Comparacao';
import {captura,edicao,fontes,indicadores,referenciaAno,valores} from '@/lib/eficiencia/saneamento/dados';
import {fichaSaneamento,naturezaSaneamento,numeroSaneamento} from '@/lib/eficiencia/saneamento/ficha';
import {ROTA,type Grupo} from '@/lib/eficiencia/saneamento/modelo';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
import {dataBR} from '@/lib/painel/formato';

const SINISA='https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa/resultados-sinisa-2025';

/** A fonte por extenso de todas as páginas do capítulo (a mesma frase do rodapé de antes), no bloco recolhido da abertura e no método. */
export function FonteSaneamento({children}:{children?:ReactNode}){return <p>Fonte: <a className="underline underline-offset-4" href={SINISA}>SINISA 2025, dados de 2024</a>. {children} <Link className="underline underline-offset-4" href={ROTA+'/dados'}>Fontes, universos e downloads.</Link></p>;}

/** A abertura comum: grupo do tema, recorte da edição e as fontes recolhidas; o título, o lead, o universo e o limite são de cada página. */
export function aberturaSaneamento({titulo,lead,universo,limite}:{titulo:string;lead:string;universo:string;limite:string}){
 return {grupo:TEMAS_EFICIENCIA.saneamento.nome,acento:'obee' as const,titulo,lead,limite,
  recorte:{periodo:'referência '+referenciaAno,universo,fonte:edicao+', Ministério das Cidades'},
  fontesDatasSiglas:<><FonteSaneamento/><p>Referência {referenciaAno} · {edicao} · Ministério das Cidades. Captura pela Scrutiniums em {dataBR(captura,'pt')}.</p><p>SINISA: Sistema Nacional de Informações em Saneamento Básico, do Ministério das Cidades.</p></>};
}

export type ServicoSaneamento={
 slug:Grupo;titulo:string;lead:string;
 /** Os três números do Brasil (indicadores do SINISA) e o complemento da nota de cada um. */
 numeros:[string,string,string];complementoNumero?:string;
 /** A nota que vinha em destaque depois dos números (o universo e o que os números não são). */
 notaNumeros?:ReactNode;
 /** O título e a frase da seção da comparação, agora a pergunta e o subtítulo da figura. */
 secao:{titulo:string;texto:string};
 /** A seção explicativa do fim da página, agora logo depois da figura. */
 explicacao:{titulo:string;corpo:ReactNode};
 limite:string;
};

/**
 * Uma página de serviço do saneamento no OBEE (água, esgoto, resíduos, drenagem e recursos) no molde de painel (Iniciativa 1 do parecer
 * de UX de 23/10/2026): o corpo é o mesmo para as cinco. A abertura traz a pergunta, o lead, o recorte da edição e o limite; o aviso do
 * painel principal da coleção Saneamento fica logo abaixo; os três números do Brasil vão para o NumeroIndicador, com a nota que vinha em
 * destaque; a comparação territorial (Comparacao, já no kit) vira a figura, com a ficha do SINISA, e a seção explicativa vem logo depois
 * dela. A fonte por extenso fica no bloco recolhido e no método. Nenhum texto, número ou arredondamento mudou.
 */
export function PaginaServico({slug,titulo,lead,numeros,complementoNumero='',notaNumeros,secao,explicacao,limite}:ServicoSaneamento){
 const medidas=indicadores.filter(m=>m.grupo===slug);const dados=valores.filter(r=>medidas.some(m=>m.id===r.indicador));
 const comUf=dados.some(r=>r.tipo==='UF');
 // a figura mostra uma medida por vez (escolhida no controle): a ficha principal é a das medidas publicadas pela fonte e, quando o grupo
 // tem razões calculadas pelo OBEE (por residente), elas ganham ficha própria, com o selo de calculado
 const observadas=medidas.filter(m=>naturezaSaneamento(m)==='OBSERVADO').map(m=>m.id);const calculadas=medidas.filter(m=>naturezaSaneamento(m)==='CALCULADO').map(m=>m.id);
 const fonteIds=[...new Set(medidas.map(m=>m.fonte))];const arquivos=fonteIds.map(id=>fontes.find(f=>f.id===id)!);
 return <PaginaPainel rota={ROTA+'/'+slug} principal={false} idioma="pt"
  abertura={aberturaSaneamento({titulo,lead,limite,universo:comUf?'Brasil, cinco regiões e 27 UFs':'Brasil e cinco regiões'})}
  aviso={<PainelPrincipal rota={ROTA+'/'+slug}/>}
  // "Brasil, 2024." da nota de antes é a linha de recorte e período do próprio número; a nota guarda a base e o complemento
  numeros={numeros.map(id=>numeroSaneamento(id,indicadores.find(m=>m.id===id)!.base+complementoNumero))}
  notaNumeros={notaNumeros}
  figuras={<FiguraAnalitica id="comparacao" idioma="pt" pergunta={secao.titulo} subtitulo={'Indicador escolhido · unidade de cada indicador · '+(comUf?'27 UFs ou cinco regiões':'Brasil e cinco regiões')+', '+referenciaAno}
   natureza={observadas.length?'OBSERVADO':'CALCULADO'} proveniencia={fichaSaneamento(observadas.length?observadas:calculadas)}
   complementares={observadas.length&&calculadas.length?[{rotulo:'Sobre as razões por residente',p:fichaSaneamento(calculadas,'CALCULADO')}]:[]}
   comoInterpretar={secao.texto}
   naoConcluir="Comparar valores não identifica, por si só, o efeito de uma gestão. Os indicadores não são notas de eficiência: universos, elegibilidade e denominadores variam por indicador."
   tabela={{naFigura:'logo abaixo do gráfico, com valor, numerador, denominador e origem de cada território no indicador escolhido.'}}
   depois={<section aria-labelledby={'explica-'+slug} className="space-y-3"><h3 id={'explica-'+slug} className="t-h3 text-carvao">{explicacao.titulo}</h3><div className="t-corpo max-w-prose2 space-y-3 text-carvao-muted">{explicacao.corpo}</div></section>}>
   <Comparacao medidas={medidas} dados={dados} fontes={fontes}/>
  </FiguraAnalitica>}
  metodo={<><FonteSaneamento/><p>Os indicadores oficiais já consolidados são preservados; não são recalculados a partir de totais com elegibilidade diferente. Ano de referência: {referenciaAno}; edição: {edicao}. Captura pela Scrutiniums em {dataBR(captura,'pt')}.</p>
   <ul className="space-y-1">{arquivos.map(f=><li key={f.id} className="[overflow-wrap:anywhere]"><a className="underline underline-offset-4" href={f.url}>{f.arquivo}</a>, SHA-256 <span className="break-all">{f.sha256}</span></li>)}</ul>
   <p>Universos, divergências e o dicionário dos indicadores em <Link className="underline underline-offset-4" href={ROTA+'/dados'}>Dados e métodos</Link>.</p></>}
 />;
}
