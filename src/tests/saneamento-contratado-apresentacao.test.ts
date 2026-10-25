import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as contratos from "@/lib/saneamento/contratos";
import { renderToStaticMarkup } from "react-dom/server";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import { apresentarNotaContratado, rotuloConferencia } from "@/lib/saneamento/contratos-apresentacao";
import { goldContratado, reaisMi } from "@/lib/saneamento/contratos";
import Pagina from "@/app/saneamento/contratado/page";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  useRouter: () => ({ push() {}, replace() {}, prefetch() {} }),
  usePathname: () => "/saneamento/contratado",
  useSearchParams: () => new URLSearchParams(),
}));

type No = DefaultTreeAdapterMap["node"];
function elementos(no: No, predicado: (el: DefaultTreeAdapterMap["element"]) => boolean): DefaultTreeAdapterMap["element"][] {
  const atual = "tagName" in no && predicado(no) ? [no] : [];
  return [...atual, ...("childNodes" in no ? no.childNodes.flatMap((filho) => elementos(filho, predicado)) : [])];
}
function texto(no: No): string {
  return "value" in no ? no.value : "childNodes" in no ? no.childNodes.map(texto).join("") : "";
}
const atributo = (no: DefaultTreeAdapterMap["element"], nome: string) => no.attrs.find((a) => a.name === nome)?.value;
const g = goldContratado()!;
const html = renderToStaticMarkup(createElement(Pagina));
const arvore = parse(html);

// Decisão do dono, pacote B da Onda S1 de 25/10/2026: os quatro tratamentos de texto
// abaixo são deliberados. A prova da página usa estrutura, valores e ausência dos bastidores.
describe("notas públicas do contratado", () => {
  it("retira a marca de inclusão e o solicitante, preservando o fato", () => {
    expect(apresentarNotaContratado("Linha extra (pedido: Maria). Investimento de R$ 10 bi."))
      .toBe("Investimento de R$ 10 bi.");
    expect(apresentarNotaContratado("Linha extra, exemplo de PPP em 2026."))
      .toBe("exemplo de PPP em 2026.");
  });
  it("explicita divergência sem resolver os valores", () => {
    expect(apresentarNotaContratado("DIVERGÊNCIA: R$ 6,3 bi e R$ 10,3 bi."))
      .toBe("Fontes divergem: R$ 6,3 bi e R$ 10,3 bi.");
  });
  it("não apresenta suposição como valor confirmado", () => {
    expect(apresentarNotaContratado("R$ 10,3 bi (provavelmente valor do contrato)"))
      .toBe("R$ 10,3 bi (valor não confirmado na fonte)");
  });
  it("traduz os graus sem atribuir natureza oficial à imprensa", () => {
    expect(rotuloConferencia("V", "noticia_oficial")).toBe("conferido na fonte oficial");
    expect(rotuloConferencia("V", "documento_oficial")).toBe("conferido na fonte oficial");
    // A gold inclui IstoÉ, InfoMoney e CNN como imprensa V. Conferir não muda a natureza da fonte.
    expect(rotuloConferencia("V", "imprensa")).toBe("conferido na fonte consultada");
    expect(rotuloConferencia("V")).toBe("conferido na fonte consultada");
    expect(rotuloConferencia("S", "noticia_oficial")).toBe("só em fonte secundária");
    expect(apresentarNotaContratado("Imprensa (V), outra fonte (S)"))
      .toBe("Imprensa (conferido na fonte consultada), outra fonte (só em fonte secundária)");
  });
  it("preserva palavras acentuadas que começam com a letra de um grau", () => {
    const nota = "Só esgoto em São Gonçalo do Amarante, 91,55%.";
    expect(apresentarNotaContratado(nota)).toBe(nota);
  });
  it("não deixa bastidores em nenhuma observação publicada", () => {
    const notas = [...g.leiloes, ...g.contratos, ...g.custos].map((x) => x.observacoes).filter((x): x is string => !!x);
    for (const nota of notas) {
      expect(apresentarNotaContratado(nota)).not.toMatch(/Linha extra|pedido:|provavelmente|\([VS]\)/i);
    }
    expect(html.match(/.{0,80}(?:Linha extra|pedido:|provavelmente|\([VS]\)).{0,80}/gi)).toBeNull();
    expect(texto(arvore)).not.toMatch(/\b(?:undefined|NaN)\b/);
  });
});

describe("tabela comparável com auditoria por linha", () => {
  it("mantém todas as identificações, valores, fontes e notas no HTML", () => {
    const linhas = elementos(arvore, (n) => atributo(n, "data-leilao") !== undefined);
    expect(linhas).toHaveLength(g.leiloes.length);
    for (const leilao of g.leiloes) {
      const linha = linhas.find((n) => atributo(n, "data-leilao") === leilao.id)!;
      const conteudo = texto(linha);
      expect(conteudo).toContain(leilao.objeto);
      expect(conteudo).toContain(leilao.poder_concedente);
      expect(conteudo).toContain(rotuloConferencia(leilao.fonte.grau, leilao.fonte.tipo_fonte));
      for (const valor of [leilao.outorga_rs_mi, leilao.contraprestacao_rs_mi, leilao.investimento_previsto_rs_mi]) {
        expect(conteudo).toContain(reaisMi(valor));
      }
      expect(elementos(linha, (n) => atributo(n, "href") === leilao.fonte.url)).toHaveLength(1);
      if (leilao.observacoes) {
        expect(conteudo).not.toContain(apresentarNotaContratado(leilao.observacoes));
        const nota = elementos(arvore, (n) => atributo(n, "data-nota-leilao") === leilao.id);
        expect(nota).toHaveLength(1);
        const detalhes = elementos(nota[0], (n) => n.tagName === "details");
        expect(detalhes).toHaveLength(1);
        expect(atributo(detalhes[0], "open")).toBeUndefined();
        expect(texto(detalhes[0])).toContain(apresentarNotaContratado(leilao.observacoes));
      }
    }
  });
  it("preserva notas de contratos e estimativas em detalhes, inclusive as não lidas", () => {
    const detalhes = elementos(arvore, (n) => n.tagName === "details" && atributo(n, "data-notas-linha") !== undefined);
    for (const item of [...g.contratos, ...g.custos]) {
      if (item.observacoes) expect(detalhes.some((d) => texto(d).includes(apresentarNotaContratado(item.observacoes!))), item.id).toBe(true);
    }
  });
  it("mantém motivo e tentativas dos documentos não lidos sem bastidor de pesquisa", () => {
    const naoLido = {
      id: "documento-nao-lido-teste", nome: "Documento não localizado no teste",
      motivo: "Documento público não localizado",
      tentativas: ["Linha extra (pedido: Maria). Portal indisponível.", "Outra fonte (S)"],
    };
    const leitura = vi.spyOn(contratos, "goldContratado").mockReturnValueOnce({ ...g, nao_lidos: [naoLido] });
    try {
      const renderizado = parse(renderToStaticMarkup(createElement(Pagina)));
      const lista = elementos(renderizado, (n) => atributo(n, "data-nao-lidos") !== undefined)[0];
      expect(texto(lista)).toContain(naoLido.nome);
      expect(texto(lista)).toContain(naoLido.motivo);
      expect(texto(lista)).not.toMatch(/Linha extra|pedido:|\([VS]\)/i);
      const detalhes = elementos(lista, (n) => n.tagName === "details");
      expect(detalhes.some((n) => texto(n).includes(apresentarNotaContratado(naoLido.tentativas.join("; "))))).toBe(true);
    } finally { leitura.mockRestore(); }
  });
  it("declara a comparação e mantém a tabela dentro de região focável", () => {
    const regioes = elementos(arvore, (n) => atributo(n, "aria-label") === "Tabela de leilões desde 2020");
    expect(regioes).toHaveLength(1);
    expect(atributo(regioes[0], "tabindex")).toBe("0");
    expect(elementos(regioes[0], (n) => n.tagName === "table" && atributo(n, "data-comparacao") !== undefined)).toHaveLength(1);
  });
});

// O pedido da Onda S1 exige a prova no HTML publicado, incluindo conteúdo serializado.
// Ausência de build é falha de pré-requisito, nunca teste pulado; rode npm run build.
it("HTML do build não publica notas internas nem siglas de conferência soltas", () => {
  const publicado = readFileSync(join(process.cwd(), ".next/server/app/saneamento/contratado.html"), "utf8");
  expect(publicado).not.toMatch(/Linha extra|pedido:|provavelmente|\([VS]\)/i);
  const documento = parse(publicado);
  const main = elementos(documento, (n) => n.tagName === "main");
  expect(main).toHaveLength(1);
  expect(texto(main[0])).not.toMatch(/\b(?:undefined|NaN)\b/);
  for (const linha of g.leiloes.filter((l) => l.observacoes)) {
    const nota = elementos(main[0], (n) => atributo(n, "data-nota-leilao") === linha.id);
    expect(nota, linha.id).toHaveLength(1);
    expect(elementos(nota[0], (n) => n.tagName === "details")).toHaveLength(1);
    expect(texto(nota[0])).toContain(apresentarNotaContratado(linha.observacoes!));
  }
});
