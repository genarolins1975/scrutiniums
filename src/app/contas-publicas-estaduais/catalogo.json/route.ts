import { catalogo } from "@/lib/contas-estaduais/dados";
export const dynamic = "force-static";
export function GET() { return Response.json(catalogo); }
