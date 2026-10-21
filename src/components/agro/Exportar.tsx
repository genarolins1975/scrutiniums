'use client';
import { csvAgro } from '@/lib/agro/modelo';
import { baixarAgro } from '@/lib/agro/baixar';
import s from './Agro.module.css';
export function ExportarAgro({ nome, colunas, linhas, rotulo = 'Baixar tabela completa · CSV' }: {
    nome: string;
    colunas: string[];
    linhas: (string | number | null)[][];
    rotulo?: string;
}) { return <button className={s.button} onClick={() => baixarAgro(nome, csvAgro(colunas, linhas))}>{rotulo}</button>; }
