import {CabecalhoPlataforma} from '@/components/layout/CabecalhoPlataforma';
import Link from 'next/link';
import s from '@/components/eficiencia/judiciario/Judiciario.module.css';
import type { Metadata } from "next";
import { colecaoDoDominio, modeloDeTitulo } from "@/lib/observatorios/contexto";

/** Títulos "Página · Coleção · Scrutiniums", com a coleção dona do tema no registro. */
export const metadata: Metadata = { title: modeloDeTitulo("/eficiencia-estatal/judiciario") };
/** A coleção do registro que mora em /eficiencia-estatal (Síntese das capitais): o link de contexto leva o nome dela, não o do domínio de origem. */
const SINTESE = colecaoDoDominio("eficiencia")!.colecao;
export default function Layout({children}:{children:React.ReactNode}){return <><header><CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal/judiciario" navegacao="justica" /></header><main id="conteudo" className={s.shell}><div className={s.contextLinks}><Link href={SINTESE.href}>{SINTESE.nome}</Link><Link href="/eficiencia-estatal/acesso-justica">Acesso à Justiça e Defensorias</Link></div>{children}</main></>;}
