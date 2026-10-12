import { snapshot, primarios } from "@/lib/contas-estaduais/dados";
export const dynamic = "force-static";
export function GET() { return Response.json({ versao: "0.4.0", primarios, snapshotHerdado: snapshot }, {headers:{"Content-Disposition":'attachment; filename="contas-estaduais-dados.json"'}}); }
