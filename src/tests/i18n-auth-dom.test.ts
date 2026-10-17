import { parse, serialize } from "parse5";
import { describe, expect, it } from "vitest";
import { verificarPaginaAuth, type CaminhoAuth } from "./suporte/i18n-auth";
import { verificarFallbackDinamico, type CapturaAnunciador } from "./suporte/i18n-dinamico";
import { verificarEntradaTraduzida } from "./suporte/i18n-entrada";
import { attr, elementos, filhos, texto, type Elemento, type No } from "./suporte/i18n-dom";

type Estado = "inicial" | "vazio";
type Idioma = "pt" | "en";

const EMAIL_ID = ":R1:";
const SENHA_ID = ":R2:";
const HOST = '<next-route-announcer style="position: absolute;"></next-route-announcer>';
const AVISO = '<p data-i18n-aviso lang="en">Portuguese only</p>';

/** Textos de /entrar em cada idioma; o cadastro só existe em português. */
const ENTRAR = {
  pt: {
    titulo: "Entrar", marca: ["/", "Scrutiniums — página inicial"], criar: "Criar acesso", seletor: ["Idioma", "Português", "Inglês"],
    introducao: "Use o e-mail e a senha da sua conta.", email: "E-mail", erroEmail: "Informe um e-mail válido.", senha: "Senha", erroSenha: "Informe sua senha.",
    submit: "Entrar", fim: '<div><p>Prefere ou precisa entrar sem senha? <a href="/entrar/sms">Entrar com código por SMS</a></p><a href="/cadastro">Ainda não tenho cadastro</a></div>',
    termos: "Termos de uso", privacidade: "Privacidade",
  },
  en: {
    titulo: "Sign in", marca: ["/en", "Scrutiniums home page"], criar: "Sign up", seletor: ["Language", "Portuguese", "English"],
    introducao: "Use your account email and password.", email: "Email", erroEmail: "Enter a valid email address.", senha: "Password", erroSenha: "Enter your password.",
    submit: "Sign in", fim: '<div><p>Prefer or need to sign in without a password? <a href="/en/entrar/sms">Sign in with an SMS code</a></p><a href="/cadastro">I don&#39;t have an account yet</a></div>',
    termos: "Terms of use", privacidade: "Privacy",
  },
} as const;

function campoEmail(caminho: CaminhoAuth, estado: Estado, id: string, idioma: Idioma): string {
  const erro = estado === "vazio";
  const t = caminho === "/entrar" ? ENTRAR[idioma] : ENTRAR.pt;
  return `<div><label for="${id}">${t.email}</label><input id="${id}" name="email" type="email" autocomplete="email" inputmode="email" required value=""${caminho === "/entrar" ? ' maxlength="254"' : ""}${erro ? ` aria-invalid="true" aria-describedby="${id}-erro"` : ""}>${erro ? `<p id="${id}-erro" role="alert">${t.erroEmail}</p>` : ""}</div>`;
}

function campoSenha(estado: Estado, id: string, idioma: Idioma): string {
  const erro = estado === "vazio";
  const t = ENTRAR[idioma];
  return `<div><label for="${id}">${t.senha}</label><input id="${id}" name="current-password" type="password" autocomplete="current-password" maxlength="72" required value=""${erro ? ` aria-invalid="true" aria-describedby="${id}-erro"` : ""}>${erro ? `<p id="${id}-erro" role="alert">${t.erroSenha}</p>` : ""}</div>`;
}

function consentimentos(estado: Estado): string {
  const erro = estado === "vazio";
  return `<div><label><input type="checkbox"${erro ? ' aria-invalid="true" aria-describedby="termos-erro"' : ""}><span>Li e aceito os <a href="/termos">Termos de uso</a> e a <a href="/privacidade">Política de privacidade</a>. Seu e-mail é usado para contato e comunicações essenciais.</span></label>${erro ? '<p id="termos-erro" role="alert">É preciso aceitar os termos para continuar.</p>' : ""}<label><input type="checkbox"><span>Quero receber novidades da plataforma por e-mail (opcional).</span></label></div>`;
}

/** Fixtures de contrato: preservam IDs e relações, sem reproduzir CSS do produto. */
function documento(caminho: CaminhoAuth, idioma: Idioma = "pt", estado: Estado = "inicial", ids = { email: EMAIL_ID, senha: SENHA_ID }) {
  const entrar = caminho === "/entrar";
  const t = entrar ? ENTRAR[idioma] : ENTRAR.pt;
  const titulo = entrar ? t.titulo : "Crie seu acesso";
  const seletor = entrar ? `<div role="group" aria-label="${t.seletor[0]}"><span aria-hidden="true">${t.seletor[0]}</span>`
    + `<a href="/entrar" hreflang="pt-BR">${t.seletor[1]}</a><a href="/en/entrar" hreflang="en">${t.seletor[2]}</a></div>` : "";
  const header = `<header><a href="${t.marca[0]}" aria-label="${t.marca[1]}">Scrutiniums</a><a href="${entrar ? "/cadastro" : "/entrar"}">${entrar ? t.criar : "Entrar"}</a>${seletor}</header>`;
  const introducao = entrar
    ? `<p>${t.introducao}</p>`
    : '<div aria-label="Etapa 1 de 3"><span aria-hidden="true">01</span><span>Etapa 1 de 3</span></div>';
  const fimFormulario = entrar
    ? t.fim
    : '<div><a href="/entrar">Já tenho cadastro</a><p>100% gratuito · sem assinatura · sem cobrança</p></div>';
  const form = `<form novalidate>${campoEmail(caminho, estado, ids.email, idioma)}${entrar ? campoSenha(estado, ids.senha, idioma) : consentimentos(estado)}<button type="submit">${entrar ? t.submit : "Continuar"}</button>${fimFormulario}</form>`;
  const main = `<main><section>${entrar ? "" : introducao}<h1>${titulo}</h1>${entrar ? introducao : "<p>Informe seu e-mail de contato para começar.</p>"}${form}</section></main>`;
  const footer = `<footer><p>scrutiniums.com</p><p><a href="/termos">${t.termos}</a> · <a href="/privacidade">${t.privacidade}</a></p></footer>`;
  const produto = `<div>${header}${main}${footer}</div>`;
  const corpo = idioma === "en" && !entrar ? `${AVISO}<div data-i18n-estado="portugues_marcado" lang="pt-BR">${produto}</div>` : produto;
  return parse(`<html lang="${idioma === "en" ? "en" : "pt-BR"}"><head><title>${titulo} · Scrutiniums</title></head><body>${corpo}${HOST}</body></html>`);
}

function encontrar(doc: No, predicado: (e: Elemento) => boolean): Elemento {
  const encontrados = elementos(doc).filter(predicado);
  expect(encontrados, "alvo único da adulteração da fixture").toHaveLength(1);
  return encontrados[0];
}
const input = (doc: No, nome: string) => encontrar(doc, (e) => e.tagName === "input" && attr(e, "name") === nome);
function atributo(no: Elemento, nome: string, valor?: string): void {
  no.attrs = no.attrs.filter((a) => a.name !== nome);
  if (valor !== undefined) no.attrs.push({ name: nome, value: valor });
}
function remover(no: Elemento): void {
  const pai = no.parentNode;
  if (!pai || !("childNodes" in pai)) throw new Error("Fixture sem pai para remoção");
  pai.childNodes = pai.childNodes.filter((filho) => filho !== no);
}

describe.each(["/entrar", "/cadastro"] as const)("contrato DOM de %s", (caminho) => {
  it.each(["pt", "en"] as const)("aceita o formulário inicial completo em %s", (idioma) => {
    verificarPaginaAuth(documento(caminho, idioma), caminho);
  });

  it.each(["pt", "en"] as const)("aceita dois erros locais de envio vazio em %s", (idioma) => {
    verificarPaginaAuth(documento(caminho, idioma, "vazio"), caminho, "vazio");
  });

  it("aceita outros IDs React válidos sem reescrever os atributos da prova", () => {
    const doc = documento(caminho, "en", "vazio");
    const substituicoes = new Map([
      [EMAIL_ID, ":r17:"], [EMAIL_ID + "-erro", ":r17:-erro"],
      [SENHA_ID, ":r18:"], [SENHA_ID + "-erro", ":r18:-erro"],
    ]);
    for (const no of elementos(doc)) {
      for (const nome of ["id", "for", "aria-describedby"]) {
        const valor = attr(no, nome);
        if (valor !== undefined && substituicoes.has(valor)) atributo(no, nome, substituicoes.get(valor));
      }
    }
    const atributosAntes = elementos(doc).map((no) => no.attrs.map((a) => ({ ...a })));
    verificarPaginaAuth(doc, caminho, "vazio");
    expect(elementos(doc).map((no) => no.attrs)).toEqual(atributosAntes);
    expect(attr(input(doc, "email"), "id")).toBe(":r17:");
  });

  const adulteracoes: [string, (doc: No) => void][] = [
    ["ID duplicado fora do campo", (doc) => atributo(encontrar(doc, (e) => e.tagName === "section"), "id", EMAIL_ID)],
    ["referência ARIA sem alvo", (doc) => atributo(encontrar(doc, (e) => e.tagName === "section"), "aria-labelledby", "titulo-inexistente")],
    ["label sem seu Field", (doc) => atributo(encontrar(doc, (e) => e.tagName === "label" && attr(e, "for") === EMAIL_ID), "for", "campo-inexistente")],
    ["e-mail sem required", (doc) => atributo(input(doc, "email"), "required")],
    ["limite de e-mail alterado", (doc) => atributo(input(doc, "email"), "maxlength", caminho === "/entrar" ? "255" : "254")],
    ["nome do e-mail alterado", (doc) => atributo(input(doc, "email"), "name", "outro-email")],
    ["tipo do e-mail alterado", (doc) => atributo(input(doc, "email"), "type", "text")],
    ["autocomplete do e-mail alterado", (doc) => atributo(input(doc, "email"), "autocomplete", "off")],
    ["campo de e-mail removido", (doc) => remover(input(doc, "email"))],
    ["rodapé removido", (doc) => remover(encontrar(doc, (e) => e.tagName === "footer"))],
    caminho === "/cadastro"
      ? ["oferta indevida de inglês", (doc) => atributo(encontrar(doc, (e) => e.tagName === "header"), "role", "group")]
      : ["seletor de idioma removido", (doc) => remover(encontrar(doc, (e) => attr(e, "role") === "group"))],
  ];
  it.each(adulteracoes)("reprova %s em PT e EN", (_nome, adulterar) => {
    for (const idioma of ["pt", "en"] as const) {
      const doc = documento(caminho, idioma);
      adulterar(doc);
      expect(() => verificarPaginaAuth(doc, caminho)).toThrow();
    }
  });

  it("reprova alerta de e-mail ausente depois do envio vazio", () => {
    const doc = documento(caminho, "en", "vazio");
    remover(encontrar(doc, (e) => attr(e, "id") === EMAIL_ID + "-erro"));
    expect(() => verificarPaginaAuth(doc, caminho, "vazio")).toThrow();
  });

  it("reprova estado inicial apresentado como resposta de envio vazio", () => {
    expect(() => verificarPaginaAuth(documento(caminho), caminho, "vazio")).toThrow();
  });

  it.runIf(caminho === "/cadastro")("reprova a ilha EN sem aviso visível", () => {
    const doc = documento(caminho, "en");
    atributo(encontrar(doc, (e) => attr(e, "data-i18n-aviso") !== undefined), "hidden", "");
    expect(() => verificarPaginaAuth(doc, caminho)).toThrow();
  });

  it("reprova erros associados ao outro controle mesmo com todos os IDs presentes", () => {
    const doc = documento(caminho, "pt", "vazio");
    const outro = caminho === "/entrar" ? input(doc, "current-password")
      : encontrar(doc, (e) => e.tagName === "input" && attr(e, "aria-describedby") === "termos-erro");
    const outroErro = attr(outro, "aria-describedby");
    expect(outroErro).toBeDefined();
    atributo(input(doc, "email"), "aria-describedby", outroErro);
    atributo(outro, "aria-describedby", EMAIL_ID + "-erro");
    expect(() => verificarPaginaAuth(doc, caminho, "vazio")).toThrow();
  });
});

describe("atributos próprios de cada formulário", () => {
  it("reprova label de e-mail apontando para a senha existente", () => {
    const doc = documento("/entrar");
    atributo(encontrar(doc, (e) => e.tagName === "label" && attr(e, "for") === EMAIL_ID), "for", SENHA_ID);
    expect(() => verificarPaginaAuth(doc, "/entrar")).toThrow();
  });

  it.each([
    ["required", undefined],
    ["maxlength", "73"],
    ["name", "password"],
    ["type", "text"],
    ["autocomplete", "new-password"],
  ] as const)("reprova alteração de %s na senha", (nome, valor) => {
    const doc = documento("/entrar", "en");
    atributo(input(doc, "current-password"), nome, valor);
    expect(() => verificarPaginaAuth(doc, "/entrar")).toThrow();
  });

  it("reprova novidades opcionais transformadas em consentimento obrigatório HTML", () => {
    const doc = documento("/cadastro", "en");
    const checks = elementos(doc).filter((e) => e.tagName === "input" && attr(e, "type") === "checkbox");
    expect(checks).toHaveLength(2);
    atributo(checks[1], "required", "");
    expect(() => verificarPaginaAuth(doc, "/cadastro")).toThrow();
  });

  it("reprova checkbox opcional marcado sem escolha do visitante", () => {
    const doc = documento("/cadastro");
    const checks = elementos(doc).filter((e) => e.tagName === "input" && attr(e, "type") === "checkbox");
    expect(checks).toHaveLength(2);
    atributo(checks[1], "checked", "");
    expect(() => verificarPaginaAuth(doc, "/cadastro")).toThrow();
  });
});

const EMAIL_EN = ":R9:";
const SENHA_EN = ":Ra:";
function anunciador(idioma: "pt-BR" | "en"): CapturaAnunciador {
  return {
    quantidade: 1, filhoDiretoDoBody: true, dentroDaIlha: false, idioma,
    host: { tipo: 1, nome: "next-route-announcer", atributos: [["style", "position: absolute;"]], filhos: 0, texto: "" },
    sombra: { modo: "open", filhos: [{ tipo: 1, nome: "div", filhos: 0, texto: "", atributos: [
      ["aria-live", "assertive"], ["id", "__next-route-announcer__"], ["role", "alert"],
      ["style", "position:absolute;border:0;height:1px;margin:-1px;padding:0;width:1px;clip:rect(0 0 0 0);overflow:hidden;white-space:nowrap;word-wrap:normal"],
    ] }] },
  };
}
function par(caminho: CaminhoAuth, estado: Estado) {
  return {
    pt: documento(caminho, "pt", estado),
    en: documento(caminho, "en", estado, { email: EMAIL_EN, senha: SENHA_EN }),
  };
}
function mudarParagrafo(doc: No, anterior: string, novo: string): void {
  const p = encontrar(doc, (e) => e.tagName === "p" && texto(e) === anterior);
  const nos = filhos(p);
  expect(nos).toHaveLength(1);
  const no = nos[0];
  if (!("value" in no)) throw new Error("Parágrafo de fixture não contém texto simples");
  no.value = novo;
}

describe("cadastro: comparação integral com adaptação explícita dos IDs dos Fields", () => {
  const estados: Estado[] = ["inicial", "vazio"];
  it.each(estados)("compara /cadastro no estado %s sem modificar os documentos", (estado) => {
    const { pt, en } = par("/cadastro", estado);
    const antes = [serialize(pt), serialize(en)];
    verificarFallbackDinamico(pt, en, anunciador("pt-BR"), anunciador("en"), { caminho: "/cadastro", estado });
    expect([serialize(pt), serialize(en)]).toEqual(antes);
    expect(attr(input(pt, "email"), "id")).toBe(EMAIL_ID);
    expect(attr(input(en, "email"), "id")).toBe(EMAIL_EN);
  });

  it.each(estados)("sem opção mantém a comparação literal de /cadastro no estado %s", (estado) => {
    const { pt, en } = par("/cadastro", estado);
    expect(() => verificarFallbackDinamico(pt, en, anunciador("pt-BR"), anunciador("en"))).toThrow();
  });

  it("reprova estado inicial explícito quando os dois documentos já exibem erros", () => {
    const { pt, en } = par("/cadastro", "vazio");
    const antes = [serialize(pt), serialize(en)];
    expect(() => verificarFallbackDinamico(pt, en, anunciador("pt-BR"), anunciador("en"), { caminho: "/cadastro", estado: "inicial" })).toThrow();
    expect([serialize(pt), serialize(en)]).toEqual(antes);
  });

  it("não aceita o login traduzido como fallback integral", () => {
    const { pt, en } = par("/entrar", "inicial");
    expect(() => verificarFallbackDinamico(pt, en, anunciador("pt-BR"), anunciador("en"), { caminho: "/entrar", estado: "inicial" })).toThrow();
  });

  type Adulteracao = { nome: string; estado: Estado; alterar: (pt: No, en: No) => void; contratosIntactos?: boolean };
  const adulteracoes: Adulteracao[] = [
    { nome: "ID React adicional fora de Field", estado: "inicial", contratosIntactos: true, alterar: (_pt, en) => {
      atributo(encontrar(en, (e) => e.tagName === "section"), "id", ":Rb:");
    } },
    { nome: "ID de Field fora do formato React", estado: "inicial", contratosIntactos: true, alterar: (_pt, en) => {
      atributo(input(en, "email"), "id", "email-fixo");
      atributo(encontrar(en, (e) => e.tagName === "label" && attr(e, "for") === EMAIL_EN), "for", "email-fixo");
    } },
    { nome: "atributo adicional do controle", estado: "vazio", contratosIntactos: true, alterar: (_pt, en) => {
      atributo(input(en, "email"), "data-campo", "extra");
    } },
    { nome: "número fora das asserções locais do formulário", estado: "vazio", contratosIntactos: true, alterar: (pt, en) => {
      mudarParagrafo(pt, "scrutiniums.com", "scrutiniums.com 42");
      mudarParagrafo(en, "scrutiniums.com", "scrutiniums.com 43");
    } },
    { nome: "termos-erro renomeado junto com sua referência", estado: "vazio", alterar: (_pt, en) => {
      atributo(encontrar(en, (e) => attr(e, "id") === "termos-erro"), "id", "consentimento-erro");
      atributo(encontrar(en, (e) => e.tagName === "input" && attr(e, "aria-describedby") === "termos-erro"), "aria-describedby", "consentimento-erro");
    } },
  ];
  it.each(adulteracoes)("reprova $nome", ({ estado, alterar, contratosIntactos }) => {
    const { pt, en } = par("/cadastro", estado);
    alterar(pt, en);
    if (contratosIntactos) {
      verificarPaginaAuth(pt, "/cadastro", estado);
      verificarPaginaAuth(en, "/cadastro", estado);
    }
    const antes = [serialize(pt), serialize(en)];
    expect(() => verificarFallbackDinamico(pt, en, anunciador("pt-BR"), anunciador("en"), { caminho: "/cadastro", estado })).toThrow();
    expect([serialize(pt), serialize(en)]).toEqual(antes);
  });
});

describe("entrar: paridade da tradução publicada", () => {
  const estados: Estado[] = ["inicial", "vazio"];
  it.each(estados)("aceita /entrar traduzido no estado %s sem modificar os documentos", (estado) => {
    const { pt, en } = par("/entrar", estado);
    const antes = [serialize(pt), serialize(en)];
    verificarPaginaAuth(pt, "/entrar", estado);
    verificarPaginaAuth(en, "/entrar", estado);
    verificarEntradaTraduzida(pt, en);
    expect([serialize(pt), serialize(en)]).toEqual(antes);
  });

  type Adulteracao = { nome: string; estado: Estado; alterar: (pt: No, en: No) => void; contratosIntactos?: boolean };
  const adulteracoes: Adulteracao[] = [
    { nome: "ID duplicado", estado: "inicial", alterar: (_pt, en) => {
      atributo(encontrar(en, (e) => e.tagName === "section"), "id", EMAIL_EN);
    } },
    { nome: "label cruzada com a senha", estado: "inicial", alterar: (_pt, en) => {
      atributo(encontrar(en, (e) => e.tagName === "label" && attr(e, "for") === EMAIL_EN), "for", SENHA_EN);
    } },
    { nome: "referência ao erro do outro campo", estado: "vazio", alterar: (_pt, en) => {
      atributo(input(en, "email"), "aria-describedby", SENHA_EN + "-erro");
    } },
    { nome: "atributo existente do controle alterado", estado: "inicial", contratosIntactos: true, alterar: (pt, en) => {
      atributo(input(pt, "email"), "class", "campo");
      atributo(input(en, "email"), "class", "campo-alterado");
    } },
    { nome: "texto português fora das asserções locais", estado: "inicial", contratosIntactos: true, alterar: (_pt, en) => {
      mudarParagrafo(en, "scrutiniums.com", "scrutiniums.com Texto adicional para conferir.");
    } },
    { nome: "número fora das asserções locais", estado: "vazio", contratosIntactos: true, alterar: (pt, en) => {
      mudarParagrafo(pt, "scrutiniums.com", "scrutiniums.com 42");
      mudarParagrafo(en, "scrutiniums.com", "scrutiniums.com 43");
    } },
    { nome: "aria-controls diferente apontando campos existentes", estado: "inicial", contratosIntactos: true, alterar: (pt, en) => {
      atributo(input(pt, "email"), "aria-controls", SENHA_ID);
      atributo(input(en, "email"), "aria-controls", SENHA_EN);
    } },
    { nome: "introdução esquecida em português", estado: "inicial", alterar: (_pt, en) => {
      mudarParagrafo(en, "Use your account email and password.", "Use o e-mail e a senha da sua conta.");
    } },
    { nome: "link do SMS apontando a irmã portuguesa", estado: "inicial", alterar: (_pt, en) => {
      atributo(encontrar(en, (e) => e.tagName === "a" && attr(e, "href") === "/en/entrar/sms"), "href", "/entrar/sms");
    } },
  ];
  it.each(adulteracoes)("reprova $nome", ({ estado, alterar, contratosIntactos }) => {
    const { pt, en } = par("/entrar", estado);
    alterar(pt, en);
    if (contratosIntactos) {
      verificarPaginaAuth(pt, "/entrar", estado);
      verificarPaginaAuth(en, "/entrar", estado);
    }
    const antes = [serialize(pt), serialize(en)];
    expect(() => {
      verificarPaginaAuth(en, "/entrar", estado);
      verificarEntradaTraduzida(pt, en);
    }).toThrow();
    expect([serialize(pt), serialize(en)]).toEqual(antes);
  });
});
