import { expect } from "vitest";
import { attr, elementos, oculto, tag, texto, unico, type No } from "./i18n-dom";
import { verificarSeletorIdioma } from "./i18n-auth";

export const CAMINHOS_SMS = ["/entrar/sms", "/entrar/sms/verificar"] as const;
export type CaminhoSms = typeof CAMINHOS_SMS[number];
export type EstadoSms = "inicial" | "vazio";
export type ComparacaoSms =
  | { caminho: "/entrar/sms"; estado: EstadoSms; contador?: never }
  | { caminho: "/entrar/sms/verificar"; estado: EstadoSms; contador: "30s" | "liberado" };

/** Textos literais esperados em cada idioma; as duas telas têm tradução publicada. */
const TEXTOS = {
  pt: {
    marca: ["/", "Scrutiniums — página inicial"], criar: ["/cadastro", "Criar acesso"],
    rodape: [["/termos", "Termos de uso"], ["/privacidade", "Privacidade"]], rotuloSeletor: "Idioma", portugues: "Português", ingles: "Inglês",
    h1Sms: "Entrar com código por SMS", h1Otp: "Código de acesso", pais: "País", telefone: "Telefone celular", codigo: "Código recebido por SMS",
    erroTelefone: "Informe um telefone válido com DDD.", erroCodigo: "Informe o código de 6 dígitos.",
    submitSms: "Receber código por SMS", submitOtp: "Entrar", paises: [["BR", "Brasil (+55)"]],
    destino: "Se houver cadastro para +55 •• •••••-5678, você receberá um código de 6 dígitos por SMS.", destinoInicio: "Se houver cadastro para",
    reenviarEm: "Reenviar código em 30s", reenviar: "Reenviar código",
    linksOtp: [["/entrar/sms", "Alterar telefone"]],
    linksSms: [["/entrar", "Entrar com e-mail e senha"], ["/cadastro", "Ainda não tenho cadastro"]],
  },
  en: {
    marca: ["/en", "Scrutiniums home page"], criar: ["/cadastro", "Sign up"],
    rodape: [["/termos", "Terms of use"], ["/privacidade", "Privacy"]], rotuloSeletor: "Language", portugues: "Portuguese", ingles: "English",
    h1Sms: "Sign in with an SMS code", h1Otp: "Access code", pais: "Country", telefone: "Mobile phone", codigo: "Code received by SMS",
    erroTelefone: "Enter a valid phone number with area code.", erroCodigo: "Enter the 6-digit code.",
    submitSms: "Get a code by SMS", submitOtp: "Sign in", paises: [["BR", "Brazil (+55)"]],
    destino: "If there is an account for +55 •• •••••-5678, you will receive a 6-digit code by SMS.", destinoInicio: "If there is an account for",
    reenviarEm: "Resend code in 30s", reenviar: "Resend code",
    linksOtp: [["/en/entrar/sms", "Change phone number"]],
    linksSms: [["/en/entrar", "Sign in with email and password"], ["/cadastro", "I don't have an account yet"]],
  },
} as const;

function dentro(no: No, ancestral: No): boolean {
  return no === ancestral || ("parentNode" in no && no.parentNode !== null && dentro(no.parentNode, ancestral));
}

/** Controles SMS sem name: identidade explícita por tag, tipo, label e ordem. */
export function verificarPaginaSms(doc: No, cenario: ComparacaoSms): void {
  const { caminho, estado } = cenario;
  expect(CAMINHOS_SMS).toContain(caminho);
  expect(["inicial", "vazio"]).toContain(estado);
  const otp = caminho === "/entrar/sms/verificar";
  if (otp) expect(["30s", "liberado"]).toContain(cenario.contador);
  else expect(cenario.contador).toBeUndefined();
  const idioma = attr(tag(doc, "html"), "lang");
  expect(["pt-BR", "en"]).toContain(idioma);
  const todos = elementos(doc);
  const ids = todos.filter((e) => attr(e, "id") !== undefined);
  expect(new Set(ids.map((e) => attr(e, "id"))).size, "IDs únicos no documento inteiro").toBe(ids.length);
  for (const no of todos) {
    for (const nome of ["for", "aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "aria-errormessage"]) {
      const valor = attr(no, nome);
      if (valor === undefined) continue;
      const referencias = valor.trim().split(/\s+/);
      expect(referencias.every(Boolean), `${nome} não vazio`).toBe(true);
      for (const id of referencias) unico(doc, (e) => attr(e, "id") === id, `${nome} resolve exatamente ${id}`);
    }
  }

  const t = TEXTOS[idioma === "en" ? "en" : "pt"];
  const header = tag(doc, "header"), main = tag(doc, "main"), footer = tag(doc, "footer");
  for (const regiao of [header, main, footer]) expect(oculto(regiao)).toBe(false);
  expect(texto(tag(main, "h1"))).toBe(otp ? t.h1Otp : t.h1Sms);
  tag(main, "section");
  unico(header, (e) => e.tagName === "a" && attr(e, "href") === t.marca[0]
    && attr(e, "aria-label") === t.marca[1], "marca do cabeçalho SMS");
  expect(texto(unico(header, (e) => e.tagName === "a" && attr(e, "href") === t.criar[0], "criar acesso"))).toBe(t.criar[1]);
  verificarSeletorIdioma(header, { rotulo: t.rotuloSeletor, links: [["pt-BR", caminho, t.portugues], ["en", "/en" + caminho, t.ingles]] });
  expect(elementos(footer).filter((e) => e.tagName === "a").map((e) => [attr(e, "href"), texto(e)]))
    .toEqual(t.rodape.map((l) => [...l]));
  expect(texto(footer)).toContain("scrutiniums.com");
  // tradução publicada: nenhuma ilha portuguesa nem aviso em nenhum dos idiomas
  expect(todos.filter((e) => attr(e, "data-i18n-estado") !== undefined || attr(e, "data-i18n-aviso") !== undefined)).toHaveLength(0);

  const form = tag(doc, "form");
  expect(dentro(form, main) && !oculto(form)).toBe(true);
  expect(attr(form, "novalidate")).toBe("");
  expect(attr(form, "action")).toBeUndefined();
  expect(attr(form, "method")).toBeUndefined();
  const controles = todos.filter((e) => ["input", "select", "textarea"].includes(e.tagName));
  expect(controles.map((e) => [e.tagName, attr(e, "type")])).toEqual(otp ? [["input", "text"]] : [["select", undefined], ["input", "tel"]]);
  expect(controles.every((e) => dentro(e, form) && !oculto(e))).toBe(true);
  const labels = todos.filter((e) => e.tagName === "label");
  expect(labels).toHaveLength(controles.length);
  expect(labels.every((e) => dentro(e, form) && !oculto(e))).toBe(true);
  for (const [i, controle] of controles.entries()) {
    const id = attr(controle, "id");
    expect(id, "useId do controle SMS").toMatch(/^:[Rr][0-9a-v]+:$/);
    const label = unico(form, (e) => e.tagName === "label" && attr(e, "for") === id, "label do controle SMS");
    expect(texto(label)).toBe(otp ? t.codigo : i === 0 ? t.pais : t.telefone);
    for (const nome of ["name", "required", "disabled"]) expect(attr(controle, nome), nome).toBeUndefined();
  }
  const input = tag(form, "input");
  expect(attr(input, "value")).toBe("");
  expect(attr(input, "inputmode")).toBe(otp ? "numeric" : "tel");
  expect(attr(input, "autocomplete")).toBe(otp ? "one-time-code" : "tel-national");
  expect(attr(input, "placeholder")).toBe(otp ? "••••••" : "(11) 91234-5678");
  expect(attr(input, "maxlength")).toBe(otp ? "6" : undefined);
  expect(attr(input, "pattern")).toBe(otp ? "[0-9]{6}" : undefined);
  const alertas = todos.filter((e) => attr(e, "role") === "alert");
  expect(alertas).toHaveLength(estado === "vazio" ? 1 : 0);
  if (estado === "vazio") {
    expect(attr(input, "aria-invalid")).toBe("true");
    const idErro = `${attr(input, "id")}-erro`;
    expect(attr(input, "aria-describedby")).toBe(idErro);
    const erro = unico(form, (e) => attr(e, "id") === idErro, "erro do próprio input");
    expect(erro.tagName).toBe("p");
    expect(attr(erro, "role")).toBe("alert");
    expect(oculto(erro)).toBe(false);
    expect(texto(erro)).toBe(otp ? t.erroCodigo : t.erroTelefone);
  } else {
    expect(attr(input, "aria-invalid")).toBeUndefined();
    expect(attr(input, "aria-describedby")).toBeUndefined();
  }
  const botoes = todos.filter((e) => e.tagName === "button");
  expect(botoes).toHaveLength(otp ? 2 : 1);
  expect(botoes.every((e) => dentro(e, form) && !oculto(e))).toBe(true);
  const submit = unico(form, (e) => e.tagName === "button" && attr(e, "type") === "submit", "submit SMS");
  expect(attr(submit, "disabled")).toBeUndefined();
  expect(texto(submit)).toBe(otp ? t.submitOtp : t.submitSms);
  const links = elementos(form).filter((e) => e.tagName === "a").map((e) => [attr(e, "href"), texto(e)]);
  if (otp) {
    expect(texto(unico(form, (e) => e.tagName === "p" && texto(e).includes(t.destinoInicio), "destino mascarado")))
      .toBe(t.destino);
    const reenviar = unico(form, (e) => e.tagName === "button" && attr(e, "type") === "button", "reenvio SMS");
    expect(attr(reenviar, "aria-live")).toBe("polite");
    expect(texto(reenviar)).toBe(cenario.contador === "30s" ? t.reenviarEm : t.reenviar);
    expect(attr(reenviar, "disabled")).toBe(cenario.contador === "30s" ? "" : undefined);
    expect(links).toEqual(t.linksOtp.map((l) => [...l]));
    expect(todos.filter((e) => e.tagName === "option")).toHaveLength(0);
  } else {
    const pais = tag(form, "select");
    for (const nome of ["multiple", "aria-invalid", "aria-describedby"]) expect(attr(pais, nome), nome).toBeUndefined();
    const opcoes = todos.filter((e) => e.tagName === "option");
    expect(opcoes.every((e) => e.parentNode === pais && attr(e, "disabled") === undefined)).toBe(true);
    expect(opcoes.map((e) => [attr(e, "value"), texto(e)])).toEqual(t.paises.map((p) => [...p]));
    expect(opcoes.map((e) => attr(e, "selected"))).toEqual([""]);
    expect(links).toEqual(t.linksSms.map((l) => [...l]));
  }
}
