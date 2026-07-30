/**
 * Indicador de progresso do onboarding: "Etapa N de 3".
 * Números de seção serifados em bronze, conforme direção visual.
 */
export function StepIndicator({ current, total = 3 }: { current: number; total?: number }) {
  return (
    <div className="flex items-center gap-4" aria-label={`Etapa ${current} de ${total}`}>
      <span className="font-serif text-2xl text-bronze" aria-hidden="true">
        {String(current).padStart(2, "0")}
      </span>
      <span className="rotulo text-mineral">
        Etapa {current} de {total}
      </span>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-[3px] w-8 ${i < current ? "bg-bronze" : "bg-linha"}`}
          />
        ))}
      </div>
    </div>
  );
}
