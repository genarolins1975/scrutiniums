/* Sessão assinada para auditorias automatizadas contra um servidor local.
   Os painéis exigem sessão (src/middleware.ts); o middleware confere só a
   assinatura HMAC e a expiração do cookie, no mesmo formato de
   src/lib/sessionCookie.ts. Exige COOKIE_SECRET igual ao do servidor auditado.
   Nunca use contra produção: o segredo de produção não deve sair da Vercel. */
import { createHmac, randomBytes } from "node:crypto";

export const NOME_COOKIE = "scrutiniums_session";

export function valorSessao(horas = 2) {
  const segredo = process.env.COOKIE_SECRET;
  if (!segredo || segredo.length < 16) throw new Error("COOKIE_SECRET (16+ caracteres) é necessário para auditar painéis.");
  const exp = Math.floor(Date.now() / 1000) + horas * 3600;
  const payload = `${exp}.${randomBytes(24).toString("hex")}`;
  return `${payload}.${createHmac("sha256", segredo).update(payload).digest("hex")}`;
}

/** Liga a sessão em todas as páginas abertas pelo navegador e em todo fetch do script. */
export function autenticarAuditoria(browser, base) {
  const valor = valorSessao();
  const abrir = browser.newPage.bind(browser);
  browser.newPage = async (opcoes) => {
    const pagina = await abrir(opcoes);
    await pagina.context().addCookies([{ name: NOME_COOKIE, value: valor, url: base }]);
    return pagina;
  };
  const buscar = globalThis.fetch;
  globalThis.fetch = (url, init = {}) => {
    const headers = new Headers(init.headers ?? {});
    headers.set("cookie", `${NOME_COOKIE}=${valor}`);
    return buscar(url, { ...init, headers });
  };
}
