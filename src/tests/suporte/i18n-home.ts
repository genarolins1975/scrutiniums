import { expect } from "vitest";
import inventario from "../../../config/i18n-inventario.json";
import { pt as catalogoPt } from "@/i18n/pt";
import { en as catalogoEn } from "@/i18n/en";
import { ACESSO, listaObservatorios, observatoriosPorExtenso } from "@/lib/acesso";
import { DOMINIOS, type DominioId } from "@/lib/dominios";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { formatadorNumero } from "@/lib/format";
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { DIMENSOES } from "@/lib/eficiencia/dimensoes";
import { CAPITULOS, PAINEIS_COM_DADOS } from "@/lib/contas-publicas/catalogo";
import primariosEstaduais from "@/lib/contas-estaduais/primarios.json";
import { CAPITULOS as CAPITULOS_SANEAMENTO } from "@/lib/saneamento/capitulos";
import { PAGINAS_GAS } from "@/lib/gas/navegacao";
import { attr, conteudo, elementos, filhos, meta, oculto, tag, texto, unico, vazamentos, type Elemento, type Forma, type No } from "./i18n-dom";

const REGIOES_PT = ["home-cabecalho", "home-perguntas", "home-secoes", "home-rodape"];
const REGIOES_EN = ["home-titulo", "home-acoes", "home-rotulo", "home-introducao", "home-beneficios", "home-indice"];

/** Esperados integrais independentes do formatador e do adaptador do Hero. */
export const INTRODUCAO_HOME = {
  pt: "Seis observatórios sobre crédito, setor elétrico, agronegócio, gás natural, saneamento, serviços públicos e contas da União e dos estados, construídos sobre bases oficiais. Cada painel informa a fonte, o período de referência e o que o dado não permite afirmar.",
  en: "Six observatories on credit, the power sector, agribusiness, natural gas, basic sanitation, public services and the public accounts of the União (Brazil's federal government) and the states, built on official databases. Each dashboard identifies the data source, the reference period and what the data cannot establish.",
} as const;
const CHAVES = {
  titulo: ["home.hero.titulo_inicio", "home.hero.titulo_destaque"],
  acoes: ["acesso.criar_conta", "home.hero.ja_cadastrado"],
  rotulo: ["home.hero.rotulo"],
  introducao: ["home.hero.introducao"],
  beneficios: ["home.hero.beneficio_conta", "home.hero.beneficio_evidencia", "home.hero.beneficio_gratuidade"],
  indice: [
    "home.indice.rotulo", "home.indice.ilustracoes", "home.indice.paginas_tematicas", "home.indice.secoes_publicadas",
    "home.indice.temas_publicados", "home.indice.capitulos_com_dados", "home.indice.unidades_federacao",
    "home.indice.paginas_por_pergunta", "home.indice.contagem_parcial",
  ],
} as const;

/** Oráculo independente de vitrine/formatarContagemIndice: lê os registros, não o texto renderizado. */
const contagensIndice: Record<DominioId, { numeros: readonly number[]; chave: (typeof CHAVES.indice)[number]; pt: string; en: string }> = {
  credito: { numeros: [ABAS_OBSERVATORIO.filter((a) => !a.caminho.endsWith("/") && !["/suggestions", "/about"].includes(a.caminho)).length], chave: "home.indice.paginas_tematicas", pt: "páginas temáticas", en: "thematic pages" },
  energia: { numeros: [DESTINOS_NAVEGACAO.filter((d) => d.publicado).length], chave: "home.indice.secoes_publicadas", pt: "seções publicadas", en: "published sections" },
  eficiencia: { numeros: [DIMENSOES.filter((d) => d.href).length], chave: "home.indice.temas_publicados", pt: "temas publicados", en: "published topics" },
  contas: { numeros: [PAINEIS_COM_DADOS.length, CAPITULOS.length], chave: "home.indice.capitulos_com_dados", pt: "capítulos com dados", en: "chapters with data" },
  estados: { numeros: [primariosEstaduais.cobertura.ufs], chave: "home.indice.unidades_federacao", pt: "unidades da Federação", en: "Federation Units" },
  saneamento: { numeros: [CAPITULOS_SANEAMENTO.filter((c) => c.situacao !== "em_preparacao").length, CAPITULOS_SANEAMENTO.length], chave: "home.indice.capitulos_com_dados", pt: "capítulos com dados", en: "chapters with data" },
  agro: { numeros: [16], chave: "home.indice.paginas_por_pergunta", pt: "páginas por pergunta", en: "pages by question" },
  gas: { numeros: [PAGINAS_GAS.length], chave: "home.indice.paginas_por_pergunta", pt: "páginas por pergunta", en: "pages by question" },
};
export const INDICE_HOME = DOMINIOS.map((dominio, i) => {
  const contagem = contagensIndice[dominio.id];
  return {
    id: dominio.id, nome: dominio.nomeCurto, ordinal: String(i + 1).padStart(2, "0"),
    href: `#obs-${dominio.id}`, imagem: dominio.id === "agro" ? "/home/agro.svg" : `/home/${dominio.id}.webp`, chave: contagem.chave,
    pt: { valor: contagem.numeros.length === 2 ? contagem.numeros.join(" de ") : formatadorNumero("pt", {}).format(contagem.numeros[0]), unidade: contagem.pt },
    en: { valor: contagem.numeros.map((n) => formatadorNumero("en", {}).format(n)).join(" of "), unidade: contagem.en },
  };
});
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

/** Comprova o nav inteiro antes de autorizar sua substituição na reconstrução PT. */
function verificarIndiceHome(indicePt: Elemento, indiceEn: Elemento, corpoPt: Elemento, corpoEn: Elemento): void {
  expect(INDICE_HOME.map((d) => d.id)).toEqual(["credito", "energia", "eficiencia", "contas", "estados", "saneamento", "gas", "agro"]);
  expect(indicePt.tagName).toBe("nav");
  expect(indiceEn.tagName).toBe("nav");
  expect(attr(indicePt, "aria-label")).toBe("Índice das coleções");
  expect(catalogoPt["home.indice.rotulo"]).toBe("Índice das coleções");
  expect(inglesa("home.indice.rotulo")).toBe("Collection index");
  const esperado = forma(indicePt);
  const rotulo = esperado.atributos.find(([nome]) => nome === "aria-label");
  if (!rotulo) throw new Error("Índice PT sem nome acessível");
  rotulo[1] = inglesa("home.indice.rotulo");
  const objeto = (f: Forma, descricao: string): Exclude<Forma, string> => {
    expect(typeof f, descricao).toBe("object");
    if (typeof f === "string") throw new Error(descricao);
    return f;
  };
  // Desde 19/10/2026 (achado A9 da banca) o índice fica recolhido num <details> dentro do nav:
  // o resumo repete o nome do índice (mesma chave traduzida) e um sinal decorativo sem filhos.
  expect(esperado.filhos).toHaveLength(1);
  const recolhido = objeto(esperado.filhos[0], "índice PT sem bloco recolhido");
  expect(recolhido.tag).toBe("details");
  expect(atributo(recolhido, "open"), "o índice começa recolhido").toBeUndefined();
  expect(recolhido.filhos).toHaveLength(3);
  const resumo = objeto(recolhido.filhos[0], "índice PT sem resumo");
  expect(resumo.tag).toBe("summary");
  expect(resumo.filhos).toHaveLength(2);
  expect(resumo.filhos[0]).toBe("Índice das coleções");
  resumo.filhos[0] = inglesa("home.indice.rotulo");
  const sinal = objeto(resumo.filhos[1], "resumo sem sinal de abrir");
  expect(sinal.tag).toBe("span");
  expect(atributo(sinal, "aria-hidden")).toBe("true");
  expect(sinal.filhos).toEqual([]);
  const lista = objeto(recolhido.filhos[1], "índice PT sem lista");
  const ressalva = objeto(recolhido.filhos[2], "índice PT sem ressalva");
  expect(lista.tag).toBe("ol");
  expect(lista.filhos).toHaveLength(8);
  expect(ressalva.tag).toBe("p");
  expect(ressalva.filhos).toEqual(["Ilustrações editoriais de cada coleção. Não representam dados nem lugares específicos."]);
  expect(catalogoPt["home.indice.ilustracoes"]).toBe(ressalva.filhos[0]);
  expect(inglesa("home.indice.ilustracoes")).toBe("Editorial illustrations for each collection. They do not represent data or specific places.");
  ressalva.filhos = [inglesa("home.indice.ilustracoes")];
  for (const [i, esperadoCartao] of INDICE_HOME.entries()) {
    const item = objeto(lista.filhos[i], `cartão ${esperadoCartao.id} sem li`);
    expect(item.tag).toBe("li");
    expect(item.filhos).toHaveLength(1);
    expect(atributo(item, "class")).toBe(undefined);
    const anchor = objeto(item.filhos[0], "cartão sem âncora");
    expect(anchor.tag).toBe("a");
    expect(atributo(anchor, "href")).toBe(esperadoCartao.href);
    expect(atributo(anchor, "class")).toBe("group relative block overflow-hidden bg-carvao aspect-[4/5]");
    expect(anchor.filhos).toHaveLength(4);
    const imagem = objeto(anchor.filhos[0], "cartão sem imagem");
    expect(imagem.tag).toBe("img");
    for (const [nome, valor] of [["src", esperadoCartao.imagem], ["alt", ""], ["width", "480"], ["height", "600"], ["decoding", "async"]]) {
      expect(atributo(imagem, nome), `${esperadoCartao.id}: ${nome}`).toBe(valor);
    }
    if (esperadoCartao.id === "gas") expect(atributo(imagem, "style")).toMatch(/^object-position:\s*50% 22%;?$/);
    else expect(atributo(imagem, "style")).toBeUndefined();
    for (const decoracao of anchor.filhos.slice(1, 3)) {
      const span = objeto(decoracao, "decoração sem span");
      expect(span.tag).toBe("span");
      expect(atributo(span, "aria-hidden")).toBe("true");
      expect(span.filhos).toEqual([]);
    }
    const conteudoCartao = objeto(anchor.filhos[3], "cartão sem textos");
    expect(conteudoCartao.tag).toBe("span");
    expect(conteudoCartao.filhos).toHaveLength(3);
    const ordinal = objeto(conteudoCartao.filhos[0], "cartão sem ordinal");
    const nome = objeto(conteudoCartao.filhos[1], "cartão sem nome");
    const contagem = objeto(conteudoCartao.filhos[2], "cartão sem contagem");
    for (const span of [ordinal, nome, contagem]) expect(span.tag).toBe("span");
    expect(ordinal.filhos).toEqual([esperadoCartao.ordinal]);
    expect(nome.filhos).toEqual([esperadoCartao.nome]);
    expect(atributo(nome, "lang")).toBeUndefined();
    nome.atributos.push(["lang", "pt-BR"]);
    nome.atributos.sort(([a], [b]) => a.localeCompare(b));
    expect(contagem.filhos).toHaveLength(2);
    const valor = objeto(contagem.filhos[0], "contagem sem valor");
    expect(valor.tag).toBe("span");
    expect(valor.filhos, `${esperadoCartao.id}: quantidade PT vinda do registro`).toEqual([esperadoCartao.pt.valor]);
    expect(contagem.filhos[1], `${esperadoCartao.id}: unidade PT`).toBe(` ${esperadoCartao.pt.unidade}`);
    expect(catalogoPt[esperadoCartao.chave]).toBe(esperadoCartao.pt.unidade);
    expect(inglesa(esperadoCartao.chave)).toBe(esperadoCartao.en.unidade);
    valor.filhos = [esperadoCartao.en.valor];
    contagem.filhos[1] = ` ${esperadoCartao.en.unidade}`;
    for (const corpo of [corpoPt, corpoEn]) {
      const alvo = unico(corpo, (e) => attr(e, "id") === esperadoCartao.href.slice(1), `destino ${esperadoCartao.href}`);
      expect(alvo.tagName).toBe("article");
      expect(oculto(alvo)).toBe(false);
    }
  }
  const atual = forma(indiceEn);
  atual.atributos = atual.atributos.filter(([nome]) => nome !== "data-i18n-regiao");
  expect(atual, "índice EN integral: somente mensagens declaradas e idioma dos nomes preservados").toEqual(esperado);
  for (const indice of [indicePt, indiceEn]) {
    for (const e of elementos(indice).filter((e) => attr(e, "aria-hidden") !== "true")) expect(oculto(e), `${e.tagName} visível no índice`).toBe(false);
  }
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

/** A reconstrução só admite as dezoito traduções comprovadas e três ilhas declaradas. */
export function verificarHomeParcial(pt: No, en: No): void {
  const declaracao = inventario.uso_interface.rotas.find((rota) => rota.pt === "/");
  expect(declaracao, "declaração da home parcial").toBeDefined();
  expect(declaracao!.regioes).toHaveLength(10);
  const traduzidas = declaracao!.regioes.filter((regiao) => regiao.estado === "traduzido");
  expect(traduzidas).toEqual([
    { id: "home-titulo", estado: "traduzido", chaves: CHAVES.titulo },
    { id: "home-acoes", estado: "traduzido", chaves: CHAVES.acoes },
    { id: "home-rotulo", estado: "traduzido", chaves: CHAVES.rotulo },
    { id: "home-introducao", estado: "traduzido", chaves: CHAVES.introducao },
    { id: "home-beneficios", estado: "traduzido", chaves: CHAVES.beneficios },
    { id: "home-indice", estado: "traduzido", chaves: CHAVES.indice },
  ]);
  const preservadas = declaracao!.regioes.filter((regiao) => regiao.estado === "portugues_marcado");
  expect(preservadas.map((r) => r.id).sort()).toEqual([...REGIOES_PT].sort());
  const corpoPt = tag(pt, "body");
  const corpoEn = tag(en, "body");
  const heroPt = unico(corpoPt, (e) => attr(e, "aria-labelledby") === "hero-titulo", "Hero PT");
  // O H1 da página é a pergunta da abertura (HeroPerguntas); o índice dos observatórios leva H2.
  const tituloPt = tag(heroPt, "h2");
  const rotuloPt = unico(heroPt, (e) => e.tagName === "p" && texto(e) === "As coleções de dados", "rótulo PT");
  const beneficiosPt = tag(heroPt, "ul");
  const indicePt = tag(heroPt, "nav");
  const irmaosTitulo = filhos(tituloPt.parentNode!).filter(elemento);
  const introducaoPt = irmaosTitulo[irmaosTitulo.indexOf(tituloPt) + 1];
  expect(introducaoPt.tagName).toBe("p");
  expect(OBSERVATORIOS, "a quantidade por extenso deve corresponder aos seis observatórios publicados").toHaveLength(6);
  expect(conteudo(introducaoPt), "texto PT completo, com espaços e quantidade preservados").toEqual([INTRODUCAO_HOME.pt]);
  expect(catalogoPt[CHAVES.introducao[0]].replace("{observatorios}", "Seis observatórios")).toBe(INTRODUCAO_HOME.pt);
  expect(inglesa(CHAVES.introducao[0]).replace("{observatorios}", "Six observatories")).toBe(INTRODUCAO_HOME.en);
  const acoesPt = unico(heroPt, (e) => e.tagName === "div" && filhos(e).filter(elemento).length === 2
    && filhos(e).filter(elemento).every((a) => a.tagName === "a")
    && filhos(e).filter(elemento).some((a) => attr(a, "href") === "/cadastro"), "ações PT");
  const mainPt = tag(corpoPt, "main");
  const perguntasPt = unico(corpoPt, (e) => attr(e, "aria-labelledby") === "perguntas-titulo", "Perguntas PT");
  expect(filhos(mainPt).filter(elemento)[0], "a abertura por perguntas vem antes do índice").toBe(perguntasPt);
  expect(tag(perguntasPt, "h1")).toBeDefined();
  const secoesPt = filhos(mainPt).filter(elemento).filter((e) => e !== heroPt && e !== perguntasPt);
  expect(secoesPt).toHaveLength(4);
  expect(secoesPt.map((e) => attr(e, "aria-labelledby"))).toEqual(["observatorios-titulo", "plataforma-titulo", "recursos-titulo", "acesso-titulo"]);
  const originais: Record<string, Forma[]> = {
    "home-cabecalho": [forma(tag(corpoPt, "header"))],
    "home-perguntas": [forma(perguntasPt)],
    "home-secoes": secoesPt.map(forma),
    "home-rodape": [forma(tag(corpoPt, "footer"))],
  };
  const ids = elementos(corpoEn).filter((e) => attr(e, "data-i18n-regiao") !== undefined).map((e) => attr(e, "data-i18n-regiao"));
  expect(new Set(ids).size, "dez regiões únicas").toBe(10);
  expect(ids.sort()).toEqual([...REGIOES_PT, ...REGIOES_EN].sort());
  expect(elementos(corpoEn).filter((e) => attr(e, "data-i18n-aviso") !== undefined)).toHaveLength(4);
  expect(elementos(corpoEn).filter((e) => attr(e, "data-i18n-estado") !== undefined)).toHaveLength(4);
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
  const introducao = unico(corpoEn, (e) => attr(e, "data-i18n-regiao") === "home-introducao", "introdução traduzida");
  const beneficios = unico(corpoEn, (e) => attr(e, "data-i18n-regiao") === "home-beneficios", "benefícios traduzidos");
  const indice = unico(corpoEn, (e) => attr(e, "data-i18n-regiao") === "home-indice", "índice traduzido");
  expect(introducao.parentNode).toBe(titulo.parentNode);
  const irmaosTituloEn = filhos(titulo.parentNode!).filter(elemento);
  expect(irmaosTituloEn[irmaosTituloEn.indexOf(titulo) + 1], "introdução imediatamente após o título").toBe(introducao);
  for (const regiao of [titulo, acoes, rotulo, introducao, beneficios, indice]) {
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
    // a entrada tem tradução publicada: o atalho inglês leva à irmã /en; o cadastro continua em português
    if (href === "/entrar") anchor.atributos = anchor.atributos.map(([nome, valor]): [string, string] => [nome, nome === "href" ? "/en/entrar" : valor]);
  }
  const rotuloEsperado = forma(rotuloPt);
  expect(rotuloEsperado.tag).toBe("p");
  expect(rotuloEsperado.filhos).toEqual([catalogoPt[CHAVES.rotulo[0]]]);
  rotuloEsperado.filhos = [inglesa(CHAVES.rotulo[0])];
  const introducaoEsperada = forma(introducaoPt);
  expect(conteudo(introducao), "frase EN resolvida integral, sem token residual ou quantidade arbitrária").toEqual([INTRODUCAO_HOME.en]);
  introducaoEsperada.filhos = [INTRODUCAO_HOME.en];
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
  expect(semId(introducao), "mesmo p e atributos PT, somente texto e região EN declarados").toEqual(introducaoEsperada);
  expect(semId(beneficios)).toEqual(beneficiosEsperados);
  verificarIndiceHome(indicePt, indice, corpoPt, corpoEn);
  const reconstruir = (formas: Forma[]): Forma[] => formas.flatMap((f): Forma[] => {
    if (typeof f === "string") return [f];
    if (atributo(f, "data-i18n-aviso") !== undefined) return [];
    const id = atributo(f, "data-i18n-regiao");
    if (id && REGIOES_PT.includes(id)) return reconstruir(f.filhos);
    if (id === "home-titulo") return [forma(tituloPt)];
    if (id === "home-acoes") return [forma(acoesPt)];
    if (id === "home-rotulo") return [forma(rotuloPt)];
    if (id === "home-introducao") return [forma(introducaoPt)];
    if (id === "home-beneficios") return [forma(beneficiosPt)];
    if (id === "home-indice") return [forma(indicePt)];
    return [{ ...f, filhos: reconstruir(f.filhos) }];
  });
  expect(reconstruir(conteudo(corpoEn)), "corpo PT integral reconstruído somente pelas regiões declaradas").toEqual(conteudo(corpoPt));
  expect(elementos(corpoPt).some((e) => attr(e, "data-i18n-regiao") !== undefined || attr(e, "data-i18n-estado") !== undefined)).toBe(false);
  expect(vazamentos(en, "en")).toEqual([]);
  expect(vazamentos(pt, "pt")).toEqual([]);
}
