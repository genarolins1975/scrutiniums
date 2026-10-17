import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dadosAgro } from '@/lib/agro/dados';
import { AberturaAgro, SecaoAgro } from '@/components/agro/Editorial';
import { MercadosAgro, PerguntasAgro } from '@/components/agro/Economia';
export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Para quem vendemos e de quem dependemos?', description: 'Composição e destinos das exportações agro e origem dos fertilizantes importados, por país.', alternates: { canonical: '/agronegocio/mercados' } };
export default function PaginaMercadosAgro() {
    const e = dadosAgro.economia;
    if (!e)
        notFound();
    return <><AberturaAgro rotulo="Agronegócio / Pergunta 4" titulo="Para quem vendemos e de quem dependemos?" texto="O que o agro exporta, para quais países e de onde vêm os fertilizantes. Concentração descreve o ano observado; não prevê o próximo."/><MercadosAgro dados={dadosAgro} e={e}/><SecaoAgro titulo="As outras perguntas sobre o setor."><PerguntasAgro e={e} atual="mercados"/></SecaoAgro></>;
}
