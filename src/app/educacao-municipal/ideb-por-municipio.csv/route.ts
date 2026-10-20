import { csvIdeb } from "@/lib/educacao/csv";

/** Arquivo para baixar do painel Educação nos municípios, com conta (o caminho não está em src/lib/rotasPublicas.ts). */
export const dynamic = "force-static";

export function GET() {
  return csvIdeb();
}
