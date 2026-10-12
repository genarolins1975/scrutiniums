import { snapshot, primarios } from "@/lib/contas-estaduais/dados";
export const dynamic = "force-static";
export function GET() { return Response.json({ versao: "0.2.0", primarios, snapshotHerdado: snapshot }); }
