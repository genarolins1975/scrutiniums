import Link from 'next/link';
import type { SnapshotAgro } from '@/lib/agro/tipos';
import s from './Agro.module.css';
export function AberturaAgro({ rotulo, titulo, texto }: {
    rotulo: string;
    titulo: string;
    texto: string;
}) { return <section className={s.intro}><p className={`rotulo ${s.eyebrow}`}>{rotulo}</p><h1>{titulo}</h1><p>{texto}</p></section>; }
export function SecaoAgro({ id, titulo, rotulo, texto, children }: {
    id?: string;
    titulo: string;
    rotulo?: string;
    texto?: string;
    children: React.ReactNode;
}) { return <section className={s.section} id={id}><div className={s.sectionHeading}><div>{rotulo && <p className={`rotulo ${s.eyebrow}`}>{rotulo}</p>}<h2>{titulo}</h2></div>{texto && <p>{texto}</p>}</div>{children}</section>; }
export function LimiteAgro({ titulo, children }: {
    titulo: string;
    children: React.ReactNode;
}) { return <aside className={s.material}><strong>{titulo}</strong>{children}</aside>; }
export function FonteAgro({ dados, id, periodo, nota }: {
    dados: SnapshotAgro;
    id: string;
    periodo: string;
    nota: string;
}) { const f = dados.fontes.find(x => x.id === id); return <p className={s.note}>Fonte: {f ? <a href={f.url}>{f.nome}</a> : id}. Referência: {periodo}. {nota} <Link href={'/agronegocio/metodologia#fonte-' + id} prefetch={false}>Origem e limites</Link>.</p>; }
export function EnsaioPergunta({ titulo, children }: {
    titulo: string;
    children: React.ReactNode;
}) { return <article><h3>{titulo}</h3>{children}</article>; }
