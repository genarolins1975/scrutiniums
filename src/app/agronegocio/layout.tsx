import type { Metadata } from 'next';
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import { Footer } from '@/components/layout/Footer';
import { CabecalhoPlataforma } from '@/components/layout/CabecalhoPlataforma';
import { NavegacaoColecao } from '@/components/layout/NavegacaoColecao';
import { MarcaVisitaAgro } from '@/components/agro/MarcaVisitaAgro';
import s from '@/components/agro/Agro.module.css';
export const metadata: Metadata = { title: { default: 'Agronegócio', template: '%s · Agronegócio · Scrutiniums' }, description: 'Do campo à mesa e ao mercado: oito perguntas sobre o setor, doze cadeias com produção por estado e exportação, dados oficiais e limites identificados.' };
export default function LayoutAgro({ children }: {
    children: React.ReactNode;
}) { return <div className={`${s.shell} dominio-energia`}><MarcaVisitaAgro /><a href="#conteudo" className={s.skip}>Pular para o conteúdo</a><header className={s.platform}><CabecalhoPlataforma colecao="agro" destinoConta="/agronegocio" /><NavegacaoColecao colecao="agro" /></header><main id="conteudo" className={`${s.main} ${s.wrap}`}>{children}</main><ParaIrAlem mapa={mapaParaIrAlem()} /><Footer compacto/></div>; }
