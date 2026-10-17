import { parse, serialize } from "parse5";
import { describe, expect, it } from "vitest";
import { verificarPaginaSms, type ComparacaoSms } from "./suporte/i18n-sms";
import { verificarEntradaTraduzida } from "./suporte/i18n-entrada";
import { attr, elementos, filhos, texto, type Elemento, type No } from "./suporte/i18n-dom";

// IDs no formato do useId do React; cada idioma tem os seus.
const IDS = { pais: ":R2ijttsq:", telefone: ":R3ijttsq:", otp: ":R1ujtttsq:" };
const IDS_EN = { pais: ":Raajtttsq:", telefone: ":Reajtttsq:", otp: ":R7qjttttsq:" };
const SOLICITACAO: ComparacaoSms = { caminho: "/entrar/sms", estado: "inicial" };
const SOLICITACAO_VAZIA: ComparacaoSms = { caminho: "/entrar/sms", estado: "vazio" };
const OTP_30: ComparacaoSms = { caminho: "/entrar/sms/verificar", estado: "inicial", contador: "30s" };
const OTP_LIBERADO: ComparacaoSms = { caminho: "/entrar/sms/verificar", estado: "inicial", contador: "liberado" };
const OTP_VAZIO: ComparacaoSms = { caminho: "/entrar/sms/verificar", estado: "vazio", contador: "liberado" };

const TEXTOS = {
  pt: {
    tituloSms: "Entrar com código por SMS", tituloOtp: "Código de acesso", marca: ["/", "Scrutiniums — página inicial"], criar: "Criar acesso",
    seletor: ["Idioma", "Português", "Inglês"], termos: "Termos de uso", privacidade: "Privacidade",
    introSms: "<p>Enviamos um código por SMS para o telefone cadastrado.</p><p>Use também este caminho se esqueceu sua senha: depois de entrar, defina uma nova em Conta.</p>",
    introOtp: "<p>Enviamos um código de acesso por SMS ao telefone cadastrado.</p>",
    pais: "País", brasil: "Brasil (+55)", telefone: "Telefone celular", erroTelefone: "Informe um telefone válido com DDD.", submitSms: "Receber código por SMS",
    linksSms: '<a href="/entrar">Entrar com e-mail e senha</a><a href="/cadastro">Ainda não tenho cadastro</a>',
    destino: ["Se houver cadastro para", ", você receberá um código de 6 dígitos por SMS."], codigo: "Código recebido por SMS",
    erroCodigo: "Informe o código de 6 dígitos.", submitOtp: "Entrar", reenviarEm: "Reenviar código em 30s", reenviar: "Reenviar código",
    alterar: '<a href="/entrar/sms">Alterar telefone</a>',
  },
  en: {
    tituloSms: "Sign in with an SMS code", tituloOtp: "Access code", marca: ["/en", "Scrutiniums home page"], criar: "Sign up",
    seletor: ["Language", "Portuguese", "English"], termos: "Terms of use", privacidade: "Privacy",
    introSms: "<p>We send a code by SMS to the phone number on your account.</p><p>Use this option too if you forgot your password: after signing in, set a new one under Account.</p>",
    introOtp: "<p>We sent an access code by SMS to the phone number on your account.</p>",
    pais: "Country", brasil: "Brazil (+55)", telefone: "Mobile phone", erroTelefone: "Enter a valid phone number with area code.", submitSms: "Get a code by SMS",
    linksSms: '<a href="/en/entrar">Sign in with email and password</a><a href="/cadastro">I don&#39;t have an account yet</a>',
    destino: ["If there is an account for", ", you will receive a 6-digit code by SMS."], codigo: "Code received by SMS",
    erroCodigo: "Enter the 6-digit code.", submitOtp: "Sign in", reenviarEm: "Resend code in 30s", reenviar: "Resend code",
    alterar: '<a href="/en/entrar/sms">Change phone number</a>',
  },
} as const;

/** IDs e atributos literais; a fixture reproduz o DOM de cada idioma sem projetar um no outro. */
function documento(cenario: ComparacaoSms, idioma: "pt" | "en" = "pt", ids = idioma === "pt" ? IDS : IDS_EN) {
  const t = TEXTOS[idioma];
  const solicitar = cenario.caminho === "/entrar/sms";
  const titulo = solicitar ? t.tituloSms : t.tituloOtp;
  const id = solicitar ? ids.telefone : ids.otp;
  const erro = cenario.estado === "vazio";
  const atributosErro = erro ? ` aria-invalid="true" aria-describedby="${id}-erro"` : "";
  const alerta = erro ? `<p id="${id}-erro" role="alert">${solicitar ? t.erroTelefone : t.erroCodigo}</p>` : "";
  const formulario = solicitar
    ? `<div><label for="${ids.pais}">${t.pais}</label><select id="${ids.pais}"><option value="BR" selected="">${t.brasil}</option></select></div>`
      + `<div><label for="${id}">${t.telefone}</label><input id="${id}" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(11) 91234-5678" value=""${atributosErro}>${alerta}</div>`
      + `<button type="submit">${t.submitSms}</button><div>${t.linksSms}</div>`
    : `<p>${t.destino[0]} <span class="font-medium text-carvao">+55 •• •••••-5678</span>${t.destino[1]}</p>`
      + `<div><label for="${id}">${t.codigo}</label><input id="${id}" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="••••••" value=""${atributosErro}>${alerta}</div>`
      + `<button type="submit">${t.submitOtp}</button><div><button type="button" aria-live="polite"${cenario.contador === "30s" ? ' disabled=""' : ""}>${cenario.contador === "30s" ? t.reenviarEm : t.reenviar}</button>${t.alterar}</div>`;
  const seletor = `<div role="group" aria-label="${t.seletor[0]}"><span aria-hidden="true">${t.seletor[0]}</span>`
    + `<a href="${cenario.caminho}" hreflang="pt-BR">${t.seletor[1]}</a><a href="/en${cenario.caminho}" hreflang="en">${t.seletor[2]}</a></div>`;
  const header = `<header><a href="${t.marca[0]}" aria-label="${t.marca[1]}">Scrutiniums</a><a href="/cadastro">${t.criar}</a>${seletor}</header>`;
  const corpo = `<div>${header}<main><section><h1>${titulo}</h1>${solicitar ? t.introSms : t.introOtp}<form novalidate>${formulario}</form></section></main>`
    + `<footer><p>scrutiniums.com</p><p><a href="/termos">${t.termos}</a> · <a href="/privacidade">${t.privacidade}</a></p></footer></div>`;
  return parse(`<html lang="${idioma === "en" ? "en" : "pt-BR"}"><head><title>${titulo} · Scrutiniums</title></head><body>${corpo}<next-route-announcer style="position: absolute;"></next-route-announcer></body></html>`);
}

function encontrar(doc: No, predicado: (e: Elemento) => boolean): Elemento {
  const encontrados = elementos(doc).filter(predicado);
  expect(encontrados, "alvo único da adulteração").toHaveLength(1);
  return encontrados[0];
}
const input = (doc: No) => encontrar(doc, (e) => e.tagName === "input");
const select = (doc: No) => encontrar(doc, (e) => e.tagName === "select");
const reenvio = (doc: No) => encontrar(doc, (e) => e.tagName === "button" && attr(e, "type") === "button");
function atributo(no: Elemento, nome: string, valor?: string): void {
  no.attrs = no.attrs.filter((a) => a.name !== nome);
  if (valor !== undefined) no.attrs.push({ name: nome, value: valor });
}
function remover(no: Elemento): void {
  const pai = no.parentNode;
  if (!pai || !("childNodes" in pai)) throw new Error("Alvo da fixture sem pai");
  pai.childNodes = pai.childNodes.filter((filho) => filho !== no);
}
function substituirTexto(no: Elemento, valor: string): void {
  const nos = filhos(no);
  expect(nos).toHaveLength(1);
  if (!("value" in nos[0])) throw new Error("Alvo da fixture sem texto simples");
  nos[0].value = valor;
}

describe("contratos DOM das duas telas de login por SMS", () => {
  const cenarios: ComparacaoSms[] = [SOLICITACAO, SOLICITACAO_VAZIA, OTP_30, OTP_LIBERADO,
    { caminho: "/entrar/sms/verificar", estado: "vazio", contador: "30s" }, OTP_VAZIO];
  it.each(cenarios)("aceita PT e EN traduzido sem alterar os originais: %j", (cenario) => {
    const pt = documento(cenario), en = documento(cenario, "en");
    const antes = [serialize(pt), serialize(en)];
    expect(attr(input(pt), "id")).not.toBe(attr(input(en), "id"));
    verificarPaginaSms(pt, cenario);
    verificarPaginaSms(en, cenario);
    verificarEntradaTraduzida(pt, en);
    expect([serialize(pt), serialize(en)]).toEqual(antes);
  });

  type Adulteracao = { nome: string; cenario: ComparacaoSms; alterar: (doc: No) => void };
  const adulteracoes: Adulteracao[] = [
    { nome: "país removido", cenario: SOLICITACAO, alterar: (doc) => remover(encontrar(doc, (e) => e.tagName === "option" && attr(e, "value") === "BR")) },
    { nome: "país não habilitado oferecido", cenario: SOLICITACAO, alterar: (doc) => {
      atributo(encontrar(doc, (e) => e.tagName === "option"), "value", "PT");
    } },
    { nome: "Brasil sem seleção inicial", cenario: SOLICITACAO, alterar: (doc) => atributo(encontrar(doc, (e) => e.tagName === "option" && attr(e, "value") === "BR"), "selected") },
    { nome: "select removido", cenario: SOLICITACAO, alterar: (doc) => remover(select(doc)) },
    { nome: "telefone removido", cenario: SOLICITACAO, alterar: (doc) => remover(input(doc)) },
    { nome: "label de país apontando o telefone", cenario: SOLICITACAO, alterar: (doc) => atributo(encontrar(doc, (e) => e.tagName === "label" && attr(e, "for") === IDS_EN.pais), "for", IDS_EN.telefone) },
    { nome: "ID duplicado no shell", cenario: SOLICITACAO, alterar: (doc) => atributo(encontrar(doc, (e) => e.tagName === "footer"), "id", IDS_EN.telefone) },
    { nome: "erro do telefone apontando o país", cenario: SOLICITACAO_VAZIA, alterar: (doc) => atributo(input(doc), "aria-describedby", IDS_EN.pais) },
    { nome: "alerta OTP ausente", cenario: OTP_VAZIO, alterar: (doc) => remover(encontrar(doc, (e) => attr(e, "role") === "alert")) },
    { nome: "select com required novo", cenario: SOLICITACAO, alterar: (doc) => atributo(select(doc), "required", "") },
    { nome: "telefone com name novo", cenario: SOLICITACAO, alterar: (doc) => atributo(input(doc), "name", "phone") },
    { nome: "pattern OTP alterado", cenario: OTP_30, alterar: (doc) => atributo(input(doc), "pattern", "[0-9]{5}") },
    { nome: "limite OTP alterado", cenario: OTP_30, alterar: (doc) => atributo(input(doc), "maxlength", "7") },
    { nome: "máscara com número alterado", cenario: OTP_30, alterar: (doc) => substituirTexto(encontrar(doc, (e) => e.tagName === "span" && texto(e) === "+55 •• •••••-5678"), "+55 •• •••••-5679") },
    { nome: "contador inicial em 29", cenario: OTP_30, alterar: (doc) => substituirTexto(reenvio(doc), "Resend code in 29s") },
    { nome: "contador liberado ainda bloqueado", cenario: OTP_LIBERADO, alterar: (doc) => atributo(reenvio(doc), "disabled", "") },
    { nome: "contador inicial habilitado", cenario: OTP_30, alterar: (doc) => atributo(reenvio(doc), "disabled") },
    { nome: "aria-live do contador alterado", cenario: OTP_30, alterar: (doc) => atributo(reenvio(doc), "aria-live", "off") },
    { nome: "rótulo do telefone esquecido em português", cenario: SOLICITACAO, alterar: (doc) => substituirTexto(encontrar(doc, (e) => e.tagName === "label" && texto(e) === "Mobile phone"), "Telefone celular") },
    { nome: "troca de telefone apontando a irmã portuguesa", cenario: OTP_30, alterar: (doc) => atributo(encontrar(doc, (e) => e.tagName === "a" && texto(e) === "Change phone number"), "href", "/entrar/sms") },
    { nome: "seletor de idioma removido", cenario: SOLICITACAO, alterar: (doc) => remover(encontrar(doc, (e) => attr(e, "role") === "group")) },
    { nome: "página marcada como só em português", cenario: SOLICITACAO, alterar: (doc) => atributo(encontrar(doc, (e) => e.tagName === "main"), "data-i18n-estado", "portugues_marcado") },
  ];
  it.each(adulteracoes)("reprova $nome", ({ cenario, alterar }) => {
    const doc = documento(cenario, "en");
    alterar(doc);
    const antes = serialize(doc);
    expect(() => verificarPaginaSms(doc, cenario)).toThrow();
    expect(serialize(doc)).toEqual(antes);
  });

  it("a paridade recusa atributo adicional, texto português e número diferente fora das asserções locais", () => {
    const pt = documento(OTP_LIBERADO);
    for (const alterar of [
      (doc: No) => atributo(input(doc), "data-extra", "preservar"),
      (doc: No) => substituirTexto(encontrar(doc, (e) => e.tagName === "p" && texto(e) === "scrutiniums.com"), "scrutiniums.com Texto adicional para conferir."),
      (doc: No) => substituirTexto(encontrar(doc, (e) => e.tagName === "p" && texto(e) === "scrutiniums.com"), "scrutiniums.com 42"),
    ]) {
      const en = documento(OTP_LIBERADO, "en");
      alterar(en);
      verificarPaginaSms(en, OTP_LIBERADO);
      const antes = [serialize(pt), serialize(en)];
      expect(() => verificarEntradaTraduzida(pt, en)).toThrow();
      expect([serialize(pt), serialize(en)]).toEqual(antes);
    }
  });

  it("recusa ID fora do formato React mesmo com label resolvida", () => {
    const en = documento(SOLICITACAO, "en", { ...IDS_EN, telefone: "telefone-fixo" });
    expect(() => verificarPaginaSms(en, SOLICITACAO)).toThrow();
  });
});
