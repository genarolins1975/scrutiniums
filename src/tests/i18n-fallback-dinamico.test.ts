import { parse } from "parse5";
import { describe, expect, it } from "vitest";
import { GLOSSARIO } from "@/lib/data/glossario";
import { LINKEDIN_URL } from "@/lib/contato";
import { PRIVACY_VERSION } from "@/lib/versoesPoliticas";
import { cenarioDinamico, validarAnunciador, verificarFallbackDinamico, verificarPaginaConcluida, type CapturaAnunciador } from "./suporte/i18n-dinamico";

const HOST = '<next-route-announcer style="position: absolute;"></next-route-announcer>';
const AVISO = '<p data-i18n-aviso lang="en">Portuguese only</p>';
const PRODUTO = '<div><header>Scrutiniums</header><main><h1>Exemplo</h1><p>Dados 42.</p></main><footer>Fim</footer></div>';
const ilha = (produto: string) => `<div data-i18n-estado="portugues_marcado" lang="pt-BR">${produto}</div>`;
const documento = (idioma: string, corpo: string) => parse(`<html lang="${idioma}"><head><title>Scrutiniums</title></head><body>${corpo}</body></html>`);
function captura(idioma: "pt-BR" | "en" = "en"): CapturaAnunciador {
  return {
    quantidade: 1, filhoDiretoDoBody: true, dentroDaIlha: false, idioma,
    host: { tipo: 1, nome: "next-route-announcer", atributos: [["style", "position: absolute;"]], filhos: 0, texto: "" },
    sombra: { modo: "open", filhos: [{ tipo: 1, nome: "div", filhos: 0, texto: "", atributos: [
      ["aria-live", "assertive"], ["id", "__next-route-announcer__"], ["role", "alert"],
      ["style", "position:absolute;border:0;height:1px;margin:-1px;padding:0;width:1px;clip:rect(0 0 0 0);overflow:hidden;white-space:nowrap;word-wrap:normal"],
    ] }] },
  };
}
function verificar(corpoEn: string, produtoPt = PRODUTO, capturaEn = captura()) {
  verificarFallbackDinamico(documento("pt-BR", produtoPt + HOST), documento("en", corpoEn), captura("pt-BR"), capturaEn);
}

describe("anunciador do Next na entrada direta: host e shadow root", () => {
  it("confere separadamente o shadow root que não existe na serialização HTML", () => {
    validarAnunciador(captura());
    verificar(AVISO + ilha(PRODUTO) + HOST);
  });

  const adulteracoes: [string, (c: CapturaAnunciador) => void][] = [
    ["host ausente", (c) => { c.quantidade = 0; c.host = null; }],
    ["host duplicado", (c) => { c.quantidade = 2; }],
    ["host fora do body", (c) => { c.filhoDiretoDoBody = false; }],
    ["host dentro da ilha", (c) => { c.dentroDaIlha = true; }],
    ["idioma desconhecido", (c) => { c.idioma = "fr"; }],
    ["atributo extra do host", (c) => { c.host!.atributos.push(["hidden", ""]); }],
    ["estilo do host", (c) => { c.host!.atributos[0][1] = "position: fixed;"; }],
    ["texto leve", (c) => { c.host!.filhos = 1; c.host!.texto = "42"; }],
    ["filho leve sem texto", (c) => { c.host!.filhos = 1; }],
    ["shadow root ausente", (c) => { c.sombra = null; }],
    ["shadow root fechado", (c) => { c.sombra!.modo = "closed"; }],
    ["nó extra no shadow root", (c) => { c.sombra!.filhos.push({ tipo: 3, nome: "#text", atributos: [], filhos: 0, texto: "42" }); }],
    ["elemento interno trocado", (c) => { c.sombra!.filhos[0].nome = "span"; }],
    ["id interno", (c) => { c.sombra!.filhos[0].atributos[1][1] = "outra-regiao"; }],
    ["aria-live interno", (c) => { c.sombra!.filhos[0].atributos[0][1] = "off"; }],
    ["role interno", (c) => { c.sombra!.filhos[0].atributos[2][1] = "status"; }],
    ["declaração CSS extra", (c) => { c.sombra!.filhos[0].atributos[3][1] += ";display:none"; }],
    ["número no shadow root", (c) => { c.sombra!.filhos[0].filhos = 1; c.sombra!.filhos[0].texto = "42"; }],
    ["prosa no shadow root", (c) => { c.sombra!.filhos[0].filhos = 1; c.sombra!.filhos[0].texto = "Dados indevidos."; }],
  ];
  it.each(adulteracoes)("reprova %s sem precisar iniciar outro navegador", (_nome, adulterar) => {
    const c = captura();
    adulterar(c);
    expect(() => validarAnunciador(c)).toThrow();
  });
});

describe("fallback dinâmico: nada humano pode desaparecer na projeção do host", () => {
  it.each([
    ["host ausente no HTML", AVISO + ilha(PRODUTO)],
    ["host duplicado no HTML", AVISO + ilha(PRODUTO) + HOST + HOST],
    ["host escondido dentro da ilha", AVISO + ilha(PRODUTO + HOST.replace("style=", "hidden style=")) + HOST],
    ["host movido para a ilha", AVISO + ilha(PRODUTO + HOST)],
    ["atributo adulterado no host serializado", AVISO + ilha(PRODUTO) + HOST.replace("absolute", "fixed")],
    ["texto leve no host serializado", AVISO + ilha(PRODUTO) + HOST.replace("</next", "42</next")],
    ["comentário leve no host serializado", AVISO + ilha(PRODUTO) + HOST.replace("</next", "<!-- extra --></next")],
    ["número alterado dentro da ilha", AVISO + ilha(PRODUTO.replace("42", "43")) + HOST],
    ["número antes do aviso", "42" + AVISO + ilha(PRODUTO) + HOST],
    ["texto depois do host", AVISO + ilha(PRODUTO) + HOST + "Exemplo"],
    ["número oculto fora da ilha", AVISO + ilha(PRODUTO) + '<span hidden>42</span>' + HOST],
    ["valor deslocado para fora da ilha", AVISO + ilha(PRODUTO.replace("42", "")) + "42" + HOST],
    ["aviso escondido", AVISO.replace("<p ", "<p hidden ") + ilha(PRODUTO) + HOST],
    ["idioma errado na ilha", AVISO + ilha(PRODUTO).replace('lang="pt-BR"', 'lang="en"') + HOST],
    ["ilha extra", AVISO + ilha(PRODUTO) + AVISO + ilha("<p>42</p>") + HOST],
    ["marcador desconhecido", AVISO + ilha(PRODUTO).replace("portugues_marcado", "ignorar") + HOST],
  ])("reprova %s", (_nome, en) => {
    expect(() => verificar(en)).toThrow();
  });

  it.each([
    ["template B:", (produto: string) => produto + '<template id="B:0"></template>'],
    ["segmento S:", (produto: string) => produto + '<div hidden id="S:0">42</div>'],
    ["main ocupado", (produto: string) => produto.replace("<main>", '<main aria-busy="true">')],
    ["main ausente", (produto: string) => produto.replace(/main>/g, "div>")],
    ["H1 ausente", (produto: string) => produto.replace(/h1>/g, "p>")],
  ] as const)("reprova %s mesmo quando os dois corpos são iguais", (_nome, adulterar) => {
    const incompleto = adulterar(PRODUTO);
    expect(() => verificar(AVISO + ilha(incompleto) + HOST, incompleto)).toThrow();
  });

  it("não confunde scripts de transporte já executados com nós pendentes", () => {
    const executado = '<script>function $RC() {} function $RS() {}</script>';
    verificar(AVISO + ilha(PRODUTO) + executado + HOST, PRODUTO + executado);
  });
});

const CABECALHO = '<header><a aria-label="Scrutiniums — página inicial" href="/">Scrutiniums</a><nav aria-label="Navegação principal"></nav></header>';
// Fixtures só de estrutura e fecho, sem duplicar os textos jurídicos publicados.
function pagina(caminho: "/glossario" | "/termos" | "/privacidade"): string {
  let main: string;
  if (caminho === "/glossario") {
    main = '<header><h1>Glossário</h1></header><nav aria-label="Índice do glossário">'
      + GLOSSARIO.map((e) => `<a href="#${e.slug}">${e.nome}</a>`).join("") + "</nav>"
      + GLOSSARIO.map((e) => `<section id="${e.slug}" aria-labelledby="${e.slug}-titulo"><h2 id="${e.slug}-titulo">${e.nome}</h2><dl>${"<dt>Campo</dt><dd>Valor</dd>".repeat(8)}</dl></section>`).join("")
      + '<p><a href="/observatorio/methodology">Método</a></p>';
  } else if (caminho === "/termos") {
    main = '<header><h1>Termos de uso</h1><p>Versão vigente desde agosto de 2026.</p></header>'
      + Array.from({ length: 10 }, (_, i) => {
        const id = `termos-${String(i + 1).padStart(2, "0")}`;
        return `<section aria-labelledby="${id}"><h2 id="${id}">${i === 9 ? "Contato, legislação e foro" : "Seção"}</h2></section>`;
      }).join("") + `<p><a href="/privacidade">Privacidade</a><a href="${LINKEDIN_URL}">LinkedIn</a></p>`;
  } else {
    main = `<header><h1>Política de privacidade</h1><p>Versão ${PRIVACY_VERSION}.</p></header>`
      + ["priv-dados", "priv-base", "priv-marketing", "priv-direitos", "priv-retencao", "priv-analytics", "priv-resumo"].map((id) =>
        `<section aria-labelledby="${id}"><h2 id="${id}">Seção</h2>${id === "priv-resumo" ? "<p>7 dias</p>" : ""}</section>`).join("")
      + `<p>Versão da política: ${PRIVACY_VERSION}.<a href="/app/conta">Conta</a><a href="mailto:privacidade@scrutiniums.com">Contato</a><a href="/termos">Termos</a></p>`;
  }
  return `<div>${CABECALHO}<main>${main}</main><footer>Fim</footer></div>`;
}

describe("contratos explícitos de conclusão das três páginas", () => {
  it.each(["/glossario", "/termos", "/privacidade"] as const)("exige começo, todas as seções e fecho de %s", (caminho) => {
    const corpo = pagina(caminho);
    verificarPaginaConcluida(documento("pt-BR", corpo + HOST), caminho);
    verificarPaginaConcluida(documento("en", AVISO + ilha(corpo) + HOST), "/en" + caminho);
    const secoes = [...corpo.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)];
    expect(secoes.length).toBeGreaterThan(0);
    const ultima = secoes[secoes.length - 1][0];
    expect(() => verificarPaginaConcluida(documento("pt-BR", corpo.replace(ultima, "") + HOST), caminho)).toThrow();
    expect(() => verificarPaginaConcluida(documento("pt-BR", corpo.replace("<footer>Fim</footer>", "") + HOST), caminho)).toThrow();
    const semFecho = corpo.replace(/<p>(?:(?!<p>)[\s\S])*?<\/p><\/main>/, "</main>");
    expect(semFecho).not.toBe(corpo);
    expect(() => verificarPaginaConcluida(documento("pt-BR", semFecho + HOST), caminho)).toThrow();
  });

  it.each(["/cadastro/telefone", "/english/glossario", "/en/en/glossario", "/en/glossario/", "/en/", "/glossario?origem=x"])("recusa cenário não declarado: %s", (caminho) => {
    expect(() => cenarioDinamico(caminho)).toThrow();
  });

  it.each(["/entrar", "/cadastro"])("admite apenas as duas novas entradas declaradas: %s", (caminho) => {
    expect(cenarioDinamico(caminho)).toEqual({ pt: caminho, idioma: "pt-BR" });
    expect(cenarioDinamico("/en" + caminho)).toEqual({ pt: caminho, idioma: "en" });
  });

  it.each(["/entrar/sms", "/en/entrar/sms", "/en/cadastro/telefone", "/en/cadastro/", "/cadastro?de=x"])("não generaliza auth para %s", (caminho) => {
    expect(() => cenarioDinamico(caminho)).toThrow();
  });
});
