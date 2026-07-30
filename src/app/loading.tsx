import { Skeleton } from "@/components/ui/States";

export default function Loading() {
  return (
    <main className="bg-marfim" aria-busy="true">
      <div className="mx-auto max-w-page px-6 py-16 md:py-24" role="status" aria-label="Carregando página">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="mt-6 h-12 w-full max-w-2xl" />
        <Skeleton className="mt-3 h-12 w-full max-w-xl" />
        <Skeleton className="mt-8 h-5 w-full max-w-prose2" />
        <Skeleton className="mt-2 h-5 w-full max-w-lg" />
        <div className="mt-10 flex gap-4">
          <Skeleton className="h-11 w-52" />
          <Skeleton className="h-11 w-40" />
        </div>
        <div className="mt-16 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, indice) => (
            <div key={indice} className="bg-marfim p-6">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </div>
          ))}
        </div>
        <span className="sr-only">Carregando…</span>
      </div>
    </main>
  );
}
