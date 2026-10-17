import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dadosAgro } from '@/lib/agro/dados';
import { AberturaAgro, SecaoAgro } from '@/components/agro/Editorial';
import { InsumosAgro, PerguntasAgro } from '@/components/agro/Economia';
export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Quanto custa produzir?', description: 'Fertilizantes e defensivos importados, valor médio por tonelada e relação de troca com a soja exportada.', alternates: { canonical: '/agronegocio/insumos' } };
export default function PaginaInsumosAgro() {
    const e = dadosAgro.economia;
    if (!e)
        notFound();
    return <><AberturaAgro rotulo="Agronegócio / Pergunta 3" titulo="Quanto custa produzir?" texto="O comércio exterior registra quanto o país importou de fertilizantes e defensivos, a que valor médio por tonelada e quanta soja exportada isso representa."/><InsumosAgro dados={dadosAgro} e={e}/><SecaoAgro titulo="As outras perguntas sobre o setor."><PerguntasAgro e={e} atual="insumos"/></SecaoAgro></>;
}
