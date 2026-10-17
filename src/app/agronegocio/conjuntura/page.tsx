import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dadosAgro } from '@/lib/agro/dados';
import { AberturaAgro, SecaoAgro } from '@/components/agro/Editorial';
import { ConjunturaAgro, PerguntasAgro } from '@/components/agro/Economia';
export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Como vai o negócio neste ano?', description: 'Safra estimada, crescimento trimestral, exportações do ano e crédito rural, com fonte e período de cada número.', alternates: { canonical: '/agronegocio/conjuntura' } };
export default function PaginaConjunturaAgro() {
    const e = dadosAgro.economia;
    if (!e)
        notFound();
    return <><AberturaAgro rotulo="Agronegócio / Pergunta 2" titulo="Como vai o negócio neste ano?" texto="Safra, ritmo da produção, exportações e crédito: quatro termômetros com calendários diferentes, lidos lado a lado."/><ConjunturaAgro dados={dadosAgro} e={e}/><SecaoAgro titulo="As outras perguntas sobre o setor."><PerguntasAgro e={e} atual="conjuntura"/></SecaoAgro></>;
}
