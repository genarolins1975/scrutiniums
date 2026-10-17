import type { Metadata } from 'next';
import Link from 'next/link';
import { CADEIAS } from '@/lib/agro/modelo';
import { AberturaAgro, LimiteAgro } from '@/components/agro/Editorial';
import { IconeAgro } from '@/components/agro/Figuras';
import s from '@/components/agro/Agro.module.css';
export const metadata: Metadata = { title: 'Escolha uma cadeia', alternates: { canonical: '/agronegocio/cadeias' } };
export default function CadeiasAgro() { return <><AberturaAgro rotulo="Agronegócio / Fichas das cadeias" titulo="Uma cadeia, suas etapas e suas medidas." texto="Reconheça como o produto chega ao processamento e ao uso, confira o que os registros permitem observar e escolha as perguntas para aprofundar."/><LimiteAgro titulo="Sete fichas, cobertura de dados explicitada">As fichas têm mecanismos e histórias específicos. Há financiamento de cinco itens identificados no recorte dos maiores produtos. Feijão e leite não aparecem nesse recorte; isso não é zero. Produção física das sete cadeias ainda não foi medida nesta entrega.</LimiteAgro><div className={s.chainGrid}>{CADEIAS.map(c => <Link href={'/agronegocio/cadeias/' + c.id} key={c.id} className={s.chainTile} prefetch={false}><IconeAgro tema={c.id}/><h2 className={s.blockTitle}>{c.nome}</h2><p>{c.pergunta}</p></Link>)}</div></>; }
