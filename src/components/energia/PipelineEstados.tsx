import type { CatalogoGold, EstadoCatalogo } from "@/lib/energia/tipos";

/**
 * Estados de integração dos conjuntos como uma esteira: catalogado, em
 * integração, integrado, validado, utilizado em indicador ou em modelo. Os
 * estados são cumulativos: a contagem de cada degrau inclui os seguintes.
 * Contagens são do próprio catálogo do portal, não números do setor.
 */
export function PipelineEstados({ cat, entradas, compacto = false }: { cat: CatalogoGold; entradas?: CatalogoGold["entradas"]; compacto?: boolean }) {
  const lista = entradas ?? cat.entradas;
  const exatos = Object.fromEntries(cat.estados.map((e) => [e, lista.filter((x) => x.estado === e).length])) as Record<EstadoCatalogo, number>;
  const acumulado = cat.estados.map((e, i) => cat.estados.slice(i).reduce((t, k) => t + (exatos[k] ?? 0), 0));
  const total = lista.length || 1;
  return (
    <ol className={`grid gap-px border border-linha bg-linha ${compacto ? "sm:grid-cols-3 lg:grid-cols-6" : "sm:grid-cols-2 lg:grid-cols-6"}`} aria-label="Conjuntos por estado de integração">
      {cat.estados.map((e, i) => {
        const n = acumulado[i];
        const largura = Math.max(2, Math.round((100 * n) / total));
        return (
          <li key={e} className="bg-superficie p-3">
            <p className="rotulo !text-[0.62rem] text-mineral">
              <span className="mr-1 font-serif text-sm normal-case tracking-normal text-energia">{i + 1}</span>
              {e}
            </p>
            <p className="mt-1 font-serif text-2xl tabular-nums text-carvao">{n.toLocaleString("pt-BR")}</p>
            <div className="mt-1 h-1.5 w-full bg-papel" aria-hidden="true">
              <div className="h-full bg-energia" style={{ width: `${largura}%` }} />
            </div>
            <p className="mt-1 text-[0.68rem] leading-snug text-mineral">
              neste estado ou além; exatamente neste: {(exatos[e] ?? 0).toLocaleString("pt-BR")}
            </p>
            {!compacto && <p className="mt-1 text-xs leading-snug text-carvao-muted">{cat.definicoes_estado[e]}</p>}
          </li>
        );
      })}
    </ol>
  );
}
