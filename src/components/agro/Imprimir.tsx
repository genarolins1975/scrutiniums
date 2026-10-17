'use client';
import { registrarUsoAgro } from '@/lib/agro/uso';
import s from './Agro.module.css';
export function ImprimirAgro() { return <button className={s.primaryButton} onClick={() => { registrarUsoAgro('download'); window.print(); }}>Imprimir ou salvar em PDF</button>; }
