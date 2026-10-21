import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dadosAgro } from '@/lib/agro/dados';
import { AberturaAgro, SecaoAgro } from '@/components/agro/Editorial';
import { TamanhoAgro, PerguntasAgro } from '@/components/agro/Economia';
export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Qual o tamanho do agro na economia?', description: 'Participação da agropecuária no valor adicionado, crescimento em volume e peso nas exportações, com dados do IBGE e do Comex Stat.', alternates: { canonical: '/agronegocio/tamanho' } };
export default function PaginaTamanhoAgro() {
    const e = dadosAgro.economia;
    if (!e)
        notFound();
    return <><AberturaAgro rotulo="Agronegócio / Pergunta 1" titulo="Qual o tamanho do agro na economia?" texto="O peso da agropecuária na renda do país, o ritmo em que cresce e a fatia que ocupa nas exportações. Cada medida tem fonte, período e limite próprios."/><TamanhoAgro dados={dadosAgro} e={e}/><SecaoAgro titulo="As outras perguntas sobre o setor."><PerguntasAgro e={e} atual="tamanho"/></SecaoAgro></>;
}
