import { readFileSync, writeFileSync, statSync } from "node:fs";

/**
 * Build do SPA do Observatório com split por rota (P2 da auditoria).
 *
 * O app.js legível segue no git como fonte canônica ÚNICA (testes e patches
 * leem dele; servido inteiro, o despacho por presença o torna funcional sem
 * chunks). O build extrai as regiões marcadas com
 *   /* @chunk:NOME:ini *\/ ... /* @chunk:NOME:fim *\/
 * para app-NOME.min.js e minifica o restante como app.min.js (core). O core
 * carrega os chunks sob demanda (ensureChunk) na primeira visita à rota.
 *
 * Segurança: mangle apenas de escopo interno (sem `toplevel`), porque os
 * handlers inline (onclick="nav('pulse')") e o despacho por nome
 * (window[RENDER[v]]) dependem dos nomes globais dos scripts clássicos.
 */
const { minify } = await import("terser");

const SRC = "public/obs/app.js";
const src = readFileSync(SRC, "utf8");

const RE = /\/\* @chunk:(\w+):(ini|fim) \*\/\n/g;
const chunks = {};
let core = "";
let cursor = 0;
let aberto = null; // [nome, posIniConteudo]
for (const m of src.matchAll(RE)) {
  const [tag, nome, tipo] = m;
  if (tipo === "ini") {
    if (aberto) throw new Error(`marcador ${nome}:ini dentro de ${aberto[0]} aberto`);
    core += src.slice(cursor, m.index);
    aberto = [nome, m.index + tag.length];
  } else {
    if (!aberto || aberto[0] !== nome) throw new Error(`marcador ${nome}:fim sem ini correspondente`);
    chunks[nome] = (chunks[nome] || "") + src.slice(aberto[1], m.index) + "\n";
    aberto = null;
  }
  cursor = m.index + tag.length;
}
if (aberto) throw new Error(`marcador ${aberto[0]}:ini sem fim`);
core += src.slice(cursor);

const kb = (s) => Math.round(Buffer.byteLength(s, "utf8") / 1024);
const min = async (code, rotulo) => {
  const res = await minify(code, {
    compress: { passes: 2 },
    mangle: true, // escopos internos apenas — nunca os nomes globais
    format: { comments: false },
  });
  if (!res.code) throw new Error(`terser não produziu saída para ${rotulo}`);
  return res.code;
};

const coreMin = await min(core, "core");
writeFileSync("public/obs/app.min.js", coreMin);
let linha = `obs: app.js ${kb(src)} KB → core ${kb(coreMin)} KB`;
for (const [nome, code] of Object.entries(chunks)) {
  const cMin = await min(code, nome);
  writeFileSync(`public/obs/app-${nome}.min.js`, cMin);
  linha += ` + ${nome} ${kb(cMin)} KB`;
}
console.log(linha);
