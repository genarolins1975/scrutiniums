import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dadosAgro } from '@/lib/agro/dados';
import { AberturaAgro, SecaoAgro } from '@/components/agro/Editorial';
import { PerguntasAgro } from '@/components/agro/Economia';
import { PratoAgro } from '@/components/agro/Sociedade';
export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Quanto custa a comida para as famílias?', description: 'Inflação de alimentos no IPCA, itens da cesta e segurança alimentar dos domicílios.', alternates: { canonical: '/agronegocio/prato' } };
export default function PaginaPratoAgro() {
    const e = dadosAgro.economia;
    if (!e)
        notFound();
    return <><AberturaAgro rotulo="Agronegócio / Pergunta 8" titulo="Quanto custa a comida para as famílias?" texto="A inflação dos alimentos comprados para casa, item a item, comparada com a inflação geral, e a condição alimentar dos domicílios. Preço ao consumidor não é preço ao produtor."/><PratoAgro dados={dadosAgro} e={e}/><SecaoAgro titulo="As outras perguntas sobre o setor."><PerguntasAgro e={e} atual="prato"/></SecaoAgro></>;
}
