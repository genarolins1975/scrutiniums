import { geradoEmPublicado, resumoDiario } from "@/lib/dadosPublicos";
import { montarFeedResumo } from "@/lib/feedResumo";

/** RSS do resumo do crédito: um item por publicação, gerado no build com o gold do deploy. */
export const dynamic = "force-static";

export function GET() {
  const xml = montarFeedResumo(resumoDiario(), geradoEmPublicado());
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
