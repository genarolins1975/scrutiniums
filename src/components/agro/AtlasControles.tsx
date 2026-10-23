'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { MapaCoropletico, type MapaCoropleticoProps } from '@/components/energia/MapaCoropletico';
import type { CamadaGeo } from '@/lib/energia/geo';

/**
 * As duas peças de cliente do Atlas no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). O recorte (medida, até três UFs
 * e a UF em foco) vive na URL e é lido no servidor, que já entrega o HTML no recorte pedido; o cliente só troca o endereço.
 *
 * - FormularioAtlas: formulário GET; sem JavaScript, o botão "Aplicar" envia; com JavaScript, a mudança de um campo já envia e o botão
 *   some. Parâmetros no valor padrão saem da URL, como no explorador de antes.
 * - MapaAtlas: o mapa por UF; tocar uma UF troca a UF em foco na URL, sem rolar a página.
 */
export function FormularioAtlas({ children, ancora, rotulo }: { children: React.ReactNode; ancora: string; rotulo: string }) {
    const form = useRef<HTMLFormElement>(null);
    const [js, setJs] = useState(false);
    useEffect(() => setJs(true), []);
    return <form ref={form} method="get" action={`/agronegocio/atlas#${ancora}`} aria-label={rotulo} className="flex flex-wrap items-end gap-x-6 gap-y-3" onChange={() => {
        const f = form.current;
        if (!f)
            return;
        const campos = Array.from(f.elements) as (HTMLSelectElement | HTMLInputElement)[];
        const omitidos = campos.filter(el => el.name && el.dataset.padrao === el.value);
        for (const el of omitidos)
            el.disabled = true;
        f.requestSubmit();
        for (const el of omitidos)
            el.disabled = false;
    }}>{children}{!js && <button type="submit" className="inline-flex min-h-[44px] items-center border border-carvao px-4 text-sm text-carvao">Aplicar</button>}</form>;
}

export function MapaAtlas({ parametros, padroes, geometria, ...mapa }: Omit<MapaCoropleticoProps, 'onSelecionar' | 'geometria'> & { geometria: CamadaGeo; parametros: Record<string, string>; padroes: Record<string, string> }) {
    const router = useRouter();
    return <MapaCoropletico {...mapa} geometria={geometria} semTabela onSelecionar={id => {
        const q = new URLSearchParams();
        for (const [k, v] of Object.entries({ ...parametros, foco: id ?? '' }))
            if (v !== padroes[k])
                q.set(k, v);
        const s = q.toString();
        router.push(`/agronegocio/atlas${s ? `?${s}` : ''}#d1`, { scroll: false });
    }}/>;
}
