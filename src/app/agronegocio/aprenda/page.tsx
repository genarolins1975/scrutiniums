import type { Metadata } from 'next';
import Link from 'next/link';
import catalogo from '../../../../docs/agro/catalogo-artefatos.json';
import resumo from '../../../../docs/agro/resumo-artefatos.json';
import type { ArtefatoAgro } from '@/lib/agro/tipos';
import { AberturaAgro, SecaoAgro } from '@/components/agro/Editorial';
import { PercursosAgro, OficinasAgro } from '@/components/agro/Aprendizado';
import { CatalogoAgro } from '@/components/agro/Catalogo';
import s from '@/components/agro/Agro.module.css';
export const metadata: Metadata = { title: 'Aprenda e experimente', alternates: { canonical: '/agronegocio/aprenda' } };
export default function AprendaAgro() { return <><AberturaAgro rotulo="Agronegócio / Aprenda e experimente" titulo="Entender a conta. Reconhecer o limite." texto="Entre por um percurso ou procure uma pergunta. Os conteúdos distinguem dado observado, explicação conceitual e cenário; nenhuma categoria substitui outra."/><PercursosAgro /><OficinasAgro /><SecaoAgro titulo="Encontre uma tarefa, não uma sigla." texto={`${resumo.implementados} tarefas implementadas no recorte declarado; ${resumo.bloqueados.length} medições bloqueadas. Uma história reutilizada em sete cadeias conta uma vez.`}><CatalogoAgro itens={(catalogo.artefatos as unknown as ArtefatoAgro[]).map(({ id, titulo, rota, categoria, status, limitacao, publico }) => ({ id, titulo, rota, categoria, status, limitacao, publico }))}/></SecaoAgro><div className={s.actions}><Link className={s.button} href="/agronegocio/glossario#t4" prefetch={false}>Consultar conceitos</Link><Link className={s.button} href="/agronegocio/metodologia#t8" prefetch={false}>Ver cobertura e reprodução</Link></div></>; }
