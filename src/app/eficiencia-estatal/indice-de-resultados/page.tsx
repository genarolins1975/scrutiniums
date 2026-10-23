import {CabecalhoPlataforma} from '@/components/layout/CabecalhoPlataforma';
import type {Metadata} from 'next';
import Link from 'next/link';
import {PaginaPainel, type NumeroProps} from '@/components/painel';
import {PainelIndice} from '@/components/eficiencia/PainelIndice';
import {EscoresServicos} from '@/components/eficiencia/EscoresServicos';
import {DisponibilidadeEscores} from '@/components/eficiencia/DisponibilidadeEscores';
import {indiceNumber, indiceSnapshot} from '@/lib/eficiencia/indice-v4';
import {provenienciaObee} from '@/lib/eficiencia/proveniencia';

export const dynamic = 'force-static';
export const metadata: Metadata = {
  title: 'Índice de resultados das capitais · Síntese das capitais',
  description: 'Edição experimental: posição média de cada capital estadual em sete resultados de 2022, com faixa nos testes de sensibilidade, contribuições e estabilidade de cada par.',
  alternates: {canonical: '/eficiencia-estatal/indice-de-resultados'},
};

const ROTA = '/eficiencia-estatal/indice-de-resultados';

/**
 * Painel da nota experimental. Decisão do dono de 19/10/2026: a entrada mostra
 * só as sete posições do retrato; a nota, a distribuição das 26 capitais e a
 * composição dos escores ficam aqui, com conta.
 *
 * Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): abertura com recorte e limite, os números da edição (que não dependem
 * do par escolhido), a escolha do par e a interface da edição v4 na figura, e a composição dos escores no método.
 */
export default function PaginaIndiceResultados() {
  const d = indiceSnapshot;
  const s = d.summary;
  const notas = d.rows.map(r => r.score);
  const fonte = 'OBEE, sobre IBGE (Censo 2022) e Ipea e FBSP (Atlas da Violência 2024)';
  const periodo = String(d.reference_year);
  const numeros: NumeroProps[] = [
    {rotulo: 'Pares de capitais com a ordem mantida em cada teste', valor: s.pair_status.mantida, formato: 'inteiro', unidade: `de ${s.pairs} pares`, periodo, fonte, natureza: 'CALCULADO', nota: 'Cada família de testes avaliada separadamente.'},
    {rotulo: 'Pares cuja ordem pode inverter', valor: s.pair_status.pode_inverter, formato: 'inteiro', unidade: `de ${s.pairs} pares`, periodo, fonte, natureza: 'CALCULADO'},
    {rotulo: 'Menor e maior nota entre as capitais', valorTexto: `${indiceNumber(Math.min(...notas))} a ${indiceNumber(Math.max(...notas))}`, formato: 'texto', unidade: 'pontos de 0 a 100', periodo, recorte: `${s.cities} capitais`, fonte, natureza: 'CALCULADO', nota: 'A média das capitais é 50 por construção; 50 não é meta.'},
  ];
  // uma proveniência por órgão: o Censo do IBGE (seis tabelas do SIDRA) e o Atlas da Violência
  const ibge = d.indicators.filter(i => i.source.startsWith('IBGE'));
  const atlas = d.indicators.filter(i => !i.source.startsWith('IBGE'));
  const comum = {natureza: 'CALCULADO' as const, unidade: 'pontos de 0 a 100', frequencia: 'Edição única (referência fixa de 2022)', inicio: periodo, fim: periodo, formula: `Posição em cada indicador: ${d.normalization}. Nota: média simples das sete posições, peso 1/7 cada.`, versao: d.edition};
  const proveniencia = provenienciaObee({...comum, indicador: 'Índice de resultados das capitais, edição v4', orgao: 'IBGE', dataset: 'Censo 2022', recurso: ibge.map(i => i.source.replace('IBGE, Censo 2022, ', '')).join(', '), url: ibge[0].source_url, transformacoes: ibge.map(i => `${i.label}: ${i.note}`), limitacoes: [...ibge.map(i => i.precision), 'Faixa metodológica, não intervalo de confiança. Precisão municipal não quantificada.']});
  const complementares = atlas.map(i => ({rotulo: `Sobre este dado: ${i.label}`, p: provenienciaObee({...comum, indicador: i.label, orgao: 'Ipea e FBSP', dataset: 'Atlas da Violência 2024', recurso: i.source, url: i.source_url, transformacoes: [i.note], limitacoes: [i.precision]})}));
  return <>
    <header><CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal" navegacao="sintese" /></header>
    <div className="ed-pagina pt-4">
      <Link href="/eficiencia-estatal" className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline">← Retrato das capitais</Link>
    </div>
    <PaginaPainel
      rota={ROTA}
      idioma="pt"
      abertura={{
        grupo: 'Síntese das capitais',
        acento: 'obee',
        titulo: 'Índice de resultados das capitais',
        lead: `Uma nota de 0 a 100 que resume as sete posições do retrato de ${periodo}. Ela descreve condições de vida dos moradores: não mede eficiência.`,
        recorte: {periodo: `${periodo}, edição experimental v4`, universo: `${s.cities} capitais estaduais, sem o Distrito Federal`, unidade: 'pontos de 0 a 100', fonte: 'IBGE, Censo 2022; Ipea e FBSP, Atlas da Violência 2024'},
        limite: 'quem produziu o resultado; a nota não deve ser lida sem a faixa nos testes de sensibilidade.',
        fontesDatasSiglas: <>
          <p>IBGE, Censo 2022 (SIDRA 10056, 10295, 10330, 6805, 9940 e 9936) · Ipea e FBSP, Atlas da Violência 2024, dados de 2022. Edição {d.edition}, experimental, sem revisão independente.</p>
          <p><span className="font-medium">IBGE:</span> Instituto Brasileiro de Geografia e Estatística. <span className="font-medium">SIDRA:</span> Sistema IBGE de Recuperação Automática. <span className="font-medium">Ipea:</span> Instituto de Pesquisa Econômica Aplicada. <span className="font-medium">FBSP:</span> Fórum Brasileiro de Segurança Pública.</p>
        </>,
      }}
      numeros={numeros}
      notaNumeros="Números da edição, iguais para qualquer par escolhido abaixo. A precisão municipal das fontes não foi quantificada: diferenças pequenas não são diferenças certas."
      figuras={<PainelIndice data={d} rota={ROTA} proveniencia={proveniencia} complementares={complementares}/>}
      metodo={<>
        <p>Como a nota é calculada, a sensibilidade de cada par e o pacote auditável da edição estão na figura, em &quot;Composição, diferença e testes da nota&quot;. Abaixo, o que falta para calcular os escores de serviço da plataforma.</p>
        <details id="atlas-score-method" className="scroll-mt-6 border-y border-linha py-5"><summary className="min-h-[44px] cursor-pointer font-serif text-xl text-carvao">Composição e disponibilidade dos escores</summary><DisponibilidadeEscores/><details className="border-t border-linha py-4"><summary className="min-h-[44px] cursor-pointer font-serif text-lg text-carvao">Consultar regras de cálculo e metodologia experimental</summary><EscoresServicos/></details></details>
      </>}
    />
  </>;
}
