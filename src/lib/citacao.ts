/**
 * Citação e incorporação dos indicadores públicos (/dados/[slug] e /dados/ibcc).
 *
 * A citação carrega os invariantes editoriais da casa: título, fonte primária com
 * a série, data de referência, natureza do número, data de processamento, URL
 * estável e data de acesso. O "Incorporar" gera o iframe do embed.html (a mesma
 * SPA, sem cromo, recortada no cartão), com crédito e link de volta.
 */
const BASE = "https://scrutiniums.com";

export type DadosCitacao = {
  titulo: string;
  fonte: string;
  serie?: string;
  referencia: string;
  natureza: "dado observado" | "dado calculado";
  processadoEm?: string | null;
  caminho: string;
};

const ddmmaaaa = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

export function citacao(c: DadosCitacao, acesso: Date): string {
  const fonte = c.serie ? `${c.fonte}, série ${c.serie}` : c.fonte;
  return (
    `${c.titulo}. In: Observatório Brasileiro de Crédito. Scrutiniums, ${acesso.getFullYear()}. ` +
    `Fonte primária: ${fonte}. Referência: ${c.referencia}. Natureza: ${c.natureza}. ` +
    (c.processadoEm ? `Processado em ${c.processadoEm.slice(0, 10)}. ` : "") +
    `Disponível em: ${BASE}${c.caminho}. Acesso em: ${ddmmaaaa(acesso)}.`
  );
}

/**
 * Cartão da SPA que mostra cada série no embed.html. Chave `X_seg` vira o cartão
 * `pu-X` do Pulso com o segmento na URL; chaves sem segmento são cartões extras.
 */
export function alvoEmbed(chave: string): string {
  if (chave === "ibcc") return "g=overview.ov-ibcc";
  const m = chave.match(/^(inad|taxa|spread|saldo|concessoes)_(total|pf|pj)$/);
  if (m) return `g=pulse.pu-${m[1]}&seg=${m[2]}`;
  return `g=pulse.pu-${chave}`;
}

const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function codigoIncorporar(chave: string, titulo: string, caminho: string): string {
  const src = `${BASE}/obs/embed.html?${alvoEmbed(chave)}`;
  return (
    `<iframe src="${escAttr(src)}" width="720" height="520" loading="lazy" style="border:1px solid #ccc;border-radius:8px" title="${escAttr(titulo)}"></iframe>` +
    `<p style="font:12px/1.4 sans-serif;margin:4px 0 0">Gráfico: <a href="${BASE}${caminho}">${escAttr(titulo)}</a>, ` +
    `Observatório Brasileiro de Crédito (Scrutiniums). Fonte e período no rodapé do gráfico.</p>`
  );
}
