import { NextResponse } from "next/server";
import { montarHtml, resolverMeta } from "@/lib/observatorioHead";

/**
 * Serve a SPA do Observatório (public/obs/index.html) com metadados por
 * rota: <title>, description, canonical, Open Graph e JSON-LD (Dataset)
 * específicos de cada aba. Substitui os antigos rewrites do next.config,
 * que entregavam o mesmo <head> para todas as rotas — o que impedia
 * indexação e compartilhamento decentes de cada painel.
 *
 * O corpo da página é idêntico em todas as rotas (o roteamento fino é da
 * própria SPA, via History API); só o <head> muda. Rotas desconhecidas
 * respondem 404 com noindex, servindo a SPA mesmo assim.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { rota?: string[] } },
) {
  let caminho: string;
  try {
    caminho = "/" + (params.rota ?? []).map(decodeURIComponent).join("/");
  } catch {
    // Percent-encoding malformado: trata como rota desconhecida (404/noindex).
    caminho = "/__rota-invalida";
  }
  const meta = resolverMeta(caminho);
  return new NextResponse(montarHtml(meta), {
    status: meta.status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // O conteúdo muda quando o pipeline diário publica (novo deploy);
      // uma hora de cache compartilhado equilibra frescor e custo.
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
