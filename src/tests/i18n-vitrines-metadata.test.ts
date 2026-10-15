import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it, type TestContext } from "vitest";

type No = DefaultTreeAdapterMap["node"];
type Elemento = DefaultTreeAdapterMap["element"];
const APP = join(process.cwd(), ".next", "server", "app");
const EXIGIR = process.env.EXIGIR_BUILD_HTML === "1";

// Textos dos metadados PT anteriores à criação das irmãs. Os cartões próprios
// substituíam o OG ancestral inteiro, sem siteName ou imagens, nas duas folhas.
const VITRINES = [
  {
    caminho: "/imprensa",
    titulo: "Para a imprensa — números citáveis com fonte primária · Scrutiniums",
    descricao: "Bets e fraudes financeiras no Brasil em números verificáveis: cada dado com fonte primária, grau de evidência e data de referência, prontos para citação.",
    tituloSocial: "Scrutiniums para a imprensa",
    descricaoSocial: "Números citáveis sobre apostas online e fraudes financeiras, com fonte primária e grau de evidência declarados.",
  },
  {
    caminho: "/observatorio-do-credito",
    titulo: "Observatório Brasileiro de Crédito · Scrutiniums",
    descricao: "Crédito, instituições financeiras, Pix, juros e litigiosidade em uma plataforma gratuita: dados oficiais do Banco Central, CVM, IBGE e CNJ com metodologia aberta, distinguindo dado observado de indicador calculado.",
    tituloSocial: "Observatório Brasileiro de Crédito",
    descricaoSocial: "O mercado de crédito brasileiro explicado com rigor: 12 fontes oficiais, metodologia aberta e gratuito.",
  },
] as const;

function elementos(no: No): Elemento[] {
  return [...("tagName" in no ? [no] : []), ...("childNodes" in no ? no.childNodes.flatMap(elementos) : [])];
}
function texto(no: No): string {
  return "value" in no ? no.value : "childNodes" in no ? no.childNodes.map(texto).join("") : "";
}
const attr = (no: Elemento, nome: string) => no.attrs.find((atributo) => atributo.name === nome)?.value;

function headPublicado(ctx: TestContext, caminho: string): Elemento[] {
  if (!existsSync(APP) && !EXIGIR) ctx.skip("sem build local; rode npm run build para verificar os cartões PT das vitrines");
  expect(existsSync(APP), "EXIGIR_BUILD_HTML=1 requer .next/server/app").toBe(true);
  const arquivo = join(APP, caminho.slice(1) + ".html");
  expect(existsSync(arquivo), `HTML ausente: ${caminho}; gere um build completo`).toBe(true);
  const heads = elementos(parse(readFileSync(arquivo, "utf8"))).filter((no) => no.tagName === "head");
  expect(heads, caminho).toHaveLength(1);
  return elementos(heads[0]);
}

describe.each(VITRINES)("head português preservado em $caminho", (pagina) => {
  it("mantém os títulos, descrições e cartão próprio sem imagens ou siteName ancestrais", (ctx) => {
    const head = headPublicado(ctx, pagina.caminho);
    const meta = (nome: string) => head.filter((no) => no.tagName === "meta"
      && (attr(no, "name") === nome || attr(no, "property") === nome)).map((no) => attr(no, "content"));

    expect(head.filter((no) => no.tagName === "title").map(texto)).toEqual([pagina.titulo]);
    expect(meta("description")).toEqual([pagina.descricao]);
    for (const nome of ["og:title", "twitter:title"]) expect(meta(nome), nome).toEqual([pagina.tituloSocial]);
    for (const nome of ["og:description", "twitter:description"]) expect(meta(nome), nome).toEqual([pagina.descricaoSocial]);
    expect(meta("og:type")).toEqual(["website"]);
    expect(meta("twitter:card")).toEqual(["summary_large_image"]);
    expect(meta("og:site_name")).toEqual([]);
    expect(head.filter((no) => no.tagName === "meta" && /^(?:og|twitter):image(?::|$)/
      .test(attr(no, "name") ?? attr(no, "property") ?? ""))).toEqual([]);
  });
});
