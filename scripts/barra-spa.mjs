// Regrava, em public/obs/index.html, a casca da plataforma gerada a partir do registro dos observatórios e dos componentes da
// plataforma, e a folha de estilo dela (public/obs/casca.css). Rodar depois de mudar um rótulo, uma rota, a ordem dos
// observatórios, a navegação de uma coleção ou um dos componentes copiados; os testes cabecalho-movel e credito-casca falham
// enquanto a aplicação estiver diferente. Como em toda mudança da aplicação, a versão do Crédito sobe (APP_VERSION em app.js,
// ?v= em index.html e o teste avaliacao-set26).
//
// Trechos regravados no index.html (cada um entre os seus marcadores):
//   barra-plataforma   a barra comum e a trilha (src/lib/observatorios/barraSpa.ts, htmlBarraSpa);
//   navegacao-colecao  a navegação da coleção da entrada (/observatorio) e o índice que o app.js usa para refazê-la (htmlNavegacaoSpa);
//   fim-colecao        "Para ir além" e o rodapé da coleção da entrada (htmlFimSpa);
//   rodape-plataforma  o rodapé da plataforma, renderizado do próprio componente React (src/components/layout/Footer.tsx).
// O route handler de /observatorio (src/lib/observatorioHead.ts) troca os três primeiros pelos do endereço pedido.
//
// public/obs/casca.css: as classes utilitárias que esse HTML usa, geradas pelo Tailwind com a configuração da plataforma
// (tailwind.config.ts) e presas a `.casca` (a aplicação não carrega o CSS do Next e tem classes próprias que não podem ser
// atingidas), mais o mínimo da base do Tailwind que elas pressupõem e as regras de globals.css de que as peças dependem.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";
import ts from "typescript";

const raiz = fileURLToPath(new URL("..", import.meta.url));
// TypeScript com JSX (o rodapé da plataforma é um componente React)
const transform = (o) => ({
  code: ts.transpileModule(o.source, {
    fileName: o.filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText,
});
const jiti = createJiti(import.meta.url, { alias: { "@": raiz + "src" }, interopDefault: true, transform, extensions: [".js", ".mjs", ".cjs", ".ts", ".tsx", ".json"] });
const casca = jiti(raiz + "src/lib/observatorios/barraSpa.ts");
const { renderToStaticMarkup } = jiti("react-dom/server");
const { createElement } = jiti("react");
const { Footer } = jiti(raiz + "src/components/layout/Footer.tsx");

const ARQ = raiz + "public/obs/index.html";
let html = readFileSync(ARQ, "utf8");
const trocar = (ini, fim, novo, nome) => {
  const a = html.indexOf(ini);
  const b = html.indexOf(fim);
  if (a < 0 || b < a) throw new Error(`marcadores ${nome} não encontrados em public/obs/index.html`);
  html = html.slice(0, a) + novo + html.slice(b + fim.length);
};
const original = html;
trocar(casca.MARCADOR_INICIO, casca.MARCADOR_FIM, casca.htmlBarraSpa(), "da barra");
trocar(casca.MARCADOR_NAV_INICIO, casca.MARCADOR_NAV_FIM, casca.htmlNavegacaoSpa(), "da navegação da coleção");
trocar(casca.MARCADOR_FIM_INICIO, casca.MARCADOR_FIM_FIM, casca.htmlFimSpa(), "do fim da página");
trocar(casca.MARCADOR_RODAPE_INICIO, casca.MARCADOR_RODAPE_FIM, casca.htmlRodapePlataformaSpa(renderToStaticMarkup(createElement(Footer, {}))), "do rodapé da plataforma");
if (html === original) console.log("casca da aplicação já igual ao registro");
else {
  writeFileSync(ARQ, html);
  console.log("casca da aplicação regravada a partir do registro e dos componentes da plataforma");
}

// ------------------------------------------------------------------------------------------------------------ casca.css

const postcss = (await import("postcss")).default;
const tailwind = (await import("tailwindcss")).default;
const config = jiti(raiz + "tailwind.config.ts");
const globais = readFileSync(raiz + "src/app/globals.css", "utf8");

/** Bloco entre chaves que começa em `inicio` (o @layer components da escala tipográfica). */
function bloco(css, inicio) {
  const i = css.indexOf(inicio);
  if (i < 0) throw new Error(`globals.css sem ${inicio}`);
  let n = 0;
  for (let j = css.indexOf("{", i); j < css.length; j++) {
    if (css[j] === "{") n++;
    else if (css[j] === "}" && --n === 0) return css.slice(i, j + 1);
  }
  throw new Error(`bloco ${inicio} sem fim`);
}
/** Regras de globals.css cujo seletor cita `classe`, só com esse seletor e presas a .casca. */
function regras(css, classe) {
  const sem = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const saida = [];
  for (const m of sem.matchAll(/(?:^|\n)([^{}@]+)\{([^{}]*)\}/g)) {
    if (!m[1].split(",").some((s) => s.trim() === classe)) continue;
    saida.push(`.casca ${classe} {${m[2]}}`);
  }
  if (!saida.length) throw new Error(`globals.css sem regra para ${classe}`);
  return saida.join("\n");
}

// todo HTML que a casca pode desenhar: a navegação de cada coleção em cada endereço, o rótulo, o fim e o rodapé da plataforma
const indice = casca.indiceCasca();
const enderecos = indice.paineis.map((p) => p[0]);
// as classes no atributo vêm com o escape do HTML ("[&amp;::-webkit-scrollbar]:hidden"); o Tailwind lê a classe sem ele
const conteudo = [html, ...enderecos.flatMap((r) => [casca.htmlNavegacaoSpa(r), casca.htmlRotuloSpa(r), casca.htmlFimSpa(r)])]
  .join("\n")
  .replace(/&amp;/g, "&")
  .replace(/&gt;/g, ">")
  .replace(/&lt;/g, "<");

const entrada = `
/* Base: o mínimo do preflight do Tailwind que as classes da casca pressupõem, só dentro dela. Em :where(), com o peso de uma
   classe: vence as regras de elemento da aplicação (h2, a) e perde para as classes da casca (.rotulo, .px-3). */
.casca { font-family: var(--font-sans), system-ui, sans-serif; line-height: 1.5; }
.casca :where(*, ::before, ::after) { box-sizing: border-box; border-width: 0; border-style: solid; border-color: currentColor; }
.casca :where(h2, p, ul, ol, dl, dd, figure) { margin: 0; }
.casca :where(h2) { font-family: inherit; font-size: inherit; font-weight: inherit; letter-spacing: inherit; line-height: inherit; }
.casca :where(ul, ol) { list-style: none; padding: 0; }
.casca :where(a) { color: inherit; text-decoration: inherit; }
.casca :where(svg, img) { display: block; vertical-align: middle; }
${regras(globais, ".nav-colecao-faixa")}
${regras(globais, ".ed-pagina")}
@tailwind base;
@tailwind components;
@tailwind utilities;
${bloco(globais, "@layer components {")}
`;
const resultado = await postcss([
  tailwind({ ...config, content: [{ raw: conteudo, extension: "html" }], important: ".casca", corePlugins: { ...(config.corePlugins || {}), preflight: false } }),
]).process(entrada, { from: undefined });
const cabecalho =
  "/* Gerado por scripts/barra-spa.mjs: não editar. As classes da casca da plataforma (barra, navegação da coleção, rótulo de\n" +
  "   contexto, fim de página e rodapé) na aplicação do Crédito, que não carrega o CSS do Next (Iniciativa 2 do parecer de UX de\n" +
  "   23/10/2026). As famílias tipográficas são as da aplicação (public/obs/styles.css). */\n" +
  ':root { --font-serif: "Playfair Display"; --font-sans: "Inter"; --font-label: "Archivo Narrow"; }\n';
const css = cabecalho + resultado.css.trim() + "\n";
const CSS = raiz + "public/obs/casca.css";
let antes = "";
try { antes = readFileSync(CSS, "utf8"); } catch { /* primeira geração */ }
if (antes === css) console.log("casca.css já igual");
else {
  writeFileSync(CSS, css);
  console.log(`casca.css regravada (${Math.round(css.length / 1024)} KB)`);
}
