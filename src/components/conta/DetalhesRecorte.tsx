"use client";

import { resumoRecorte } from "@/lib/conta/resumoRecorte";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { Nome } from "@/components/i18n/Nome";

export function DetalhesRecorte({ caminho }: { caminho: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const partes = resumoRecorte(caminho, idioma);
  return <div className="min-w-0 space-y-1">
    {partes.length > 0 && <p data-resumo-recorte="" className="text-sm leading-relaxed text-carvao">
      {partes.map((p, i) => <span key={i}>{i > 0 && " · "}{p.nome ? <Nome>{p.texto}</Nome> : p.texto}</span>)}
    </p>}
    <details className="min-w-0 text-xs leading-relaxed text-carvao-muted">
      {/* A barra impede quebra nos seus seletores; o texto deste detalhe precisa caber também com fonte ampliada. */}
      <summary className="inline-flex min-h-[44px] max-w-full cursor-pointer items-center !whitespace-normal underline underline-offset-4">{tx("Ver endereço e parâmetros", "View address and parameters")}</summary>
      <p className="break-all font-mono text-xs leading-relaxed text-carvao-muted">{caminho}</p>
    </details>
  </div>;
}
