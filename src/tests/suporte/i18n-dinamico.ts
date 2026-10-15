import { expect } from "vitest";
import { GLOSSARIO } from "@/lib/data/glossario";
import { LINKEDIN_URL } from "@/lib/contato";
import { PRIVACY_VERSION } from "@/lib/versoesPoliticas";
import { attr, conteudo, elementos, filhos, oculto, tag, texto, unico, vazamentos, type Elemento, type Forma, type No } from "./i18n-dom";
import { projetarIlhaAuth, verificarPaginaAuth, type ComparacaoAuth } from "./i18n-auth";

type NoAnunciador = { tipo: number; nome: string; atributos: [string, string][]; filhos: number; texto: string };
export type CapturaAnunciador = {
  quantidade: number;
  filhoDiretoDoBody: boolean;
  dentroDaIlha: boolean;
  idioma: string | null;
  host: NoAnunciador | null;
  sombra: { modo: string; filhos: NoAnunciador[] } | null;
};

const ESTILO_INTERNO = "position:absolute;border:0;height:1px;margin:-1px;padding:0;width:1px;clip:rect(0 0 0 0);overflow:hidden;white-space:nowrap;word-wrap:normal";

/** Lista fechada: nenhuma página dinâmica ganha uma prova genérica por acidente. */
export function cenarioDinamico(caminho: string) {
  const idioma = caminho === "/en" || caminho.startsWith("/en/") ? "en" : "pt-BR";
  const pt = idioma === "en" ? caminho.slice(3) || "/" : caminho;
  if (pt !== "/" && pt !== "/glossario" && pt !== "/termos" && pt !== "/privacidade" && pt !== "/entrar" && pt !== "/cadastro") {
    throw new Error(`Página dinâmica sem contrato de conclusão DOM: ${caminho}`);
  }
  if (caminho !== (idioma === "en" ? "/en" + (pt === "/" ? "" : pt) : pt)) {
    throw new Error(`Caminho não canônico no cenário dinâmico: ${caminho}`);
  }
  return { pt, idioma };
}

/** O filtro histórico de conteúdo não pode esconder transporte ainda pendente. */
export function verificarAusenciaDeTransporte(doc: No): void {
  const pendentes = elementos(doc).filter((e) =>
    (e.tagName === "main" && attr(e, "aria-busy") === "true")
    || (e.tagName === "template" && attr(e, "id")?.startsWith("B:"))
    || (attr(e, "hidden") !== undefined && attr(e, "id")?.startsWith("S:")));
  expect(pendentes, "nenhum loading ou transporte B:/S: pendente").toHaveLength(0);
  tag(doc, "main");
  tag(doc, "h1");
}

/** Contrato de conteúdo, aplicado após a espera no navegador e testável por adulteração. */
export function verificarPaginaConcluida(doc: No, caminho: string): void {
  const { pt, idioma } = cenarioDinamico(caminho);
  if (pt === "/") throw new Error("A home usa seu contrato próprio de Hero e regiões");
  verificarAusenciaDeTransporte(doc);
  expect(attr(tag(doc, "html"), "lang")).toBe(idioma);
  if (pt === "/entrar" || pt === "/cadastro") {
    verificarPaginaAuth(doc, pt);
    return;
  }
  const main = tag(doc, "main");
  const titulo = pt === "/glossario" ? "Glossário" : pt === "/termos" ? "Termos de uso" : "Política de privacidade";
  expect(texto(tag(main, "h1"))).toBe(titulo);
  unico(doc, (e) => e.tagName === "a" && attr(e, "aria-label") === "Scrutiniums — página inicial", "marca do cabeçalho público");
  unico(doc, (e) => e.tagName === "nav" && attr(e, "aria-label") === "Navegação principal", "navegação pública concluída");
  expect(oculto(tag(doc, "footer"))).toBe(false);
  const secoes = elementos(main).filter((e) => e.tagName === "section");
  const destinos = elementos(main).filter((e) => e.tagName === "a").map((e) => attr(e, "href"));
  if (pt === "/glossario") {
    const indice = unico(main, (e) => e.tagName === "nav" && attr(e, "aria-label") === "Índice do glossário", "índice do glossário");
    expect(elementos(indice).filter((e) => e.tagName === "a").map((e) => attr(e, "href"))).toEqual(GLOSSARIO.map((e) => "#" + e.slug));
    expect(secoes.map((e) => attr(e, "id"))).toEqual(GLOSSARIO.map((e) => e.slug));
    for (const [i, secao] of secoes.entries()) {
      expect(attr(secao, "aria-labelledby")).toBe(GLOSSARIO[i].slug + "-titulo");
      expect(attr(tag(secao, "h2"), "id")).toBe(GLOSSARIO[i].slug + "-titulo");
      expect(texto(tag(secao, "h2"))).toBe(GLOSSARIO[i].nome);
      const dl = tag(secao, "dl");
      for (const nome of ["dt", "dd"]) {
        const campos = elementos(dl).filter((e) => e.tagName === nome);
        expect(campos, `${GLOSSARIO[i].slug}: ${nome}`).toHaveLength(8);
        expect(campos.every((e) => texto(e).trim().length > 0)).toBe(true);
      }
    }
    expect(destinos).toContain("/observatorio/methodology");
  } else {
    const ids = pt === "/termos" ? Array.from({ length: 10 }, (_, i) => `termos-${String(i + 1).padStart(2, "0")}`)
      : ["priv-dados", "priv-base", "priv-marketing", "priv-direitos", "priv-retencao", "priv-analytics", "priv-resumo"];
    expect(secoes.map((e) => attr(e, "aria-labelledby"))).toEqual(ids);
    expect(secoes.map((e) => attr(tag(e, "h2"), "id"))).toEqual(ids);
    const descricao = texto(tag(main, "header"));
    if (pt === "/termos") {
      expect(texto(tag(secoes[9], "h2"))).toBe("Contato, legislação e foro");
      expect(descricao).toContain("Versão vigente desde agosto de 2026.");
      expect(destinos).toEqual(expect.arrayContaining(["/privacidade", LINKEDIN_URL]));
    } else {
      expect(descricao).toContain(`Versão ${PRIVACY_VERSION}.`);
      expect(texto(main)).toContain(`Versão da política: ${PRIVACY_VERSION}.`);
      expect(texto(secoes[6])).toContain("7 dias");
      expect(destinos).toEqual(expect.arrayContaining(["/app/conta", "mailto:privacidade@scrutiniums.com", "/termos"]));
    }
  }
}
/** Só normaliza equivalências CSS presentes na declaração fixa do Next. */
function declaracoesCss(css: string): string[] {
  return css.split(";").filter((s) => s.trim()).map((declaracao) => {
    const partes = declaracao.trim().match(/^([a-z-]+)\s*:\s*(.+)$/);
    if (!partes) throw new Error("Declaração CSS inválida no anunciador");
    const propriedade = partes[1] === "word-wrap" ? "overflow-wrap" : partes[1];
    const valor = partes[2].replace(/\b0px\b/g, "0").replace(/\s*,\s*/g, " ").replace(/\s+/g, " ").trim();
    return `${propriedade}:${valor}`;
  }).sort();
}

/** Entrada direta em contexto novo: nenhum título anterior deve ser anunciado. */
export function validarAnunciador(captura: CapturaAnunciador): void {
  expect(captura.quantidade, "um único anunciador do Next").toBe(1);
  expect(captura.filhoDiretoDoBody).toBe(true);
  expect(captura.dentroDaIlha).toBe(false);
  expect(["pt-BR", "en"]).toContain(captura.idioma);
  expect(captura.host).toEqual({ tipo: 1, nome: "next-route-announcer", atributos: [["style", "position: absolute;"]], filhos: 0, texto: "" });
  expect(captura.sombra?.modo, "shadow root aberto").toBe("open");
  expect(captura.sombra?.filhos, "um único div no shadow root").toHaveLength(1);
  const interno = captura.sombra!.filhos[0];
  expect(interno.tipo).toBe(1);
  expect(interno.nome).toBe("div");
  expect(interno.filhos).toBe(0);
  expect(interno.texto).toBe("");
  expect(interno.atributos.map(([nome]) => nome).sort()).toEqual(["aria-live", "id", "role", "style"]);
  expect(interno.atributos.filter(([nome]) => nome !== "style").sort(([a], [b]) => a.localeCompare(b))).toEqual([
    ["aria-live", "assertive"], ["id", "__next-route-announcer__"], ["role", "alert"],
  ]);
  const estilo = interno.atributos.find(([nome]) => nome === "style")![1];
  expect(declaracoesCss(estilo), "estilo completo conhecido do Next, sem declarações extras").toEqual(declaracoesCss(ESTILO_INTERNO));
}

function forma(no: Elemento): Exclude<Forma, string> {
  return { tag: no.tagName, atributos: no.attrs.map((a): [string, string] => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)), filhos: conteudo(no) };
}

function corpoSemAnunciador(doc: No, captura: CapturaAnunciador): Forma[] {
  validarAnunciador(captura);
  const body = tag(doc, "body");
  const host = unico(doc, (e) => e.tagName === "next-route-announcer", "host serializado único");
  expect(host.parentNode).toBe(body);
  expect(filhos(host), "nenhum conteúdo leve omitido").toHaveLength(0);
  expect(forma(host)).toEqual({ tag: captura.host!.nome, atributos: captura.host!.atributos, filhos: [] });
  // Projeta somente os irmãos da referência já validada; não muda o documento
  // usado pelo detector nem acrescenta o host ao filtro global de conteúdo.
  return conteudo({ ...body, childNodes: body.childNodes.filter((no) => no !== host) });
}

export function verificarFallbackDinamico(pt: No, en: No, anunciadorPt: CapturaAnunciador, anunciadorEn: CapturaAnunciador, auth?: ComparacaoAuth): void {
  verificarAusenciaDeTransporte(pt);
  verificarAusenciaDeTransporte(en);
  expect(anunciadorPt.idioma).toBe("pt-BR");
  expect(anunciadorEn.idioma).toBe("en");
  const corpoPt = corpoSemAnunciador(pt, anunciadorPt);
  const corpoEn = corpoSemAnunciador(en, anunciadorEn);
  expect(anunciadorEn.host).toEqual(anunciadorPt.host);
  expect(anunciadorEn.sombra).toEqual(anunciadorPt.sombra);
  const ilha = unico(en, (e) => attr(e, "data-i18n-estado") !== undefined, "ilha integral dinâmica");
  const aviso = unico(en, (e) => attr(e, "data-i18n-aviso") !== undefined, "aviso dinâmico");
  expect(attr(ilha, "data-i18n-estado")).toBe("portugues_marcado");
  expect(attr(ilha, "lang")).toBe("pt-BR");
  expect(attr(aviso, "lang")).toBe("en");
  expect(texto(aviso).trim()).toBe("Portuguese only");
  expect(oculto(aviso)).toBe(false);
  expect(oculto(ilha)).toBe(false);
  const produtoEn = auth ? projetarIlhaAuth(pt, en, auth) : conteudo(ilha);
  expect(produtoEn, "produto PT integral; somente Fields auth explicitamente validados admitem bijeção de IDs").toEqual(corpoPt);
  expect(corpoEn).toHaveLength(2);
  expect(corpoEn).toEqual([forma(aviso), forma(ilha)]);
  expect(elementos(pt).some((e) => attr(e, "data-i18n-estado") !== undefined)).toBe(false);
  expect(vazamentos(en, "en")).toEqual([]);
  expect(vazamentos(pt, "pt")).toEqual([]);
}
