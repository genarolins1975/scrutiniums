import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dadosAgro } from '@/lib/agro/dados';
import { AberturaAgro, SecaoAgro } from '@/components/agro/Editorial';
import { PerguntasAgro } from '@/components/agro/Economia';
import { ProdutoresAgro } from '@/components/agro/Sociedade';
export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Quem produz, quem trabalha e quanto ganha no campo?', description: 'Estabelecimentos, área e agricultura familiar no Censo Agropecuário; ocupados e renda do trabalho no campo na PNAD Contínua.', alternates: { canonical: '/agronegocio/produtores' } };
export default function PaginaProdutoresAgro() {
    const e = dadosAgro.economia;
    if (!e)
        notFound();
    return <><AberturaAgro rotulo="Agronegócio / Pergunta 5" titulo="Quem produz, quem trabalha e quanto ganha no campo?" texto="O tamanho dos estabelecimentos, o peso da agricultura familiar, quantas pessoas trabalham no campo e quanto ganham. Censo de 2017 para a estrutura; PNAD trimestral para o trabalho."/><ProdutoresAgro dados={dadosAgro} e={e}/><SecaoAgro titulo="As outras perguntas sobre o setor."><PerguntasAgro e={e} atual="produtores"/></SecaoAgro></>;
}
