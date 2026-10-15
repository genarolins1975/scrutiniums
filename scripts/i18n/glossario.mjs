/** Validação offline de estrutura e referências; não consulta nem autentica citações. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { z } from "zod";
import { criarContextoProdutos, REGISTRO_PRODUTOS } from "./produtos.mjs";

// Hosts institucionais explícitos. O portal gov.br exige também o órgão no caminho.
const ORIGENS = {
  BCB: [["www.bcb.gov.br"], ["bcb.gov.br"]],
  IBGE: [["www.ibge.gov.br"], ["ibge.gov.br"], ["biblioteca.ibge.gov.br"], ["agenciadenoticias.ibge.gov.br"]],
  IEA: [["www.iea.org"], ["iea.org"], ["iea.blob.core.windows.net", "/assets/"]],
  OECD: [["www.oecd.org"], ["oecd.org"], ["www.oecd-ilibrary.org"], ["oecd-ilibrary.org"]],
  ANEEL: [["www.gov.br", "/aneel/"]],
  ANP: [["www.gov.br", "/anp/"]],
  TESOURO: [["www.gov.br", "/tesouronacional/"], ["www.tesourotransparente.gov.br"], ["tesourotransparente.gov.br"]],
};

const texto = z.string().refine((v) => v.trim().length > 0, "Texto vazio.");
const inglesPublicavel = texto.refine((v) => !/[\u2013\u2014]/u.test(v), "Texto inglês publicável contém en dash ou em dash.");
const idFonte = z.string().regex(/^[a-z][a-z0-9_]*$/);
const idConceito = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);

function urlOficial(url, orgao) {
  try {
    const u = new URL(url);
    return url === url.trim() && u.protocol === "https:" && !u.username && !u.password && !u.port
      && ORIGENS[orgao].some(([host, prefixo]) => u.hostname === host && (!prefixo || u.pathname.startsWith(prefixo)));
  } catch { return false; }
}

const fonte = z.strictObject({
  orgao: z.enum(Object.keys(ORIGENS)),
  titulo: texto,
  url: texto,
  url_pt: texto.optional(),
  idioma: z.literal("en"),
  formato: z.enum(["pdf", "html"]),
  sha256_consultado: z.string().regex(/^[a-f0-9]{64}$/),
}).superRefine((f, ctx) => {
  for (const campo of ["url", "url_pt"]) {
    if (f[campo] !== undefined && !urlOficial(f[campo], f.orgao)) {
      ctx.addIssue({ code: "custom", path: [campo], message: `URL deve ser HTTPS institucional de ${f.orgao}, sem credenciais.` });
    }
  }
});

const evidencia = z.strictObject({
  fonte: idFonte,
  trecho: texto,
  localizacao: texto,
  pagina: z.number().int().positive().optional(),
});
const comum = {
  pt: texto,
  en: inglesPublicavel,
  contexto: texto,
  nota: texto.optional(),
};
const documentada = { ...comum, evidencias: z.array(evidencia).min(1) };
const entrada = z.discriminatedUnion("tipo", [
  z.strictObject({ tipo: z.literal("termo"), ...documentada }),
  z.strictObject({
    tipo: z.literal("nome_proprio"),
    ...documentada,
    explicacao_en: inglesPublicavel,
    formas_preservadas: z.array(texto).min(1).optional(),
  }),
  z.strictObject({
    tipo: z.literal("nome_proprio_produto"),
    ...comum,
    origem_nome: z.strictObject({
      arquivo: z.literal(REGISTRO_PRODUTOS),
      id: z.string().regex(/^[a-z][a-z0-9_]*$/),
      campo: z.literal("nomeCurto"),
    }),
    explicacao_en: inglesPublicavel,
    evidencias_explicacao: z.array(evidencia).min(1),
  }),
]);
const pendencia = z.strictObject({
  id: idConceito,
  pt: texto,
  contexto: texto,
  motivo: texto,
  origens: z.array(texto).min(1),
  depende_de: z.enum(["pesquisa", "mantenedor"]),
});

const glossario = z.strictObject({
  schema_version: z.literal(1),
  fontes: z.record(idFonte, fonte),
  entradas: z.record(idConceito, entrada),
  pendencias: z.array(pendencia),
}).superRefine((g, ctx) => {
  const erro = (path, message) => ctx.addIssue({ code: "custom", path, message });
  for (const [id, e] of Object.entries(g.entradas)) {
    if ((e.tipo === "nome_proprio" || e.tipo === "nome_proprio_produto") && e.en !== e.pt) {
      erro(["entradas", id, "en"], "Nome próprio deve ser preservado literalmente: en deve ser igual a pt.");
    }
    const campo = e.tipo === "nome_proprio_produto" ? "evidencias_explicacao" : "evidencias";
    const evidencias = e.tipo === "nome_proprio_produto" ? e.evidencias_explicacao : e.evidencias;
    evidencias.forEach((ev, i) => {
      const path = ["entradas", id, campo, i];
      if (!Object.hasOwn(g.fontes, ev.fonte)) erro([...path, "fonte"], "Referência a fonte inexistente.");
      else if (g.fontes[ev.fonte].formato === "pdf" && ev.pagina === undefined) {
        erro([...path, "pagina"], "Evidência de PDF exige página.");
      }
    });
  }
  const ids = new Set(Object.keys(g.entradas));
  g.pendencias.forEach((p, i) => {
    if (ids.has(p.id)) erro(["pendencias", i, "id"], "ID duplicado entre entradas e pendências.");
    ids.add(p.id);
  });
});

/** JSON.parse garante JSON estrito; a árvore conserva chaves que ele sobrescreveria.
 * @param {string} conteudo
 * @param {import("./produtos.mjs").ContextoProdutos} [contexto]
 */
export function lerGlossario(conteudo, contexto = undefined) {
  const dados = JSON.parse(conteudo);
  const arvore = ts.parseJsonText("glossario-en.json", conteudo);
  function visitar(no) {
    if (ts.isObjectLiteralExpression(no)) {
      const vistos = new Set();
      for (const propriedade of no.properties) {
        const chave = propriedade.name.text; // texto decodificado: "en" e "\u0065n" são iguais
        if (vistos.has(chave)) {
          const { line, character } = arvore.getLineAndCharacterOfPosition(propriedade.name.getStart(arvore));
          throw new Error(`Chave JSON duplicada ${JSON.stringify(chave)} em ${line + 1}:${character + 1}.`);
        }
        vistos.add(chave);
      }
    }
    ts.forEachChild(no, visitar);
  }
  visitar(arvore);
  const resultado = glossario.parse(dados);
  const produtos = Object.entries(resultado.entradas).filter(([, e]) => e.tipo === "nome_proprio_produto");
  if (produtos.length) {
    if (!contexto || typeof contexto.carregarProdutos !== "function") {
      throw new Error("Nome próprio de produto exige contexto do registro canônico.");
    }
    const registro = contexto.carregarProdutos();
    if (registro.arquivo !== REGISTRO_PRODUTOS || !(registro.nomes instanceof Map)) {
      throw new Error("Contexto de produtos incompatível com o registro canônico.");
    }
    const origens = new Set();
    for (const [id, e] of produtos) {
      if (e.tipo !== "nome_proprio_produto") continue;
      if (origens.has(e.origem_nome.id)) throw new Error(`Origem de produto duplicada: ${e.origem_nome.id}.`);
      origens.add(e.origem_nome.id);
      if (id !== `nome.observatorio_${e.origem_nome.id}`) throw new Error(`Chave incompatível com a origem de produto: ${id}.`);
      if (!registro.nomes.has(e.origem_nome.id) || registro.nomes.get(e.origem_nome.id) !== e.pt) {
        throw new Error(`Nome de produto diverge do registro canônico: ${id}.`);
      }
    }
  }
  return resultado;
}

/** Só nomes validados podem ser isentados pelo detector; explicações continuam prosa.
 * @param {string} conteudo
 * @param {import("./produtos.mjs").ContextoProdutos} [contexto]
 */
export function lerNomesPreservados(conteudo, contexto = undefined) {
  const g = lerGlossario(conteudo, contexto);
  return Object.values(g.entradas).flatMap((e) => {
    if (e.tipo === "nome_proprio") return [e.pt, ...(e.formas_preservadas ?? [])];
    if (e.tipo === "nome_proprio_produto") return [e.pt];
    return [];
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 3) throw new Error("Uso: node scripts/i18n/glossario.mjs [arquivo.json]");
    const arquivo = process.argv[2] ?? fileURLToPath(new URL("../../config/glossario-en.json", import.meta.url));
    const g = lerGlossario(readFileSync(arquivo, "utf8"), criarContextoProdutos(fileURLToPath(new URL("../../", import.meta.url))));
    console.log(`Glossário válido: ${Object.keys(g.entradas).length} entradas, ${g.pendencias.length} pendências; validação offline.`);
  } catch (erro) { console.error(erro.message); process.exitCode = 1; }
}
