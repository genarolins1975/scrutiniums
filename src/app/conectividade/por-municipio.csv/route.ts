import { csvPorMunicipio } from "@/lib/conectividade/csv";

/** Arquivo para baixar do painel Conectividade, com conta (o caminho não está em src/lib/rotasPublicas.ts). */
export const dynamic = "force-static";

export function GET() {
  return new Response(csvPorMunicipio(), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="conectividade-por-municipio.csv"' } });
}
