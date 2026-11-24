import { csvAtividades } from "@/lib/varejo/csv";

/** Arquivo para baixar da coleção Varejo, com conta (o caminho não está em src/lib/rotasPublicas.ts). */
export const dynamic = "force-static";

export function GET() {
  return new Response(csvAtividades(), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="varejo-atividades.csv"' } });
}
