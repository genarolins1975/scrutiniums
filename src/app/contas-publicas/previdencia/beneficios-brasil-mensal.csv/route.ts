import { csvBrasilMensal } from "@/lib/previdencia/csv";

/** Arquivo para baixar do painel Previdência e INSS, com conta (o caminho não está em src/lib/rotasPublicas.ts). */
export const dynamic = "force-static";

export function GET() {
  return csvBrasilMensal();
}
