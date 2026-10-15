import { expect } from "vitest";
import inventario from "../../../config/i18n-inventario.json";
import { pt as catalogoPt } from "@/i18n/pt";
import { en as catalogoEn } from "@/i18n/en";
import { ACESSO, listaObservatorios, observatoriosPorExtenso } from "@/lib/acesso";
import { attr, conteudo, elementos, filhos, meta, oculto, tag, texto, unico, vazamentos, type Elemento, type Forma, type No } from "./i18n-dom";

const REGIOES_PT = ["home-cabecalho", "home-introducao", "home-indice", "home-secoes", "home-rodape"];
const REGIOES_EN = ["home-titulo", "home-acoes", "home-rotulo", "home-beneficios"];
const CHAVES = {
  titulo: ["home.hero.titulo_inicio", "home.hero.titulo_destaque"],
  acoes: ["acesso.criar_conta", "home.hero.ja_cadastrado"],
  rotulo: ["home.hero.rotulo"],
  beneficios: ["home.hero.beneficio_conta", "home.hero.beneficio_evidencia", "home.hero.beneficio_gratuidade"],
} as const;
const atributo = (forma: Exclude<Forma, string>, nome: string) => forma.atributos.find(([n]) => n === nome)?.[1];
const elemento = (no: No): no is Elemento => "tagName" in no;
function forma(no: Elemento): Exclude<Forma, string> {
  return { tag: no.tagName, atributos: no.attrs.map((a): [string, string] => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)), filhos: conteudo(no) };
}
function inglesa(chave: (typeof CHAVES)[keyof typeof CHAVES][number]): string {
  const entrada = catalogoEn[chave];
  expect(entrada.estado, chave).toBe("traduzido");
  return entrada.texto;
}

export function verificarHeadHome(pt: No, en: No): void {
  const descricao = inglesa("home.hero.titulo_inicio") + inglesa("home.hero.titulo_destaque") + ".";
  const titulo = `Scrutiniums · ${descricao}`;
  expect(texto(tag(en, "title"))).toBe(titulo);
  expect(meta(en, "description")).toEqual([descricao]);
  for (const nome of ["og:title", "twitter:title"]) expect(meta(en, nome), nome).toEqual([titulo]);
  for (const nome of ["og:description", "twitter:description"]) expect(meta(en, nome), nome).toEqual([descricao]);
  expect(meta(en, "og:site_name")).toEqual(["Scrutiniums"]);
  expect(meta(en, "og:type")).toEqual(["website"]);
  expect(meta(en, "twitter:card")).toEqual(["summary"]);
  for (const nome of ["og:image", "og:image:alt", "twitter:image", "twitter:image:alt"]) expect(meta(en, nome), nome).toEqual([]);
  expect(meta(pt, "twitter:card")).toEqual(["summary_large_image"]);
  expect(texto(tag(pt, "title"))).toBe("Scrutiniums — Toda a informação relevante para decisões melhores");
  expect(meta(pt, "description")).toEqual([
    `Da informação dispersa ao conhecimento verificável. Uma plataforma, observatórios de ${listaObservatorios()}, com bases públicas, registros oficiais e método declarado. Gratuita. ${ACESSO.curto}`,
  ]);
  for (const nome of ["og:title", "twitter:title"]) expect(meta(pt, nome), nome).toEqual([`Scrutiniums: ${listaObservatorios()}`]);
  for (const nome of ["og:description", "twitter:description"]) expect(meta(pt, nome), nome).toEqual([
    `${observatoriosPorExtenso(true)}, a mesma filosofia de evidência: dados oficiais, fonte e data em cada número, metodologia aberta. Gratuito. ${ACESSO.curto}`,
  ]);
  expect(meta(pt, "og:image").length).toBeGreaterThan(0);
  expect(meta(pt, "twitter:image")).toEqual(meta(pt, "og:image"));
  for (const prefixo of ["og", "twitter"]) {
    expect(meta(pt, `${prefixo}:image:alt`)).toEqual(["Scrutiniums: observatórios com dados oficiais, fonte e data em cada número"]);
    expect(meta(pt, `${prefixo}:image:type`)).toEqual(["image/png"]);
    expect(meta(pt, `${prefixo}:image:width`)).toEqual(["1200"]);
    expect(meta(pt, `${prefixo}:image:height`)).toEqual(["630"]);
    for (const imagem of meta(pt, `${prefixo}:image`)) expect(new URL(imagem).pathname).toBe("/opengraph-image");
  }
}

/** A reconstrução só admite as oito traduções comprovadas e cinco ilhas declaradas. */
export function verificarHomeParcial(pt: No, en: No): void {
  const declaracao = inventario.uso_interface.rotas.find((rota) => rota.pt === "/");
  expect(declaracao, "declaração da home parcial").toBeDefined();
  expect(declaracao!.regioes).toHaveLength(9);
  const traduzidas = declaracao!.regioes.filter((regiao) => regiao.estado === "traduzido");
  expect(traduzidas).toEqual([
    { id: "home-titulo", estado: "traduzido", chaves: CHAVES.titulo },
    { id: "home-acoes", estado: "traduzido", chaves: CHAVES.acoes },
    { id: "home-rotulo", estado: "traduzido", chaves: CHAVES.rotulo },
    { id: "home-beneficios", estado: "traduzido", chaves: CHAVES.beneficios },
  ]);
  const preservadas = declaracao!.regioes.filter((regiao) => regiao.estado === "portugues_marcado");
  expect(preservadas.map((r) => r.id).sort()).toEqual([...REGIOES_PT].sort());
  const corpoPt = tag(pt, "body");
  const corpoEn = tag(en, "body");
  const heroPt = unico(corpoPt, (e) => attr(e, "aria-labelledby") === "hero-titulo", "Hero PT");
  const tituloPt = tag(heroPt, "h1");
  const rotuloPt = unico(heroPt, (e) => e.tagName === "p" && texto(e) === "Observatórios de dados públicos", "rótulo PT");
  const beneficiosPt = tag(heroPt, "ul");
  const irmaosTitulo = filhos(tituloPt.parentNode!).filter(elemento);
  const introducaoPt = irmaosTitulo[irmaosTitulo.indexOf(tituloPt) + 1];
  expect(introducaoPt.tagName).toBe("p");
  const acoesPt = unico(heroPt, (e) => e.tagName === "div" && filhos(e).filter(elemento).length === 2
    && filhos(e).filter(elemento).every((a) => a.tagName === "a")
    && filhos(e).filter(elemento).some((a) => attr(a, "href") === "/cadastro"), "ações PT");
  const mainPt = tag(corpoPt, "main");
  const secoesPt = filhos(mainPt).filter(elemento).filter((e) => e !== heroPt);
  expect(secoesPt).toHaveLength(4);
  expect(secoesPt.map((e) => attr(e, "aria-labelledby"))).toEqual(["observatorios-titulo", "plataforma-titulo", "recursos-titulo", "acesso-titulo"]);
  const originais: Record<string, Forma[]> = {
    "home-cabecalho": [forma(tag(corpoPt, "header"))],
    "home-introducao": [forma(introducaoPt)],
    "home-indice": [forma(tag(heroPt, "nav"))],
    "home-secoes": secoesPt.map(forma),
    "home-rodape": [forma(tag(corpoPt, "footer"))],
  };
  const ids = elementos(corpoEn).filter((e) => attr(e, "data-i18n-regiao") !== undefined).map((e) => attr(e, "data-i18n-regiao"));
  expect(new Set(ids).size, "nove regiões únicas").toBe(9);
  expect(ids.sort()).toEqual([...REGIOES_PT, ...REGIOES_EN].sort());
  expect(elementos(corpoEn).filter((e) => attr(e, "data-i18n-aviso") !== undefined)).toHaveLength(5);
  expect(elementos(corpoEn).filter((e) => attr(e, "data-i18n-estado") !== undefined)).toHaveLength(5);
  for (const regiao of preservadas) {
    const ilha = unico(corpoEn, (e) => attr(e, "data-i18n-regiao") === regiao.id, regiao.id);
    expect(attr(ilha, "data-i18n-estado")).toBe("portugues_marcado");
    expect(attr(ilha, "lang")).toBe("pt-BR");
    expect(oculto(ilha)).toBe(false);
    expect(conteudo(ilha), regiao.id).toEqual(originais[regiao.id]);
  }
  const titulo = unico(corpoEn, (e) => attr(e, "data-i18n-regiao") === "home-titulo", "título traduzido");
  const acoes = unico(corpoEn, (e) => attr(e, "data-i18n-regiao") === "home-acoes", "ações traduzidas");
  const rotulo = unico(corpoEn, (e) => attr(e, "data-i18n-regiao") === "home-rotulo", "rótulo traduzido");
  const beneficios = unico(corpoEn, (e) => attr(e, "data-i18n-regiao") === "home-beneficios", "benefícios traduzidos");
  for (const regiao of [titulo, acoes, rotulo, beneficios]) {
    expect(oculto(regiao)).toBe(false);
    expect(attr(regiao, "data-i18n-estado")).toBeUndefined();
    expect(attr(regiao, "lang")).toBeUndefined();
  }
  const tituloEsperado = forma(tituloPt);
  expect(tituloEsperado.filhos[0]).toBe(catalogoPt[CHAVES.titulo[0]]);
  expect(tituloEsperado.filhos[2]).toBe(".");
  const destaque = tituloEsperado.filhos[1];
  expect(typeof destaque).toBe("object");
  if (typeof destaque === "string") throw new Error("Destaque do Hero sem elemento");
  expect(destaque.tag).toBe("span");
  expect(destaque.filhos).toEqual([catalogoPt[CHAVES.titulo[1]]]);
  tituloEsperado.filhos[0] = inglesa(CHAVES.titulo[0]);
  destaque.filhos = [inglesa(CHAVES.titulo[1])];
  const acoesEsperadas = forma(acoesPt);
  for (const [href, chave] of [["/cadastro", CHAVES.acoes[0]], ["/entrar", CHAVES.acoes[1]]] as const) {
    const anchor = acoesEsperadas.filhos.find((f) => typeof f !== "string" && atributo(f, "href") === href);
    if (!anchor || typeof anchor === "string") throw new Error(`Ação PT ausente: ${href}`);
    expect(anchor.tag).toBe("a");
    expect(anchor.filhos).toEqual([catalogoPt[chave]]);
    anchor.filhos = [inglesa(chave)];
  }
  const rotuloEsperado = forma(rotuloPt);
  expect(rotuloEsperado.tag).toBe("p");
  expect(rotuloEsperado.filhos).toEqual([catalogoPt[CHAVES.rotulo[0]]]);
  rotuloEsperado.filhos = [inglesa(CHAVES.rotulo[0])];
  const beneficiosEsperados = forma(beneficiosPt);
  expect(beneficiosEsperados.tag).toBe("ul");
  expect(beneficiosEsperados.filhos).toHaveLength(3);
  for (const [i, chave] of CHAVES.beneficios.entries()) {
    const item = beneficiosEsperados.filhos[i];
    if (typeof item === "string") throw new Error("Benefício PT sem li");
    expect(item.tag).toBe("li");
    expect(item.filhos).toHaveLength(2);
    const decoracao = item.filhos[0];
    if (typeof decoracao === "string") throw new Error("Benefício PT sem span decorativo");
    expect(decoracao.tag).toBe("span");
    expect(atributo(decoracao, "aria-hidden")).toBe("true");
    expect(decoracao.filhos).toEqual([]);
    expect(item.filhos[1]).toBe(catalogoPt[chave]);
    item.filhos[1] = inglesa(chave);
  }
  const semId = (no: Elemento) => {
    const f = forma(no);
    f.atributos = f.atributos.filter(([n]) => n !== "data-i18n-regiao");
    return f;
  };
  expect(semId(titulo)).toEqual(tituloEsperado);
  expect(semId(acoes)).toEqual(acoesEsperadas);
  expect(semId(rotulo)).toEqual(rotuloEsperado);
  expect(semId(beneficios)).toEqual(beneficiosEsperados);
  const reconstruir = (formas: Forma[]): Forma[] => formas.flatMap((f): Forma[] => {
    if (typeof f === "string") return [f];
    if (atributo(f, "data-i18n-aviso") !== undefined) return [];
    const id = atributo(f, "data-i18n-regiao");
    if (id && REGIOES_PT.includes(id)) return reconstruir(f.filhos);
    if (id === "home-titulo") return [forma(tituloPt)];
    if (id === "home-acoes") return [forma(acoesPt)];
    if (id === "home-rotulo") return [forma(rotuloPt)];
    if (id === "home-beneficios") return [forma(beneficiosPt)];
    return [{ ...f, filhos: reconstruir(f.filhos) }];
  });
  expect(reconstruir(conteudo(corpoEn)), "corpo PT integral reconstruído somente pelas regiões declaradas").toEqual(conteudo(corpoPt));
  expect(elementos(corpoPt).some((e) => attr(e, "data-i18n-regiao") !== undefined || attr(e, "data-i18n-estado") !== undefined)).toBe(false);
  expect(vazamentos(en, "en")).toEqual([]);
  expect(vazamentos(pt, "pt")).toEqual([]);
}
