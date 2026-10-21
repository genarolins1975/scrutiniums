// Regrava, em public/obs/index.html, a barra comum da plataforma gerada a partir do registro dos observatórios
// (src/lib/observatorios/barraSpa.ts). Rodar depois de mudar um rótulo, uma rota ou a ordem dos observatórios; o teste
// cabecalho-movel falha enquanto a SPA estiver diferente do registro. Como em toda mudança da SPA, a versão da aplicação
// do Crédito sobe (APP_VERSION em app.js, ?v= em index.html e o teste avaliacao-set26).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": raiz + "src" }, interopDefault: true });
const { htmlBarraSpa, MARCADOR_INICIO, MARCADOR_FIM } = jiti(raiz + "src/lib/observatorios/barraSpa.ts");

const ARQ = raiz + "public/obs/index.html";
const html = readFileSync(ARQ, "utf8");
const ini = html.indexOf(MARCADOR_INICIO);
const fim = html.indexOf(MARCADOR_FIM);
if (ini < 0 || fim < ini) throw new Error("marcadores da barra não encontrados em public/obs/index.html");
const novo = html.slice(0, ini) + htmlBarraSpa() + html.slice(fim + MARCADOR_FIM.length);
if (novo === html) console.log("barra da SPA já igual ao registro");
else {
  writeFileSync(ARQ, novo);
  console.log("barra da SPA regravada a partir do registro");
}
