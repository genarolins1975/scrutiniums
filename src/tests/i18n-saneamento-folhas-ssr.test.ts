import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { MetaSaneamento, Municipio, Prestador, TabelaMunicipios } from "@/lib/saneamento/tipos";

// Só os leitores ativos no cenário recebem dados de apresentação. Os demais
// exports, modelos e componentes permanecem reais. Undefined delega; null não.
const troca = vi.hoisted(() => {
  const estado: { meta: MetaSaneamento | null | undefined; municipios: Municipio[] | undefined; prestadores: Prestador[] | undefined }
    = { meta: undefined, municipios: undefined, prestadores: undefined };
  return estado;
});
vi.mock("@/lib/saneamento/gold", async (original) => {
  const modulo = await original<typeof import("@/lib/saneamento/gold")>();
  return { ...modulo,
    meta: () => troca.meta === undefined ? modulo.meta() : troca.meta,
    municipios: () => troca.municipios === undefined ? modulo.municipios() : troca.municipios,
    prestadores: () => troca.prestadores === undefined ? modulo.prestadores() : troca.prestadores,
  };
});

import CompararMunicipiosPage from "@/app/saneamento/comparar/page";
import CompararPrestadoresPage from "@/app/saneamento/prestadores/comparar/page";
import MetodologiaPage from "@/app/saneamento/metodologia/page";
import DesigualdadesPage from "@/app/saneamento/desigualdades/page";
import { Qualidade } from "@/app/saneamento/continuidade/Qualidade";
import { Abertura, Fonte, Secao } from "@/components/saneamento/Editorial";
import { paraMunicipios } from "@/lib/saneamento/municipios";

type Elo = ReactElement<{ children?: ReactNode; id?: string }>;
function arvore(no: ReactNode): Elo[] {
  if (Array.isArray(no)) return no.flatMap(arvore);
  if (!isValidElement<{ children?: ReactNode; id?: string }>(no)) return [];
  return [no, ...arvore(no.props.children)];
}
function selecionar(raiz: ReactNode, predicado: (no: Elo) => boolean): Elo {
  const encontrados = arvore(raiz).filter(predicado);
  expect(encontrados).toHaveLength(1);
  return encontrados[0];
}
const main = (raiz: ReactNode) => selecionar(raiz, (no) => no.type === "main" && no.props.id === "conteudo");
const secao = (raiz: ReactNode, id: string) => selecionar(raiz, (no) => no.type === Secao && no.props.id === id);
const fonte = (raiz: ReactNode) => selecionar(raiz, (no) => no.type === Fonte);

type No = DefaultTreeAdapterMap["node"];
type Elemento = DefaultTreeAdapterMap["element"];
const filhos = (no: No): No[] => "childNodes" in no ? no.childNodes : [];
const atributo = (no: Elemento, nome: string) => no.attrs.find((a) => a.name === nome)?.value;
function elementos(no: No): Elemento[] {
  return [...("tagName" in no ? [no] : []), ...filhos(no).flatMap(elementos)];
}
function texto(no: No): string {
  return "value" in no ? no.value : filhos(no).map(texto).join("");
}
function unico(nos: Elemento[], predicado: (no: Elemento) => boolean): Elemento {
  const encontrados = nos.filter(predicado);
  expect(encontrados).toHaveLength(1);
  return encontrados[0];
}
const tag = (nos: Elemento[], nome: string) => unico(nos, (no) => no.tagName === nome);
const renderizar = (elemento: Elo) => elementos(parseFragment(renderToStaticMarkup(elemento)));
const links = (nos: Elemento[]) => nos.filter((no) => no.tagName === "a").map((no) => [texto(no), atributo(no, "href")]);
function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}
const ler = (nome: string) => readFileSync(join(process.cwd(), "public/saneamento/gold", nome), "utf8");
const brutos = { "meta.json": ler("meta.json"), "municipios.json": ler("municipios.json"), "prestadores.json": ler("prestadores.json") };
const metaOriginal: MetaSaneamento = congelar(JSON.parse(brutos["meta.json"]));
const tabela: TabelaMunicipios = JSON.parse(brutos["municipios.json"]);
const municipioBase = paraMunicipios({ ...tabela, linhas: tabela.linhas.slice(0, 1) })[0];
const prestadoresOriginais: Prestador[] = JSON.parse(brutos["prestadores.json"]);
const prestadorBase = prestadoresOriginais[0];
if (!municipioBase || !prestadorBase) throw new Error("Os cadastros reais precisam conter ao menos uma linha tipada para a fixture.");

afterEach(() => {
  troca.meta = undefined;
  troca.municipios = undefined;
  troca.prestadores = undefined;
});
afterAll(() => {
  for (const [nome, original] of Object.entries(brutos)) expect(ler(nome)).toBe(original);
});

// SSR focal de elementos ORIGINAIS produzidos pelas funções reais. O percurso
// só lê arrays/props.children, sem clone, props novas ou execução de .type(props).
// Não prova página integral, irmãos, layouts, hidratação, efeitos ou browser;
// os modelos e cálculos executados pela própria Page/Qualidade continuam reais.
describe("Saneamento: contagens nas Aberturas originais", () => {
  it.each([{ quantidade: 1234, esperado: "1.234 municípios do IBGE; Censo 2022 e SINISA 2025 (ano de referência 2024)." },
    { quantidade: 0, esperado: "0 municípios do IBGE; Censo 2022 e SINISA 2025 (ano de referência 2024)." }])
    ("mantém a contagem de $quantidade municípios e a prosa PT", ({ quantidade, esperado }) => {
      const fixture = congelar<Municipio[]>(Array.from({ length: quantidade }, (_, i) => ({ ...structuredClone(municipioBase), id: String(9000000 + i) })));
      const antes = structuredClone(fixture);
      troca.municipios = fixture;
      const abertura = selecionar(main(CompararMunicipiosPage()), (no) => no.type === Abertura);
      const nos = renderizar(abertura);
      expect(texto(tag(nos, "h1"))).toBe("Comparar municípios");
      const recorte = unico(nos, (no) => no.tagName === "p" && filhos(no).some((filho) => "tagName" in filho && filho.tagName === "span" && texto(filho) === "Recorte"));
      expect(filhos(recorte).filter((no) => !("tagName" in no && no.tagName === "span")).map(texto).join("")).toBe(esperado);
      expect(fixture).toStrictEqual(antes);
    });

  it.each([{ quantidade: 1234, esperado: "SINISA 2025, ano de referência 2024; 1.234 prestadores no cadastro." },
    { quantidade: 0, esperado: "SINISA 2025, ano de referência 2024; 0 prestadores no cadastro." }])
    ("mantém a contagem de $quantidade prestadores e o período", ({ quantidade, esperado }) => {
      const fixture = congelar<Prestador[]>(Array.from({ length: quantidade }, (_, i) => ({ ...structuredClone(prestadorBase), id: `fixture-prestador-${i}` })));
      const antes = structuredClone(fixture);
      troca.prestadores = fixture;
      const abertura = selecionar(main(CompararPrestadoresPage()), (no) => no.type === Abertura);
      const nos = renderizar(abertura);
      const recorte = unico(nos, (no) => no.tagName === "p" && filhos(no).some((filho) => "tagName" in filho && filho.tagName === "span" && texto(filho) === "Recorte"));
      expect(filhos(recorte).filter((no) => !("tagName" in no && no.tagName === "span")).map(texto).join("")).toBe(esperado);
      expect(fixture).toStrictEqual(antes);
    });
});

describe("Saneamento: conferência na Secao original", () => {
  it("mantém máximo de duas casas e a guarda de ausência sem rejeitar não finitos", () => {
    const fixture = structuredClone(metaOriginal);
    fixture.conferencias.push({ id: "fixture-formato", descricao: "Conferência sintética de apresentação", conclusao: "Texto de apresentação 1.234,5",
      valores: { fracao: 1234.5678, inteiro: 1000, zero: 0, negativo: -12.3, zero_negativo: -0, ausente: null, nan: NaN, infinito: Infinity, menos_infinito: -Infinity } });
    const antes = structuredClone(fixture);
    troca.meta = congelar(fixture);
    const nos = renderizar(secao(main(MetodologiaPage()), "conferencias"));
    expect(atributo(tag(nos, "section"), "id")).toBe("conferencias");
    const artigo = elementos(unico(nos, (no) => no.tagName === "article" && elementos(no).some((filho) => filho.tagName === "h3" && texto(filho) === "Conferência sintética de apresentação")));
    const pares = elementos(tag(artigo, "dl")).filter((no) => no.tagName === "div").map((no) => {
      const dentro = elementos(no);
      return [texto(tag(dentro, "dt")), texto(tag(dentro, "dd"))];
    });
    expect(pares).toEqual([["fracao", "1.234,57"], ["inteiro", "1.000"], ["zero", "0"], ["negativo", "-12,3"], ["zero negativo", "-0"],
      ["ausente", "sem dado"], ["nan", "NaN"], ["infinito", "∞"], ["menos infinito", "-∞"]]);
    expect(texto(tag(artigo, "p"))).toBe("Texto de apresentação 1.234,5");
    expect(fixture).toStrictEqual(antes);
  });
});

function conferirFonteDesigualdades(esperada: string) {
  const nos = renderizar(fonte(secao(main(DesigualdadesPage()), "dados")));
  expect(texto(tag(nos, "p"))).toBe(`FonteIBGE, Censo 2022, tabelas 6894, 7555, 10105, 9957, 9894 e 9898. Coleta em ${esperada}. Originais e metadados com SHA-256 no pipeline; proveniência e conferências em meta.json. Método, conferências e arquivos.`);
  expect(links(nos)).toEqual([["meta.json", "/saneamento/gold/meta.json"], ["Método, conferências e arquivos", "/saneamento/metodologia"]]);
}

describe("Saneamento: proveniência nas Fontes originais", () => {
  it.each([
    { nome: "datas válidas em UTC", desigualdades: "2026-10-14T23:30:00-03:00", captura: "2026-10-14T23:30:00-03:00", controle: "2026-10-14T00:30:00+02:00", vigilancia: "2026-10-14T12:00:00Z", removerVigilancia: false,
      textoDesigualdades: "15/10/2026", textoCaptura: "15/10/2026", textoControle: "13/10/2026", textoVigilancia: "14/10/2026" },
    { nome: "datas inválidas com contratos distintos", desigualdades: "captura inválida", captura: "extração inválida", controle: "controle inválido", vigilancia: "vigilância inválida", removerVigilancia: false,
      textoDesigualdades: "Invalid Date", textoCaptura: "extração inválida", textoControle: "controle inválido", textoVigilancia: "vigilância inválida" },
    { nome: "vazio, null e arquivo ausente sem apagar a auditoria", desigualdades: "", captura: "", controle: null, vigilancia: null, removerVigilancia: true,
      textoDesigualdades: "Invalid Date", textoCaptura: "sem data", textoControle: "sem data", textoVigilancia: "sem data" },
  ])("preserva $nome", (caso) => {
    const fixture = structuredClone(metaOriginal);
    if (!fixture.desigualdades || !fixture.sisagua?.por_ano["2024"]) throw new Error("A fixture real deve conter as duas auditorias e o ano SISAGUA 2024.");
    const arquivos = fixture.sisagua.proveniencia.arquivos;
    const controles = arquivos.filter((x) => x.conjunto === "controle" && x.ano === 2024);
    const vigilancias = arquivos.filter((x) => x.conjunto === "vigilancia" && x.ano === 2025);
    expect(controles).toHaveLength(1);
    expect(vigilancias).toHaveLength(1);
    fixture.desigualdades.proveniencia.capturado_em = caso.desigualdades;
    fixture.sisagua.proveniencia.capturado_em = caso.captura;
    controles[0].last_modified = caso.controle;
    if (caso.removerVigilancia) fixture.sisagua.proveniencia.arquivos = arquivos.filter((x) => x !== vigilancias[0]);
    else vigilancias[0].last_modified = caso.vigilancia;
    const antes = structuredClone(fixture);
    troca.meta = congelar(fixture);

    conferirFonteDesigualdades(caso.textoDesigualdades);
    const raizQualidade = Qualidade();
    const nos = renderizar(fonte(secao(raizQualidade, "qualidade")));
    expect(texto(tag(nos, "p"))).toBe(`FonteMinistério da Saúde, SISAGUA, dados abertos: controle mensal (parâmetros básicos e plano de amostragem) e vigilância (parâmetros básicos), 2024 e 2025. Arquivos atualizados pelo Ministério em ${caso.textoControle} (controle 2024) e ${caso.textoVigilancia} (vigilância 2025); extração do Observatório em ${caso.textoCaptura}. Método, conferências e arquivos.`);
    expect(links(nos)).toEqual([["Método, conferências e arquivos", "/saneamento/metodologia"]]);
    const conferencia = renderizar(fonte(secao(raizQualidade, "qualidade-conferencia")));
    expect(texto(tag(conferencia, "p")).startsWith(`FonteMinistério da Saúde, SISAGUA: controle mensal, plano de amostragem, vigilância e amostras fora do padrão. Arquivos, sha256 e datas de atualização em meta.json; extração em ${caso.textoCaptura}.`)).toBe(true);
    expect(links(conferencia)).toEqual([["Método, conferências e arquivos", "/saneamento/metodologia"]]);
    expect(fixture).toStrictEqual(antes);
  });

  it("mantém sem data em Desigualdades e o retorno real de indisponibilidade de Qualidade", () => {
    troca.meta = null;
    conferirFonteDesigualdades("sem data");
    const retorno = Qualidade();
    expect(secao(retorno, "qualidade")).toBe(retorno);
    expect(arvore(retorno).filter((no) => no.type === Fonte)).toEqual([]);
    const nos = renderizar(retorno);
    expect(atributo(tag(nos, "section"), "id")).toBe("qualidade");
    expect(texto(tag(nos, "aside"))).toBe("Dados do SISAGUA indisponíveis nesta ediçãoO arquivo da qualidade da água não foi encontrado na gold.");
  });
});
