import { expect } from "vitest";
import { attr, conteudo, elementos, filhos, oculto, tag, texto, unico, type Elemento, type Forma, type No } from "./i18n-dom";

export const CAMINHOS_SMS = ["/entrar/sms", "/entrar/sms/verificar"] as const;
export type CaminhoSms = typeof CAMINHOS_SMS[number];
export type EstadoSms = "inicial" | "vazio";
export type ComparacaoSms =
  | { caminho: "/entrar/sms"; estado: EstadoSms; contador?: never }
  | { caminho: "/entrar/sms/verificar"; estado: EstadoSms; contador: "30s" | "liberado" };

const PAISES = [
  ["BR", "Brasil (+55)"], ["PT", "Portugal (+351)"], ["US", "Estados Unidos (+1)"],
  ["AR", "Argentina (+54)"], ["CL", "Chile (+56)"], ["CO", "Colômbia (+57)"],
  ["MX", "México (+52)"], ["GB", "Reino Unido (+44)"], ["ES", "Espanha (+34)"],
  ["FR", "França (+33)"], ["DE", "Alemanha (+49)"], ["IT", "Itália (+39)"],
] as const;

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

  const header = tag(doc, "header"), main = tag(doc, "main"), footer = tag(doc, "footer");
  for (const regiao of [header, main, footer]) expect(oculto(regiao)).toBe(false);
  expect(texto(tag(main, "h1"))).toBe(otp ? "Código de acesso" : "Entrar com código por SMS");
  tag(main, "section");
  unico(header, (e) => e.tagName === "a" && attr(e, "href") === "/"
    && attr(e, "aria-label") === "Scrutiniums — página inicial", "marca do cabeçalho SMS");
  expect(texto(unico(header, (e) => e.tagName === "a" && attr(e, "href") === "/cadastro", "criar acesso"))).toBe("Criar acesso");
  expect(elementos(header).filter((e) => attr(e, "hreflang") === "en" || attr(e, "aria-label") === "Idioma")).toEqual([]);
  expect(elementos(footer).filter((e) => e.tagName === "a").map((e) => [attr(e, "href"), texto(e)]))
    .toEqual([["/termos", "Termos de uso"], ["/privacidade", "Privacidade"]]);
  expect(texto(footer)).toContain("scrutiniums.com");
  if (idioma === "en") {
    const ilha = unico(doc, (e) => attr(e, "data-i18n-estado") !== undefined, "ilha SMS");
    const aviso = unico(doc, (e) => attr(e, "data-i18n-aviso") !== undefined, "aviso SMS");
    expect(attr(ilha, "data-i18n-estado")).toBe("portugues_marcado");
    expect(attr(ilha, "lang")).toBe("pt-BR");
    expect(attr(aviso, "lang")).toBe("en");
    expect(texto(aviso).trim()).toBe("Portuguese only");
    expect(oculto(aviso) || oculto(ilha)).toBe(false);
    expect([header, main, footer].every((e) => dentro(e, ilha)), "shell inteiro na ilha").toBe(true);
    const irmaos = filhos(ilha.parentNode!).filter((e): e is Elemento => "tagName" in e);
    expect(irmaos[irmaos.indexOf(ilha) - 1]).toBe(aviso);
  } else {
    expect(todos.filter((e) => attr(e, "data-i18n-estado") !== undefined || attr(e, "data-i18n-aviso") !== undefined)).toHaveLength(0);
  }

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
    expect(texto(label)).toBe(otp ? "Código recebido por SMS" : i === 0 ? "País" : "Telefone celular");
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
    expect(texto(erro)).toBe(otp ? "Informe o código de 6 dígitos." : "Informe um telefone válido com DDD.");
  } else {
    expect(attr(input, "aria-invalid")).toBeUndefined();
    expect(attr(input, "aria-describedby")).toBeUndefined();
  }
  const botoes = todos.filter((e) => e.tagName === "button");
  expect(botoes).toHaveLength(otp ? 2 : 1);
  expect(botoes.every((e) => dentro(e, form) && !oculto(e))).toBe(true);
  const submit = unico(form, (e) => e.tagName === "button" && attr(e, "type") === "submit", "submit SMS");
  expect(attr(submit, "disabled")).toBeUndefined();
  expect(texto(submit)).toBe(otp ? "Entrar" : "Receber código por SMS");
  const links = elementos(form).filter((e) => e.tagName === "a").map((e) => [attr(e, "href"), texto(e)]);
  if (otp) {
    expect(texto(unico(form, (e) => e.tagName === "p" && texto(e).includes("Se houver cadastro para"), "destino mascarado")))
      .toBe("Se houver cadastro para +55 •• •••••-5678, você receberá um código de 6 dígitos por SMS.");
    const reenviar = unico(form, (e) => e.tagName === "button" && attr(e, "type") === "button", "reenvio SMS");
    expect(attr(reenviar, "aria-live")).toBe("polite");
    expect(texto(reenviar)).toBe(cenario.contador === "30s" ? "Reenviar código em 30s" : "Reenviar código");
    expect(attr(reenviar, "disabled")).toBe(cenario.contador === "30s" ? "" : undefined);
    expect(links).toEqual([["/entrar/sms", "Alterar telefone"]]);
    expect(todos.filter((e) => e.tagName === "option")).toHaveLength(0);
  } else {
    const pais = tag(form, "select");
    for (const nome of ["multiple", "aria-invalid", "aria-describedby"]) expect(attr(pais, nome), nome).toBeUndefined();
    const opcoes = todos.filter((e) => e.tagName === "option");
    expect(opcoes.every((e) => e.parentNode === pais && attr(e, "disabled") === undefined)).toBe(true);
    expect(opcoes.map((e) => [attr(e, "value"), texto(e)])).toEqual(PAISES);
    expect(opcoes.map((e) => attr(e, "selected"))).toEqual(["", ...Array(11).fill(undefined)]);
    expect(links).toEqual([["/entrar", "Entrar com e-mail e senha"], ["/cadastro", "Ainda não tenho cadastro"]]);
  }
}

/** Projeta somente os useId dos controles SMS e referências comprovados no build. */
export function projetarIlhaSms(pt: No, en: No, cenario: ComparacaoSms): Forma[] {
  verificarPaginaSms(pt, cenario);
  verificarPaginaSms(en, cenario);
  expect(attr(tag(pt, "html"), "lang")).toBe("pt-BR");
  expect(attr(tag(en, "html"), "lang")).toBe("en");
  const campos = cenario.caminho === "/entrar/sms"
    ? [["select", undefined, "País"], ["input", "tel", "Telefone celular"]] as const
    : [["input", "text", "Código recebido por SMS"]] as const;
  const substituicoes = new Map<Elemento, Map<string, string>>();
  const bijecao = new Map<string, string>();
  const destinos = new Set<string>();

  function campo(doc: No, nomeTag: string, tipo: string | undefined, rotulo: string) {
    const form = tag(doc, "form"), controle = tag(form, nomeTag);
    const id = attr(controle, "id")!;
    const label = unico(form, (e) => e.tagName === "label" && attr(e, "for") === id, `label de ${rotulo}`);
    const identidade = [controle.tagName, attr(controle, "type"), texto(label)];
    expect(identidade).toEqual([nomeTag, tipo, rotulo]);
    const erro = cenario.estado === "vazio" && nomeTag === "input"
      ? unico(form, (e) => attr(e, "id") === `${id}-erro`, `erro de ${rotulo}`) : undefined;
    return { controle, label, id, identidade, erro };
  }

  for (const [nomeTag, tipo, rotulo] of campos) {
    const campoPt = campo(pt, nomeTag, tipo, rotulo), campoEn = campo(en, nomeTag, tipo, rotulo);
    expect(campoEn.identidade).toEqual(campoPt.identidade);
    expect(bijecao.has(campoEn.id) || destinos.has(campoPt.id), "bijeção SMS sem colisões").toBe(false);
    bijecao.set(campoEn.id, campoPt.id);
    destinos.add(campoPt.id);
    const atributosControle = new Map([["id", campoPt.id]]);
    if (campoEn.erro) {
      atributosControle.set("aria-describedby", `${campoPt.id}-erro`);
      substituicoes.set(campoEn.erro, new Map([["id", `${campoPt.id}-erro`]]));
    }
    substituicoes.set(campoEn.controle, atributosControle);
    substituicoes.set(campoEn.label, new Map([["for", campoPt.id]]));
  }
  expect(bijecao.size).toBe(campos.length);
  expect(destinos.size).toBe(campos.length);

  function copiar<T extends No>(no: T): T {
    if ("tagName" in no) {
      const atributos = substituicoes.get(no);
      return { ...no, attrs: no.attrs.map((a) => ({ ...a, value: atributos?.get(a.name) ?? a.value })), childNodes: no.childNodes.map((filho) => copiar(filho)) };
    }
    if ("childNodes" in no) return { ...no, childNodes: no.childNodes.map((filho) => copiar(filho)) };
    return { ...no };
  }
  const ilha = unico(en, (e) => attr(e, "data-i18n-estado") === "portugues_marcado", "ilha SMS validada");
  // Identidade dos nós, sem troca global de strings; números, atributos adicionais
  // e o DOM original entregue ao detector permanecem intactos.
  return conteudo(copiar(ilha));
}
