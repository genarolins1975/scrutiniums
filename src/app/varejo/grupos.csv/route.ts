import { csvGrupos } from "@/lib/varejo/csv";

/** O ranking dos maiores grupos em CSV, com conta (o caminho não está em src/lib/rotasPublicas.ts). */
export const dynamic = "force-static";

export function GET() {
  return new Response(csvGrupos(), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="varejo-grupos.csv"' } });
}
