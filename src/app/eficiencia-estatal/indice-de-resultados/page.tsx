import {CabecalhoPlataforma} from '@/components/layout/CabecalhoPlataforma';
import type {Metadata} from 'next';
import Link from 'next/link';
import {PainelIndice} from '@/components/eficiencia/PainelIndice';
import {EscoresServicos} from '@/components/eficiencia/EscoresServicos';
import {DisponibilidadeEscores} from '@/components/eficiencia/DisponibilidadeEscores';
import {indiceSnapshot} from '@/lib/eficiencia/indice-v4';

export const dynamic = 'force-static';
export const metadata: Metadata = {
  title: 'Índice de resultados das capitais · Síntese das capitais',
  description: 'Edição experimental: posição média de cada capital estadual em sete resultados de 2022, com faixa nos testes de sensibilidade, contribuições e estabilidade de cada par.',
  alternates: {canonical: '/eficiencia-estatal/indice-de-resultados'},
};

/**
 * Painel da nota experimental. Decisão do dono de 19/10/2026: a entrada mostra
 * só as sete posições do retrato; a nota, a distribuição das 26 capitais e a
 * composição dos escores ficam aqui, com conta.
 */
export default function PaginaIndiceResultados() {
  return <><header><CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal" navegacao="sintese" /></header><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-6 sm:px-6">
    <Link href="/eficiencia-estatal" className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline">← Retrato das capitais</Link>
    <header className="border-b border-linha py-7">
      <p className="font-label text-xs uppercase tracking-label text-obee-dark">Eficiência Estatal · Edição experimental</p>
      <h1 className="mt-4 max-w-[900px] font-serif text-4xl leading-tight md:text-5xl">Índice de resultados das capitais</h1>
      <p className="mt-5 max-w-prose2 text-lg leading-relaxed text-carvao-muted">Uma nota de 0 a 100 que resume as sete posições do retrato de 2022. Ela descreve condições de vida dos moradores: não mede eficiência, não identifica quem produziu o resultado e não deve ser lida sem a faixa nos testes de sensibilidade.</p>
    </header>
    <div className="pt-7"><PainelIndice data={indiceSnapshot}/></div>
    <details id="atlas-score-method" className="mt-10 scroll-mt-6 border-y border-linha py-5"><summary className="min-h-[44px] cursor-pointer font-serif text-xl">Composição e disponibilidade dos escores</summary><DisponibilidadeEscores/><details className="border-t border-linha py-4"><summary className="min-h-[44px] cursor-pointer font-serif text-lg">Consultar regras de cálculo e metodologia experimental</summary><EscoresServicos/></details></details>
  </main></>;
}
