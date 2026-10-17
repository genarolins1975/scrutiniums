'use client';
import Link from 'next/link';
import { useState } from 'react';
import { CADEIAS } from '@/lib/agro/modelo';
import type { CadeiaId } from '@/lib/agro/tipos';
import { IconeAgro } from './Figuras';
import s from './Agro.module.css';
export function ExploradorCadeiaAgro({ inicial = 'soja', fixo = false }: {
    inicial?: CadeiaId;
    fixo?: boolean;
}) { const [id, setId] = useState<CadeiaId>(inicial), c = CADEIAS.find(c => c.id === id)!; return <div className={s.mechanism} id="t1"><span className={s.status}>Explicação conceitual · T1</span>{!fixo && <nav aria-label="Cadeia do explorador">{CADEIAS.map(x => <button key={x.id} aria-pressed={id === x.id} onClick={() => setId(x.id)}>{x.nome}</button>)}</nav>}<ol className={s.steps}>{c.etapas.map((e, i) => <li key={e}><IconeAgro tema={i === 0 ? 'insumos' : i === 1 ? c.id : i === 2 ? 'silo' : i === 3 ? 'industria' : 'mercado'}/><b>ETAPA {i + 1}</b><strong>{e}</strong>{i === 2 && id === 'leite' && <p>Coleta e refrigeração têm papéis próprios; esta figura não mede perdas nem prazo.</p>}</li>)}</ol><p className={s.note}>{c.mecanismo}</p><p className={s.note}>As setas mostram uma sequência conceitual, sem medir volumes, participação no preço ou origem de um alimento específico. {c.limite}</p>{!fixo && <Link href={'/agronegocio/cadeias/' + id} className={s.button} prefetch={false}>Explorar a cadeia de {c.nome.toLowerCase()}</Link>}</div>; }
