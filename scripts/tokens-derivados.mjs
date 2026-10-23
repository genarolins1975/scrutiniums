// Deriva de src/app/globals.css (único arquivo de tokens da plataforma) os dois lugares que não conseguem ler o CSS do Next:
//   public/obs/tokens.css     as mesmas variáveis para a aplicação do Crédito (public/obs/index.html), que não carrega globals.css;
//   src/lib/tokens.gerado.ts  os hexadecimais resolvidos para a imagem social (src/lib/og.tsx), que não lê CSS.
// Uso: node scripts/tokens-derivados.mjs   (src/tests/design-tokens.test.ts reprova arquivo derivado fora de sincronia)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Propriedades declaradas nos blocos :root de um CSS, na ordem, sem comentários. */
export function propriedadesRaiz(css) {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const props = [];
  for (const bloco of semComentarios.matchAll(/(?:^|\n)\s*:root\s*\{([^}]*)\}/g)) {
    for (const m of bloco[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) props.push([m[1], m[2].trim()]);
  }
  return props;
}

/** Hexadecimal de cada token, seguindo var(--outro) até o valor literal; tokens que não terminam em hexadecimal ficam de fora. */
export function hexadecimais(props) {
  const mapa = new Map(props);
  const resolve = (nome, visto = new Set()) => {
    if (visto.has(nome)) return null;
    visto.add(nome);
    const valor = mapa.get(nome);
    if (!valor) return null;
    if (/^#[0-9a-f]{3,8}$/i.test(valor)) return valor.toLowerCase();
    const ref = valor.match(/^var\((--[a-z0-9-]+)\)$/i);
    return ref ? resolve(ref[1], visto) : null;
  };
  const saida = {};
  for (const [nome] of props) {
    const hex = resolve(nome);
    if (hex) saida[nome.slice(2)] = hex;
  }
  return saida;
}

export function derivar(globals) {
  const props = propriedadesRaiz(globals);
  const css =
    "/* Gerado de src/app/globals.css por scripts/tokens-derivados.mjs: não editar. A aplicação do Crédito não carrega o CSS do\n" +
    "   Next; esta folha lhe dá as mesmas variáveis da plataforma (Iniciativa 5 do parecer de UX de 21/10/2026). */\n" +
    ":root {\n" +
    props.map(([n, v]) => `  ${n}: ${v};`).join("\n") +
    "\n}\n";
  const hex = hexadecimais(props);
  const ts =
    "// Gerado de src/app/globals.css por scripts/tokens-derivados.mjs: não editar.\n" +
    "// Hexadecimais resolvidos dos tokens da plataforma, para quem não lê CSS (a imagem social em src/lib/og.tsx).\n" +
    "export const TOKENS = {\n" +
    Object.entries(hex)
      .map(([n, v]) => `  ${JSON.stringify(n)}: ${JSON.stringify(v)},`)
      .join("\n") +
    "\n} as const;\n";
  return { css, ts };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { css, ts } = derivar(readFileSync(join(raiz, "src/app/globals.css"), "utf-8"));
  writeFileSync(join(raiz, "public/obs/tokens.css"), css);
  writeFileSync(join(raiz, "src/lib/tokens.gerado.ts"), ts);
  console.log("public/obs/tokens.css e src/lib/tokens.gerado.ts atualizados");
}
