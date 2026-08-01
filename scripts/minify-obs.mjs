import { readFileSync, writeFileSync, statSync } from "node:fs";

/**
 * Minifica o SPA do Observatório (public/obs/app.js → app.min.js) antes de
 * cada build. O app.js legível segue no git como fonte canônica (testes e
 * patches do pipeline leem dele); o index.html referencia só o .min.
 *
 * Segurança: mangle apenas de escopo interno (sem `toplevel`), porque os
 * handlers inline (onclick="nav('pulse')" etc.) dependem dos nomes globais
 * das funções declaradas no script clássico.
 */
const { minify } = await import("terser");

const SRC = "public/obs/app.js";
const OUT = "public/obs/app.min.js";

const src = readFileSync(SRC, "utf8");
const res = await minify(src, {
  compress: { passes: 2 },
  mangle: true, // escopos internos apenas — nunca os nomes globais
  format: { comments: false },
});
if (!res.code) throw new Error("terser não produziu saída");
writeFileSync(OUT, res.code);

const kb = (p) => Math.round(statSync(p).size / 1024);
console.log(`obs: app.js ${kb(SRC)} KB → app.min.js ${kb(OUT)} KB`);
