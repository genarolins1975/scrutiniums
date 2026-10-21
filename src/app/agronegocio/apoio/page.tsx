import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dadosAgro } from '@/lib/agro/dados';
import { AberturaAgro, SecaoAgro } from '@/components/agro/Editorial';
import { PerguntasAgro } from '@/components/agro/Economia';
import { ApoioAgro } from '@/components/agro/Sociedade';
export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Quanto custa o apoio público e quem recebe?', description: 'Juros do crédito rural por programa e origem do recurso, subvenções pagas pelo Tesouro e crédito por programa.', alternates: { canonical: '/agronegocio/apoio' } };
export default function PaginaApoioAgro() {
    const e = dadosAgro.economia;
    if (!e)
        notFound();
    return <><AberturaAgro rotulo="Agronegócio / Pergunta 6" titulo="Quanto custa o apoio público e quem recebe?" texto="Os juros que o produtor paga em cada programa, quanto o Tesouro gasta para reduzi-los e para quem vai o crédito. O custo do seguro rural ainda não está nesta conta."/><ApoioAgro dados={dadosAgro} e={e}/><SecaoAgro titulo="As outras perguntas sobre o setor."><PerguntasAgro e={e} atual="apoio"/></SecaoAgro></>;
}
