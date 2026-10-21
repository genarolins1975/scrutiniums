import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { lerCatalogo } from "../../scripts/i18n/catalogo.mjs";

const ptReal = readFileSync(new URL("../i18n/pt.ts", import.meta.url), "utf8");
const enReal = readFileSync(new URL("../i18n/en.ts", import.meta.url), "utf8");
const portugues = { "teste.texto": "Texto sintético", "teste.pendente": "Texto em português" };
const ingles = {
  "teste.texto": { estado: "traduzido", texto: "Synthetic text" },
  "teste.pendente": { estado: "traduzido", texto: "Another synthetic text" },
};
const fontePt = (valor: unknown = portugues) => `export const pt = ${JSON.stringify(valor)} as const;`;
const fonteEn = (valor: unknown = ingles) => `export const en = ${JSON.stringify(valor)} as const;`;
const unicoEn = 'export const en = {x:{estado:"traduzido",texto:"Synthetic"}} as const;';

describe("leitura literal dos catálogos PT e EN", () => {
  it("lê as mensagens de infraestrutura e confere todas as chaves sem importar os módulos", () => {
    const catalogo = lerCatalogo(ptReal, enReal);
    expect(catalogo.pt).toMatchObject({
      "idioma.portugues": "Português",
      "idioma.ingles": "Inglês",
      "idioma.seletor": "Idioma",
      "traducao.portugues_apenas": "Somente em português",
    });
    expect(catalogo.en).toMatchObject({
      "idioma.portugues": { estado: "traduzido", texto: "Portuguese" },
      "idioma.ingles": { estado: "traduzido", texto: "English" },
      "idioma.seletor": { estado: "traduzido", texto: "Language" },
      "traducao.portugues_apenas": { estado: "traduzido", texto: "Portuguese only" },
    });
    expect(Object.keys(catalogo.pt).sort()).toEqual(Object.keys(catalogo.en).sort());
  });

  it("aceita fallback declarado por motivo sem copiar o texto português", () => {
    const fallback = { estado: "portugues_marcado", motivo: "Pesquisa – aguardando revisão." };
    const resultado = lerCatalogo(fontePt(), fonteEn({ ...ingles, "teste.pendente": fallback }));
    expect(resultado.pt).toEqual(portugues);
    expect(resultado.en).toEqual({ ...ingles, "teste.pendente": fallback });
    expect(resultado.en["teste.pendente"]).not.toHaveProperty("texto");
  });

  it.each([
    ["ausente", { "teste.texto": ingles["teste.texto"] }],
    ["extra", { ...ingles, "teste.extra": { estado: "traduzido", texto: "Extra" } }],
    ["substituída", { "teste.texto": ingles["teste.texto"], "teste.outra": ingles["teste.pendente"] }],
  ])("rejeita chave inglesa %s", (_, en) => {
    expect(() => lerCatalogo(fontePt(), fonteEn(en))).toThrow("mesmas chaves");
  });

  it.each([
    ["PT", 'export const pt = {"x":"Mesmo", "x":"Mesmo"} as const;', 'export const en = {x:{estado:"traduzido",texto:"Same"}} as const;'],
    ["EN", 'export const pt = {x:"Mesmo"} as const;', 'export const en = {x:{estado:"traduzido",texto:"Same"},x:{estado:"traduzido",texto:"Same"}} as const;'],
    ["campo de estado", 'export const pt = {x:"Mesmo"} as const;', 'export const en = {x:{estado:"traduzido",estado:"traduzido",texto:"Same"}} as const;'],
    ["escape equivalente", 'export const pt = {"x":"Mesmo", "\\u0078":"Mesmo"} as const;', 'export const en = {x:{estado:"traduzido",texto:"Same"}} as const;'],
  ])("rejeita chave duplicada em %s antes de sobrescrever valores", (_, pt, en) => {
    expect(() => lerCatalogo(pt, en)).toThrow("chave duplicada");
  });

  it.each([
    ["import de runtime", `import { pt } from "./outro"; ${unicoEn}`],
    ["import por efeito colateral", `import "./outro"; ${unicoEn}`],
    ["valor auxiliar", `const auxiliar = "Synthetic"; ${unicoEn}`],
    ["export let", unicoEn.replace("export const", "export let")],
    ["export default", 'export default {x:{estado:"traduzido",texto:"Synthetic"}};'],
    ["segunda exportação", `${unicoEn} export const outro = "Extra";`],
    ["exportação repetida", `${unicoEn} ${unicoEn}`],
    ["concatenação", 'export const en = {x:{estado:"traduzido",texto:"Syn" + "thetic"}} as const;'],
    ["chamada", 'export const en = (() => ({x:{estado:"traduzido",texto:"Synthetic"}}))();'],
    ["spread", 'export const en = {...{x:{estado:"traduzido",texto:"Synthetic"}}} as const;'],
    ["chave calculada", 'export const en = {["x"]:{estado:"traduzido",texto:"Synthetic"}} as const;'],
    ["shorthand", 'export const en = {x} as const;'],
    ["getter", 'export const en = {get x() { return {estado:"traduzido",texto:"Synthetic"}; }} as const;'],
    ["template literal", 'export const en = {x:{estado:"traduzido",texto:`Synthetic`}} as const;'],
    ["asserção de tipo", 'export const en = {x:{estado:"traduzido",texto:"Synthetic"}} as DicionarioEn;'],
    ["sintaxe incompleta", 'export const en = {x:'],
  ])("recusa construção fora do formato literal: %s", (_, en) => {
    expect(() => lerCatalogo('export const pt = {x:"Sintético"} as const;', en)).toThrow();
  });

  it("recusa expressão também no português", () => {
    expect(() => lerCatalogo('export const pt = {x: String("Texto")};', 'export const en = {x:{estado:"traduzido",texto:"Text"}};'))
      .toThrow();
  });

  it.each(["", "export const pt = {} as const;", 'export const pt = "Texto" as const;'])("recusa português ausente, vazio ou fora de objeto: %s", (pt) => {
    expect(() => lerCatalogo(pt, fonteEn())).toThrow();
  });

  it.each([
    ["PT vazio", { ...portugues, "teste.texto": "" }, ingles],
    ["PT whitespace", { ...portugues, "teste.texto": " \t\n " }, ingles],
    ["EN vazio", portugues, { ...ingles, "teste.texto": { estado: "traduzido", texto: "" } }],
    ["EN whitespace", portugues, { ...ingles, "teste.texto": { estado: "traduzido", texto: " \t " } }],
    ["motivo vazio", portugues, { ...ingles, "teste.texto": { estado: "portugues_marcado", motivo: " \n " } }],
  ])("rejeita %s", (_, pt, en) => {
    expect(() => lerCatalogo(fontePt(pt), fonteEn(en))).toThrow("texto não vazio");
  });

  it.each([
    ["estado ausente", { texto: "Synthetic text" }],
    ["estado desconhecido", { estado: "automatico", texto: "Synthetic text" }],
    ["string sem estado", "Synthetic text"],
    ["tradução sem texto", { estado: "traduzido" }],
    ["tradução com motivo adicional", { estado: "traduzido", texto: "Synthetic", motivo: "Extra" }],
    ["fallback sem motivo", { estado: "portugues_marcado" }],
    ["fallback com texto copiado", { estado: "portugues_marcado", motivo: "Sem tradução.", texto: portugues["teste.texto"] }],
  ])("rejeita entrada com %s", (_, entrada) => {
    expect(() => lerCatalogo(fontePt(), fonteEn({ ...ingles, "teste.texto": entrada }))).toThrow();
  });

  it.each(["–", "—"])("proíbe %s no texto inglês sem alterar o texto original PT", (traco) => {
    const pt = { ...portugues, "teste.texto": `Texto ${traco} original` };
    expect(lerCatalogo(fontePt(pt), fonteEn()).pt).toEqual(pt);
    expect(() => lerCatalogo(fontePt(pt), fonteEn({ ...ingles, "teste.texto": { estado: "traduzido", texto: `Synthetic ${traco} text` } })))
      .toThrow("en dash ou em dash");
  });
});

function removerChave(codigo: string, chave: string) {
  const fonte = ts.createSourceFile("en.ts", codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let removidas = 0;
  const transformacao = ts.transform(fonte, [(contexto) => (raiz) => {
    const visitar: ts.Visitor = (no) => {
      if (ts.isObjectLiteralExpression(no)) {
        const propriedades = no.properties.filter((propriedade) => {
          if (ts.isPropertyAssignment(propriedade)
            && (ts.isStringLiteral(propriedade.name) || ts.isIdentifier(propriedade.name))
            && propriedade.name.text === chave) {
            removidas++;
            return false;
          }
          return true;
        });
        if (propriedades.length !== no.properties.length) return ts.factory.updateObjectLiteralExpression(no, propriedades);
      }
      return ts.visitEachChild(no, visitar, contexto);
    };
    return ts.visitNode(raiz, visitar) as ts.SourceFile;
  }]);
  try {
    expect(removidas).toBe(1);
    return ts.createPrinter().printFile(transformacao.transformed[0]);
  } finally { transformacao.dispose(); }
}

describe("contrato TypeScript real do catálogo", () => {
  it("compila as cópias reais e reprova uma chave inglesa ausente sem compilar a aplicação", () => {
    const raiz = mkdtempSync(join(tmpdir(), "i18n-catalogo-tipos-"));
    try {
      const pt = join(raiz, "pt.ts");
      const en = join(raiz, "en.ts");
      writeFileSync(pt, ptReal);
      writeFileSync(en, enReal);
      const opcoes: ts.CompilerOptions = {
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        types: [],
        lib: ["lib.es2022.d.ts"],
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
      };
      const diagnosticos = () => ts.getPreEmitDiagnostics(ts.createProgram([pt, en], opcoes));
      expect(diagnosticos()).toEqual([]);

      writeFileSync(en, removerChave(enReal, "idioma.ingles"));
      const erros = diagnosticos();
      expect(erros).toHaveLength(1);
      expect(erros[0].file?.fileName).toBe(en);
      expect(erros[0].code).toBe(1360);
      const mensagem = ts.flattenDiagnosticMessageText(erros[0].messageText, "\n");
      expect(mensagem).toContain('"idioma.ingles"');
      expect(mensagem).toContain("is missing");
      expect(mensagem).toContain("DicionarioEn");
    } finally { rmSync(raiz, { recursive: true, force: true }); }
  });
});
