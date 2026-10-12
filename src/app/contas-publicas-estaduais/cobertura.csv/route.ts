import { csvCobertura, recorte } from "@/lib/contas-estaduais/dados";
export function GET(request: Request) {
 const { ano } = recorte(null, new URL(request.url).searchParams.get("ano"));
 return new Response(csvCobertura(ano), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="cobertura-estados-' + ano + '.csv"' } });
}
