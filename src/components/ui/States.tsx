/**
 * Estados padronizados: carregamento (skeleton), vazio, erro e indisponibilidade.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function PanelSkeleton() {
  return (
    <div className="border border-linha bg-papel p-6" role="status" aria-label="Carregando conteúdo">
      <Skeleton className="mb-3 h-4 w-40" />
      <Skeleton className="mb-6 h-7 w-72" />
      <Skeleton className="h-48 w-full" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

export function EmptyState({
  title = "Sem dados para os filtros selecionados",
  description = "Ajuste o período ou os filtros para visualizar resultados.",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 border border-linha bg-papel px-6 py-14 text-center">
      <span className="font-serif text-3xl text-linha" aria-hidden="true">
        ∅
      </span>
      <p className="font-serif text-lg text-carvao">{title}</p>
      <p className="max-w-md text-sm text-mineral">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Não foi possível carregar",
  description = "Ocorreu um erro ao buscar os dados. Tente novamente em instantes.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 border border-linha bg-papel px-6 py-14 text-center"
    >
      <span className="font-serif text-3xl text-erro" aria-hidden="true">
        !
      </span>
      <p className="font-serif text-lg text-carvao">{title}</p>
      <p className="max-w-md text-sm text-mineral">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rotulo mt-2 border border-carvao px-5 py-2.5 min-h-[44px] text-carvao hover:bg-carvao hover:text-marfim"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
