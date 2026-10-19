import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dadosAgro } from '@/lib/agro/dados';
import { AberturaAgro, SecaoAgro } from '@/components/agro/Editorial';
import { PerguntasAgro } from '@/components/agro/Economia';
import { AmbienteAgro } from '@/components/agro/Sociedade';
import { PainelPrincipal } from '@/components/observatorios/PainelPrincipal';
export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Quanto se desmata e quanto o campo emite?', description: 'Desmatamento PRODES por bioma, emissões do SEEG e uso da terra do MapBiomas.', alternates: { canonical: '/agronegocio/ambiente' } };
export default function PaginaAmbienteAgro() {
    const e = dadosAgro.economia;
    if (!e)
        notFound();
    return <><AberturaAgro rotulo="Agronegócio / Pergunta 7" titulo="Quanto se desmata e quanto o campo emite?" texto="Desmatamento medido pelo INPE, emissões da agropecuária e da mudança de uso da terra estimadas pelo SEEG e a área ocupada pela agropecuária no MapBiomas. Séries nacionais, sem atribuição a produtor ou cadeia."/><AmbienteAgro dados={dadosAgro} e={e} serieOficial={<PainelPrincipal rota="/agronegocio/ambiente"/>}/><SecaoAgro titulo="As outras perguntas sobre o setor."><PerguntasAgro e={e} atual="ambiente"/></SecaoAgro></>;
}
