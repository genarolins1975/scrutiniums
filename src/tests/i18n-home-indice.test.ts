import { beforeAll, describe, expect, it } from "vitest";
import { pt } from "@/i18n/pt";
import { en } from "@/i18n/en";
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { DIMENSOES } from "@/lib/eficiencia/dimensoes";
import { CAPITULOS, PAINEIS_COM_DADOS } from "@/lib/contas-publicas/catalogo";
import primariosEstaduais from "@/lib/contas-estaduais/primarios.json";
import { CAPITULOS as CAPITULOS_SANEAMENTO } from "@/lib/saneamento/capitulos";
import { PAGINAS_GAS } from "@/lib/gas/navegacao";
import type { DominioId } from "@/lib/dominios";
import { formatarContagemIndice } from "@/lib/i18n-home-indice";
import { vitrines, type ContagemIndice, type UnidadeSimplesIndice, type Vitrine } from "@/lib/vitrine";

const MENSAGENS = [
  { chave: "home.indice.rotulo", pt: "Índice dos observatórios", en: "Observatory index" },
  {
    chave: "home.indice.ilustracoes",
    pt: "Ilustrações editoriais de cada observatório. Não representam dados nem lugares específicos.",
    en: "Editorial illustrations for each observatory. They do not represent data or specific places.",
  },
  { chave: "home.indice.paginas_tematicas", pt: "páginas temáticas", en: "thematic pages" },
  { chave: "home.indice.secoes_publicadas", pt: "seções publicadas", en: "published sections" },
  { chave: "home.indice.temas_publicados", pt: "temas publicados", en: "published topics" },
  { chave: "home.indice.capitulos_com_dados", pt: "capítulos com dados", en: "chapters with data" },
  { chave: "home.indice.unidades_federacao", pt: "unidades da Federação", en: "Federation Units" },
  { chave: "home.indice.paginas_por_pergunta", pt: "páginas por pergunta", en: "pages by question" },
  { chave: "home.indice.contagem_parcial", pt: "{publicados} de {total}", en: "{publicados} of {total}" },
] as const;

const UNIDADES_EN = {
  paginas_tematicas: "thematic pages",
  secoes_publicadas: "published sections",
  temas_publicados: "published topics",
  capitulos_com_dados: "chapters with data",
  unidades_federacao: "Federation Units",
  paginas_por_pergunta: "pages by question",
} satisfies Record<ContagemIndice["unidade"], string>;

describe("mensagens literais do índice da home", () => {
  it.each(MENSAGENS)("preserva o par aprovado de $chave", (mensagem) => {
    expect(pt[mensagem.chave]).toBe(mensagem.pt);
    expect(en[mensagem.chave]).toEqual({ estado: "traduzido", texto: mensagem.en });
  });

  it("mantém exatamente as nove chaves do recorte nos dois catálogos", () => {
    const chaves = MENSAGENS.map(({ chave }) => chave).sort();
    expect(Object.keys(pt).filter((chave) => chave.startsWith("home.indice.")).sort()).toEqual(chaves);
    expect(Object.keys(en).filter((chave) => chave.startsWith("home.indice.")).sort()).toEqual(chaves);
  });

  it.each([
    { idioma: "pt", texto: pt["home.indice.contagem_parcial"] },
    { idioma: "en", texto: en["home.indice.contagem_parcial"].texto },
  ])("contagem parcial em $idioma tem exatamente um token de cada, na ordem declarada", ({ texto }) => {
    expect(texto.match(/\{[^{}]*\}/g)).toEqual(["{publicados}", "{total}"]);
    expect(texto.startsWith("{publicados}")).toBe(true);
    expect(texto.endsWith("{total}")).toBe(true);
    expect(texto.replace("{publicados}", "").replace("{total}", "")).not.toMatch(/[{}]/);
  });
});

// As expectativas vêm dos registros de origem, não de contagem, contagemIndice
// ou de outro resultado do adaptador. Nenhuma fonte publicada é simulada ou alterada.
const CONTAGENS_REAIS = {
  agro: { tipo: "simples", quantidade: 8, unidade: "paginas_por_pergunta" },
  credito: {
    tipo: "simples",
    quantidade: ABAS_OBSERVATORIO.reduce((n, aba) => n + Number(
      !aba.caminho.endsWith("/") && aba.caminho !== "/suggestions" && aba.caminho !== "/about",
    ), 0),
    unidade: "paginas_tematicas",
  },
  energia: {
    tipo: "simples", quantidade: DESTINOS_NAVEGACAO.reduce((n, destino) => n + Number(destino.publicado), 0),
    unidade: "secoes_publicadas",
  },
  eficiencia: {
    tipo: "simples", quantidade: DIMENSOES.reduce((n, dimensao) => n + Number(Boolean(dimensao.href)), 0),
    unidade: "temas_publicados",
  },
  contas: {
    tipo: "parcial", publicados: PAINEIS_COM_DADOS.length, total: CAPITULOS.length, unidade: "capitulos_com_dados",
  },
  estados: { tipo: "simples", quantidade: primariosEstaduais.cobertura.ufs, unidade: "unidades_federacao" },
  saneamento: {
    tipo: "parcial",
    publicados: CAPITULOS_SANEAMENTO.reduce((n, capitulo) => n + Number(capitulo.situacao !== "em_preparacao"), 0),
    total: CAPITULOS_SANEAMENTO.length,
    unidade: "capitulos_com_dados",
  },
  gas: { tipo: "simples", quantidade: PAGINAS_GAS.length, unidade: "paginas_por_pergunta" },
} satisfies Record<DominioId, ContagemIndice>;

describe("oito contagens semânticas derivadas das fontes reais", () => {
  let padrao: ReturnType<typeof vitrines>;
  let portugues: ReturnType<typeof vitrines>;
  let ingles: ReturnType<typeof vitrines>;
  beforeAll(() => {
    padrao = vitrines();
    portugues = vitrines("pt");
    ingles = vitrines("en");
  });

  it.each(Object.entries(CONTAGENS_REAIS) as [DominioId, ContagemIndice][])(
    "%s conserva os mesmos inteiros e unidade semântica em PT e EN", (id, esperado) => {
      expect(padrao[id].contagemIndice).toEqual(esperado);
      expect(portugues[id].contagemIndice).toEqual(esperado);
      expect(ingles[id].contagemIndice).toEqual(esperado);
      expect(formatarContagemIndice(portugues[id])).toBe(portugues[id].contagem);
      expect(formatarContagemIndice(portugues[id], "pt")).toBe(portugues[id].contagem);
      expect(formatarContagemIndice(portugues[id], "en").unidade).toBe(UNIDADES_EN[esperado.unidade]);
    },
  );
});

type EntradaIndice = Readonly<Pick<Vitrine, "contagem" | "contagemIndice">>;

function congelada(contagemIndice: ContagemIndice): EntradaIndice {
  return Object.freeze({
    // Deliberadamente incompatível: não pode ser reinterpretada como quantidade.
    contagem: Object.freeze({ valor: "9.876,54 de texto português", unidade: "unidade portuguesa incompatível" }),
    contagemIndice: Object.freeze({ ...contagemIndice }),
  });
}

describe("adaptador numérico exclusivo do índice", () => {
  const simples = [
    "paginas_tematicas", "secoes_publicadas", "temas_publicados", "unidades_federacao", "paginas_por_pergunta",
  ] as const satisfies readonly UnidadeSimplesIndice[];

  it.each(simples)("formata %s com inteiros sem ler nem modificar a contagem portuguesa", (unidade) => {
    for (const [quantidade, valor] of [[0, "0"], [1234, "1,234"], [12345, "12,345"]] as const) {
      const entrada = congelada({ tipo: "simples", quantidade, unidade });
      const antes = structuredClone(entrada);
      const resultado = formatarContagemIndice(entrada, "en");
      expect(resultado).toEqual({ valor, unidade: UNIDADES_EN[unidade] });
      expect(resultado).not.toBe(entrada.contagem);
      expect(entrada).toEqual(antes);
    }
  });

  it.each([
    { publicados: 1234, total: 5678, valor: "1,234 of 5,678" },
    { publicados: 1234, total: 12345, valor: "1,234 of 12,345" },
    { publicados: 0, total: 5678, valor: "0 of 5,678" },
    { publicados: 0, total: 0, valor: "0 of 0" },
  ])("formata separadamente $publicados publicados e $total no total", ({ publicados, total, valor }) => {
    const entrada = congelada({ tipo: "parcial", publicados, total, unidade: "capitulos_com_dados" });
    const antes = structuredClone(entrada);
    expect(formatarContagemIndice(entrada, "en")).toEqual({ valor, unidade: "chapters with data" });
    expect(entrada).toEqual(antes);
  });

  it("PT implícito e explícito devolvem a referência original sem consultar a contagem semântica", () => {
    const contagem = Object.freeze({ valor: "1.234,50", unidade: "unidade sintética" });
    const entrada: EntradaIndice = Object.freeze({
      contagem,
      get contagemIndice(): ContagemIndice { throw new Error("PT não deve consultar a contagem semântica"); },
    });
    expect(formatarContagemIndice(entrada)).toBe(contagem);
    expect(formatarContagemIndice(entrada, "pt")).toBe(contagem);
    expect(contagem).toEqual({ valor: "1.234,50", unidade: "unidade sintética" });
  });

  it("EN consulta exclusivamente os números semânticos, mesmo se o texto PT não puder ser lido", () => {
    const contagemIndice = Object.freeze({ tipo: "parcial", publicados: 1234, total: 5678, unidade: "capitulos_com_dados" } as const);
    const entrada: EntradaIndice = Object.freeze({
      get contagem(): Vitrine["contagem"] { throw new Error("EN não deve consultar a contagem portuguesa"); },
      contagemIndice,
    });
    expect(formatarContagemIndice(entrada, "en")).toEqual({ valor: "1,234 of 5,678", unidade: "chapters with data" });
    expect(contagemIndice).toEqual({ tipo: "parcial", publicados: 1234, total: 5678, unidade: "capitulos_com_dados" });
  });

  it("PT conserva contagem parcial sem separador de milhar enquanto EN usa os dois inteiros", () => {
    const entrada: EntradaIndice = Object.freeze({
      contagem: Object.freeze({ valor: "1234 de 5678", unidade: "capítulos com dados" }),
      contagemIndice: Object.freeze({ tipo: "parcial", publicados: 1234, total: 5678, unidade: "capitulos_com_dados" } as const),
    });
    const antes = structuredClone(entrada);
    expect(formatarContagemIndice(entrada)).toBe(entrada.contagem);
    expect(formatarContagemIndice(entrada, "pt")).toEqual({ valor: "1234 de 5678", unidade: "capítulos com dados" });
    expect(formatarContagemIndice(entrada, "en")).toEqual({ valor: "1,234 of 5,678", unidade: "chapters with data" });
    expect(entrada).toEqual(antes);
  });
});
