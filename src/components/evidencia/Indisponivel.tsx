import type { ReactNode } from "react";

/**
 * Estado de ausência. Ausência nunca vira zero, erro nunca vira valor, ensaio
 * nunca vira publicação: o componente mostra o que falta e por quê.
 */
export function Indisponivel({
  titulo,
  motivo,
  ultimaExecucao,
  faltante,
  estado,
  children,
}: {
  titulo: string;
  motivo: ReactNode;
  ultimaExecucao?: ReactNode;
  faltante?: ReactNode[];
  estado?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div role="status" className="border border-dashed border-mineral bg-papel px-6 py-7 md:px-8">
      <p className="rotulo flex items-center gap-2 text-carvao">
        <span aria-hidden="true" className="inline-block h-2.5 w-2.5 border border-carvao" />
        {titulo}
      </p>
      <div className="mt-3 max-w-prose2 leading-relaxed text-carvao">{motivo}</div>
      {/* itens empilhados: o componente aparece tanto em largura cheia quanto em meia coluna */}
      <dl className="mt-5 space-y-4 text-sm">
        {ultimaExecucao && (
          <div>
            <dt className="rotulo text-mineral">Última execução</dt>
            <dd className="mt-1 text-carvao-muted">{ultimaExecucao}</dd>
          </div>
        )}
        {faltante && faltante.length > 0 && (
          <div>
            <dt className="rotulo text-mineral">O que falta</dt>
            <dd className="mt-1 text-carvao-muted">
              <ul className="list-disc space-y-1 pl-4">
                {faltante.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {estado && (
          <div>
            <dt className="rotulo text-mineral">Situação atual</dt>
            <dd className="mt-1 text-carvao-muted">{estado}</dd>
          </div>
        )}
      </dl>
      {children}
    </div>
  );
}
