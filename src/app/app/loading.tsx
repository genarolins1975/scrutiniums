import { PanelSkeleton } from "@/components/ui/States";

/** Carregamento da área interna: esqueletos no lugar dos painéis. */
export default function Loading() {
  return (
    <div className="grid gap-6 md:grid-cols-2" aria-busy="true">
      <PanelSkeleton />
      <PanelSkeleton />
      <PanelSkeleton />
      <PanelSkeleton />
    </div>
  );
}
