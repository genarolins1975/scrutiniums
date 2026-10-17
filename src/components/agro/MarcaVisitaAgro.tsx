'use client';

import { usePathname } from 'next/navigation';
import { MarcaVisita } from '@/components/telemetria/MarcaVisita';

/** Contagem agregada: não envia caminho, consulta, cadeia ou parâmetros. */
export function MarcaVisitaAgro() {
    const pathname = usePathname();
    return <MarcaVisita key={pathname} secao="agro:paginas" />;
}
