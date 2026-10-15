import { parse, serialize } from "parse5";
import { describe, expect, it } from "vitest";
import { verificarPaginaSms, type ComparacaoSms } from "./suporte/i18n-sms";
import { verificarFallbackDinamico, type CapturaAnunciador } from "./suporte/i18n-dinamico";
import { attr, elementos, filhos, texto, type Elemento, type No } from "./suporte/i18n-dom";

// IDs capturados no build real: a moldura EN muda o caminho React dos controles.
const IDS = { pais: ":R2ijttsq:", telefone: ":R3ijttsq:", otp: ":R1ujtttsq:" };
const IDS_EN = { pais: ":Raajtttsq:", telefone: ":Reajtttsq:", otp: ":R7qjttttsq:" };
const PAISES = [["BR", "Brasil (+55)"]] as const;
const SOLICITACAO: ComparacaoSms = { caminho: "/entrar/sms", estado: "inicial" };
const SOLICITACAO_VAZIA: ComparacaoSms = { caminho: "/entrar/sms", estado: "vazio" };
const OTP_30: ComparacaoSms = { caminho: "/entrar/sms/verificar", estado: "inicial", contador: "30s" };
const OTP_LIBERADO: ComparacaoSms = { caminho: "/entrar/sms/verificar", estado: "inicial", contador: "liberado" };
const OTP_VAZIO: ComparacaoSms = { caminho: "/entrar/sms/verificar", estado: "vazio", contador: "liberado" };

/** IDs e atributos literais; a fixture não projeta ou normaliza o DOM inglês. */
function documento(cenario: ComparacaoSms, idioma: "pt" | "en" = "pt", ids = IDS) {
  const solicitar = cenario.caminho === "/entrar/sms";
  const titulo = solicitar ? "Entrar com código por SMS" : "Código de acesso";
  const id = solicitar ? ids.telefone : ids.otp;
  const erro = cenario.estado === "vazio";
  const atributosErro = erro ? ` aria-invalid="true" aria-describedby="${id}-erro"` : "";
  const alerta = erro ? `<p id="${id}-erro" role="alert">${solicitar ? "Informe um telefone válido com DDD." : "Informe o código de 6 dígitos."}</p>` : "";
  let formulario: string;
  if (cenario.caminho === "/entrar/sms") {
    const opcoes = PAISES.map(([valor, nome]) => `<option value="${valor}"${valor === "BR" ? ' selected=""' : ""}>${nome}</option>`).join("");
    formulario = `<div><label for="${ids.pais}">País</label><select id="${ids.pais}">${opcoes}</select></div>`
      + `<div><label for="${id}">Telefone celular</label><input id="${id}" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(11) 91234-5678" value=""${atributosErro}>${alerta}</div>`
      + '<button type="submit">Receber código por SMS</button><div><a href="/entrar">Entrar com e-mail e senha</a><a href="/cadastro">Ainda não tenho cadastro</a></div>';
  } else {
    formulario = '<p>Se houver cadastro para <span class="font-medium text-carvao">+55 •• •••••-5678</span>, você receberá um código de 6 dígitos por SMS.</p>'
      + `<div><label for="${id}">Código recebido por SMS</label><input id="${id}" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="••••••" value=""${atributosErro}>${alerta}</div>`
      + `<button type="submit">Entrar</button><div><button type="button" aria-live="polite"${cenario.contador === "30s" ? ' disabled=""' : ""}>${cenario.contador === "30s" ? "Reenviar código em 30s" : "Reenviar código"}</button><a href="/entrar/sms">Alterar telefone</a></div>`;
  }
  const header = '<header><a href="/" aria-label="Scrutiniums — página inicial">Scrutiniums</a><a href="/cadastro">Criar acesso</a>'
    + "</header>";
  const introducao = solicitar
    ? '<p>Enviamos um código por SMS para o telefone cadastrado.</p><p>Use também este caminho se esqueceu sua senha: depois de entrar, defina uma nova em Conta.</p>'
    : '<p>Enviamos um código de acesso por SMS ao telefone cadastrado.</p>';
  const produto = `<div>${header}<main><section><h1>${titulo}</h1>${introducao}<form novalidate>${formulario}</form></section></main>`
    + '<footer><p>scrutiniums.com</p><p><a href="/termos">Termos de uso</a> · <a href="/privacidade">Privacidade</a></p></footer></div>';
  const corpo = idioma === "en" ? `<p data-i18n-aviso lang="en">Portuguese only</p><div data-i18n-estado="portugues_marcado" lang="pt-BR">${produto}</div>` : produto;
  return parse(`<html lang="${idioma === "en" ? "en" : "pt-BR"}"><head><title>${idioma === "en" ? "Scrutiniums · Portuguese only" : titulo + " · Scrutiniums"}</title></head><body>${corpo}<next-route-announcer style="position: absolute;"></next-route-announcer></body></html>`);
}

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
  it.each(cenarios)("preserva PT/EN e os originais: %j", (cenario) => {
    const pt = documento(cenario), en = documento(cenario, "en", IDS_EN);
    const antes = [serialize(pt), serialize(en)];
    expect(attr(input(pt), "id")).not.toBe(attr(input(en), "id"));
    verificarPaginaSms(pt, cenario);
    verificarPaginaSms(en, cenario);
    verificarFallbackDinamico(pt, en, anunciador("pt-BR"), anunciador("en"), cenario);
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
    { nome: "contador inicial em 29", cenario: OTP_30, alterar: (doc) => substituirTexto(reenvio(doc), "Reenviar código em 29s") },
    { nome: "contador liberado ainda bloqueado", cenario: OTP_LIBERADO, alterar: (doc) => atributo(reenvio(doc), "disabled", "") },
    { nome: "contador inicial habilitado", cenario: OTP_30, alterar: (doc) => atributo(reenvio(doc), "disabled") },
    { nome: "aria-live do contador alterado", cenario: OTP_30, alterar: (doc) => atributo(reenvio(doc), "aria-live", "off") },
  ];
  it.each(adulteracoes)("reprova $nome", ({ cenario, alterar }) => {
    const pt = documento(cenario), doc = documento(cenario, "en", IDS_EN);
    alterar(doc);
    const antes = [serialize(pt), serialize(doc)];
    expect(() => verificarPaginaSms(doc, cenario)).toThrow();
    expect(() => verificarFallbackDinamico(pt, doc, anunciador("pt-BR"), anunciador("en"), cenario)).toThrow();
    expect([serialize(pt), serialize(doc)]).toEqual(antes);
  });

  it("mantém IDs estritos sem opção e admite a bijeção somente no cenário SMS explícito", () => {
    const pt = documento(SOLICITACAO_VAZIA);
    const en = documento(SOLICITACAO_VAZIA, "en", IDS_EN);
    verificarPaginaSms(pt, SOLICITACAO_VAZIA);
    verificarPaginaSms(en, SOLICITACAO_VAZIA);
    const antes = [serialize(pt), serialize(en)];
    expect(() => verificarFallbackDinamico(pt, en, anunciador("pt-BR"), anunciador("en"))).toThrow();
    verificarFallbackDinamico(pt, en, anunciador("pt-BR"), anunciador("en"), SOLICITACAO_VAZIA);
    expect([serialize(pt), serialize(en)]).toEqual(antes);
  });

  it("a comparação integral recusa atributo e texto adicionais fora das asserções locais", () => {
    const pt = documento(OTP_LIBERADO);
    for (const alterar of [
      (doc: No) => atributo(input(doc), "data-extra", "preservar"),
      (doc: No) => substituirTexto(encontrar(doc, (e) => e.tagName === "p" && texto(e) === "scrutiniums.com"), "scrutiniums.com Texto adicional 42."),
    ]) {
      const en = documento(OTP_LIBERADO, "en", IDS_EN);
      alterar(en);
      verificarPaginaSms(en, OTP_LIBERADO);
      const antes = [serialize(pt), serialize(en)];
      expect(() => verificarFallbackDinamico(pt, en, anunciador("pt-BR"), anunciador("en"), OTP_LIBERADO)).toThrow();
      expect([serialize(pt), serialize(en)]).toEqual(antes);
    }
  });

  it("não adapta ID adicional fora dos controles conhecidos", () => {
    const pt = documento(OTP_LIBERADO), en = documento(OTP_LIBERADO, "en", IDS_EN);
    atributo(encontrar(en, (e) => e.tagName === "footer"), "id", ":Rf:");
    verificarPaginaSms(en, OTP_LIBERADO);
    const antes = [serialize(pt), serialize(en)];
    expect(() => verificarFallbackDinamico(pt, en, anunciador("pt-BR"), anunciador("en"), OTP_LIBERADO)).toThrow();
    expect([serialize(pt), serialize(en)]).toEqual(antes);
  });

  it("conserva aria-controls literal mesmo apontando outro controle conhecido", () => {
    const pt = documento(SOLICITACAO), en = documento(SOLICITACAO, "en", IDS_EN);
    atributo(input(pt), "aria-controls", IDS.pais);
    atributo(input(en), "aria-controls", IDS_EN.pais);
    verificarPaginaSms(pt, SOLICITACAO);
    verificarPaginaSms(en, SOLICITACAO);
    const antes = [serialize(pt), serialize(en)];
    expect(() => verificarFallbackDinamico(pt, en, anunciador("pt-BR"), anunciador("en"), SOLICITACAO)).toThrow();
    expect([serialize(pt), serialize(en)]).toEqual(antes);
  });

  it("recusa ID fora do formato React mesmo com label resolvida", () => {
    const pt = documento(SOLICITACAO);
    const en = documento(SOLICITACAO, "en", { ...IDS_EN, telefone: "telefone-fixo" });
    const antes = [serialize(pt), serialize(en)];
    expect(() => verificarPaginaSms(en, SOLICITACAO)).toThrow();
    expect(() => verificarFallbackDinamico(pt, en, anunciador("pt-BR"), anunciador("en"), SOLICITACAO)).toThrow();
    expect([serialize(pt), serialize(en)]).toEqual(antes);
  });
});
