import type { ResumoDiario } from "./dadosPublicos";
import { fmtPercentil, fmtRefMes } from "./dadosPublicos";
import { publicadoEmBrasilia } from "./frescor";

const BASE = "https://scrutiniums.com";
export const URL_FEED_RESUMO = "/resumo/feed.xml";
/** Feed da central de alertas do crédito, gerado pelo pipeline (pipeline/central_alertas.py). */
export const URL_FEED_ALERTAS = "/obs/data/gold/alerts.xml";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Feed RSS 2.0 do resumo. Cada publicação vira um item com guid estável (o
 * `gerado_em`): o leitor de RSS acumula a história, o endereço não muda. Sem
 * resumo no gold, o canal sai sem itens, nunca com item inventado.
 */
export function montarFeedResumo(r: ResumoDiario | null, geradoEm: string | null): string {
  const itens =
    r && geradoEm
      ? [
          `<item>
  <title>${esc(`Resumo do crédito: publicação de ${publicadoEmBrasilia(geradoEm)} (Brasília)`)}</title>
  <link>${BASE}/resumo</link>
  <guid isPermaLink="false">scrutiniums-resumo-${esc(geradoEm)}</guid>
  <pubDate>${new Date(geradoEm.match(/(Z|[+-]\d{2}:?\d{2})$/) ? geradoEm : `${geradoEm}Z`).toUTCString()}</pubDate>
  <description>${esc(
    `${r.frase} IBCC ${r.ibcc.atual.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} ` +
      `(percentil histórico ${fmtPercentil(r.ibcc.percentil)}). Referência ${fmtRefMes(r.refDiagnostico)}; confiança ${r.confianca}. ` +
      "Dado calculado sobre séries do BCB/SGS; método e fontes em scrutiniums.com/resumo.",
  )}</description>
</item>`,
        ]
      : [];
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Resumo do crédito · Scrutiniums</title>
<link>${BASE}/resumo</link>
<atom:link href="${BASE}${URL_FEED_RESUMO}" rel="self" type="application/rss+xml" />
<description>Diagnóstico determinístico do crédito no Brasil, uma entrada por publicação, com fonte e referência declaradas.</description>
<language>pt-BR</language>
${itens.join("\n")}
</channel>
</rss>
`;
}
